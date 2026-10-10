import { useState, useMemo } from 'react'
import {
  Plus, Search, Package, ChevronDown, ChevronUp,
  Edit2, RefreshCw, EyeOff, Eye, Info,
  Database, AlertTriangle,
} from 'lucide-react'
import { PageShell } from '../../components/PageShell'
import { EmptyState } from '../../components/EmptyState'
import { Badge } from '../../components/Badge'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ProductForm, formValuesToProductFields } from './ProductForm'
import { RestockForm } from './RestockForm'
import { ProductDetail } from './ProductDetail'
import { useInventory } from '../../hooks/useInventory'
import { useSettingsContext } from '../../app/SettingsContext'
import { useT } from '../../i18n'
import type { Product, SortField, SortDir, StockFilter } from '../../types'
import { formatPaisa, formatQty } from '../../lib/format'
import type { ProductFormValues, RestockFormValues } from '../../lib/validation'

type FilterCategory = 'all' | string

export function InventoryPage() {
  const { settings } = useSettingsContext()
  const tr = useT(settings.language)

  const {
    products, loading, error,
    addProduct, updateProduct,
    deactivateProduct, reactivateProduct,
    adjustStock, loadDemoData, reload,
  } = useInventory()

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Dialogs
  const [addOpen, setAddOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [restockProduct, setRestockProduct] = useState<Product | null>(null)
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Product | null>(null)
  const [deactivateLoading, setDeactivateLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoMessage, setDemoMessage] = useState<string | null>(null)

  // ── Derived data ────────────────────────────────────────────────────────────

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean))
    return Array.from(cats).sort()
  }, [products])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return products
      .filter(p => {
        if (!showInactive && !p.isActive) return false
        if (q) {
          const inName = p.name.toLowerCase().includes(q)
          const inAliases = p.aliases?.some(a => a.toLowerCase().includes(q))
          if (!inName && !inAliases) return false
        }
        if (categoryFilter !== 'all' && p.category !== categoryFilter) return false
        if (stockFilter === 'low' && !(p.stockQty > 0 && p.stockQty <= p.lowStockThreshold)) return false
        if (stockFilter === 'out' && p.stockQty > 0) return false
        return true
      })
      .sort((a, b) => {
        let cmp = 0
        switch (sortField) {
          case 'name': cmp = a.name.localeCompare(b.name); break
          case 'stockQty': cmp = a.stockQty - b.stockQty; break
          case 'stockValue': cmp = (a.stockQty * a.costPaisa) - (b.stockQty * b.costPaisa); break
          case 'pricePaisa': cmp = a.pricePaisa - b.pricePaisa; break
          case 'updatedAt': cmp = a.updatedAt - b.updatedAt; break
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [products, search, categoryFilter, stockFilter, showInactive, sortField, sortDir])

  const totalValuation = useMemo(
    () => products.filter(p => p.isActive).reduce((s, p) => s + p.stockQty * p.costPaisa, 0),
    [products],
  )

  const lowCount = useMemo(
    () => products.filter(p => p.isActive && p.stockQty > 0 && p.stockQty <= p.lowStockThreshold).length,
    [products],
  )

  const outCount = useMemo(
    () => products.filter(p => p.isActive && p.stockQty <= 0).length,
    [products],
  )

  // ── Sort toggle ─────────────────────────────────────────────────────────────

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('asc') }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronDown size={12} className="text-muted opacity-40" />
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-brand-700" />
      : <ChevronDown size={12} className="text-brand-700" />
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleAdd(values: ProductFormValues) {
    const fields = formValuesToProductFields(values)
    await addProduct({
      name: fields.name,
      aliases: fields.aliases,
      category: fields.category,
      unit: fields.unit,
      costPaisa: fields.costPaisa,
      pricePaisa: fields.pricePaisa,
      stockQty: fields.stockQty,
      lowStockThreshold: fields.lowStockThreshold,
      targetDays: fields.targetDays,
      isActive: true,
    })
  }

  async function handleEdit(values: ProductFormValues) {
    if (!editProduct) return
    const fields = formValuesToProductFields(values)
    await updateProduct(editProduct.id, {
      name: fields.name,
      aliases: fields.aliases,
      category: fields.category,
      unit: fields.unit,
      costPaisa: fields.costPaisa,
      pricePaisa: fields.pricePaisa,
      lowStockThreshold: fields.lowStockThreshold,
      targetDays: fields.targetDays,
    })
  }

  async function handleRestock(productId: string, values: RestockFormValues) {
    await adjustStock(productId, values.qtyDelta, values.reason, values.note || undefined)
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return
    setDeactivateLoading(true)
    try {
      await deactivateProduct(deactivateTarget.id)
    } finally {
      setDeactivateLoading(false)
      setDeactivateTarget(null)
    }
  }

  async function handleLoadDemo() {
    setDemoLoading(true)
    setDemoMessage(null)
    try {
      const { products: count } = await loadDemoData()
      setDemoMessage(
        count === 0
          ? 'Demo data is already loaded.'
          : `Added ${count} demo product${count !== 1 ? 's' : ''} to your inventory.`,
      )
    } catch (e) {
      setDemoMessage(e instanceof Error ? e.message : 'Failed to load demo data')
    } finally {
      setDemoLoading(false)
    }
  }

  // ── Stock badge ──────────────────────────────────────────────────────────────

  function stockBadge(p: Product) {
    if (!p.isActive) return <Badge label="Inactive" variant="gray" />
    if (p.stockQty <= 0) return <Badge label="Out" variant="red" />
    if (p.stockQty <= p.lowStockThreshold) return <Badge label="Low" variant="amber" />
    return <Badge label="OK" variant="green" />
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-24 text-sm text-muted">Loading inventory…</div>
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell>
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => reload()} className="ml-auto underline">Retry</button>
        </div>
      </PageShell>
    )
  }

  return (
    <>
      <PageShell>
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-ink">{tr('inventory.title')}</h2>
            <p className="text-xs text-muted mt-0.5">
              {products.filter(p => p.isActive).length} active products ·{' '}
              Valuation: {formatPaisa(totalValuation)}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {products.length === 0 && (
              <button
                onClick={handleLoadDemo}
                disabled={demoLoading}
                className="flex items-center gap-2 px-3 py-2 border border-border text-sm font-medium text-ink-light rounded-lg hover:bg-surface transition-colors disabled:opacity-50"
              >
                <Database size={15} />
                {demoLoading ? 'Loading…' : 'Load Demo Shop'}
              </button>
            )}
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-700 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors"
            >
              <Plus size={16} />
              {tr('inventory.addProduct')}
            </button>
          </div>
        </div>

        {/* Demo message */}
        {demoMessage && (
          <div className="mb-4 text-sm text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-4 py-2.5 flex items-center justify-between">
            <span>{demoMessage}</span>
            <button onClick={() => setDemoMessage(null)} className="text-brand-400 hover:text-brand-700">✕</button>
          </div>
        )}

        {/* Quick-filter pills */}
        {products.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {lowCount > 0 && (
              <button
                onClick={() => setStockFilter(f => f === 'low' ? 'all' : 'low')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${stockFilter === 'low' ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Low Stock ({lowCount})
              </button>
            )}
            {outCount > 0 && (
              <button
                onClick={() => setStockFilter(f => f === 'out' ? 'all' : 'out')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${stockFilter === 'out' ? 'bg-red-100 border-red-300 text-red-800' : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Out of Stock ({outCount})
              </button>
            )}
          </div>
        )}

        {products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No products yet"
            description="Add your first product or load demo data to see the inventory."
            action={{ label: tr('inventory.addProduct'), onClick: () => setAddOpen(true) }}
          />
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Search + filters */}
            <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search products or aliases…"
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button
                  onClick={() => setShowInactive(s => !s)}
                  className={`px-3 py-2 border rounded-lg text-xs font-medium transition-colors ${showInactive ? 'bg-brand-50 border-brand-300 text-brand-700' : 'border-border text-muted hover:bg-surface'}`}
                >
                  {showInactive ? 'Hide Inactive' : 'Show Inactive'}
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface/50">
                    <Th onClick={() => toggleSort('name')} label="Product">
                      <SortIcon field="name" />
                    </Th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted">Category</th>
                    <Th onClick={() => toggleSort('pricePaisa')} label="Price">
                      <SortIcon field="pricePaisa" />
                    </Th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted">Cost</th>
                    <Th onClick={() => toggleSort('stockQty')} label="Stock">
                      <SortIcon field="stockQty" />
                    </Th>
                    <Th onClick={() => toggleSort('stockValue')} label="Value">
                      <SortIcon field="stockValue" />
                    </Th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted">
                        No products match your filters.
                      </td>
                    </tr>
                  )}
                  {filtered.map(p => (
                    <tr
                      key={p.id}
                      className={`border-b border-border last:border-0 hover:bg-surface/50 transition-colors ${!p.isActive ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{p.name}</p>
                        {p.aliases?.length > 0 && (
                          <p className="text-xs text-muted truncate max-w-[180px]">
                            {p.aliases.join(', ')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">{p.category}</td>
                      <td className="px-4 py-3 font-medium text-ink">{formatPaisa(p.pricePaisa)}</td>
                      <td className="px-4 py-3 text-muted">{formatPaisa(p.costPaisa)}</td>
                      <td className="px-4 py-3">
                        <span className={p.stockQty <= p.lowStockThreshold && p.stockQty > 0 ? 'text-amber-700 font-medium' : p.stockQty <= 0 ? 'text-red-600 font-medium' : 'text-ink'}>
                          {formatQty(p.stockQty, p.unit)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">{formatPaisa(p.stockQty * p.costPaisa)}</td>
                      <td className="px-4 py-3">{stockBadge(p)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <ActionBtn title="View details" onClick={() => setDetailProduct(p)}>
                            <Info size={14} />
                          </ActionBtn>
                          <ActionBtn title="Edit product" onClick={() => setEditProduct(p)}>
                            <Edit2 size={14} />
                          </ActionBtn>
                          <ActionBtn title="Adjust stock" onClick={() => setRestockProduct(p)}>
                            <RefreshCw size={14} />
                          </ActionBtn>
                          {p.isActive ? (
                            <ActionBtn
                              title="Deactivate"
                              onClick={() => setDeactivateTarget(p)}
                              className="hover:text-red-600"
                            >
                              <EyeOff size={14} />
                            </ActionBtn>
                          ) : (
                            <ActionBtn
                              title="Reactivate"
                              onClick={() => reactivateProduct(p.id)}
                              className="hover:text-green-600"
                            >
                              <Eye size={14} />
                            </ActionBtn>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer summary */}
            {filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-border bg-surface/30 flex items-center justify-between">
                <p className="text-xs text-muted">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</p>
                <p className="text-xs text-muted">
                  Total valuation: <span className="font-medium text-ink">{formatPaisa(totalValuation)}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Load demo button when inventory has items too */}
        {products.length > 0 && (
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleLoadDemo}
              disabled={demoLoading}
              className="flex items-center gap-2 px-3 py-2 border border-border text-sm text-muted rounded-lg hover:bg-surface transition-colors disabled:opacity-50"
            >
              <Database size={14} />
              {demoLoading ? 'Loading…' : 'Load Demo Shop'}
            </button>
            <p className="text-xs text-muted">Demo products are clearly labelled and won't duplicate.</p>
          </div>
        )}
      </PageShell>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      <ProductForm
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAdd}
      />

      <ProductForm
        open={!!editProduct}
        onClose={() => setEditProduct(null)}
        onSubmit={handleEdit}
        initial={editProduct}
      />

      <RestockForm
        open={!!restockProduct}
        onClose={() => setRestockProduct(null)}
        product={restockProduct}
        onSubmit={handleRestock}
      />

      <ProductDetail
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
      />

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        loading={deactivateLoading}
        title="Deactivate Product"
        message={`Deactivate "${deactivateTarget?.name}"? It will be hidden from active inventory but its history is preserved.`}
        confirmLabel="Deactivate"
        danger
      />
    </>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Th({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <th className="px-4 py-3 text-left">
      <button
        onClick={onClick}
        className="flex items-center gap-1 text-xs font-medium text-muted hover:text-ink transition-colors"
      >
        {label}
        {children}
      </button>
    </th>
  )
}

function ActionBtn({
  children,
  title,
  onClick,
  className = '',
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded-lg text-muted hover:bg-surface transition-colors ${className}`}
    >
      {children}
    </button>
  )
}
