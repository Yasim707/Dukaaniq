/**
 * Sale service integration tests.
 * Each test suite gets a fresh database instance via beforeEach db.delete() + reopen.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import { createSale, reverseSale } from '../lib/saleService'
import { generateId } from '../lib/ids'
import type { Product, Customer } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function seedProduct(overrides: Partial<Product> = {}): Promise<Product> {
  const p: Product = {
    id: generateId('prod'),
    name: 'Test Rice',
    aliases: ['chawal'],
    category: 'Staples',
    unit: 'kg',
    costPaisa: 28_000,
    pricePaisa: 32_000,
    stockQty: 50,
    lowStockThreshold: 5,
    isActive: true,
    isDemo: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
  await db.products.add(p)
  return p
}

async function seedCustomer(overrides: Partial<Customer> = {}): Promise<Customer> {
  const c: Customer = {
    id: generateId('cust'),
    name: 'Ahmed Khan',
    udhaarBalancePaisa: 0,
    isActive: true,
    isDemo: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
  await db.customers.add(c)
  return c
}

beforeEach(async () => {
  // Wipe and re-open the DB before each test
  await db.delete()
  await db.open()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createSale — cash', () => {
  it('deducts stock exactly once and creates a sale record', async () => {
    const product = await seedProduct()

    const sale = await createSale({
      id: generateId('sale'),
      lines: [{ productId: product.id, qty: 3 }],
      discountPaisa: 0,
      paymentMethod: 'cash',
    })

    // Sale record saved
    expect(sale.totalPaisa).toBe(3 * product.pricePaisa)
    expect(sale.items[0].qty).toBe(3)
    expect(sale.items[0].unitPricePaisa).toBe(product.pricePaisa)
    expect(sale.items[0].unitCostPaisa).toBe(product.costPaisa)

    // Stock deducted exactly once
    const updated = await db.products.get(product.id)
    expect(updated?.stockQty).toBe(50 - 3)

    // Movement recorded
    const movements = await db.stockMovements.where('productId').equals(product.id).toArray()
    expect(movements).toHaveLength(1)
    expect(movements[0].qtyDelta).toBe(-3)
    expect(movements[0].reason).toBe('sale')

    // No udhaar
    const udhaarCount = await db.udhaarEntries.count()
    expect(udhaarCount).toBe(0)
  })

  it('calculates totals in integer paisa (line total is round)', async () => {
    // 3.33 kg × ₨100/kg = ₨333 = 33300 paisa (exact)
    const product = await seedProduct({ pricePaisa: 10_000, stockQty: 100 })

    const sale = await createSale({
      id: generateId('sale'),
      lines: [{ productId: product.id, qty: 3.33 }],
      discountPaisa: 0,
      paymentMethod: 'cash',
    })

    expect(sale.items[0].lineTotalPaisa).toBe(Math.round(3.33 * 10_000))
    expect(Number.isInteger(sale.totalPaisa)).toBe(true)
  })
})

describe('createSale — udhaar (credit)', () => {
  it('deducts stock and increases customer udhaar balance', async () => {
    const product = await seedProduct()
    const customer = await seedCustomer()

    const sale = await createSale({
      id: generateId('sale'),
      lines: [{ productId: product.id, qty: 2 }],
      discountPaisa: 0,
      paymentMethod: 'udhaar',
      customerId: customer.id,
    })

    expect(sale.udhaarPaisa).toBe(2 * product.pricePaisa)
    expect(sale.paidPaisa).toBe(0)

    // Stock deducted
    const updatedProduct = await db.products.get(product.id)
    expect(updatedProduct?.stockQty).toBe(50 - 2)

    // Udhaar entry created
    const entries = await db.udhaarEntries.where('customerId').equals(customer.id).toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0].type).toBe('credit')
    expect(entries[0].amountPaisa).toBe(2 * product.pricePaisa)

    // Customer balance updated
    const updatedCustomer = await db.customers.get(customer.id)
    expect(updatedCustomer?.udhaarBalancePaisa).toBe(2 * product.pricePaisa)
  })

  it('rejects udhaar sale without a customer', async () => {
    const product = await seedProduct()
    await expect(
      createSale({
        id: generateId('sale'),
        lines: [{ productId: product.id, qty: 1 }],
        discountPaisa: 0,
        paymentMethod: 'udhaar',
        // no customerId
      }),
    ).rejects.toThrow('customer')
  })
})

describe('createSale — insufficient stock', () => {
  it('blocks the sale and leaves DB unchanged', async () => {
    const product = await seedProduct({ stockQty: 2 })

    await expect(
      createSale({
        id: generateId('sale'),
        lines: [{ productId: product.id, qty: 10 }], // more than available
        discountPaisa: 0,
        paymentMethod: 'cash',
      }),
    ).rejects.toThrow('Insufficient stock')

    // Stock unchanged
    const unchanged = await db.products.get(product.id)
    expect(unchanged?.stockQty).toBe(2)

    // No sale record
    const saleCount = await db.sales.count()
    expect(saleCount).toBe(0)

    // No movement
    const mvCount = await db.stockMovements.count()
    expect(mvCount).toBe(0)
  })
})

describe('reverseSale', () => {
  it('restores stock and reverses udhaar in one transaction', async () => {
    const product = await seedProduct({ stockQty: 50 })
    const customer = await seedCustomer()

    const sale = await createSale({
      id: generateId('sale'),
      lines: [{ productId: product.id, qty: 5 }],
      discountPaisa: 0,
      paymentMethod: 'udhaar',
      customerId: customer.id,
    })

    // Stock was deducted: 50 - 5 = 45
    const afterSale = await db.products.get(product.id)
    expect(afterSale?.stockQty).toBe(45)

    // Customer owes the amount
    const afterSaleCust = await db.customers.get(customer.id)
    const saleUdhaar = sale.udhaarPaisa
    expect(afterSaleCust?.udhaarBalancePaisa).toBe(saleUdhaar)

    // Reverse the sale
    await reverseSale(sale.id, 'Wrong order')

    // Stock restored to 50
    const afterReversal = await db.products.get(product.id)
    expect(afterReversal?.stockQty).toBe(50)

    // Udhaar balance back to 0
    const afterReversalCust = await db.customers.get(customer.id)
    expect(afterReversalCust?.udhaarBalancePaisa).toBe(0)

    // Sale marked reversed (updatedAt differs)
    const reversedSale = await db.sales.get(sale.id)
    expect(reversedSale?.updatedAt).not.toBe(reversedSale?.createdAt)

    // A reversal udhaar entry (payment type) was added
    const entries = await db.udhaarEntries.where('customerId').equals(customer.id).toArray()
    const paymentEntry = entries.find(e => e.type === 'payment')
    expect(paymentEntry).toBeDefined()
    expect(paymentEntry?.amountPaisa).toBe(saleUdhaar)
  })

  it('prevents reversing the same sale twice', async () => {
    const product = await seedProduct()

    const sale = await createSale({
      id: generateId('sale'),
      lines: [{ productId: product.id, qty: 1 }],
      discountPaisa: 0,
      paymentMethod: 'cash',
    })

    await reverseSale(sale.id, 'First reversal')

    await expect(
      reverseSale(sale.id, 'Second attempt'),
    ).rejects.toThrow('already been reversed')
  })

  it('restores correct stock for cash sale', async () => {
    const product = await seedProduct({ stockQty: 20 })

    const sale = await createSale({
      id: generateId('sale'),
      lines: [{ productId: product.id, qty: 7 }],
      discountPaisa: 0,
      paymentMethod: 'cash',
    })

    expect((await db.products.get(product.id))?.stockQty).toBe(13)

    await reverseSale(sale.id, 'Return')

    expect((await db.products.get(product.id))?.stockQty).toBe(20)
  })
})

describe('persistence', () => {
  it('sale and stock movement survive a db close/reopen', async () => {
    const product = await seedProduct()

    const sale = await createSale({
      id: generateId('sale'),
      lines: [{ productId: product.id, qty: 4 }],
      discountPaisa: 0,
      paymentMethod: 'cash',
    })

    // Close and reopen
    db.close()
    await db.open()

    const reloadedSale = await db.sales.get(sale.id)
    expect(reloadedSale?.id).toBe(sale.id)
    expect(reloadedSale?.totalPaisa).toBe(sale.totalPaisa)

    const reloadedProduct = await db.products.get(product.id)
    expect(reloadedProduct?.stockQty).toBe(50 - 4)
  })
})
