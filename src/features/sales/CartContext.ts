/** Cart types shared between Quick Sale sub-components */

import type { UnitType } from '../../types'

export interface CartLine {
  productId: string
  productName: string
  unit: UnitType
  /** Current selling price in paisa */
  unitPricePaisa: number
  /** Available stock (read at add-time; re-validated at submit) */
  availableStock: number
  qty: number
  /** qty × unitPricePaisa, rounded to integer paisa */
  lineTotalPaisa: number
}

export function calcLineTotal(qty: number, unitPricePaisa: number): number {
  return Math.round(qty * unitPricePaisa)
}

export function calcSubtotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.lineTotalPaisa, 0)
}
