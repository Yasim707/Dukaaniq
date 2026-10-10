import { BarChart3, TrendingUp, Package, DollarSign } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { PageShell } from '../../components/PageShell'
import { EmptyState } from '../../components/EmptyState'
import { StatCard } from '../../components/StatCard'
import { useSettingsContext } from '../../app/SettingsContext'
import { useT } from '../../i18n'
import { saleRepo } from '../../db'
import { formatPaisa } from '../../lib/format'
import type { Sale } from '../../types'

export function InsightsPage() {
  const { settings } = useSettingsContext()
  const tr = useT(settings.language)
  
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const allSales = await saleRepo.getAll()
        setSales(allSales)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // -- Calculations

  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((s, sale) => s + sale.totalPaisa, 0)
    const totalCost = sales.reduce((s, sale) => s + sale.items.reduce((si, item) => si + item.qty * item.unitCostPaisa, 0), 0)
    const totalProfit = totalRevenue - totalCost
    const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0
    const avgTransactionValue = sales.length > 0 ? Math.round(totalRevenue / sales.length) : 0
    
    // Best selling products
    const productSales = new Map<string, { name: string; qty: number; revenue: number }>()
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const existing = productSales.get(item.productId) || { name: item.productName, qty: 0, revenue: 0 }
        productSales.set(item.productId, {
          name: existing.name,
          qty: existing.qty + item.qty,
          revenue: existing.revenue + item.lineTotalPaisa,
        })
      })
    })
    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Payment methods breakdown
    const paymentMethods = { cash: 0, udhaar: 0, partial: 0 }
    sales.forEach(sale => {
      if (sale.paymentMethod === 'cash') paymentMethods.cash += 1
      else if (sale.paymentMethod === 'udhaar') paymentMethods.udhaar += 1
      else paymentMethods.partial += 1
    })

    return {
      totalRevenue,
      totalCost,
      totalProfit,
      profitMargin,
      avgTransactionValue,
      topProducts,
      paymentMethods,
    }
  }, [sales])

  if (loading) {
    return <PageShell><div className="text-center py-12">{tr('common.loading')}</div></PageShell>
  }

  if (sales.length === 0) {
    return (
      <PageShell>
        <EmptyState
          icon={BarChart3}
          title={tr('insights.title')}
          description="Record some sales to see analytics and insights here."
        />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="space-y-6">
        {/* KPI Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Revenue"
            value={formatPaisa(stats.totalRevenue)}
            icon={DollarSign}
            iconColor="text-green-700"
            iconBg="bg-green-50"
            sub={`${sales.length} sales`}
          />
          <StatCard
            label="Total Cost"
            value={formatPaisa(stats.totalCost)}
            icon={Package}
            iconColor="text-blue-700"
            iconBg="bg-blue-50"
          />
          <StatCard
            label="Total Profit"
            value={formatPaisa(stats.totalProfit)}
            icon={TrendingUp}
            iconColor="text-brand-700"
            iconBg="bg-brand-50"
            sub={`${stats.profitMargin}% margin`}
          />
          <StatCard
            label="Avg Transaction"
            value={formatPaisa(stats.avgTransactionValue)}
            icon={BarChart3}
            iconColor="text-amber-700"
            iconBg="bg-amber-50"
          />
        </div>

        {/* Top Products */}
        {stats.topProducts.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-ink mb-4">Top Selling Products</h3>
            <div className="space-y-3">
              {stats.topProducts.map((p, idx) => (
                <div key={p.name} className="flex items-center gap-3 pb-3 border-b border-border last:border-0">
                  <div className="text-sm font-bold text-brand-700 w-6">{idx + 1}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">{p.name}</p>
                    <p className="text-xs text-muted">{p.qty} units sold</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink">{formatPaisa(p.revenue)}</p>
                    <p className="text-xs text-muted">{((p.revenue / stats.totalRevenue) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted mb-2">Cash Sales</p>
            <p className="text-2xl font-bold text-green-600">{stats.paymentMethods.cash}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted mb-2">Udhaar Sales</p>
            <p className="text-2xl font-bold text-amber-600">{stats.paymentMethods.udhaar}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted mb-2">Partial Sales</p>
            <p className="text-2xl font-bold text-blue-600">{stats.paymentMethods.partial}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted mb-2">Profit Margin</p>
            <p className="text-2xl font-bold text-green-700">{stats.profitMargin}%</p>
          </div>
        </div>
      </div>
    </PageShell>
  )
}