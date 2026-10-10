/** Generate a stable unique ID using crypto.randomUUID with a timestamp prefix */
export function generateId(prefix = ''): string {
  const uuid = crypto.randomUUID()
  return prefix ? `${prefix}_${uuid}` : uuid
}

/** Current epoch milliseconds */
export function now(): number {
  return Date.now()
}
