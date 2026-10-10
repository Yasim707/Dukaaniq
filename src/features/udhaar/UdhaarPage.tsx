import { Landmark, Plus, TrendingDown } from 'lucide-react'
import { useState, useEffect } from 'react'
import { PageShell } from '../../components/PageShell'
import { EmptyState } from '../../components/EmptyState'
import { Dialog } from '../../components/Dialog'
import { FormField, Input } from '../../components/FormField'
import { useSettingsContext } from '../../app/SettingsContext'
import { useT } from '../../i18n'
import { useCustomers } from '../../hooks/useCustomers'
import { db } from '../../db'
import { formatPaisa, formatDateTime } from '../../lib/format'
import type { Customer, UdhaarEntry } from '../../types'

export function UdhaarPage() {
  const { settings } = useSettingsContext()
  const tr = useT(settings.language)
  const { customers, loading: customersLoading } = useCustomers()

  const [showDialog, setShowDialog] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [entries, setEntries] = useState<UdhaarEntry[]>([])
  const [loading, setLoading] = useState(false)

  const [amountPKR, setAmountPKR] = useState('')

  // Load entries for selected customer
  useEffect(() => {
    async function load() {
      if (!selectedCustomer) {
        setEntries([])
        return
      }
      setLoading(true)
      const allEntries = await db.udhaarEntries.where('customerId').equals(selectedCustomer.id).toArray()
      setEntries(allEntries.sort((a, b) => b.createdAt - a.createdAt))
      setLoading(false)
    }
    load()
  }, [selectedCustomer])

  function openDialog() {
    setAmountPKR('')
    setShowDialog(true)
  }

  async function handleRecordPayment() {
    if (!selectedCustomer) {
      alert('Please select a customer')
      return
    }

    const amountPaisa = Math.round(parseFloat(amountPKR) * 100 || 0)
    if (amountPaisa <= 0) {
      alert('Amount must be greater than 0')
      return
    }

    if (amountPaisa > selectedCustomer.udhaarBalancePaisa) {
      alert(`Payment cannot exceed balance of ${formatPaisa(selectedCustomer.udhaarBalancePaisa)}`)
      return
    }

    try {
      setLoading(true)

      // Record udhaar entry and update customer balance in a transaction
      await db.transaction('rw', [db.udhaarEntries, db.customers], async () => {
        // Add udhaar entry
        const id = crypto.randomUUID()
        await db.udhaarEntries.add({
          id,
          customerId: selectedCustomer.id,
          type: 'payment',
          amountPaisa,
          note: undefined,
          isDemo: selectedCustomer.isDemo,
          createdAt: Date.now(),
        })

        // Update customer balance
        await db.customers.update(selectedCustomer.id, {
          udhaarBalancePaisa: selectedCustomer.udhaarBalancePaisa - amountPaisa,
          updatedAt: Date.now(),
        })
      })

      // Refresh entries
      const allEntries = await db.udhaarEntries.where('customerId').equals(selectedCustomer.id).toArray()
      setEntries(allEntries.sort((a, b) => b.createdAt - a.createdAt))

      // Refresh customer data
      const updated = await db.customers.get(selectedCustomer.id)
      if (updated) {
        setSelectedCustomer(updated)
      }

      setShowDialog(false)
      alert('Payment recorded successfully')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error recording payment')
    } finally {
      setLoading(false)
    }
  }

  const customersWithUdhaar = customers.filter(c => c.isActive && c.udhaarBalancePaisa > 0)

  return (
    <PageShell
      action={
        selectedCustomer ? (
          <button
            onClick={openDialog}
            className="flex items-center gap-2 px-4 py-2 bg-brand-700 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors"
          >
            <Plus size={16} />
            {tr('udhaar.addEntry')}
          </button>
        ) : null
      }
    >
      {customersLoading ? (
        <div className="text-center py-12 text-muted">{tr('common.loading')}</div>
      ) : (
        <div className="space-y-6">
          {/* Customer Selection */}
          <div className="bg-card border border-border rounded-xl p-5">
            <label className="block text-xs font-medium text-ink-light mb-3">
              Select Customer with Udhaar
            </label>

            {customersWithUdhaar.length === 0 ? (
              <p className="text-sm text-muted">{tr('common.noData')}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {customersWithUdhaar.map(customer => (
                  <button
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    className={[
                      'px-4 py-3 border rounded-lg text-left transition-colors text-sm',
                      selectedCustomer?.id === customer.id
                        ? 'bg-brand-50 border-brand-300 text-brand-700'
                        : 'border-border hover:bg-surface',
                    ].join(' ')}
                  >
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-xs mt-1 opacity-70">
                      Owes: {formatPaisa(customer.udhaarBalancePaisa)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Summary for selected customer */}
          {selectedCustomer && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Landmark size={20} className="text-amber-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">{selectedCustomer.name}</p>
                  {selectedCustomer.phone && (
                    <p className="text-xs text-muted">{selectedCustomer.phone}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-amber-700 font-medium">Current Balance</p>
                  <p className="text-lg font-bold text-amber-900 mt-1">
                    {formatPaisa(selectedCustomer.udhaarBalancePaisa)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-amber-700 font-medium">Total Transactions</p>
                  <p className="text-lg font-bold text-amber-900 mt-1">{entries.length}</p>
                </div>
              </div>
            </div>
          )}

          {/* Entries for selected customer */}
          {selectedCustomer && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-ink">Transaction History</h3>
              </div>

              {loading ? (
                <div className="px-5 py-8 text-center text-sm text-muted">{tr('common.loading')}</div>
              ) : entries.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted">{tr('common.noData')}</div>
              ) : (
                <div className="divide-y divide-border">
                  {entries.map(entry => (
                    <div key={entry.id} className="px-5 py-4 hover:bg-surface/40 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={[
                              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                              entry.type === 'credit'
                                ? 'bg-red-50'
                                : 'bg-green-50',
                            ].join(' ')}
                          >
                            <TrendingDown
                              size={16}
                              className={entry.type === 'credit' ? 'text-red-600' : 'text-green-600'}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">
                              {entry.type === 'credit' ? tr('udhaar.creditEntry') : tr('udhaar.paymentEntry')}
                            </p>
                            <p className="text-xs text-muted">
                              {formatDateTime(entry.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p
                            className={[
                              'text-sm font-semibold',
                              entry.type === 'credit' ? 'text-red-600' : 'text-green-600',
                            ].join(' ')}
                          >
                            {entry.type === 'credit' ? '+' : '-'}{formatPaisa(entry.amountPaisa)}
                          </p>
                        </div>
                      </div>
                      {entry.note && (
                        <p className="text-xs text-muted mt-2 ml-11">{entry.note}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!selectedCustomer && customersWithUdhaar.length === 0 && (
            <EmptyState
              icon={Landmark}
              title={tr('udhaar.title')}
              description="No customers with outstanding udhaar balance yet."
            />
          )}
        </div>
      )}

      {/* Record Payment Dialog */}
      <Dialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        title={`Record Payment - ${selectedCustomer?.name}`}
      >
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-medium text-ink-light mb-2">Current Balance</p>
            <p className="text-2xl font-bold text-amber-700">
              {formatPaisa(selectedCustomer?.udhaarBalancePaisa ?? 0)}
            </p>
          </div>

          <FormField id="amount" label="Payment Amount (PKR)" required>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              value={amountPKR}
              onChange={e => setAmountPKR(e.target.value)}
              placeholder="Amount in PKR"
            />
          </FormField>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowDialog(false)}
              className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-surface transition-colors text-sm font-medium"
            >
              {tr('common.cancel')}
            </button>
            <button
              onClick={handleRecordPayment}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-brand-700 text-white rounded-lg hover:bg-brand-800 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {loading ? tr('common.loading') : tr('common.save')}
            </button>
          </div>
        </div>
      </Dialog>
    </PageShell>
  )
}
