import type { Product, StockMovement } from '../types'
import { generateId } from './ids'

/**
 * Pakistani kiryana shop demo inventory.
 * IDs are stable so repeated calls won't create duplicates (bulkInsertNew skips existing).
 */

const DEMO_BASE_TS = 1_700_000_000_000 // fixed past timestamp

function product(
  id: string,
  name: string,
  aliases: string[],
  category: string,
  unit: Product['unit'],
  costPaisa: number,
  pricePaisa: number,
  stockQty: number,
  lowStockThreshold: number,
): Product {
  return {
    id,
    name,
    aliases,
    category,
    unit,
    costPaisa,
    pricePaisa,
    stockQty,
    lowStockThreshold,
    isActive: true,
    isDemo: true,
    createdAt: DEMO_BASE_TS,
    updatedAt: DEMO_BASE_TS,
  }
}

export const DEMO_PRODUCTS: Product[] = [
  product(
    'demo_atta',
    'Atta (Wheat Flour)',
    ['آٹا', 'aata', 'gehun ka atta', 'flour'],
    'Staples',
    'bag',
    14000,   // ₨140 cost
    16000,   // ₨160 sell
    45,
    10,
  ),
  product(
    'demo_milk',
    'Milk (Dairy)',
    ['دودھ', 'doodh', 'dudh', 'milk'],
    'Dairy',
    'litre',
    16000,   // ₨160/litre
    18000,
    20,
    8,
  ),
  product(
    'demo_eggs',
    'Eggs (Dozen)',
    ['انڈے', 'andey', 'anda', 'eggs'],
    'Dairy',
    'dozen',
    33000,   // ₨330/dozen
    36000,
    12,
    4,
  ),
  product(
    'demo_biscuits',
    'Sooper Biscuits',
    ['بسکٹ', 'biscuit', 'sooper', 'cookies'],
    'Snacks',
    'packet',
    1800,    // ₨18/packet
    2200,
    80,
    20,
  ),
  product(
    'demo_oil',
    'Cooking Oil (1L)',
    ['تیل', 'tail', 'khanay ka tail', 'cooking oil'],
    'Staples',
    'bottle',
    52000,   // ₨520/bottle
    58000,
    24,
    6,
  ),
  product(
    'demo_rice',
    'Basmati Rice',
    ['چاول', 'chawal', 'basmati', 'rice'],
    'Staples',
    'kg',
    28000,   // ₨280/kg
    32000,
    30,
    10,
  ),
  product(
    'demo_sugar',
    'Sugar (Cheeni)',
    ['چینی', 'cheeni', 'shakkar', 'sugar'],
    'Staples',
    'kg',
    16000,   // ₨160/kg
    18000,
    40,
    15,
  ),
  product(
    'demo_chai',
    'Chai Patti (Tea)',
    ['چائے', 'chai patti', 'tea', 'lipton', 'tapal'],
    'Beverages',
    'packet',
    55000,   // ₨550/250g packet
    62000,
    15,
    5,
  ),
  product(
    'demo_namak',
    'Salt (Namak)',
    ['نمک', 'namak', 'salt', 'table salt'],
    'Staples',
    'packet',
    5500,    // ₨55/packet
    7000,
    60,
    10,
  ),
  product(
    'demo_dishsoap',
    'Dish Soap (Vim)',
    ['وم', 'vim', 'bartan dhonay ka soap', 'dish soap'],
    'Household',
    'piece',
    5000,    // ₨50
    6500,
    30,
    8,
  ),
]

/** Generate matching opening-stock movements for demo products */
export function buildDemoStockMovements(): StockMovement[] {
  return DEMO_PRODUCTS.map(p => ({
    id: `demo_mv_${p.id}`,
    productId: p.id,
    productName: p.name,
    qtyDelta: p.stockQty,
    qtyBefore: 0,
    qtyAfter: p.stockQty,
    reason: 'demo' as const,
    note: 'Demo opening stock',
    isDemo: true,
    createdAt: DEMO_BASE_TS,
  }))
}

/** Generate a new unique stock movement id (non-demo) */
export function newMovementId(): string {
  return generateId('mv')
}
