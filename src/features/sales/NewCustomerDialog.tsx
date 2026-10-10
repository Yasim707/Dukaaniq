import { useState } from 'react'
import { Dialog } from '../../components/Dialog'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (id: string, name: string) => void
  onCreate: (name: string, phone?: string) => Promise<{ id: string; name: string }>
}

export function NewCustomerDialog({ open, onClose, onCreated, onCreate }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const c = await onCreate(name.trim(), phone.trim() || undefined)
      setName('')
      setPhone('')
      onCreated(c.id, c.name)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create customer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New Customer" width="max-w-sm">
      <form onSubmit={handleSubmit}>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-light mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Customer name"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-light mb-1">Phone (optional)</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="03xx-xxxxxxx"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-ink-light border border-border rounded-lg hover:bg-surface">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-700 rounded-lg hover:bg-brand-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Customer'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
