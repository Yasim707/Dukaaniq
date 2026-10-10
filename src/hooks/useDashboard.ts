import { useState, useEffect, useCallback } from 'react'
import { saleRepo, productRepo, customerRepo } from '../db'

export interface DashboardStats {
  todayRevenuePaisa: number
  todayTxCount: number
  weekRevenuePaisa: number
  totalUdhaarPaisa: number
  lowStockCount: number
  outOfStockCount: number
  recentSales: {
    id: string
    totalPaisa: number
    itemCount: number
    createdAt: number
    customerName?: string
    paymentMethod: string
  }[]
}

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const now = Date.now()
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const weekStart = now - 7 * 86_400_000

      const [todaySales, weekSales, customers, lowStockProducts, outOfStockProducts, recent] =
        await Promise.all([
          saleRepo.getToday(),
          saleRepo.getRange(weekStart, now + 1),
          customerRepo.getAll(),
          productRepo.getLowStock(),
          productRepo.getOutOfStock(),
          saleRepo.getRange(todayStart.getTime() - 7 * 86_400_000, now + 1),
        ])

      const customerMap = new Map(customers.map(c => [c.id, c.name]))

      // Only count non-reversed sales
      const isReversed = (s: { createdAt: number; updatedAt: number }) => s.createdAt !== s.updatedAt

      const activeTodaySales = todaySales.filter(s => !isReversed(s))
      const activeWeekSales = weekSales.filter(s => !isReversed(s))

      const totalUdhaar = customers.reduce((s, c) => s + c.udhaarBalancePaisa, 0)

      const recentSales = recent
        .filter(s => !isReversed(s))
        .slice(0, 5)
        .map(s => ({
          id: s.id,
          totalPaisa: s.totalPaisa,
          itemCount: s.items.length,
          createdAt: s.createdAt,
          customerName: s.customerId ? customerMap.get(s.customerId) : undefined,
          paymentMethod: s.paymentMethod,
        }))

      setStats({
        todayRevenuePaisa: activeTodaySales.reduce((s, sale) => s + sale.totalPaisa, 0),
        todayTxCount: activeTodaySales.length,
        weekRevenuePaisa: activeWeekSales.reduce((s, sale) => s + sale.totalPaisa, 0),
        totalUdhaarPaisa: totalUdhaar,
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length,
        recentSales,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  return { stats, loading, reload }
}
