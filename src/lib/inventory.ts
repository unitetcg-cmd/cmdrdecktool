import type { InventoryMap } from '../types.ts'

export type { InventoryMap }

export const INVENTORY_STORAGE_KEY = 'unite-tcg-cmdr-inventory-v1'

export function normalizeCardName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/\s*\/\/\s*.*$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function loadInventory(): InventoryMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(INVENTORY_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as InventoryMap
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

export function saveInventory(map: InventoryMap): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(map))
}

export function clearInventory(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(INVENTORY_STORAGE_KEY)
}

export function ownedQty(map: InventoryMap, name: string): number {
  return map[normalizeCardName(name)] ?? 0
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur.trim())
  return out
}

const QTY_HEADERS = new Set(['qty', 'quantity', 'count', 'owned', 'copies'])
const NAME_HEADERS = new Set(['name', 'card', 'card name', 'cardname'])

export function parseInventoryCsv(text: string): InventoryMap {
  const map: InventoryMap = {}
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))

  if (lines.length === 0) return map

  const firstCells = parseCsvLine(lines[0] ?? '')
  const headerish = firstCells.map((c) => c.toLowerCase())
  const nameIdx = headerish.findIndex((h) => NAME_HEADERS.has(h))
  const qtyIdx = headerish.findIndex((h) => QTY_HEADERS.has(h))
  const hasHeader = nameIdx >= 0

  const start = hasHeader ? 1 : 0
  for (let i = start; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const qtyName = line.match(/^(\d+)\s*[xX]?\s+(.+)$/)
    if (!hasHeader && qtyName) {
      const qty = Number.parseInt(qtyName[1] ?? '1', 10)
      const name = qtyName[2] ?? ''
      add(map, name, qty)
      continue
    }

    const cells = parseCsvLine(line)
    if (hasHeader) {
      const name = cells[nameIdx] ?? ''
      const qtyRaw = qtyIdx >= 0 ? cells[qtyIdx] : '1'
      const qty = Number.parseInt(qtyRaw || '1', 10)
      add(map, name, Number.isFinite(qty) ? qty : 1)
      continue
    }

    if (cells.length >= 2 && /^\d+$/.test(cells[0] ?? '')) {
      add(map, cells[1] ?? '', Number.parseInt(cells[0] ?? '1', 10))
    } else if (cells.length >= 2 && /^\d+$/.test(cells[1] ?? '')) {
      add(map, cells[0] ?? '', Number.parseInt(cells[1] ?? '1', 10))
    } else if (cells[0]) {
      add(map, cells[0], 1)
    }
  }
  return map
}

function add(map: InventoryMap, name: string, qty: number): void {
  const key = normalizeCardName(name)
  if (!key || !Number.isFinite(qty) || qty <= 0) return
  map[key] = (map[key] ?? 0) + qty
}

export function uniqueCardCount(map: InventoryMap): number {
  return Object.keys(map).length
}

export function totalOwnedCount(map: InventoryMap): number {
  return Object.values(map).reduce((a, b) => a + b, 0)
}
