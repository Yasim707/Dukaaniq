/**
 * Direct stock adjustment helper usable outside React hooks (e.g. the command bar).
 * Writes the new product stock and an audit StockMovement in one transaction.
 */

import { db } from '../db'
import { generateId } from './ids'
import type { StockMovement, StockMovementReason } from '../types'

export async function adjustStockDirect(
  productId: string,
  qtyDelta: number,
  reason: StockMovementReason,
  note?: string,
): Promise<void> {
  await db.transaction('rw', [db.products, db.stockMovements], async () => {
    const product = await db.products.get(productId)
    if (!product) throw new Error('Product not found')

    const qtyBefore = product.stockQty
    const qtyAfter = qtyBefore + qtyDelta
    if (qtyAfter < 0) throw new Error('Resulting stock cannot be negative')

    const now = Date.now()
    await db.products.update(productId, { stockQty: qtyAfter, updatedAt: now })

    const mv: StockMovement = {
      id: generateId('mv'),
      productId,
      productName: product.name,
      qtyDelta,
      qtyBefore,
      qtyAfter,
      reason,
      note,
      isDemo: product.isDemo,
      createdAt: now,
    }
    await db.stockMovements.add(mv)
  })
}
