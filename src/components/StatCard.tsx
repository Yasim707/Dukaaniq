import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  trend?: {
    value: string
    up: boolean
  }
  sub?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-brand-700',
  iconBg = 'bg-brand-50',
  trend,
  sub,
}: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">{label}</p>
        <div className={`w-9 h-9 ${iconBg} rounded-lg flex items-center justify-center`}>
          <Icon size={18} className={iconColor} strokeWidth={1.8} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-ink leading-none">{value}</p>
        {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend.up ? 'text-green-600' : 'text-red-500'}`}>
          {trend.up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {trend.value}
        </div>
      )}
    </div>
  )
}
