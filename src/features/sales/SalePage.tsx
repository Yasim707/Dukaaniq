import { useState, useMemo, useCallback, useRef } from 'react'
import {
  Search, Plus, Minus, Trash2, ShoppingCart,
  CheckCircle2, AlertCircle, ChevronRight, UserPlus, X,
} from 'lucide-react'
import { useInventory } from '../../hooks/useInventory'
import { useCustomers } from '../../hooks/useCustomers'
import { createSale } from '../../lib/saleService'
import { generateId } from '../../lib/ids'
import { formatPaisa, formatQty } from '../../lib/format'
import { PageShell } from '../../components/PageShell'
import { NewCustomerDialog } from './NewCustomerDialog'
import { type CartLine, calcLineTotal, calcSubtotal } from './CartContext'
import type { PaymentMethod, Product } from '../../types'

type Step = 'cart' | 'confirm' | 'done' | 'error'

export function SalePage() {
  const { products } = useInventory()
  const { customers, addCustomer } = useCustomers()

  // ── Cart state ────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartLine[]>([])
  const [search, setSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [customerId, setCustomerId] = useState<string>('')
  const [discountRupees, setDiscountRupees] = useState('')
  const [note, setNote] = useState('')
  const [paidRupees, setPaidRupees] = useState('')

  // ── Workflow state ────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('cart')
  const [processing, setProcessing] = useState(false)
  const [completedSale, setCompletedSale] = useState<string | null>(null)
  const [saleError, setSaleError] = useState<string | null>(null)
  const [newCustomerOpen, setNewCustomerOpen] = useState(false)

  // Stable sale ID to prevent double-submit
  const pendingSaleId = useRef(generateId('sale'))

  // ── Product search ────────────────────────────────────────────────────────
  const q = search.toLowerCase().trim()
  const searchResults = useMemo(() => {
    if (!q) return []
    return products
      .filter(p => {
        if (!p.isActive) return false
        const inName = p.name.toLowerCase().includes(q)
        const inAliases = p.aliases?.some(a => a.toLowerCase().includes(q))
        return inName || !!inAliases
      })
      .slice(0, 8)
  }, [products, q])

  // ── Cart operations ───────────────────────────────────────────────────────

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(l => l.productId === product.id)
      if (existing) {
        const newQty = existing.qty + 1
        if (newQty > product.stockQty) return prev
        return prev.map(l =>
          l.productId === product.id
            ? { ...l, qty: newQty, lineTotalPaisa: calcLineTotal(newQty, l.unitPricePaisa) }
            : l,
        )
      }
      if (product.stockQty <= 0) return prev
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          unitPricePaisa: product.pricePaisa,
          availableStock: product.stockQty,
          qty: 1,
          lineTotalPaisa: product.pricePaisa,
        },
      ]
    })
    setSearch('')
  }

  const setLineQty = useCallback((productId: string, raw: string) => {
    const n = parseFloat(raw)
    if (isNaN(n) || n < 0) return
    setCart(prev =>
      prev.map(l => {
        if (l.productId !== productId) return l
        const qty = Math.min(n, l.availableStock)
        return { ...l, qty, lineTotalPaisa: calcLineTotal(qty, l.unitPricePaisa) }
      }),
    )
  }, [])

  const adjustQty = useCallback((productId: string, delta: number) => {
    setCart(prev =>
      prev.map(l => {
        if (l.productId !== productId) return l
        const qty = Math.max(0, Math.min(l.qty + delta, l.availableStock))
        return { ...l, qty, lineTotalPaisa: calcLineTotal(qty, l.unitPricePaisa) }
      }).filter(l => l.qty > 0),
    )
  }, [])

  const removeLine = useCallback((productId: string) => {
    setCart(prev => prev.filter(l => l.productId !== productId))
  }, [])

  // ── Totals ────────────────────────────────────────────────────────────────

  const subtotalPaisa = useMemo(() => calcSubtotal(cart), [cart])
  const discountPaisa = useMemo(() => {
    const n = parseFloat(discountRupees)
    if (!isFinite(n) || n < 0) return 0
    return Math.min(Math.round(n * 100), subtotalPaisa)
  }, [discountRupees, subtotalPaisa])
  const totalPaisa = subtotalPaisa - discountPaisa
  const paidPaisa = useMemo(() => {
    if (paymentMethod !== 'partial') return 0
    const n = parseFloat(paidRupees)
    if (!isFinite(n) || n < 0) return 0
    return Math.min(Math.round(n * 100), totalPaisa)
  }, [paidRupees, totalPaisa, paymentMethod])
  const udhaarPaisa = paymentMethod === 'cash' ? 0
    : paymentMethod === 'udhaar' ? totalPaisa
    : totalPaisa - paidPaisa

  // ── Validation ────────────────────────────────────────────────────────────

  const validationErrors: string[] = useMemo(() => {
    const errs: string[] = []
    if (cart.length === 0) errs.push('Cart is empty')
    if ((paymentMethod === 'udhaar' || paymentMethod === 'partial') && !customerId)
      errs.push('Select a customer for credit sales')
    cart.forEach(l => {
      if (l.qty <= 0) errs.push(`${l.productName}: quantity must be > 0`)
    })
    return errs
  }, [cart, paymentMethod, customerId])

  // ── Submit ────────────────────────────────────────────────────────────────

  async function submitSale() {
    if (validationErrors.length || processing) return
    setProcessing(true)
    setSaleError(null)
    try {
      await createSale({
        id: pendingSaleId.current,
        lines: cart.map(l => ({ productId: l.productId, qty: l.qty })),
        discountPaisa,
        paymentMethod,
        customerId: customerId || undefined,
        paidPaisa: paymentMethod === 'partial' ? paidPaisa : undefined,
        note: note.trim() || undefined,
      })
      setCompletedSale(pendingSaleId.current)
      setStep('done')
    } catch (err) {
      setSaleError(err instanceof Error ? err.message : 'Sale failed')
      setStep('error')
    } finally {
      setProcessing(false)
    }
  }

  function resetSale() {
    setCart([])
    setSearch('')
    setPaymentMethod('cash')
    setCustomerId('')
    setDiscountRupees('')
    setNote('')
    setPaidRupees('')
    setSaleError(null)
    setCompletedSale(null)
    pendingSaleId.current = generateId('sale')
    setStep('cart')
  }

  // ── Customer helpers ──────────────────────────────────────────────────────

  const selectedCustomer = customers.find(c => c.id === customerId)

  function handleCustomerCreated(id: string, _name: string) {
    setCustomerId(id)
  }

  // ── Render: Done ─────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <PageShell>
        <div className="max-w-md mx-auto pt-10 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-ink mb-2">Sale Complete</h2>
          <p className="text-sm text-muted mb-1">Sale ID: <span className="font-mono text-xs">{completedSale?.slice(-8)}</span></p>
          <p className="text-lg font-semibold text-ink mb-6">{formatPaisa(totalPaisa)}</p>
          {udhaarPaisa > 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4">
              Udhaar recorded: {formatPaisa(udhaarPaisa)} for {selectedCustomer?.name}
            </p>
          )}
          <button
            onClick={resetSale}
            className="px-6 py-3 bg-brand-700 text-white font-medium rounded-xl hover:bg-brand-800 transition-colors"
          >
            New Sale
          </button>
        </div>
      </PageShell>
    )
  }

  // ── Render: Error ─────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <PageShell>
        <div className="max-w-md mx-auto pt-10 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-ink mb-2">Sale Failed</h2>
          <p className="text-sm text-muted mb-6">{saleError}</p>
          <button
            onClick={() => setStep('confirm')}
            className="px-6 py-3 border border-border text-ink-light font-medium rounded-xl hover:bg-surface transition-colors"
          >
            Go Back
          </button>
        </div>
      </PageShell>
    )
  }

  // ── Render: Confirm ───────────────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <PageShell>
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => setStep('cart')}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-5 transition-colors"
          >
            ← Back to cart
          </button>

          <h2 className="text-lg font-bold text-ink mb-5">Confirm Sale</h2>

          <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
            <div className="px-5 py-3 border-b border-border bg-surface/50">
              <p className="text-xs font-medium text-muted uppercase tracking-wide">Items</p>
            </div>
            {cart.map(l => (
              <div key={l.productId} className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-ink">{l.productName}</p>
                  <p className="text-xs text-muted">{l.qty} {l.unit} × {formatPaisa(l.unitPricePaisa)}</p>
                </div>
                <p className="text-sm font-semibold text-ink">{formatPaisa(l.lineTotalPaisa)}</p>
              </div>
            ))}
            <div className="px-5 py-3 border-t border-border space-y-1.5">
              <Row label="Subtotal" value={formatPaisa(subtotalPaisa)} />
              {discountPaisa > 0 && <Row label="Discount" value={`− ${formatPaisa(discountPaisa)}`} />}
              <Row label="Total" value={formatPaisa(totalPaisa)} bold />
              {paymentMethod === 'partial' && <Row label="Paid" value={formatPaisa(paidPaisa)} />}
              {udhaarPaisa > 0 && <Row label="Udhaar" value={formatPaisa(udhaarPaisa)} warn />}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl px-5 py-4 mb-6 space-y-2">
            <Row label="Payment" value={paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'udhaar' ? 'Udhaar' : 'Partial'} />
            {selectedCustomer && <Row label="Customer" value={selectedCustomer.name} />}
            {note && <Row label="Note" value={note} />}
          </div>

          <button
            onClick={submitSale}
            disabled={processing}
            className="w-full py-3.5 bg-brand-700 text-white font-semibold rounded-xl hover:bg-brand-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing…
              </span>
            ) : (
              <>
                <CheckCircle2 size={18} />
                Confirm &amp; Record Sale
              </>
            )}
          </button>
        </div>
      </PageShell>
    )
  }

  // ── Render: Cart ──────────────────────────────────────────────────────────
  return (
    <>
      <PageShell>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: product search + cart */}
          <div className="lg:col-span-3 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products to add…"
                className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-sm text-ink bg-card focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                autoFocus
              />
              {/* Dropdown results */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden">
                  {searchResults.map(p => {
                    const inCart = cart.find(l => l.productId === p.id)
                    const outOfStock = p.stockQty <= 0
                    return (
                      <button
                        key={p.id}
                        onClick={() => !outOfStock && addToCart(p)}
                        disabled={outOfStock}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface transition-colors border-b border-border last:border-0 disabled:opacity-40"
                      >
                        <div>
                          <p className="text-sm font-medium text-ink">{p.name}</p>
                          <p className="text-xs text-muted">
                            {formatPaisa(p.pricePaisa)} · Stock: {formatQty(p.stockQty, p.unit)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {inCart && (
                            <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                              In cart: {inCart.qty}
                            </span>
                          )}
                          {outOfStock
                            ? <span className="text-xs text-red-500">Out</span>
                            : <Plus size={16} className="text-brand-700" />
                          }
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              {search.length > 1 && searchResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-20 px-4 py-3 text-sm text-muted">
                  No products found for "{search}"
                </div>
              )}
            </div>

            {/* Cart */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
                <ShoppingCart size={15} className="text-muted" />
                <span className="text-sm font-semibold text-ink">Cart</span>
                {cart.length > 0 && (
                  <span className="ml-auto text-xs text-muted">{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-muted">
                  Search for products above to add them
                </div>
              ) : (
                cart.map(line => (
                  <div key={line.productId} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{line.productName}</p>
                      <p className="text-xs text-muted">{formatPaisa(line.unitPricePaisa)} / {line.unit}</p>
                    </div>

                    {/* Qty controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => adjustQty(line.productId, -1)}
                        className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-ink-light hover:bg-surface transition-colors"
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        step={['kg','gram','litre','ml'].includes(line.unit) ? '0.1' : '1'}
                        min="0"
                        max={line.availableStock}
                        value={line.qty}
                        onChange={e => setLineQty(line.productId, e.target.value)}
                        className="w-14 text-center px-1 py-1 border border-border rounded-lg text-sm text-ink bg-surface focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <button
                        onClick={() => adjustQty(line.productId, 1)}
                        disabled={line.qty >= line.availableStock}
                        className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-ink-light hover:bg-surface transition-colors disabled:opacity-30"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <div className="text-sm font-semibold text-ink w-20 text-right shrink-0">
                      {formatPaisa(line.lineTotalPaisa)}
                    </div>

                    <button
                      onClick={() => removeLine(line.productId)}
                      className="p-1.5 rounded-lg text-muted hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: payment panel */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <p className="text-sm font-semibold text-ink">Payment</p>
              </div>
              <div className="p-5 space-y-4">
                {/* Payment method */}
                <div>
                  <p className="text-xs font-medium text-ink-light mb-2">Method</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['cash', 'udhaar', 'partial'] as PaymentMethod[]).map(m => (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={[
                          'py-2 rounded-lg text-sm font-medium capitalize border transition-colors',
                          paymentMethod === m
                            ? 'bg-brand-700 text-white border-brand-700'
                            : 'border-border text-ink-light hover:bg-surface',
                        ].join(' ')}
                      >
                        {m === 'partial' ? 'Split' : m.charAt(0).toUpperCase() + m.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Partial: paid amount */}
                {paymentMethod === 'partial' && (
                  <div>
                    <label className="block text-xs font-medium text-ink-light mb-1">Amount Paid (₨)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={paidRupees}
                      onChange={e => setPaidRupees(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                )}

                {/* Customer selector */}
                {(paymentMethod === 'udhaar' || paymentMethod === 'partial') && (
                  <div>
                    <label className="block text-xs font-medium text-ink-light mb-1">
                      Customer <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={customerId}
                        onChange={e => setCustomerId(e.target.value)}
                        className="flex-1 px-3 py-2 border border-border rounded-lg text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">Select customer…</option>
                        {customers.filter(c => c.isActive).map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}{c.udhaarBalancePaisa > 0 ? ` (owes ${formatPaisa(c.udhaarBalancePaisa)})` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setNewCustomerOpen(true)}
                        className="p-2 border border-border rounded-lg text-muted hover:text-brand-700 hover:bg-brand-50 transition-colors"
                        title="Add new customer"
                      >
                        <UserPlus size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Discount */}
                <div>
                  <label className="block text-xs font-medium text-ink-light mb-1">Discount (₨)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discountRupees}
                    onChange={e => setDiscountRupees(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* Note */}
                <div>
                  <label className="block text-xs font-medium text-ink-light mb-1">Note (optional)</label>
                  <input
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Any note…"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* Totals */}
                <div className="bg-surface rounded-lg p-4 space-y-2">
                  <Row label="Subtotal" value={formatPaisa(subtotalPaisa)} />
                  {discountPaisa > 0 && <Row label="Discount" value={`− ${formatPaisa(discountPaisa)}`} />}
                  <div className="border-t border-border pt-2">
                    <Row label="Total" value={formatPaisa(totalPaisa)} bold />
                  </div>
                  {paymentMethod === 'partial' && paidPaisa > 0 && (
                    <Row label="Paid" value={formatPaisa(paidPaisa)} />
                  )}
                  {udhaarPaisa > 0 && <Row label="Udhaar" value={formatPaisa(udhaarPaisa)} warn />}
                </div>

                {/* Validation errors */}
                {validationErrors.length > 0 && (
                  <ul className="space-y-1">
                    {validationErrors.map(e => (
                      <li key={e} className="text-xs text-red-600 flex items-center gap-1.5">
                        <X size={11} />
                        {e}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Proceed to confirm */}
                <button
                  onClick={() => setStep('confirm')}
                  disabled={validationErrors.length > 0 || cart.length === 0}
                  className="w-full py-3 bg-brand-700 text-white font-semibold rounded-xl hover:bg-brand-800 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  Review Sale
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </PageShell>

      <NewCustomerDialog
        open={newCustomerOpen}
        onClose={() => setNewCustomerOpen(false)}
        onCreated={handleCustomerCreated}
        onCreate={async (name, phone) => addCustomer(name, phone)}
      />
    </>
  )
}

// ── Tiny helper ───────────────────────────────────────────────────────────────
function Row({ label, value, bold, warn }: { label: string; value: string; bold?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-ink' : warn ? 'font-semibold text-amber-700' : 'text-ink-light'}`}>
        {value}
      </span>
    </div>
  )
}
