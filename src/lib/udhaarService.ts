/**
 * Udhaar (credit ledger) service — atomic credit and payment operations.
 *
 * Mirrors the transaction pattern used by the Udhaar page but centralized so
 * it can be reused by the command bar and anywhere else.
 */

import { db } from '../db'
import { generateId } from './ids'
import type { UdhaarEntry } from '../types'

/** Record new credit against a customer (balance goes up). */
export async function recordCredit(
  customerId: string,
  amountPaisa: number,
  note?: string,
): Promise<void> {
  if (amountPaisa <= 0) throw new Error('Amount must be positive')

  await db.transaction('rw', [db.udhaarEntries, db.customers], async () => {
    const customer = await db.customers.get(customerId)
    if (!customer) throw new Error('Customer not found')

    const now = Date.now()
    const entry: UdhaarEntry = {
      id: generateId('udh'),
      customerId,
      type: 'credit',
      amountPaisa,
      note,
      isDemo: customer.isDemo,
      createdAt: now,
    }
    await db.udhaarEntries.add(entry)
    await db.customers.update(customerId, {
      udhaarBalancePaisa: customer.udhaarBalancePaisa + amountPaisa,
      updatedAt: now,
    })
  })
}

/** Record a repayment from a customer (balance goes down, never below zero). */
export async function recordPayment(
  customerId: string,
  amountPaisa: number,
  note?: string,
): Promise<void> {
  if (amountPaisa <= 0) throw new Error('Amount must be positive')

  await db.transaction('rw', [db.udhaarEntries, db.customers], async () => {
    const customer = await db.customers.get(customerId)
    if (!customer) throw new Error('Customer not found')
    if (amountPaisa > customer.udhaarBalancePaisa) {
      throw new Error('Payment cannot exceed the current balance')
    }

    const now = Date.now()
    const entry: UdhaarEntry = {
      id: generateId('udh'),
      customerId,
      type: 'payment',
      amountPaisa,
      note,
      isDemo: customer.isDemo,
      createdAt: now,
    }
    await db.udhaarEntries.add(entry)
    await db.customers.update(customerId, {
      udhaarBalancePaisa: customer.udhaarBalancePaisa - amountPaisa,
      updatedAt: now,
    })
  })
}
