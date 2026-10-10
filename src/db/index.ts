import Dexie, { type EntityTable } from 'dexie'
import type { Product, Sale, Customer, UdhaarEntry, StockMovement, Expense } from '../types'

/**
 * DukaanIQ IndexedDB database.
 *
 * VERSION RULES:
 * - Never modify a past version block — only add new ones.
 * - Indexes listed here are for *querying only*; non-indexed fields are still stored.
 * - Compound indexes use [field1+field2] syntax.
 */
class DukaanIQDatabase extends Dexie {
  products!: EntityTable<Product, 'id'>
  sales!: EntityTable<Sale, 'id'>
  customers!: EntityTable<Customer, 'id'>
  udhaarEntries!: EntityTable<UdhaarEntry, 'id'>
  stockMovements!: EntityTable<StockMovement, 'id'>
  expenses!: EntityTable<Expense, 'id'>

  constructor() {
    super('DukaanIQ')

    // v1 – original shell schema (must not change)
    this.version(1).stores({
      products: 'id, sku, barcode, category, isActive, isDemo, createdAt',
      sales: 'id, customerId, paymentMethod, isDemo, createdAt',
      customers: 'id, phone, isActive, isDemo, createdAt',
      udhaarEntries: 'id, customerId, type, saleId, isDemo, createdAt',
    })

    // v2 – expanded indexes and new tables
    this.version(2).stores({
      // products: add name index, aliases multi-entry, unit, updatedAt
      products:
        'id, name, *aliases, category, unit, isActive, isDemo, createdAt, updatedAt',

      // sales: keep existing + add updatedAt
      sales:
        'id, customerId, paymentMethod, isDemo, createdAt, updatedAt',

      // customers: add name index
      customers:
        'id, name, phone, isActive, isDemo, createdAt, updatedAt',

      // udhaar: unchanged plus updatedAt equivalent (createdAt is immutable)
      udhaarEntries:
        'id, customerId, type, saleId, isDemo, createdAt',

      // new: stock movement audit log
      stockMovements:
        'id, productId, reason, saleId, isDemo, createdAt',

      // new: expenses ledger
      expenses:
        'id, category, isDemo, createdAt',
    })
  }
}

export const db = new DukaanIQDatabase()

// ─── Error wrapper ────────────────────────────────────────────────────────────

function dbErr(op: string, err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err)
  throw new Error(`DB error [${op}]: ${msg}`)
}

// ─── Product repository ───────────────────────────────────────────────────────

export const productRepo = {
  getAll: () =>
    db.products.orderBy('name').toArray().catch(e => dbErr('products.getAll', e)),

  getActive: () =>
    db.products
      .where('isActive')
      .equals(1)
      .sortBy('name')
      .catch(e => dbErr('products.getActive', e)),

  getById: (id: string) =>
    db.products.get(id).catch(e => dbErr('products.getById', e)),

  upsert: (product: Product) =>
    db.products.put(product).catch(e => dbErr('products.upsert', e)),

  delete: (id: string) =>
    db.products.delete(id).catch(e => dbErr('products.delete', e)),

  getLowStock: () =>
    db.products
      .filter(p => p.isActive && p.stockQty > 0 && p.stockQty <= p.lowStockThreshold)
      .toArray()
      .catch(e => dbErr('products.getLowStock', e)),

  getOutOfStock: () =>
    db.products
      .filter(p => p.isActive && p.stockQty <= 0)
      .toArray()
      .catch(e => dbErr('products.getOutOfStock', e)),

  /** Search by name or alias substring (case-insensitive, client-side) */
  search: async (query: string) => {
    const q = query.toLowerCase().trim()
    if (!q) return db.products.orderBy('name').toArray()
    return db.products
      .filter(p => {
        const inName = p.name.toLowerCase().includes(q)
        const inAliases = p.aliases?.some(a => a.toLowerCase().includes(q))
        return inName || !!inAliases
      })
      .toArray()
      .catch(e => dbErr('products.search', e))
  },

  /** True if any sale references this productId */
  hasTransactions: async (productId: string): Promise<boolean> => {
    const count = await db.sales
      .filter(s => s.items.some(i => i.productId === productId))
      .count()
      .catch(e => dbErr('products.hasTransactions', e))
    return count > 0
  },

  /** Bulk insert – skips existing ids to prevent duplicates */
  bulkInsertNew: async (products: Product[]) => {
    const existing = await db.products.bulkGet(products.map(p => p.id))
    const toInsert = products.filter((_, i) => !existing[i])
    if (toInsert.length) await db.products.bulkPut(toInsert)
    return toInsert.length
  },
}

// ─── Stock movement repository ────────────────────────────────────────────────

export const stockMovementRepo = {
  getForProduct: (productId: string) =>
    db.stockMovements
      .where('productId')
      .equals(productId)
      .reverse()
      .sortBy('createdAt')
      .catch(e => dbErr('stockMovements.getForProduct', e)),

  getRecent: (limit = 50) =>
    db.stockMovements
      .orderBy('createdAt')
      .reverse()
      .limit(limit)
      .toArray()
      .catch(e => dbErr('stockMovements.getRecent', e)),

  upsert: (mv: StockMovement) =>
    db.stockMovements.put(mv).catch(e => dbErr('stockMovements.upsert', e)),

  bulkInsertNew: async (mvs: StockMovement[]) => {
    const existing = await db.stockMovements.bulkGet(mvs.map(m => m.id))
    const toInsert = mvs.filter((_, i) => !existing[i])
    if (toInsert.length) await db.stockMovements.bulkPut(toInsert)
    return toInsert.length
  },
}

// ─── Sale repository ──────────────────────────────────────────────────────────

export const saleRepo = {
  getAll: () =>
    db.sales.orderBy('createdAt').reverse().toArray().catch(e => dbErr('sales.getAll', e)),

  getById: (id: string) =>
    db.sales.get(id).catch(e => dbErr('sales.getById', e)),

  getToday: () => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return db.sales
      .where('createdAt')
      .aboveOrEqual(start.getTime())
      .toArray()
      .catch(e => dbErr('sales.getToday', e))
  },

  getRange: (fromMs: number, toMs: number) =>
    db.sales
      .where('createdAt')
      .between(fromMs, toMs)
      .toArray()
      .catch(e => dbErr('sales.getRange', e)),

  upsert: (sale: Sale) =>
    db.sales.put(sale).catch(e => dbErr('sales.upsert', e)),

  delete: (id: string) =>
    db.sales.delete(id).catch(e => dbErr('sales.delete', e)),

  countForProduct: (productId: string) =>
    db.sales
      .filter(s => s.items.some(i => i.productId === productId))
      .count()
      .catch(e => dbErr('sales.countForProduct', e)),
}

// ─── Customer repository ──────────────────────────────────────────────────────

export const customerRepo = {
  getAll: () =>
    db.customers.orderBy('name').toArray().catch(e => dbErr('customers.getAll', e)),

  getActive: () =>
    db.customers
      .where('isActive')
      .equals(1)
      .sortBy('name')
      .catch(e => dbErr('customers.getActive', e)),

  getById: (id: string) =>
    db.customers.get(id).catch(e => dbErr('customers.getById', e)),

  upsert: (customer: Customer) =>
    db.customers.put(customer).catch(e => dbErr('customers.upsert', e)),

  delete: (id: string) =>
    db.customers.delete(id).catch(e => dbErr('customers.delete', e)),
}

// ─── Udhaar repository ────────────────────────────────────────────────────────

export const udhaarRepo = {
  getAll: () =>
    db.udhaarEntries
      .orderBy('createdAt')
      .reverse()
      .toArray()
      .catch(e => dbErr('udhaar.getAll', e)),

  getForCustomer: (customerId: string) =>
    db.udhaarEntries
      .where('customerId')
      .equals(customerId)
      .reverse()
      .sortBy('createdAt')
      .catch(e => dbErr('udhaar.getForCustomer', e)),

  upsert: (entry: UdhaarEntry) =>
    db.udhaarEntries.put(entry).catch(e => dbErr('udhaar.upsert', e)),

  delete: (id: string) =>
    db.udhaarEntries.delete(id).catch(e => dbErr('udhaar.delete', e)),
}

// ─── Expense repository ───────────────────────────────────────────────────────

export const expenseRepo = {
  getAll: () =>
    db.expenses.orderBy('createdAt').reverse().toArray().catch(e => dbErr('expenses.getAll', e)),

  getRange: (fromMs: number, toMs: number) =>
    db.expenses
      .where('createdAt')
      .between(fromMs, toMs)
      .toArray()
      .catch(e => dbErr('expenses.getRange', e)),

  upsert: (expense: Expense) =>
    db.expenses.put(expense).catch(e => dbErr('expenses.upsert', e)),

  delete: (id: string) =>
    db.expenses.delete(id).catch(e => dbErr('expenses.delete', e)),

  bulkInsertNew: async (expenses: Expense[]) => {
    const existing = await db.expenses.bulkGet(expenses.map(e => e.id))
    const toInsert = expenses.filter((_, i) => !existing[i])
    if (toInsert.length) await db.expenses.bulkPut(toInsert)
    return toInsert.length
  },
}
