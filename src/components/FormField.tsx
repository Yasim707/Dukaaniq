import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from 'react'

interface FieldProps {
  id: string
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}

export function FormField({ id, label, error, hint, required, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-ink-light mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { error?: boolean }

export function Input({ className = '', error, ...props }: InputProps) {
  return (
    <input
      {...props}
      className={[
        'w-full px-3 py-2 border rounded-lg text-sm text-ink bg-surface',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        error ? 'border-red-400' : 'border-border',
        className,
      ].join(' ')}
    />
  )
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }

export function Select({ className = '', error, children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={[
        'w-full px-3 py-2 border rounded-lg text-sm text-ink bg-surface',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        error ? 'border-red-400' : 'border-border',
        className,
      ].join(' ')}
    >
      {children}
    </select>
  )
}

export function Textarea({
  className = '',
  error,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      {...props}
      className={[
        'w-full px-3 py-2 border rounded-lg text-sm text-ink bg-surface resize-none',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
        error ? 'border-red-400' : 'border-border',
        className,
      ].join(' ')}
    />
  )
}
