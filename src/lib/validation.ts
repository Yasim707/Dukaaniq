import { z } from 'zod'
import type { UnitType } from '../types'

// ─── Product form schema ──────────────────────────────────────────────────────
// Zod v4 uses object-map enums. We declare a matching UnitType enum map.

const unitEnum = z.enum({
  piece: 'piece',
  packet: 'packet',
  kg: 'kg',
  gram: 'gram',
  litre: 'litre',
  ml: 'ml',
  dozen: 'dozen',
  bag: 'bag',
  bottle: 'bottle',
  box: 'box',
} as const)

const restockReasonEnum = z.enum({
  purchase: 'purchase',
  adjustment: 'adjustment',
  damage: 'damage',
} as const)

export const productSchema = z.object({
  name: z
    .string()
    .min(1, 'Product name is required')
    .max(100, 'Name too long'),

  aliases: z
    .string()
    .max(200, 'Aliases too long')
    .optional()
    .default(''),

  category: z
    .string()
    .min(1, 'Category is required')
    .max(60, 'Category too long'),

  unit: unitEnum,

  costRupees: z
    .number()
    .min(0, 'Cost cannot be negative')
    .max(999_999, 'Cost too large'),

  priceRupees: z
    .number()
    .min(0, 'Price cannot be negative')
    .max(999_999, 'Price too large'),

  stockQty: z
    .number()
    .min(0, 'Stock cannot be negative')
    .max(999_999, 'Quantity too large'),

  lowStockThreshold: z
    .number()
    .int('Must be a whole number')
    .min(0, 'Threshold cannot be negative')
    .max(99_999, 'Threshold too large'),

  targetDays: z
    .number()
    .int('Must be a whole number')
    .min(1, 'Must be at least 1 day')
    .max(365, 'Max 365 days')
    .optional()
    .nullable(),
})

export type ProductFormValues = {
  name: string
  aliases: string
  category: string
  unit: UnitType
  costRupees: number
  priceRupees: number
  stockQty: number
  lowStockThreshold: number
  targetDays?: number | null
}

// ─── Restock / stock adjustment schema ───────────────────────────────────────

export const restockSchema = z.object({
  qtyDelta: z
    .number()
    .refine(v => v !== 0, 'Quantity change cannot be zero')
    .refine(v => Math.abs(v) <= 999_999, 'Quantity too large'),

  reason: restockReasonEnum,

  note: z.string().max(200, 'Note too long').optional().default(''),
})

export type RestockFormValues = {
  qtyDelta: number
  reason: 'purchase' | 'adjustment' | 'damage'
  note: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parseNumber(raw: string): number | undefined {
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : undefined
}
