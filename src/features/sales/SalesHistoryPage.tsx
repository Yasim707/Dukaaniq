import { useState, useEffect, useMemo, useCallback } from 'react'
import { Receipt, ChevronDown, ChevronRight, RotateCcw, AlertTriangle } from 'lucide-react'
import { saleRepo, customerRepo } from '../../db'
import { reverseSale } from '../../lib/saleService'
import { formatPaisa, formatDateTime } from '../../lib/format'
import { Badge } from '../../components/Badge'
import { PageShell } from '../../components/PageShell'
import type { Sale, Customer } from '../../types'

type DateRange = 'today' | '7d' | '30d' | 'all'

function rangeStart(range: DateRange): number {
  const now = new Date()
  if (range === 'today') { now.setHours(0, 0, 0, 0); return now.getTime() }
  if (range === '7d') return Date.now() - 7 * 86_400_000
  if (range === '30d') return Date.now() - 30 * 86_400_000
  return 0
}

export function SalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [customers, setCustomers] = useState<Map<string, Customer>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<DateRange>('7d')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [reverseTarget, setReverseTarget] = useState<Sale | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [reverseLoading, setReverseLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [allSales, allCustomers] = await Promise.all([
        saleRepo.getAll(),
        customerRepo.getAll(),
      ])
      setSales(allSales)
      const map = new Map<string, Customer>()
      allCustomers.forEach(c => map.set(c.id, c))
      setCustomers(map)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sales')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const filtered = useMemo(() => {
    const from = rangeStart(range)
    const q = search.toLowerCase().trim()
    return sales.filter(s => {
      if (s.createdAt < from) return false
      if (q) {
        const inId = s.id.toLowerCase().includes(q)
        const customer = s.customerId ? customers.get(s.customerId) : null
        const inCustomer = customer?.name.toLowerCase().includes(q)
        const inItems = s.items.some(i => i.productName.toLowerCase().includes(q))
        if (!inId && !inCustomer && !inItems) return false
      }
      return true
    })
  }, [sales, range, search, customers])

  function isReversed(sale: Sale): boolean {
    return sale.updatedAt !== sale.createdAt
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleReverse() {
    if (!reverseTarget || !reverseReason.trim()) return
    setReverseLoading(true)
    try {
      await reverseSale(reverseTarget.id, reverseReason.trim())
      showToast('Sale reversed successfully', true)
      setReverseTarget(null)
      setReverseReason('')
      await reload()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Reversal failed', false)
    } finally {
      setReverseLoading(false)
    }
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const totalRevenue = useMemo(() =>
    filtered.filter(s => !isReversed(s)).reduce((s, sale) => s + sale.totalPaisa, 0),
    [filtered],
  )

  if (loading) return <PageShell><div className="py-20 text-center text-sm text-muted">Loading sales…</div></PageShell>
  if (error) return <PageShell><div className="text-red-600 text-sm px-4 py-3 bg-red-50 rounded-lg">{error}</div></PageShell>

  return (
    <>
      <PageShell>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-ink">Sales History</h2>
            <p className="text-xs text-muted mt-0.5">
              {filtered.length} sale{filtered.length !== 1 ? 's' : ''} · Revenue: {formatPaisa(totalRevenue)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex gap-1.5">
            {(['today', '7d', '30d', 'all'] as DateRange[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={[
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  range === r
                    ? 'bg-brand-700 text-white border-brand-700'
                    : 'border-border text-muted hover:bg-surface',
                ].join(' ')}
              >
                {r === 'today' ? 'Today' : r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : 'All'}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by product, customer, ID…"
            className="flex-1 px-3 py-1.5 border border-border rounded-lg text-sm text-ink bg-card focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-sm text-muted">
            <Receipt size={28} className="mx-auto mb-3 text-muted/40" strokeWidth={1.5} />
            No sales in this period
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(sale => {
              const customer = sale.customerId ? customers.get(sale.customerId) : null
              const reversed = isReversed(sale)
              const open = expanded.has(sale.id)

              return (
                <div key={sale.id} className={`bg-card border rounded-xl overflow-hidden transition-all ${reversed ? 'opacity-60' : 'border-border'}`}>
                  {/* Row */}
                  <div
                    className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-surface/50 transition-colors"
                    onClick={() => toggleExpand(sale.id)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                      <Receipt size={15} className="text-brand-700" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-muted">{sale.id.slice(-8)}</span>
                        {reversed && <Badge label="Reversed" variant="gray" />}
                        {sale.paymentMethod === 'udhaar' && <Badge label="Udhaar" variant="amber" />}
                        {sale.paymentMethod === 'partial' && <Badge label="Partial" variant="blue" />}
                      </div>
                      <p className="text-xs text-muted mt-0.5">
                        {formatDateTime(sale.createdAt)}
                        {customer && ` · ${customer.name}`}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-semibold text-ink">{formatPaisa(sale.totalPaisa)}</p>
                      <p className="text-xs text-muted">{sale.items.length} item{sale.items.length !== 1 ? 's' : ''}</p>
                    </div>

                    {open ? <ChevronDown size={16} className="text-muted shrink-0" /> : <ChevronRight size={16} className="text-muted shrink-0" />}
                  </div>

                  {/* Expanded detail */}
                  {open && (
                    <div className="border-t border-border">
                      {/* Items */}
                      <div className="px-5 py-3 space-y-1.5">
                        {sale.items.map(item => (
                          <div key={item.productId} className="flex items-center justify-between text-sm">
                            <span className="text-ink">{item.productName}</span>
                            <span className="text-muted">
                              {item.qty} {item.unit} × {formatPaisa(item.unitPricePaisa)} = {formatPaisa(item.lineTotalPaisa)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Totals */}
                      <div className="px-5 py-3 border-t border-border bg-surface/30 space-y-1">
                        {sale.discountPaisa > 0 && (
                          <div className="flex justify-between text-xs text-muted">
                            <span>Discount</span><span>− {formatPaisa(sale.discountPaisa)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Total</span><span>{formatPaisa(sale.totalPaisa)}</span>
                        </div>
                        {sale.udhaarPaisa > 0 && (
                          <div className="flex justify-between text-xs text-amber-700">
                            <span>Udhaar</span><span>{formatPaisa(sale.udhaarPaisa)}</span>
                          </div>
                        )}
                        {sale.note && (
                          <p className="text-xs text-muted italic pt-1">{sale.note}</p>
                        )}
                      </div>

                      {/* Actions */}
                      {!reversed && (
                        <div className="px-5 py-3 border-t border-border flex justify-end">
                          <button
                            onClick={e => { e.stopPropagation(); setReverseTarget(sale); setReverseReason('') }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <RotateCcw size={13} />
                            Reverse Sale
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </PageShell>

      {/* Reverse dialog */}
      {reverseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReverseTarget(null)} />
          <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-5 z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-red-50 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Reverse Sale</p>
                <p className="text-xs text-muted">
                  {formatPaisa(reverseTarget.totalPaisa)} · {reverseTarget.id.slice(-8)}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted mb-3">
              This will restore stock and reverse any udhaar. You must provide a reason.
            </p>
            <input
              autoFocus
              type="text"
              value={reverseReason}
              onChange={e => setReverseReason(e.target.value)}
              placeholder="Reason for reversal…"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReverseTarget(null)}
                disabled={reverseLoading}
                className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-surface"
              >
                Cancel
              </button>
              <button
                onClick={handleReverse}
                disabled={reverseLoading || !reverseReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {reverseLoading ? 'Reversing…' : 'Reverse'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${toast.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}
    </>
  )
}
