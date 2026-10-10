import { useState, useEffect } from 'react'
import { TrendingDown, TrendingUp, ArrowUpDown, X } from 'lucide-react'
import { stockMovementRepo } from '../../db'
import type { Product, StockMovement } from '../../types'
import { formatPaisa, formatDate, formatQty } from '../../lib/format'
import { Badge } from '../../components/Badge'

interface ProductDetailProps {
  product: Product | null
  onClose: () => void
}

const REASON_LABEL: Record<StockMovement['reason'], string> = {
  sale: 'Sale',
  purchase: 'Purchase',
  adjustment: 'Adjustment',
  damage: 'Damage',
  opening_stock: 'Opening Stock',
  demo: 'Demo',
}

export function ProductDetail({ product, onClose }: ProductDetailProps) {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!product) return
    setLoading(true)
    stockMovementRepo
      .getForProduct(product.id)
      .then(mvs => setMovements(mvs))
      .catch(() => setMovements([]))
      .finally(() => setLoading(false))
  }, [product])

  if (!product) return null

  const margin = product.pricePaisa - product.costPaisa
  const marginPct = product.costPaisa > 0
    ? ((margin / product.costPaisa) * 100).toFixed(1)
    : '–'
  const stockValue = product.stockQty * product.costPaisa

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />

      {/* Drawer */}
      <div className="relative bg-card border-l border-border w-full max-w-sm flex flex-col h-full overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-ink">{product.name}</h2>
            <p className="text-xs text-muted mt-0.5">{product.category} · {product.unit}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface">
            <X size={16} />
          </button>
        </div>

        {/* Stats */}
        <div className="p-5 border-b border-border shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Cost" value={formatPaisa(product.costPaisa)} />
            <Stat label="Price" value={formatPaisa(product.pricePaisa)} />
            <Stat label="Margin" value={`${marginPct}%`} />
            <Stat label="Stock Value" value={formatPaisa(stockValue)} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <StockBadge product={product} />
            {!product.isActive && <Badge label="Inactive" variant="gray" />}
          </div>
          {product.aliases?.length > 0 && (
            <p className="text-xs text-muted mt-2">
              Aliases: {product.aliases.join(', ')}
            </p>
          )}
        </div>

        {/* Stock movements */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <ArrowUpDown size={13} />
              Stock History
            </h3>
          </div>
          {loading && (
            <div className="px-5 py-8 text-sm text-muted text-center">Loading…</div>
          )}
          {!loading && movements.length === 0 && (
            <div className="px-5 py-8 text-sm text-muted text-center">No movements yet</div>
          )}
          {!loading && movements.map(mv => (
            <div key={mv.id} className="flex items-start gap-3 px-5 py-3 border-b border-border last:border-0">
              <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${mv.qtyDelta >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                {mv.qtyDelta >= 0
                  ? <TrendingUp size={12} className="text-green-600" />
                  : <TrendingDown size={12} className="text-red-600" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-ink">
                    {REASON_LABEL[mv.reason]}
                  </span>
                  <span className={`text-xs font-semibold ${mv.qtyDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {mv.qtyDelta >= 0 ? '+' : ''}{mv.qtyDelta}
                  </span>
                </div>
                <p className="text-xs text-muted truncate">
                  {mv.qtyBefore} → {mv.qtyAfter}
                  {mv.note ? ` · ${mv.note}` : ''}
                </p>
                <p className="text-xs text-muted">{formatDate(mv.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-lg px-3 py-2">
      <p className="text-xs text-muted mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-ink">{value}</p>
    </div>
  )
}

function StockBadge({ product }: { product: Product }) {
  if (product.stockQty <= 0) return <Badge label="Out of Stock" variant="red" />
  if (product.stockQty <= product.lowStockThreshold) return <Badge label="Low Stock" variant="amber" />
  return <Badge label={formatQty(product.stockQty, product.unit)} variant="green" />
}
