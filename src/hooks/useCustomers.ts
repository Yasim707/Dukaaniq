import { useState, useEffect, useCallback } from 'react'
import { customerRepo } from '../db'
import { generateId } from '../lib/ids'
import type { Customer } from '../types'

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const all = await customerRepo.getAll()
      setCustomers(all)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const addCustomer = useCallback(async (name: string, phone?: string): Promise<Customer> => {
    const now = Date.now()
    const customer: Customer = {
      id: generateId('cust'),
      name: name.trim(),
      phone: phone?.trim() || undefined,
      udhaarBalancePaisa: 0,
      isActive: true,
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    }
    await customerRepo.upsert(customer)
    await reload()
    return customer
  }, [reload])

  return { customers, loading, reload, addCustomer }
}
