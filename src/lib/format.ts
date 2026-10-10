/**
 * Formatting utilities for currency, dates and numbers.
 * Uses native Intl APIs — no external dependency.
 */

/** Format paisa as PKR string: 5000 paisa → "₨50.00" */
export function formatPaisa(paisa: number): string {
  const rupees = paisa / 100
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rupees)
}

/** Format rupees (float) as PKR string */
export function formatRupees(rupees: number): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rupees)
}

/** Convert rupees (user input) to integer paisa */
export function rupeesToPaisa(rupees: number): number {
  return Math.round(rupees * 100)
}

/** Convert paisa to rupees */
export function paisaToRupees(paisa: number): number {
  return paisa / 100
}

/** Format a timestamp as a short date: "12 Jan 2026" */
export function formatDate(epochMs: number): string {
  return new Intl.DateTimeFormat('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(epochMs))
}

/** Format a timestamp as time: "3:45 PM" */
export function formatTime(epochMs: number): string {
  return new Intl.DateTimeFormat('en-PK', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(epochMs))
}

/** Format a timestamp as date + time */
export function formatDateTime(epochMs: number): string {
  return `${formatDate(epochMs)} ${formatTime(epochMs)}`
}

/** Format a quantity with its unit */
export function formatQty(qty: number, unit: string): string {
  const n = Number.isInteger(qty) ? qty : qty.toFixed(2)
  return `${n} ${unit}`
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
