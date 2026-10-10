// ─── Core domain types ───────────────────────────────────────────────────────

export type Language = 'en' | 'ur' | 'roman'

export type Currency = 'PKR'

/** Money stored as integer paisa (1 PKR = 100 paisa) to avoid float rounding. */
export type Paisa = number

// ─── Product / Inventory ─────────────────────────────────────────────────────

export const UNIT_TYPES = [
  'piece', 'packet', 'kg', 'gram', 'litre', 'ml', 'dozen', 'bag', 'bottle', 'box',
] as const

export type UnitType = typeof UNIT_TYPES[number]

export const UNIT_LABELS: Record<UnitType, string> = {
  piece: 'Piece',
  packet: 'Packet',
  kg: 'Kg',
  gram: 'Gram',
  litre: 'Litre',
  ml: 'ml',
  dozen: 'Dozen',
  bag: 'Bag',
  bottle: 'Bottle',
  box: 'Box',
}

export interface Product {
  id: string
  name: string
  /** Roman Urdu / Urdu aliases for fuzzy search */
  aliases: string[]
  category: string
  unit: UnitType
  /** Current unit cost (purchase price) in paisa */
  costPaisa: number
  /** Current selling price in paisa */
  pricePaisa: number
  /** Current stock quantity (can be fractional for weight-based) */
  stockQty: number
  /** Alert threshold – notify when stock drops to this level */
  lowStockThreshold: number
  /** Optional: how many days of stock to target (for reorder guidance) */
  targetDays?: number
  isActive: boolean
  isDemo: boolean
  createdAt: number  // epoch ms
  updatedAt: number
}

// ─── Stock Movements ─────────────────────────────────────────────────────────

export type StockMovementReason =
  | 'sale'
  | 'purchase'        // restock
  | 'adjustment'      // manual correction
  | 'damage'
  | 'opening_stock'   // initial entry
  | 'demo'

export interface StockMovement {
  id: string
  productId: string
  productName: string
  /** Positive = stock in, negative = stock out */
  qtyDelta: number
  qtyBefore: number
  qtyAfter: number
  reason: StockMovementReason
  note?: string
  saleId?: string
  isDemo: boolean
  createdAt: number
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export interface SaleItem {
  productId: string
  productName: string
  qty: number
  unit: UnitType
  /** Price snapshot at time of sale (paisa) */
  unitPricePaisa: number
  /** Cost snapshot at time of sale (paisa) */
  unitCostPaisa: number
  /** qty × unitPricePaisa */
  lineTotalPaisa: number
}

export type PaymentMethod = 'cash' | 'udhaar' | 'partial'

export interface Sale {
  id: string
  items: SaleItem[]
  subtotalPaisa: number
  discountPaisa: number
  totalPaisa: number
  paidPaisa: number
  udhaarPaisa: number
  paymentMethod: PaymentMethod
  customerId?: string
  note?: string
  isDemo: boolean
  createdAt: number
  updatedAt: number
}

// ─── Customers ───────────────────────────────────────────────────────────────

export interface Customer {
  id: string
  name: string
  phone?: string
  address?: string
  /** Running udhaar balance in paisa (positive = customer owes shop) */
  udhaarBalancePaisa: number
  isActive: boolean
  isDemo: boolean
  createdAt: number
  updatedAt: number
}

// ─── Udhaar ledger ───────────────────────────────────────────────────────────

export type UdhaarEntryType = 'credit' | 'payment'

export interface UdhaarEntry {
  id: string
  customerId: string
  type: UdhaarEntryType
  amountPaisa: number
  saleId?: string
  note?: string
  isDemo: boolean
  createdAt: number
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export interface Expense {
  id: string
  description: string
  category: string
  amountPaisa: number
  note?: string
  isDemo: boolean
  createdAt: number
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface ShopSettings {
  shopName: string
  ownerName?: string
  phone?: string
  address?: string
  language: Language
  lowStockThreshold: number
  showDemoData: boolean
}

export const DEFAULT_SETTINGS: ShopSettings = {
  shopName: 'میری دکان',
  language: 'en',
  lowStockThreshold: 5,
  showDemoData: true,
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

export type SortField = 'name' | 'stockQty' | 'stockValue' | 'pricePaisa' | 'updatedAt'
export type SortDir = 'asc' | 'desc'

export type StockFilter = 'all' | 'low' | 'out'
