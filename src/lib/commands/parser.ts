/**
 * Offline command parser for natural language queries in English, Urdu, and Roman Urdu.
 * Patterns: "5 biscuit packets sold", "Ali ne 500 rupay udhaar liye", "atta ka stock kitna hai"
 */

import type { Product, Customer } from '../../types'
import { rupeesToPaisa } from '../format'

export type CommandType = 'sale' | 'udhaar' | 'stock_query' | 'sales_query' | 'unknown'

export interface ParsedCommand {
  type: CommandType
  confidence: number
  data?: {
    productName?: string
    customerName?: string
    quantity?: number
    amount?: number
    amountPaisa?: number
  }
  matches?: {
    products?: Product[]
    customers?: Customer[]
  }
  raw: string
}

// Pattern matchers
const SALE_PATTERNS = [
  // English: "5 biscuits sold", "sold 5 packets"
  /(\d+(?:\.\d+)?)\s*(.+?)\s+(sold|sale|becha|bikri)/i,
  /(sold|sale|becha|bikri)\s*(\d+(?:\.\d+)?)\s*(.+)/i,
  // Roman: "5 biscuit packet bechay"
  /(\d+(?:\.\d+)?)\s*(.+?)\s+(becha|bechay|bik|gaya|gayi)/i,
]

const UDHAAR_PATTERNS = [
  // English: "Ali took 500 rupees credit"
  /(.+?)\s+(took|ne|lia)\s*(\d+)\s*(rupees|rupay|rs)/i,
  // Roman: "Ali ne 500 rupay udhaar liye"
  /(.+?)\s+ne\s*(\d+)\s*(rupay|rupees|rs)\s*(udhaar|udhar)/i,
  // Urdu numbers: match digits
  /(.+?)\s+(udhaar|udhar)\s*(\d+)/i,
]

const STOCK_QUERY_PATTERNS = [
  // "atta stock kitna hai", "how much rice", "biscuit ka stock"
  /(.+?)\s*(stock|ka stock|kitna|how much)/i,
  /(stock|kitna hai)\s+(.+)/i,
]

const SALES_QUERY_PATTERNS = [
  // "sab se zyada kya bika", "best seller", "top product"
  /(sab se zyada|sabse zyada|best|top|most)\s*(bika|sold|selling)/i,
  /(best|top)\s*(seller|product|item)/i,
]

export function parseCommand(input: string, products: Product[], customers: Customer[]): ParsedCommand {
  const trimmed = input.trim()
  if (!trimmed) return { type: 'unknown', confidence: 0, raw: input }

  // Try sale patterns
  for (const pattern of SALE_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      const qty = parseFloat(match[1] || match[2])
      const productName = (match[2] || match[3] || '').trim()
      
      if (!isNaN(qty) && productName) {
        const matchedProducts = fuzzyMatchProducts(productName, products)
        return {
          type: 'sale',
          confidence: matchedProducts.length > 0 ? 0.8 : 0.5,
          data: { quantity: qty, productName },
          matches: { products: matchedProducts },
          raw: input,
        }
      }
    }
  }

  // Try udhaar patterns
  for (const pattern of UDHAAR_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      const customerName = (match[1] || '').trim()
      const amount = parseInt(match[2] || match[3] || '0')
      
      if (customerName && amount > 0) {
        const matchedCustomers = fuzzyMatchCustomers(customerName, customers)
        return {
          type: 'udhaar',
          confidence: matchedCustomers.length > 0 ? 0.8 : 0.6,
          data: { customerName, amount, amountPaisa: rupeesToPaisa(amount) },
          matches: { customers: matchedCustomers },
          raw: input,
        }
      }
    }
  }

  // Try stock query
  for (const pattern of STOCK_QUERY_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      const productName = (match[1] || match[2] || '').trim()
      if (productName && productName.length > 2) {
        const matchedProducts = fuzzyMatchProducts(productName, products)
        return {
          type: 'stock_query',
          confidence: matchedProducts.length > 0 ? 0.9 : 0.6,
          data: { productName },
          matches: { products: matchedProducts },
          raw: input,
        }
      }
    }
  }

  // Try sales query
  for (const pattern of SALES_QUERY_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match) {
      return {
        type: 'sales_query',
        confidence: 0.9,
        raw: input,
      }
    }
  }

  return { type: 'unknown', confidence: 0, raw: input }
}

function fuzzyMatchProducts(query: string, products: Product[]): Product[] {
  const q = query.toLowerCase()
  return products
    .filter(p => {
      const inName = p.name.toLowerCase().includes(q)
      const inAliases = p.aliases?.some(a => a.toLowerCase().includes(q))
      return inName || inAliases
    })
    .slice(0, 5) // Limit to 5 matches
}

function fuzzyMatchCustomers(query: string, customers: Customer[]): Customer[] {
  const q = query.toLowerCase()
  return customers
    .filter(c => c.name.toLowerCase().includes(q))
    .slice(0, 5)
}

// Example usage strings for UI hints
export const COMMAND_EXAMPLES = {
  en: [
    '5 biscuit packets sold',
    'sold 10 rice bags',
    'Ali took 500 rupees credit',
    'atta stock',
    'best seller',
  ],
  ur: [
    '5 بسکٹ پیکٹ بکے',
    'علی نے 500 روپے ادھار لیے',
    'آٹے کا اسٹاک کتنا ہے',
  ],
  roman: [
    '5 biscuit packet bechay',
    'Ali ne 500 rupay udhaar liye',
    'atta ka stock kitna hai',
    'sab se zyada kya bika',
  ],
}
