import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dialog } from '../../components/Dialog'
import { FormField, Input, Select, Textarea } from '../../components/FormField'
import { restockSchema, type RestockFormValues } from '../../lib/validation'
import type { Product } from '../../types'
import { formatQty } from '../../lib/format'

interface RestockFormProps {
  open: boolean
  onClose: () => void
  product: Product | null
  onSubmit: (productId: string, values: RestockFormValues) => Promise<void>
}

const REASON_LABELS: Record<RestockFormValues['reason'], string> = {
  purchase: 'Restocked (Purchase)',
  adjustment: 'Manual Adjustment',
  damage: 'Damage / Loss',
}

export function RestockForm({ open, onClose, product, onSubmit }: RestockFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RestockFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(restockSchema) as any,
    defaultValues: { qtyDelta: 0, reason: 'purchase', note: '' },
  })

  useEffect(() => {
    if (open) {
      reset({ qtyDelta: 0, reason: 'purchase', note: '' })
      setSubmitError(null)
    }
  }, [open, reset])

  const onValid = async (values: RestockFormValues) => {
    if (!product) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit(product.id, values)
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Stock Adjustment" width="max-w-md">
      {product && (
        <form onSubmit={handleSubmit(onValid as Parameters<typeof handleSubmit>[0])} noValidate>
          <div className="p-5 space-y-4">
            <div className="bg-surface rounded-lg px-4 py-3 border border-border">
              <p className="text-xs text-muted mb-0.5">Product</p>
              <p className="text-sm font-semibold text-ink">{product.name}</p>
              <p className="text-xs text-muted mt-1">
                Current stock:{' '}
                <span className="font-medium text-ink-light">
                  {formatQty(product.stockQty, product.unit)}
                </span>
              </p>
            </div>

            <FormField
              id="qtyDelta"
              label="Quantity Change"
              error={errors.qtyDelta?.message}
              hint="Positive to add stock, negative to remove"
              required
            >
              <Input
                id="qtyDelta"
                type="number"
                step="0.001"
                {...register('qtyDelta', { valueAsNumber: true })}
                placeholder="e.g. +20 or -5"
                error={!!errors.qtyDelta}
                autoFocus
              />
            </FormField>

            <FormField id="reason" label="Reason" error={errors.reason?.message} required>
              <Select id="reason" {...register('reason')} error={!!errors.reason}>
                {(Object.entries(REASON_LABELS) as [RestockFormValues['reason'], string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            </FormField>

            <FormField id="note" label="Note (optional)" error={errors.note?.message}>
              <Textarea
                id="note"
                {...register('note')}
                placeholder="e.g. Supplier delivery — Ahmed & Sons"
                rows={2}
                error={!!errors.note}
              />
            </FormField>

            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {submitError}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-surface/50">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-ink-light border border-border rounded-lg hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-700 rounded-lg hover:bg-brand-800 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
