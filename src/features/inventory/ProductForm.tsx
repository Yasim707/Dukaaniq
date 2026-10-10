import { useState, useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Dialog } from '../../components/Dialog'
import { FormField, Input, Select } from '../../components/FormField'
import { productSchema, type ProductFormValues } from '../../lib/validation'
import { UNIT_TYPES, UNIT_LABELS, type Product } from '../../types'
import { paisaToRupees, rupeesToPaisa } from '../../lib/format'

const CATEGORIES = [
  'Staples', 'Dairy', 'Snacks', 'Beverages', 'Household',
  'Personal Care', 'Frozen', 'Fresh Produce', 'Bakery', 'Other',
]

interface ProductFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (values: ProductFormValues) => Promise<void>
  initial?: Product | null
}

export function ProductForm({ open, onClose, onSubmit, initial }: ProductFormProps) {
  const isEdit = !!initial
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      name: '',
      aliases: '',
      category: '',
      unit: 'piece',
      costRupees: 0,
      priceRupees: 0,
      stockQty: 0,
      lowStockThreshold: 5,
      targetDays: null,
    },
  })

  useEffect(() => {
    if (open && initial) {
      reset({
        name: initial.name,
        aliases: initial.aliases.join(', '),
        category: initial.category,
        unit: initial.unit,
        costRupees: paisaToRupees(initial.costPaisa),
        priceRupees: paisaToRupees(initial.pricePaisa),
        stockQty: initial.stockQty,
        lowStockThreshold: initial.lowStockThreshold,
        targetDays: initial.targetDays ?? null,
      })
    } else if (open && !initial) {
      reset({
        name: '',
        aliases: '',
        category: '',
        unit: 'piece',
        costRupees: 0,
        priceRupees: 0,
        stockQty: 0,
        lowStockThreshold: 5,
        targetDays: null,
      })
    }
    setSubmitError(null)
  }, [open, initial, reset])

  const onValid = async (values: ProductFormValues) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit(values)
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Product' : 'Add Product'}
      width="max-w-xl"
    >
      <form onSubmit={handleSubmit(onValid as Parameters<typeof handleSubmit>[0])} noValidate>
        <div className="p-5 space-y-4">
          <FormField id="name" label="Product Name" error={errors.name?.message} required>
            <Input
              id="name"
              {...register('name')}
              placeholder="e.g. Basmati Rice"
              error={!!errors.name}
              autoFocus={!isEdit}
            />
          </FormField>

          <FormField
            id="aliases"
            label="Search Aliases"
            error={errors.aliases?.message}
            hint="Comma-separated Urdu/Roman Urdu names for search"
          >
            <Input
              id="aliases"
              {...register('aliases')}
              placeholder="چاول, chawal, basmati"
              error={!!errors.aliases}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField id="category" label="Category" error={errors.category?.message} required>
              <Select id="category" {...register('category')} error={!!errors.category}>
                <option value="">Select category…</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </FormField>

            <FormField id="unit" label="Unit" error={errors.unit?.message} required>
              <Select id="unit" {...register('unit')} error={!!errors.unit}>
                {UNIT_TYPES.map(u => (
                  <option key={u} value={u}>{UNIT_LABELS[u]}</option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField id="costRupees" label="Purchase Cost (₨)" error={errors.costRupees?.message} required>
              <Input
                id="costRupees"
                type="number"
                step="0.01"
                min="0"
                {...register('costRupees', { valueAsNumber: true })}
                placeholder="0"
                error={!!errors.costRupees}
              />
            </FormField>

            <FormField id="priceRupees" label="Selling Price (₨)" error={errors.priceRupees?.message} required>
              <Input
                id="priceRupees"
                type="number"
                step="0.01"
                min="0"
                {...register('priceRupees', { valueAsNumber: true })}
                placeholder="0"
                error={!!errors.priceRupees}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField id="stockQty" label="Current Stock" error={errors.stockQty?.message} required>
              <Input
                id="stockQty"
                type="number"
                step="0.001"
                min="0"
                {...register('stockQty', { valueAsNumber: true })}
                placeholder="0"
                error={!!errors.stockQty}
                disabled={isEdit}
              />
              {isEdit && (
                <p className="mt-1 text-xs text-muted">Use Restock to change stock after creation</p>
              )}
            </FormField>

            <FormField id="lowStockThreshold" label="Low Stock Alert At" error={errors.lowStockThreshold?.message} required>
              <Input
                id="lowStockThreshold"
                type="number"
                step="1"
                min="0"
                {...register('lowStockThreshold', { valueAsNumber: true })}
                placeholder="5"
                error={!!errors.lowStockThreshold}
              />
            </FormField>
          </div>

          <FormField
            id="targetDays"
            label="Target Stock (days)"
            error={errors.targetDays?.message}
            hint="Optional: how many days of stock to maintain"
          >
            <Input
              id="targetDays"
              type="number"
              step="1"
              min="1"
              max="365"
              {...register('targetDays', { valueAsNumber: true })}
              placeholder="e.g. 30"
              error={!!errors.targetDays}
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
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

/** Convert ProductFormValues (rupees) → Product fields (paisa) */
export function formValuesToProductFields(values: ProductFormValues) {
  return {
    name: values.name.trim(),
    aliases: values.aliases
      ? values.aliases.split(',').map(s => s.trim()).filter(Boolean)
      : [] as string[],
    category: values.category,
    unit: values.unit,
    costPaisa: rupeesToPaisa(values.costRupees),
    pricePaisa: rupeesToPaisa(values.priceRupees),
    stockQty: values.stockQty,
    lowStockThreshold: values.lowStockThreshold,
    targetDays: values.targetDays ?? undefined,
    isActive: true,
  } as const
}
