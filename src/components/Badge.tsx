type Variant = 'green' | 'red' | 'amber' | 'blue' | 'gray'

const VARIANTS: Record<Variant, string> = {
  green: 'bg-green-50 text-green-700 border-green-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  gray: 'bg-stone-50 text-stone-600 border-stone-200',
}

interface BadgeProps {
  label: string
  variant?: Variant
}

export function Badge({ label, variant = 'gray' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${VARIANTS[variant]}`}>
      {label}
    </span>
  )
}
