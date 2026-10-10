/**
 * Sale service — all business logic for creating and reversing sales.
 *
 * MONEY STRATEGY
 * - All monetary values are stored as integer paisa throughout.
 * - Line totals: Math.round(qty * unitPricePaisa)  — rounds half-up to nearest paisa.
 * - Subtotal: sum of rounded line totals.
 * - Discount applied after subtotal (integer paisa, provided by caller).
 * - Grand total: subtotal − discountPaisa (never negative).
 *
 * TRANSACTION GUARANTEE
 * - createSale and reverseSale each run in a single Dexie read-write transaction.
 * - If any step throws, Dexie rolls back the entire IndexedDB transaction.
 * - Callers must NOT retry a transaction blindly after failure.
 */

import { db } from '../db'
import { generateId } from './ids'
import type { Sale, SaleItem, StockMovement, UdhaarEntry, PaymentMethod } from '../types'

// ─── Input types ──────────────────────────────────────────────────────────────

export interface SaleLineInput {
  productId: string
  qty: number
}

export interface CreateSaleInput {
  id: string          // caller must generate to prevent duplicate submission
  lines: SaleLineInput[]
  discountPaisa: number
  paymentMethod: PaymentMethod
  /** Required when paymentMethod === 'udhaar' or 'partial' */
  customerId?: string
  /** Paisa actually paid (for partial sales) */
  paidPaisa?: number
  note?: string
}

// ─── Create sale (atomic) ─────────────────────────────────────────────────────

export async function createSale(input: CreateSaleInput): Promise<Sale> {
  return db.transaction(
    'rw',
    [db.products, db.sales, db.stockMovements, db.customers, db.udhaarEntries],
    async () => {
      const now = Date.now()

      // ── 1. Validate input ────────────────────────────────────────────────
      if (!input.lines.length) throw new Error('Sale must have at least one item')
      if (input.discountPaisa < 0) throw new Error('Discount cannot be negative')
      if (
        (input.paymentMethod === 'udhaar' || input.paymentMethod === 'partial') &&
        !input.customerId
      ) {
        throw new Error('A customer is required for credit sales')
      }

      // ── 2. Re-read products inside the transaction ───────────────────────
      const productIds = input.lines.map(l => l.productId)
      const products = await db.products.bulkGet(productIds)

      // ── 3. Validate stock and build sale items ───────────────────────────
      const saleItems: SaleItem[] = []
      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i]
        const product = products[i]

        if (!product) throw new Error(`Product not found: ${line.productId}`)
        if (!product.isActive) throw new Error(`Product "${product.name}" is no longer active`)
        if (product.stockQty < line.qty) {
          throw new Error(
            `Insufficient stock for "${product.name}": available ${product.stockQty}, requested ${line.qty}`,
          )
        }
        if (line.qty <= 0) throw new Error(`Quantity must be positive for "${product.name}"`)

        const lineTotalPaisa = Math.round(line.qty * product.pricePaisa)
        saleItems.push({
          productId: product.id,
          productName: product.name,
          qty: line.qty,
          unit: product.unit,
          unitPricePaisa: product.pricePaisa,
          unitCostPaisa: product.costPaisa,
          lineTotalPaisa,
        })
      }

      // ── 4. Calculate totals ──────────────────────────────────────────────
      const subtotalPaisa = saleItems.reduce((s, i) => s + i.lineTotalPaisa, 0)
      const discount = Math.min(input.discountPaisa, subtotalPaisa) // discount ≤ subtotal
      const totalPaisa = subtotalPaisa - discount

      let paidPaisa: number
      let udhaarPaisa: number
      if (input.paymentMethod === 'cash') {
        paidPaisa = totalPaisa
        udhaarPaisa = 0
      } else if (input.paymentMethod === 'udhaar') {
        paidPaisa = 0
        udhaarPaisa = totalPaisa
      } else {
        // partial
        paidPaisa = Math.min(input.paidPaisa ?? 0, totalPaisa)
        udhaarPaisa = totalPaisa - paidPaisa
      }

      // ── 5. Write sale record ─────────────────────────────────────────────
      const sale: Sale = {
        id: input.id,
        items: saleItems,
        subtotalPaisa,
        discountPaisa: discount,
        totalPaisa,
        paidPaisa,
        udhaarPaisa,
        paymentMethod: input.paymentMethod,
        customerId: input.customerId,
        note: input.note,
        isDemo: false,
        createdAt: now,
        updatedAt: now,
      }
      await db.sales.add(sale)

      // ── 6. Deduct stock + write movements ────────────────────────────────
      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i]
        const product = products[i]!
        const qtyBefore = product.stockQty
        const qtyAfter = qtyBefore - line.qty

        await db.products.update(product.id, {
          stockQty: qtyAfter,
          updatedAt: now,
        })

        const mv: StockMovement = {
          id: generateId('mv'),
          productId: product.id,
          productName: product.name,
          qtyDelta: -line.qty,
          qtyBefore,
          qtyAfter,
          reason: 'sale',
          saleId: sale.id,
          isDemo: false,
          createdAt: now,
        }
        await db.stockMovements.add(mv)
      }

      // ── 7. Udhaar ledger entry ────────────────────────────────────────────
      if (udhaarPaisa > 0 && input.customerId) {
        const customer = await db.customers.get(input.customerId)
        if (!customer) throw new Error('Customer not found')

        const udhaarEntry: UdhaarEntry = {
          id: generateId('udh'),
          customerId: input.customerId,
          type: 'credit',
          amountPaisa: udhaarPaisa,
          saleId: sale.id,
          note: `Sale ${sale.id.slice(-6)}`,
          isDemo: false,
          createdAt: now,
        }
        await db.udhaarEntries.add(udhaarEntry)

        await db.customers.update(input.customerId, {
          udhaarBalancePaisa: customer.udhaarBalancePaisa + udhaarPaisa,
          updatedAt: now,
        })
      }

      return sale
    },
  )
}

// ─── Reverse sale (atomic) ────────────────────────────────────────────────────

export async function reverseSale(saleId: string, reason: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.products, db.sales, db.stockMovements, db.customers, db.udhaarEntries],
    async () => {
      const now = Date.now()
      const sale = await db.sales.get(saleId)
      if (!sale) throw new Error('Sale not found')
      if (sale.updatedAt !== sale.createdAt) {
        throw new Error('This sale has already been reversed')
      }

      // Mark sale as reversed (updatedAt ≠ createdAt is the sentinel)
      await db.sales.update(saleId, {
        updatedAt: now,
        note: `[REVERSED: ${reason}] ${sale.note ?? ''}`.trim(),
      })

      // Restore stock
      for (const item of sale.items) {
        const product = await db.products.get(item.productId)
        const qtyBefore = product?.stockQty ?? 0
        const qtyAfter = qtyBefore + item.qty

        if (product) {
          await db.products.update(item.productId, {
            stockQty: qtyAfter,
            updatedAt: now,
          })
        }

        const mv: StockMovement = {
          id: generateId('mv'),
          productId: item.productId,
          productName: item.productName,
          qtyDelta: item.qty,
          qtyBefore,
          qtyAfter,
          reason: 'adjustment',
          note: `Reversal of sale ${saleId.slice(-6)}: ${reason}`,
          saleId,
          isDemo: sale.isDemo,
          createdAt: now,
        }
        await db.stockMovements.add(mv)
      }

      // Reverse udhaar if applicable
      if (sale.udhaarPaisa > 0 && sale.customerId) {
        const customer = await db.customers.get(sale.customerId)
        if (customer) {
          const reverseEntry: UdhaarEntry = {
            id: generateId('udh'),
            customerId: sale.customerId,
            type: 'payment',
            amountPaisa: sale.udhaarPaisa,
            saleId,
            note: `Reversal of sale ${saleId.slice(-6)}: ${reason}`,
            isDemo: sale.isDemo,
            createdAt: now,
          }
          await db.udhaarEntries.add(reverseEntry)
          await db.customers.update(sale.customerId, {
            udhaarBalancePaisa: Math.max(0, customer.udhaarBalancePaisa - sale.udhaarPaisa),
            updatedAt: now,
          })
        }
      }
    },
  )
}
