/**
 * Backup and export utilities for DukaanIQ data.
 */

import { db } from '../db'
import { z } from 'zod'

const backupSchema = z.object({
  version: z.literal(1),
  timestamp: z.number(),
  data: z.object({
    products: z.array(z.any()),
    sales: z.array(z.any()),
    customers: z.array(z.any()),
    udhaarEntries: z.array(z.any()),
    stockMovements: z.array(z.any()).optional(),
    expenses: z.array(z.any()).optional(),
  }),
})

export type BackupData = z.infer<typeof backupSchema>

export async function exportToJSON(): Promise<string> {
  const [products, sales, customers, udhaarEntries, stockMovements, expenses] = await Promise.all([
    db.products.toArray(),
    db.sales.toArray(),
    db.customers.toArray(),
    db.udhaarEntries.toArray(),
    db.stockMovements.toArray(),
    db.expenses.toArray(),
  ])

  const backup: BackupData = {
    version: 1,
    timestamp: Date.now(),
    data: { products, sales, customers, udhaarEntries, stockMovements, expenses },
  }

  return JSON.stringify(backup, null, 2)
}

export function downloadJSON(json: string, filename = 'dukaaniq-backup-' + Date.now() + '.json') {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function validateBackup(jsonString: string): Promise<{ valid: boolean; error?: string; data?: BackupData }> {
  try {
    const parsed = JSON.parse(jsonString)
    const validated = backupSchema.parse(parsed)
    return { valid: true, data: validated }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { valid: false, error: 'Invalid backup format: ' + e.issues[0].message }
    }
    return { valid: false, error: e instanceof Error ? e.message : 'Invalid JSON' }
  }
}

export async function importFromJSON(backup: BackupData, mode: 'replace' | 'merge' = 'replace'): Promise<void> {
  if (mode === 'replace') {
    await db.transaction('rw', [db.products, db.sales, db.customers, db.udhaarEntries, db.stockMovements, db.expenses], async () => {
      await db.products.clear()
      await db.sales.clear()
      await db.customers.clear()
      await db.udhaarEntries.clear()
      await db.stockMovements.clear()
      await db.expenses.clear()

      if (backup.data.products.length) await db.products.bulkPut(backup.data.products)
      if (backup.data.sales.length) await db.sales.bulkPut(backup.data.sales)
      if (backup.data.customers.length) await db.customers.bulkPut(backup.data.customers)
      if (backup.data.udhaarEntries.length) await db.udhaarEntries.bulkPut(backup.data.udhaarEntries)
      if (backup.data.stockMovements?.length) await db.stockMovements.bulkPut(backup.data.stockMovements)
      if (backup.data.expenses?.length) await db.expenses.bulkPut(backup.data.expenses)
    })
  } else {
    await db.transaction('rw', [db.products, db.sales, db.customers, db.udhaarEntries, db.stockMovements, db.expenses], async () => {
      const existingProductIds = new Set((await db.products.toCollection().primaryKeys()) as string[])
      const newProducts = backup.data.products.filter((p: any) => !existingProductIds.has(p.id))
      if (newProducts.length) await db.products.bulkPut(newProducts)

      const existingSaleIds = new Set((await db.sales.toCollection().primaryKeys()) as string[])
      const newSales = backup.data.sales.filter((s: any) => !existingSaleIds.has(s.id))
      if (newSales.length) await db.sales.bulkPut(newSales)

      const existingCustomerIds = new Set((await db.customers.toCollection().primaryKeys()) as string[])
      const newCustomers = backup.data.customers.filter((c: any) => !existingCustomerIds.has(c.id))
      if (newCustomers.length) await db.customers.bulkPut(newCustomers)

      const existingUdhaarIds = new Set((await db.udhaarEntries.toCollection().primaryKeys()) as string[])
      const newUdhaar = backup.data.udhaarEntries.filter((u: any) => !existingUdhaarIds.has(u.id))
      if (newUdhaar.length) await db.udhaarEntries.bulkPut(newUdhaar)

      if (backup.data.stockMovements?.length) {
        const existingMvIds = new Set((await db.stockMovements.toCollection().primaryKeys()) as string[])
        const newMvs = backup.data.stockMovements.filter((m: any) => !existingMvIds.has(m.id))
        if (newMvs.length) await db.stockMovements.bulkPut(newMvs)
      }

      if (backup.data.expenses?.length) {
        const existingExpIds = new Set((await db.expenses.toCollection().primaryKeys()) as string[])
        const newExps = backup.data.expenses.filter((e: any) => !existingExpIds.has(e.id))
        if (newExps.length) await db.expenses.bulkPut(newExps)
      }
    })
  }
}

export async function exportInventoryToCSV(): Promise<string> {
  const products = await db.products.toArray()
  
  const headers = ['Name', 'Category', 'Unit', 'Cost (PKR)', 'Price (PKR)', 'Stock', 'Low Stock Threshold', 'Active']
  const rows = products.map(p => [
    p.name,
    p.category,
    p.unit,
    (p.costPaisa / 100).toFixed(2),
    (p.pricePaisa / 100).toFixed(2),
    p.stockQty.toString(),
    p.lowStockThreshold.toString(),
    p.isActive ? 'Yes' : 'No',
  ])

  return [headers, ...rows].map(row => row.map(escapeCSV).join(',')).join('\n')
}

export async function exportSalesToCSV(): Promise<string> {
  const sales = await db.sales.toArray()
  const customerMap = new Map((await db.customers.toArray()).map(c => [c.id, c.name]))

  const headers = ['Sale ID', 'Date', 'Items', 'Subtotal (PKR)', 'Discount (PKR)', 'Total (PKR)', 'Payment Method', 'Customer', 'Reversed']
  const rows = sales.map(s => [
    s.id,
    new Date(s.createdAt).toISOString(),
    s.items.map(i => i.qty + 'x' + i.productName).join('; '),
    (s.subtotalPaisa / 100).toFixed(2),
    (s.discountPaisa / 100).toFixed(2),
    (s.totalPaisa / 100).toFixed(2),
    s.paymentMethod,
    s.customerId ? customerMap.get(s.customerId) || '' : '',
    s.createdAt !== s.updatedAt ? 'Yes' : 'No',
  ])

  return [headers, ...rows].map(row => row.map(escapeCSV).join(',')).join('\n')
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}