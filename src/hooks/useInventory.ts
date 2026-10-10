import { useState, useEffect, useCallback } from 'react'
import { productRepo, stockMovementRepo } from '../db'
import { generateId } from '../lib/ids'
import { DEMO_PRODUCTS, buildDemoStockMovements } from '../lib/demoData'
import type { Product, StockMovement, StockMovementReason } from '../types'

export interface InventoryState {
  products: Product[]
  loading: boolean
  error: string | null
}

export function useInventory() {
  const [state, setState] = useState<InventoryState>({
    products: [],
    loading: true,
    error: null,
  })

  const reload = useCallback(async () => {
    try {
      const products = await productRepo.getAll()
      setState({ products, loading: false, error: null })
    } catch (err) {
      setState(s => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load products',
      }))
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  // ── Create ──────────────────────────────────────────────────────────────────

  const addProduct = useCallback(
    async (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'isDemo'>): Promise<Product> => {
      const ts = Date.now()
      const product: Product = {
        ...data,
        id: generateId('prod'),
        isDemo: false,
        createdAt: ts,
        updatedAt: ts,
      }
      await productRepo.upsert(product)

      // Record opening stock movement
      if (product.stockQty > 0) {
        const mv: StockMovement = {
          id: generateId('mv'),
          productId: product.id,
          productName: product.name,
          qtyDelta: product.stockQty,
          qtyBefore: 0,
          qtyAfter: product.stockQty,
          reason: 'opening_stock',
          note: 'Initial stock on product creation',
          isDemo: false,
          createdAt: ts,
        }
        await stockMovementRepo.upsert(mv)
      }

      await reload()
      return product
    },
    [reload],
  )

  // ── Update ──────────────────────────────────────────────────────────────────

  const updateProduct = useCallback(
    async (id: string, data: Partial<Omit<Product, 'id' | 'createdAt' | 'isDemo'>>) => {
      const existing = await productRepo.getById(id)
      if (!existing) throw new Error(`Product ${id} not found`)
      const updated: Product = { ...existing, ...data, updatedAt: Date.now() }
      await productRepo.upsert(updated)
      await reload()
      return updated
    },
    [reload],
  )

  // ── Deactivate ──────────────────────────────────────────────────────────────

  const deactivateProduct = useCallback(
    async (id: string) => {
      await updateProduct(id, { isActive: false })
    },
    [updateProduct],
  )

  const reactivateProduct = useCallback(
    async (id: string) => {
      await updateProduct(id, { isActive: true })
    },
    [updateProduct],
  )

  // ── Stock adjustment ────────────────────────────────────────────────────────

  const adjustStock = useCallback(
    async (
      productId: string,
      qtyDelta: number,
      reason: StockMovementReason,
      note?: string,
      saleId?: string,
    ) => {
      const product = await productRepo.getById(productId)
      if (!product) throw new Error(`Product ${productId} not found`)

      const qtyBefore = product.stockQty
      const qtyAfter = qtyBefore + qtyDelta

      // Update product stock
      await productRepo.upsert({ ...product, stockQty: qtyAfter, updatedAt: Date.now() })

      // Write audit movement
      const mv: StockMovement = {
        id: generateId('mv'),
        productId,
        productName: product.name,
        qtyDelta,
        qtyBefore,
        qtyAfter,
        reason,
        note,
        saleId,
        isDemo: product.isDemo,
        createdAt: Date.now(),
      }
      await stockMovementRepo.upsert(mv)
      await reload()
      return { product, mv }
    },
    [reload],
  )

  // ── Demo data ───────────────────────────────────────────────────────────────

  const loadDemoData = useCallback(async (): Promise<{ products: number }> => {
    const inserted = await productRepo.bulkInsertNew(DEMO_PRODUCTS)
    const mvs = buildDemoStockMovements()
    await stockMovementRepo.bulkInsertNew(mvs)
    await reload()
    return { products: inserted }
  }, [reload])

  const clearDemoData = useCallback(async () => {
    const all = await productRepo.getAll()
    const demoIds = all.filter(p => p.isDemo).map(p => p.id)
    for (const id of demoIds) await productRepo.delete(id)
    await reload()
  }, [reload])

  return {
    ...state,
    reload,
    addProduct,
    updateProduct,
    deactivateProduct,
    reactivateProduct,
    adjustStock,
    loadDemoData,
    clearDemoData,
  }
}
