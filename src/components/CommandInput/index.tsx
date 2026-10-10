import { useState } from 'react'
import { Command, HelpCircle, X, Check } from 'lucide-react'
import { parseCommand, COMMAND_EXAMPLES, type ParsedCommand } from '../../lib/commands/parser'
import { useInventory } from '../../hooks/useInventory'
import { useCustomers } from '../../hooks/useCustomers'
import { useSettingsContext } from '../../app/SettingsContext'
import { formatPaisa, formatQty } from '../../lib/format'
import type { Product, Customer } from '../../types'

interface CommandInputProps {
  onSaleCommand?: (product: Product, qty: number) => void
  onUdhaarCommand?: (customer: Customer, amountPaisa: number) => void
}

export function CommandInput({ onSaleCommand, onUdhaarCommand }: CommandInputProps) {
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState<ParsedCommand | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const { products } = useInventory()
  const { customers } = useCustomers()
  const { settings } = useSettingsContext()

  function handleParse() {
    if (!input.trim()) return
    const result = parseCommand(input, products, customers)
    setParsed(result)
  }

  function handleConfirm() {
    if (!parsed) return

    if (parsed.type === 'sale' && parsed.matches?.products?.length === 1 && parsed.data?.quantity) {
      onSaleCommand?.(parsed.matches.products[0], parsed.data.quantity)
      reset()
    } else if (parsed.type === 'udhaar' && parsed.matches?.customers?.length === 1 && parsed.data?.amountPaisa) {
      onUdhaarCommand?.(parsed.matches.customers[0], parsed.data.amountPaisa)
      reset()
    }
  }

  function selectProduct(product: Product) {
    if (parsed?.data?.quantity) {
      onSaleCommand?.(product, parsed.data.quantity)
      reset()
    }
  }

  function selectCustomer(customer: Customer) {
    if (parsed?.data?.amountPaisa) {
      onUdhaarCommand?.(customer, parsed.data.amountPaisa)
      reset()
    }
  }

  function reset() {
    setInput('')
    setParsed(null)
  }

  const examples = COMMAND_EXAMPLES[settings.language] || COMMAND_EXAMPLES.en

  return (
    <div className="relative">
      {/* Input bar */}
      <div className="flex items-center gap-2 bg-card border border-border rounded-xl p-3 shadow-sm">
        <Command size={18} className="text-brand-700 shrink-0" />
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleParse()}
          placeholder={examples[0]}
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
        />
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
          disabled={!input.trim()}
          className="px-3 py-1.5 bg-brand-700 text-white text-xs font-medium rounded-lg hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Parse
        </button>
      </div>

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
                {parsed.type === 'udhaar' && 'Udhaar Command'}
                {parsed.type === 'stock_query' && 'Stock Query'}
                {parsed.type === 'sales_query' && 'Sales Query'}
              </p>
              <p className="text-xs text-muted">{parsed.raw}</p>
            </div>
          </div>

          {/* Sale confirmation */}
          {parsed.type === 'sale' && parsed.matches?.products && (
            <div>
              {parsed.matches.products.length === 0 && (
                <p className="text-xs text-red-600">No matching products found.</p>
              )}
              {parsed.matches.products.length === 1 && (
                <div className="bg-surface rounded-lg p-3 mb-3">
                  <p className="text-xs text-muted mb-1">Ready to record sale:</p>
                  <p className="text-sm font-medium text-ink">
                    {parsed.data?.quantity} × {parsed.matches.products[0].name}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    {formatPaisa(parsed.matches.products[0].pricePaisa)} per {parsed.matches.products[0].unit}
                  </p>
                </div>
              )}
              {parsed.matches.products.length > 1 && (
                <div>
                  <p className="text-xs text-muted mb-2">Select the correct product:</p>
                  <div className="space-y-1">
                    {parsed.matches.products.map(p => (
                      <button
                        key={p.id}
                        onClick={() => selectProduct(p)}
                        className="w-full text-left px-3 py-2 bg-surface hover:bg-brand-50 rounded-lg transition-colors"
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

          {/* Udhaar confirmation */}
          {parsed.type === 'udhaar' && parsed.matches?.customers && (
            <div>
              {parsed.matches.customers.length === 0 && (
                <p className="text-xs text-red-600">No matching customers found.</p>
              )}
              {parsed.matches.customers.length === 1 && (
                <div className="bg-surface rounded-lg p-3 mb-3">
                  <p className="text-xs text-muted mb-1">Ready to record credit:</p>
                  <p className="text-sm font-medium text-ink">
                    {parsed.matches.customers[0].name} · {formatPaisa(parsed.data?.amountPaisa ?? 0)}
                  </p>
                </div>
              )}
              {parsed.matches.customers.length > 1 && (
                <div>
                  <p className="text-xs text-muted mb-2">Select the correct customer:</p>
                  <div className="space-y-1">
                    {parsed.matches.customers.map(c => (
                      <button
                        key={c.id}
                        onClick={() => selectCustomer(c)}
                        className="w-full text-left px-3 py-2 bg-surface hover:bg-brand-50 rounded-lg transition-colors"
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
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Sales query - placeholder */}
          {parsed.type === 'sales_query' && (
            <p className="text-xs text-muted">Navigate to Insights to see best sellers</p>
          )}

          {/* Action buttons */}
          {((parsed.type === 'sale' && parsed.matches?.products?.length === 1) ||
            (parsed.type === 'udhaar' && parsed.matches?.customers?.length === 1)) && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={reset}
                className="flex-1 px-3 py-2 text-xs font-medium border border-border rounded-lg hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-3 py-2 text-xs font-medium bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition-colors"
              >
                Confirm
              </button>
            </div>
          )}
        </div>
      )}

      {parsed && parsed.type === 'unknown' && (
        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800">
            Could not understand command. Try examples above or use manual forms.
          </p>
        </div>
      )}
    </div>
  )
}
