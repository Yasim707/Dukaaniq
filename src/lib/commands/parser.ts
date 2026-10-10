/**
 * Offline command parser for natural-language shop commands in
 * English, Urdu, and Roman Urdu.
 *
 * Design goals
 * ------------
 * - Robust to word order, punctuation, filler words and casing.
 * - Understands digits, English number words and Urdu number words.
 * - Keyword/intent based rather than a single brittle regex, so phrasings
 *   like "becha 5 biscuit", "5 biscuit sold", "biscuit 5 bik gaye" all work.
 * - Produces a scored fuzzy match against the shop's own products/customers.
 *
 * Supported intents
 * -----------------
 *  sale         "5 biscuit sold"          → record a sale
 *  restock      "add 10 rice bags"        → add stock (purchase)
 *  udhaar       "Ali took 500 credit"     → add credit to a customer
 *  payment      "Ali paid 300"            → customer repays udhaar
 *  stock_query  "atta stock kitna hai"    → show current stock
 *  sales_query  "best seller"             → best-selling product
 *  unknown      (fallback)
 */

import type { Product, Customer } from '../../types'
import { rupeesToPaisa } from '../format'

export type CommandType =
  | 'sale'
  | 'restock'
  | 'udhaar'
  | 'payment'
  | 'stock_query'
  | 'sales_query'
  | 'unknown'

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

// ─── Keyword dictionaries (en / roman urdu / urdu) ──────────────────────────────

const KEYWORDS = {
  sale: [
    'sold', 'sale', 'sell', 'becha', 'becha', 'bechay', 'beche', 'bech',
    'bika', 'bike', 'bik', 'bikri', 'gaya', 'gayi', 'gaye', 'بیچ', 'بکا', 'بکے', 'بک',
  ],
  restock: [
    'add', 'added', 'restock', 'purchase', 'purchased', 'bought', 'buy',
    'khareeda', 'kharida', 'kharidi', 'laya', 'laaya', 'stock in', 'add stock',
    'خرید', 'لایا',
  ],
  udhaar: [
    'udhaar', 'udhar', 'credit', 'loan', 'liya', 'liye', 'lia', 'li', 'took', 'take',
    'ادھار', 'قرض', 'لیا', 'لیے',
  ],
  payment: [
    'paid', 'pay', 'payment', 'returned', 'return', 'wapas', 'wapis', 'jama', 'jma',
    'ada', 'diya', 'diye', 'dia', 'cleared', 'repaid', 'repay', 'settle', 'settled',
    'ادا', 'جمع', 'واپس', 'دیا', 'دیے',
  ],
  stockQuery: [
    'stock', 'kitna', 'kitne', 'kitni', 'how much', 'how many', 'available',
    'bacha', 'bache', 'bachi', 'remaining', 'left', 'quantity', 'qty',
    'اسٹاک', 'سٹاک', 'کتنا', 'کتنے', 'باقی', 'بچا',
  ],
  salesQuery: [
    'best seller', 'best selling', 'top seller', 'top product', 'most sold',
    'sabse zyada', 'sab se zyada', 'zyada bika', 'zyada bike', 'top sellers',
    'سب سے زیادہ', 'سبسے زیادہ',
  ],
  // currency words to strip out when they trail an amount
  money: ['rupees', 'rupee', 'rupay', 'rupaye', 'rupaiya', 'rs', 'pkr', ' pkr', 'روپے', 'روپیہ'],
}

// Filler / stop words to drop when extracting a product or customer name.
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'for', 'to', 'is', 'are', 'was', 'were', 'has', 'have',
  'me', 'my', 'ka', 'ki', 'ke', 'ko', 'ne', 'se', 'hai', 'hain', 'ho', 'gaya', 'gayi', 'gaye',
  'please', 'plz', 'kitna', 'kitne', 'kitni', 'how', 'much', 'many', 'kya', 'kia',
  'packet', 'packets', 'piece', 'pieces', 'pcs', 'bag', 'bags', 'bottle', 'bottles',
  'box', 'boxes', 'kg', 'gram', 'grams', 'litre', 'litres', 'liter', 'dozen',
  // all the intent keywords double as stop words when extracting names
  ...KEYWORDS.sale, ...KEYWORDS.restock, ...KEYWORDS.udhaar, ...KEYWORDS.payment,
  ...KEYWORDS.stockQuery, ...KEYWORDS.money,
])

// ─── Number parsing (English + Urdu words, Urdu-Indic digits) ───────────────────

const WORD_NUMBERS: Record<string, number> = {
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, hundred: 100, thousand: 1000, dozen: 12,
  // Roman Urdu
  aik: 1, ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chay: 6, che: 6,
  saat: 7, aath: 8, aat: 8, nau: 9, das: 10, dus: 10, bees: 20, pachaas: 50, pachas: 50,
  sau: 100, hazaar: 1000, hazar: 1000,
}

// Urdu-Indic digit → ASCII digit
const URDU_DIGITS: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
}

function normalize(input: string): string {
  let s = input.toLowerCase().trim()
  // convert Urdu-Indic digits to ascii
  s = s.replace(/[۰-۹]/g, d => URDU_DIGITS[d] ?? d)
  // normalize whitespace & strip most punctuation (keep letters, digits, dot, spaces)
  s = s.replace(/[,/\\|!?;:"'()\[\]{}]/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/** Pull the first numeric value out of the text: digits or a number word. */
function extractNumber(tokens: string[]): number | null {
  for (const t of tokens) {
    if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t)
  }
  // word numbers (handle simple "ek sau" = 100, "do sau" = 200 style loosely)
  for (let i = 0; i < tokens.length; i++) {
    const n = WORD_NUMBERS[tokens[i]]
    if (n != null) {
      // "do sau" / "ek hazaar" multipliers
      const next = tokens[i + 1]
      if (next && (WORD_NUMBERS[next] === 100 || WORD_NUMBERS[next] === 1000) && n < 100) {
        return n * WORD_NUMBERS[next]
      }
      return n
    }
  }
  return null
}

function hasKeyword(text: string, list: string[]): boolean {
  return list.some(k => {
    if (k.includes(' ')) return text.includes(k)
    // whole-word match for single tokens to avoid false positives
    return new RegExp(`(^|\\s)${escapeRe(k)}(\\s|$)`).test(text)
  })
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Remove numbers, currency words and stop words to leave the entity name. */
function extractName(tokens: string[]): string {
  return tokens
    .filter(t => !/^\d+(\.\d+)?$/.test(t))
    .filter(t => !STOP_WORDS.has(t))
    .filter(t => WORD_NUMBERS[t] == null)
    .join(' ')
    .trim()
}

// ─── Main entry ─────────────────────────────────────────────────────────────────

export function parseCommand(input: string, products: Product[], customers: Customer[]): ParsedCommand {
  const raw = input
  const text = normalize(input)
  if (!text) return { type: 'unknown', confidence: 0, raw }

  const tokens = text.split(' ')
  const num = extractNumber(tokens)
  const name = extractName(tokens)

  // 1) Sales query (no entity / number needed) — check first, it's specific.
  if (hasKeyword(text, KEYWORDS.salesQuery)) {
    return { type: 'sales_query', confidence: 0.9, raw }
  }

  const isSale = hasKeyword(text, KEYWORDS.sale)
  const isRestock = hasKeyword(text, KEYWORDS.restock)
  const isUdhaar = hasKeyword(text, KEYWORDS.udhaar)
  const isPayment = hasKeyword(text, KEYWORDS.payment)
  const isStockQuery = hasKeyword(text, KEYWORDS.stockQuery)

  // 2) Payment: customer repays credit. "Ali paid 300", "Ali ne 300 jama karaye"
  //    Checked before udhaar because "paid" is unambiguous.
  if (isPayment && num && num > 0) {
    const customerName = extractName(tokens)
    const matched = fuzzyMatchCustomers(customerName, customers)
    return {
      type: 'payment',
      confidence: matched.length ? 0.85 : 0.6,
      data: { customerName, amount: num, amountPaisa: rupeesToPaisa(num) },
      matches: { customers: matched },
      raw,
    }
  }

  // 3) Udhaar: customer takes credit. "Ali took 500 credit", "Ali ne 500 udhaar liye"
  if (isUdhaar && num && num > 0) {
    const customerName = extractName(tokens)
    const matched = fuzzyMatchCustomers(customerName, customers)
    return {
      type: 'udhaar',
      confidence: matched.length ? 0.85 : 0.6,
      data: { customerName, amount: num, amountPaisa: rupeesToPaisa(num) },
      matches: { customers: matched },
      raw,
    }
  }

  // 4) Restock: add stock. "add 10 rice bags", "10 atta khareeda"
  if (isRestock && num && num > 0) {
    const matched = fuzzyMatchProducts(name, products)
    return {
      type: 'restock',
      confidence: matched.length ? 0.85 : 0.5,
      data: { quantity: num, productName: name },
      matches: { products: matched },
      raw,
    }
  }

  // 5) Sale: "5 biscuit sold", "becha 5 biscuit", "biscuit 5 bik gaye"
  if (isSale && num && num > 0 && name) {
    const matched = fuzzyMatchProducts(name, products)
    return {
      type: 'sale',
      confidence: matched.length ? 0.85 : 0.5,
      data: { quantity: num, productName: name },
      matches: { products: matched },
      raw,
    }
  }

  // 6) Stock query: "atta stock", "rice kitna bacha hai"
  if (isStockQuery && name) {
    const matched = fuzzyMatchProducts(name, products)
    return {
      type: 'stock_query',
      confidence: matched.length ? 0.9 : 0.5,
      data: { productName: name },
      matches: { products: matched },
      raw,
    }
  }

  // 7) Heuristic fallbacks when no explicit verb was given:
  //    "5 biscuit" (number + product) → treat as a sale.
  if (num && num > 0 && name) {
    const matchedProducts = fuzzyMatchProducts(name, products)
    if (matchedProducts.length) {
      return {
        type: 'sale',
        confidence: 0.55,
        data: { quantity: num, productName: name },
        matches: { products: matchedProducts },
        raw,
      }
    }
    // number + unknown name but matches a customer → likely udhaar
    const matchedCustomers = fuzzyMatchCustomers(name, customers)
    if (matchedCustomers.length) {
      return {
        type: 'udhaar',
        confidence: 0.5,
        data: { customerName: name, amount: num, amountPaisa: rupeesToPaisa(num) },
        matches: { customers: matchedCustomers },
        raw,
      }
    }
  }

  //    Just a product name with no number → stock query.
  if (!num && name) {
    const matched = fuzzyMatchProducts(name, products)
    if (matched.length) {
      return {
        type: 'stock_query',
        confidence: 0.5,
        data: { productName: name },
        matches: { products: matched },
        raw,
      }
    }
  }

  return { type: 'unknown', confidence: 0, raw }
}

// ─── Fuzzy matching ─────────────────────────────────────────────────────────────

/**
 * Score a product/customer against the query using a mix of:
 *  - exact / substring match on name
 *  - alias substring match
 *  - per-token overlap (handles reordered or partial words)
 * Returns ranked results, best first.
 */
function fuzzyMatchProducts(query: string, products: Product[]): Product[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const qTokens = q.split(' ').filter(Boolean)

  const scored = products
    .map(p => ({ p, score: scoreMatch(q, qTokens, [p.name, ...(p.aliases ?? [])]) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)

  // If there's a clearly dominant match, return just it; otherwise top 5 candidates.
  if (scored.length && scored[0].score >= 0.95) return [scored[0].p]
  return scored.slice(0, 5).map(x => x.p)
}

function fuzzyMatchCustomers(query: string, customers: Customer[]): Customer[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const qTokens = q.split(' ').filter(Boolean)

  const scored = customers
    .map(c => ({ c, score: scoreMatch(q, qTokens, [c.name]) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length && scored[0].score >= 0.95) return [scored[0].c]
  return scored.slice(0, 5).map(x => x.c)
}

/** Returns 0..1 score of how well the query matches any of the candidate strings. */
function scoreMatch(q: string, qTokens: string[], candidates: string[]): number {
  let best = 0
  for (const raw of candidates) {
    const c = raw.toLowerCase().trim()
    if (!c) continue

    if (c === q) { best = Math.max(best, 1); continue }
    if (c.includes(q) || q.includes(c)) { best = Math.max(best, 0.96); continue }

    // token overlap
    const cTokens = c.split(' ').filter(Boolean)
    let hits = 0
    for (const qt of qTokens) {
      if (cTokens.some(ct => ct === qt || ct.includes(qt) || qt.includes(ct))) hits++
    }
    if (hits > 0) {
      const overlap = hits / Math.max(qTokens.length, cTokens.length)
      best = Math.max(best, 0.5 + overlap * 0.4) // 0.5..0.9
    }
  }
  return best
}

// ─── Example usage strings for UI hints ─────────────────────────────────────────

export const COMMAND_EXAMPLES: Record<string, string[]> = {
  en: [
    '5 biscuit packets sold',
    'add 10 rice bags',
    'Ali took 500 rupees credit',
    'Ali paid 300',
    'atta stock',
    'best seller',
  ],
  ur: [
    '5 بسکٹ بکے',
    '10 چاول کے تھیلے خریدے',
    'علی نے 500 روپے ادھار لیے',
    'علی نے 300 روپے جمع کرائے',
    'آٹے کا اسٹاک کتنا ہے',
  ],
  roman: [
    '5 biscuit packet bechay',
    '10 chawal kharide',
    'Ali ne 500 rupay udhaar liye',
    'Ali ne 300 wapas kiye',
    'atta ka stock kitna hai',
    'sab se zyada kya bika',
  ],
}
