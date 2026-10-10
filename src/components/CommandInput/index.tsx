import { useEffect, useState } from 'react'
import { Command, HelpCircle, X, Check, Mic, MicOff, Loader2 } from 'lucide-react'
import { parseCommand, COMMAND_EXAMPLES, type ParsedCommand } from '../../lib/commands/parser'
import { useInventory } from '../../hooks/useInventory'
import { useCustomers } from '../../hooks/useCustomers'
import { useSettingsContext } from '../../app/SettingsContext'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import { createSale } from '../../lib/saleService'
import { recordCredit, recordPayment } from '../../lib/udhaarService'
import { adjustStockDirect } from '../../lib/stockService'
import { generateId } from '../../lib/ids'
import { formatPaisa, formatQty } from '../../lib/format'
import type { Product, Customer } from '../../types'

interface CommandInputProps {
  /** Called after a command successfully changes data, so the parent can refresh. */
  onExecuted?: () => void
}

type Feedback = { kind: 'success' | 'error'; message: string } | null

export function CommandInput({ onExecuted }: CommandInputProps) {
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState<ParsedCommand | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const { products, reload: reloadInventory } = useInventory()
  const { customers, reload: reloadCustomers } = useCustomers()
  const { settings } = useSettingsContext()
  const speech = useSpeechRecognition(settings.language)

  // Pipe live speech transcript into the input box.
  useEffect(() => {
    if (speech.transcript) setInput(speech.transcript)
  }, [speech.transcript])

  const liveValue = speech.listening && speech.interim
    ? `${input ? input + ' ' : ''}${speech.interim}`
    : input

  function handleParse() {
    const value = input.trim()
    if (!value) return
    setFeedback(null)
    setParsed(parseCommand(value, products, customers))
  }

  function toggleMic() {
    setFeedback(null)
    if (speech.listening) {
      speech.stop()
    } else {
      speech.reset()
      setInput('')
      setParsed(null)
      speech.start()
    }
  }

  function reset() {
    setInput('')
    setParsed(null)
    setFeedback(null)
    speech.reset()
  }

  async function refreshAll() {
    await Promise.all([reloadInventory(), reloadCustomers()])
    onExecuted?.()
  }

  // ── Execute: record a sale (cash) ───────────────────────────────────────────
  async function doSale(product: Product, qty: number) {
    setBusy(true)
    setFeedback(null)
    try {
      if (product.stockQty < qty) {
        throw new Error(
          `Only ${formatQty(product.stockQty, product.unit)} of ${product.name} in stock`,
        )
      }
      const total = Math.round(qty * product.pricePaisa)
      await createSale({
        id: generateId('sale'),
        lines: [{ productId: product.id, qty }],
        discountPaisa: 0,
        paymentMethod: 'cash',
      })
      await refreshAll()
      setFeedback({
        kind: 'success',
        message: `Sale recorded: ${formatQty(qty, product.unit)} × ${product.name} = ${formatPaisa(total)}`,
      })
      reset()
    } catch (e) {
      setFeedback({ kind: 'error', message: e instanceof Error ? e.message : 'Could not record sale' })
    } finally {
      setBusy(false)
    }
  }

  // ── Execute: restock (add stock) ────────────────────────────────────────────
  async function doRestock(product: Product, qty: number) {
    setBusy(true)
    setFeedback(null)
    try {
      await adjustStockDirect(product.id, qty, 'purchase', 'Added via command bar')
      await refreshAll()
      setFeedback({
        kind: 'success',
        message: `Added ${formatQty(qty, product.unit)} to ${product.name}`,
      })
      reset()
    } catch (e) {
      setFeedback({ kind: 'error', message: e instanceof Error ? e.message : 'Could not add stock' })
    } finally {
      setBusy(false)
    }
  }

  // ── Execute: udhaar (customer takes credit) ─────────────────────────────────
  async function doCredit(customer: Customer, amountPaisa: number) {
    setBusy(true)
    setFeedback(null)
    try {
      await recordCredit(customer.id, amountPaisa, 'Added via command bar')
      await refreshAll()
      setFeedback({
        kind: 'success',
        message: `Credit recorded: ${customer.name} now owes ${formatPaisa(customer.udhaarBalancePaisa + amountPaisa)}`,
      })
      reset()
    } catch (e) {
      setFeedback({ kind: 'error', message: e instanceof Error ? e.message : 'Could not record credit' })
    } finally {
      setBusy(false)
    }
  }

  // ── Execute: payment (customer repays) ──────────────────────────────────────
  async function doPayment(customer: Customer, amountPaisa: number) {
    setBusy(true)
    setFeedback(null)
    try {
      await recordPayment(customer.id, amountPaisa, 'Payment via command bar')
      await refreshAll()
      const remaining = Math.max(0, customer.udhaarBalancePaisa - amountPaisa)
      setFeedback({
        kind: 'success',
        message: `Payment recorded: ${customer.name} ${remaining > 0 ? `now owes ${formatPaisa(remaining)}` : 'is all settled'}`,
      })
      reset()
    } catch (e) {
      setFeedback({ kind: 'error', message: e instanceof Error ? e.message : 'Could not record payment' })
    } finally {
      setBusy(false)
    }
  }

  const examples = COMMAND_EXAMPLES[settings.language] || COMMAND_EXAMPLES.en
  const micError =
    speech.error && speech.error !== 'aborted' && speech.error !== 'no-speech'
      ? speech.error === 'not-allowed' || speech.error === 'service-not-allowed'
        ? 'Microphone permission denied. Allow mic access to use voice.'
        : speech.error === 'unsupported'
          ? 'Voice input is not supported in this browser. Try Chrome or Edge.'
          : null
      : null

  return (
    <div className="relative">
      {/* Input bar */}
      <div className="flex items-center gap-2 bg-card border border-border rounded-xl p-3 shadow-sm">
        <Command size={18} className="text-brand-700 shrink-0" />
        <input
          type="text"
          value={liveValue}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleParse()}
          placeholder={speech.listening ? 'Listening… speak now' : examples[0]}
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
        />

        {/* Voice (mic) button */}
        {speech.supported && (
          <button
            onClick={toggleMic}
            title={speech.listening ? 'Stop listening' : 'Speak command'}
            aria-label={speech.listening ? 'Stop listening' : 'Speak command'}
            className={`relative p-1.5 rounded-lg transition-colors ${
              speech.listening
                ? 'bg-red-50 text-red-600'
                : 'text-muted hover:text-brand-700 hover:bg-brand-50'
            }`}
          >
            {speech.listening ? <Mic size={16} /> : <Mic size={16} />}
            {speech.listening && (
              <span className="absolute inset-0 rounded-lg ring-2 ring-red-400 animate-ping" />
            )}
          </button>
        )}
        {!speech.supported && (
          <span title="Voice not supported in this browser" className="p-1.5 text-muted/50">
            <MicOff size={16} />
          </span>
        )}

        <button
          onClick={() => setShowHelp(!showHelp)}
          className="p-1 text-muted hover:text-ink rounded transition-colors"
          title="Help"
        >
          <HelpCircle size={16} />
        </button>
        {input && (
          <button
            onClick={reset}
            className="p-1 text-muted hover:text-ink rounded transition-colors"
          >
            <X size={16} />
          </button>
        )}
        <button
          onClick={handleParse}
          disabled={!input.trim() || busy}
          className="px-3 py-1.5 bg-brand-700 text-white text-xs font-medium rounded-lg hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Parse
        </button>
      </div>

      {/* Listening / mic error status */}
      {speech.listening && (
        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Listening… speak your command, then it will parse automatically.
        </p>
      )}
      {micError && (
        <p className="mt-1.5 text-xs text-amber-700">{micError}</p>
      )}

      {/* Help examples */}
      {showHelp && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl p-4 shadow-lg z-20">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-ink">Command Examples</p>
            <button onClick={() => setShowHelp(false)} className="text-muted hover:text-ink">
              <X size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {examples.map((ex, i) => (
              <button
                key={i}
                onClick={() => { setInput(ex); setShowHelp(false) }}
                className="block w-full text-left px-2 py-1.5 text-xs text-muted hover:text-ink hover:bg-surface rounded transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Success / error feedback */}
      {feedback && (
        <div
          className={`mt-2 rounded-lg p-3 border text-xs ${
            feedback.kind === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Parsed result */}
      {parsed && parsed.type !== 'unknown' && (
        <div className="mt-2 bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${parsed.confidence > 0.7 ? 'bg-green-50' : 'bg-amber-50'}`}>
              <Check size={16} className={parsed.confidence > 0.7 ? 'text-green-600' : 'text-amber-600'} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-ink mb-0.5">
                {parsed.type === 'sale' && 'Sale Command'}
                {parsed.type === 'restock' && 'Add Stock Command'}
                {parsed.type === 'udhaar' && 'Udhaar (Credit) Command'}
                {parsed.type === 'payment' && 'Payment Command'}
                {parsed.type === 'stock_query' && 'Stock Query'}
                {parsed.type === 'sales_query' && 'Sales Query'}
              </p>
              <p className="text-xs text-muted">{parsed.raw}</p>
            </div>
          </div>

          {/* Sale / Restock confirmation (both operate on products + qty) */}
          {(parsed.type === 'sale' || parsed.type === 'restock') && parsed.matches?.products && (
            <div>
              {parsed.matches.products.length === 0 && (
                <p className="text-xs text-red-600">
                  No matching product found for "{parsed.data?.productName}".
                </p>
              )}
              {parsed.matches.products.length === 1 && (
                <ProductActionCard
                  product={parsed.matches.products[0]}
                  qty={parsed.data?.quantity ?? 0}
                  mode={parsed.type}
                  busy={busy}
                  onCancel={reset}
                  onConfirm={() =>
                    parsed.type === 'sale'
                      ? doSale(parsed.matches!.products![0], parsed.data!.quantity!)
                      : doRestock(parsed.matches!.products![0], parsed.data!.quantity!)
                  }
                />
              )}
              {parsed.matches.products.length > 1 && (
                <div>
                  <p className="text-xs text-muted mb-2">Select the correct product:</p>
                  <div className="space-y-1">
                    {parsed.matches.products.map(p => (
                      <button
                        key={p.id}
                        disabled={busy}
                        onClick={() =>
                          parsed.type === 'sale'
                            ? doSale(p, parsed.data!.quantity!)
                            : doRestock(p, parsed.data!.quantity!)
                        }
                        className="w-full text-left px-3 py-2 bg-surface hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <p className="text-sm font-medium text-ink">{p.name}</p>
                        <p className="text-xs text-muted">
                          Stock: {formatQty(p.stockQty, p.unit)} · {formatPaisa(p.pricePaisa)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Udhaar / Payment confirmation (both operate on customers + amount) */}
          {(parsed.type === 'udhaar' || parsed.type === 'payment') && parsed.matches?.customers && (
            <div>
              {parsed.matches.customers.length === 0 && (
                <p className="text-xs text-red-600">
                  No matching customer found for "{parsed.data?.customerName}".
                </p>
              )}
              {parsed.matches.customers.length === 1 && (
                <CustomerActionCard
                  customer={parsed.matches.customers[0]}
                  amountPaisa={parsed.data?.amountPaisa ?? 0}
                  mode={parsed.type}
                  busy={busy}
                  onCancel={reset}
                  onConfirm={() =>
                    parsed.type === 'udhaar'
                      ? doCredit(parsed.matches!.customers![0], parsed.data!.amountPaisa!)
                      : doPayment(parsed.matches!.customers![0], parsed.data!.amountPaisa!)
                  }
                />
              )}
              {parsed.matches.customers.length > 1 && (
                <div>
                  <p className="text-xs text-muted mb-2">Select the correct customer:</p>
                  <div className="space-y-1">
                    {parsed.matches.customers.map(c => (
                      <button
                        key={c.id}
                        disabled={busy}
                        onClick={() =>
                          parsed.type === 'udhaar'
                            ? doCredit(c, parsed.data!.amountPaisa!)
                            : doPayment(c, parsed.data!.amountPaisa!)
                        }
                        className="w-full text-left px-3 py-2 bg-surface hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <p className="text-sm font-medium text-ink">{c.name}</p>
                        <p className="text-xs text-muted">
                          Current balance: {formatPaisa(c.udhaarBalancePaisa)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stock query result */}
          {parsed.type === 'stock_query' && parsed.matches?.products && (
            <div>
              {parsed.matches.products.length === 0 && (
                <p className="text-xs text-red-600">No matching products found.</p>
              )}
              {parsed.matches.products.map(p => (
                <div key={p.id} className="bg-surface rounded-lg p-3 mb-2">
                  <p className="text-sm font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-muted mt-1">
                    Stock: <span className="font-medium text-ink">{formatQty(p.stockQty, p.unit)}</span>
                    {p.stockQty <= p.lowStockThreshold && (
                      <span className="ml-2 text-amber-600">(low stock)</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Sales query result */}
          {parsed.type === 'sales_query' && (
            <SalesQueryResult />
          )}
        </div>
      )}

      {parsed && parsed.type === 'unknown' && (
        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800">
            Could not understand "{parsed.raw}". Try phrasing like "5 biscuit sold",
            "add 10 rice bags", "Ali took 500 credit", "Ali paid 300", or "atta stock".
            Tap the help icon for more examples.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────────

function ProductActionCard({
  product, qty, mode, busy, onCancel, onConfirm,
}: {
  product: Product
  qty: number
  mode: 'sale' | 'restock'
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const total = Math.round(qty * product.pricePaisa)
  return (
    <div>
      <div className="bg-surface rounded-lg p-3 mb-3">
        <p className="text-xs text-muted mb-1">
          {mode === 'sale' ? 'Ready to record sale:' : 'Ready to add stock:'}
        </p>
        <p className="text-sm font-medium text-ink">
          {formatQty(qty, product.unit)} × {product.name}
        </p>
        <p className="text-xs text-muted mt-1">
          {mode === 'sale'
            ? `${formatPaisa(product.pricePaisa)} per ${product.unit} · total ${formatPaisa(total)}`
            : `New stock will be ${formatQty(product.stockQty + qty, product.unit)}`}
        </p>
      </div>
      <ConfirmRow busy={busy} onCancel={onCancel} onConfirm={onConfirm} />
    </div>
  )
}

function CustomerActionCard({
  customer, amountPaisa, mode, busy, onCancel, onConfirm,
}: {
  customer: Customer
  amountPaisa: number
  mode: 'udhaar' | 'payment'
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const after =
    mode === 'udhaar'
      ? customer.udhaarBalancePaisa + amountPaisa
      : Math.max(0, customer.udhaarBalancePaisa - amountPaisa)
  const exceeds = mode === 'payment' && amountPaisa > customer.udhaarBalancePaisa
  return (
    <div>
      <div className="bg-surface rounded-lg p-3 mb-3">
        <p className="text-xs text-muted mb-1">
          {mode === 'udhaar' ? 'Ready to record credit:' : 'Ready to record payment:'}
        </p>
        <p className="text-sm font-medium text-ink">
          {customer.name} · {formatPaisa(amountPaisa)}
        </p>
        <p className="text-xs text-muted mt-1">
          Current balance {formatPaisa(customer.udhaarBalancePaisa)} → {formatPaisa(after)}
        </p>
        {exceeds && (
          <p className="text-xs text-red-600 mt-1">
            Payment exceeds the current balance of {formatPaisa(customer.udhaarBalancePaisa)}.
          </p>
        )}
      </div>
      <ConfirmRow busy={busy} disabled={exceeds} onCancel={onCancel} onConfirm={onConfirm} />
    </div>
  )
}

function ConfirmRow({
  busy, disabled, onCancel, onConfirm,
}: {
  busy: boolean
  disabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="flex gap-2 mt-3">
      <button
        onClick={onCancel}
        disabled={busy}
        className="flex-1 px-3 py-2 text-xs font-medium border border-border rounded-lg hover:bg-surface transition-colors disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={busy || disabled}
        className="flex-1 px-3 py-2 text-xs font-medium bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {busy && <Loader2 size={13} className="animate-spin" />}
        {busy ? 'Saving…' : 'Confirm'}
      </button>
    </div>
  )
}

function SalesQueryResult() {
  const { products } = useInventory()
  // Lightweight: show the products ordered by lowest stock as a hint, and
  // point to Insights for full analytics.
  return (
    <p className="text-xs text-muted">
      See the Insights page for best sellers and full sales analytics.
      {products.length === 0 && ' Add products first to see data.'}
    </p>
  )
}
