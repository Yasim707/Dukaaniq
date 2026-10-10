import { ShoppingCart, Package, Landmark, TrendingUp, Receipt } from 'lucide-react'
import { PageShell } from '../../components/PageShell'
import { StatCard } from '../../components/StatCard'
import { Badge } from '../../components/Badge'
import { CommandInput } from '../../components/CommandInput'
import { useSettingsContext } from '../../app/SettingsContext'
import { useT } from '../../i18n'
import { useDashboard } from '../../hooks/useDashboard'
import { formatPaisa, formatDateTime } from '../../lib/format'

export function DashboardPage() {
  const { settings } = useSettingsContext()
  const tr = useT(settings.language)
  const { stats, loading, reload } = useDashboard()

  const hour = new Date().getHours()
  const greetingKey =
    hour < 12 ? 'dashboard.greeting.morning'
    : hour < 17 ? 'dashboard.greeting.afternoon'
    : 'dashboard.greeting.evening'

  return (
    <PageShell>
      {/* Greeting */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-ink">
          {tr(greetingKey)}, {settings.shopName}
        </h2>
        <p className="text-sm text-muted mt-0.5">
          {new Intl.DateTimeFormat('en-PK', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          }).format(new Date())}
        </p>
      </div>

      {/* Command Input */}
      <div className="mb-6">
        <CommandInput onExecuted={reload} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label={tr('dashboard.todaySales')}
          value={loading ? '…' : formatPaisa(stats?.todayRevenuePaisa ?? 0)}
          icon={ShoppingCart}
          iconColor="text-brand-700"
          iconBg="bg-brand-50"
          sub={loading ? '' : `${stats?.todayTxCount ?? 0} transactions`}
        />
        <StatCard
          label={tr('dashboard.weekSales')}
          value={loading ? '…' : formatPaisa(stats?.weekRevenuePaisa ?? 0)}
          icon={TrendingUp}
          iconColor="text-blue-700"
          iconBg="bg-blue-50"
        />
        <StatCard
          label={tr('dashboard.totalUdhaar')}
          value={loading ? '…' : formatPaisa(stats?.totalUdhaarPaisa ?? 0)}
          icon={Landmark}
          iconColor="text-amber-700"
          iconBg="bg-amber-50"
        />
        <StatCard
          label={tr('dashboard.lowStock')}
          value={loading ? '…' : String((stats?.lowStockCount ?? 0) + (stats?.outOfStockCount ?? 0))}
          icon={Package}
          iconColor="text-red-700"
          iconBg="bg-red-50"
          sub={loading ? '' : stats?.outOfStockCount ? `${stats.outOfStockCount} out of stock` : 'items need restocking'}
        />
      </div>

      {/* Recent sales */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-ink">{tr('dashboard.recentSales')}</h3>
        </div>

        {loading && (
          <div className="px-5 py-10 text-center text-sm text-muted">Loading…</div>
        )}

        {!loading && (!stats?.recentSales?.length) && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Receipt size={24} className="text-muted mb-2" strokeWidth={1.5} />
            <p className="text-sm text-muted">{tr('common.noData')}</p>
          </div>
        )}

        {!loading && stats?.recentSales?.map(s => (
          <div key={s.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-0 hover:bg-surface/40 transition-colors">
            <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center shrink-0">
              <Receipt size={14} className="text-brand-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink">
                {s.customerName ?? 'Walk-in'}
              </p>
              <p className="text-xs text-muted">
                {formatDateTime(s.createdAt)} · {s.itemCount} item{s.itemCount !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-semibold text-ink text-sm">{formatPaisa(s.totalPaisa)}</p>
              <div className="flex justify-end mt-0.5">
                {s.paymentMethod === 'udhaar'
                  ? <Badge label="Udhaar" variant="amber" />
                  : s.paymentMethod === 'partial'
                  ? <Badge label="Partial" variant="blue" />
                  : <Badge label="Cash" variant="green" />
                }
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  )
}
