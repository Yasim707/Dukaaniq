import { Users, Plus, Edit2, Trash2, Phone, MapPin, Wallet } from 'lucide-react'
import { useState, useEffect } from 'react'
import { PageShell } from '../../components/PageShell'
import { EmptyState } from '../../components/EmptyState'
import { Dialog } from '../../components/Dialog'
import { FormField, Input, Textarea } from '../../components/FormField'
import { Badge } from '../../components/Badge'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useSettingsContext } from '../../app/SettingsContext'
import { useT } from '../../i18n'
import { useCustomers } from '../../hooks/useCustomers'
import { formatPaisa } from '../../lib/format'
import { db } from '../../db'
import type { Customer } from '../../types'

export function CustomersPage() {
  const { settings } = useSettingsContext()
  const tr = useT(settings.language)
  const { customers, loading } = useCustomers()

  const [showDialog, setShowDialog] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const [formData, setFormData] = useState({ id: '', name: '', phone: '', address: '' })

  useEffect(() => {
    if (editingCustomer) {
      setFormData({
        id: editingCustomer.id,
        name: editingCustomer.name,
        phone: editingCustomer.phone || '',
        address: editingCustomer.address || '',
      })
    } else {
      setFormData({ id: '', name: '', phone: '', address: '' })
    }
  }, [editingCustomer])

  function openNew() {
    setEditingCustomer(null)
    setShowDialog(true)
  }

  function openEdit(customer: Customer) {
    setEditingCustomer(customer)
    setShowDialog(true)
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      alert('Name is required')
      return
    }

    setIsProcessing(true)
    try {
      if (editingCustomer) {
        // Update existing customer
        await db.customers.update(editingCustomer.id, {
          name: formData.name.trim(),
          phone: formData.phone.trim() || undefined,
          address: formData.address.trim() || undefined,
          updatedAt: Date.now(),
        })
      } else {
        // Add new customer
        await db.customers.add({
          id: crypto.randomUUID(),
          name: formData.name.trim(),
          phone: formData.phone.trim() || undefined,
          address: formData.address.trim() || undefined,
          udhaarBalancePaisa: 0,
          isActive: true,
          isDemo: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      }

      setShowDialog(false)
      setEditingCustomer(null)
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleDelete() {
    if (editingCustomer) {
      setIsProcessing(true)
      try {
        await db.customers.update(editingCustomer.id, { isActive: false })
        setShowDeleteConfirm(false)
        setShowDialog(false)
        setEditingCustomer(null)
      } finally {
        setIsProcessing(false)
      }
    }
  }

  const activeCustomers = customers.filter(c => c.isActive)

  return (
    <PageShell
      action={
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-brand-700 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors"
        >
          <Plus size={16} />
          {tr('customers.addCustomer')}
        </button>
      }
    >
      {loading ? (
        <div className="text-center py-12 text-muted">{tr('common.loading')}</div>
      ) : activeCustomers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={tr('customers.title')}
          description="Keep track of your regular customers here."
          action={{ label: tr('customers.addCustomer'), onClick: openNew }}
        />
      ) : (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-700 font-medium">{tr('customers.totalCustomers')}</p>
              <p className="text-2xl font-bold text-ink mt-2">{activeCustomers.length}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-700 font-medium">{tr('dashboard.totalUdhaar')}</p>
              <p className="text-2xl font-bold text-amber-700 mt-2">
                {formatPaisa(activeCustomers.reduce((sum, c) => sum + c.udhaarBalancePaisa, 0))}
              </p>
            </div>
          </div>

          {/* Customers List */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-ink">{tr('customers.title')}</h3>
            </div>

            <div className="divide-y divide-border">
              {activeCustomers.map(customer => (
                <div
                  key={customer.id}
                  className="px-5 py-4 hover:bg-surface/40 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink text-sm">{customer.name}</p>

                      <div className="mt-2 space-y-1">
                        {customer.phone && (
                          <div className="flex items-center gap-2 text-xs text-muted">
                            <Phone size={12} />
                            <span>{customer.phone}</span>
                          </div>
                        )}
                        {customer.address && (
                          <div className="flex items-center gap-2 text-xs text-muted">
                            <MapPin size={12} />
                            <span>{customer.address}</span>
                          </div>
                        )}
                      </div>

                      {customer.udhaarBalancePaisa > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <Wallet size={12} className="text-amber-600" />
                          <Badge
                            label={`Owes ${formatPaisa(customer.udhaarBalancePaisa)}`}
                            variant="amber"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(customer)}
                        className="p-2 text-muted hover:text-ink hover:bg-surface rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingCustomer(customer)
                          setShowDeleteConfirm(true)
                        }}
                        className="p-2 text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        title={editingCustomer ? `Edit ${editingCustomer.name}` : tr('customers.addCustomer')}
      >
        <div className="p-5 space-y-4">
          <FormField id="name" label={tr('common.name')} required>
            <Input
              id="name"
              value={formData.name}
              onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
              placeholder="Full name"
              autoFocus
            />
          </FormField>
          <FormField id="phone" label={tr('common.phone')}>
            <Input
              id="phone"
              value={formData.phone}
              onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
              placeholder="Phone number"
              type="tel"
            />
          </FormField>
          <FormField id="address" label="Address">
            <Textarea
              id="address"
              value={formData.address}
              onChange={e => setFormData(f => ({ ...f, address: e.target.value }))}
              placeholder="Street address"
            />
          </FormField>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowDialog(false)}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-surface transition-colors text-sm font-medium disabled:opacity-50"
            >
              {tr('common.cancel')}
            </button>
            {editingCustomer && (
              <button
                onClick={() => {
                  setShowDialog(false)
                  setShowDeleteConfirm(true)
                }}
                disabled={isProcessing}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {tr('common.delete')}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 bg-brand-700 text-white rounded-lg hover:bg-brand-800 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {isProcessing ? tr('common.loading') : tr('common.save')}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Customer"
        message={`Are you sure you want to delete ${editingCustomer?.name}? This cannot be undone.`}
        confirmLabel={tr('common.delete')}
        danger
        onConfirm={handleDelete}
      />
    </PageShell>
  )
}
