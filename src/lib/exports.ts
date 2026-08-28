import type { DeckEntry, GeneratedDeck } from '../types.ts'
import { cardPrice, frontName } from './scryfall.ts'
import { ownedQty, type InventoryMap } from './inventory.ts'

export function deckQtyTotal(entries: DeckEntry[]): number {
  return entries.reduce((sum, e) => sum + e.qty, 0)
}

export function collapsedNeedList(
  deck: GeneratedDeck,
  inventory: InventoryMap,
): { name: string; qty: number }[] {
  const need: { name: string; qty: number }[] = []
  for (const entry of deck.entries) {
    const have = ownedQty(inventory, entry.card.name)
    const missing = Math.max(0, entry.qty - have)
    if (missing > 0) {
      need.push({ name: frontName(entry.card), qty: missing })
    }
  }
  return need
}

export function ownedNeedTotals(
  deck: GeneratedDeck,
  inventory: InventoryMap,
): { owned: number; need: number; ownedUsd: number; needUsd: number } {
  let owned = 0
  let need = 0
  let ownedUsd = 0
  let needUsd = 0
  for (const entry of deck.entries) {
    const have = Math.min(entry.qty, ownedQty(inventory, entry.card.name))
    const missing = entry.qty - have
    const unit = cardPrice(entry.card)
    owned += have
    need += missing
    ownedUsd += have * unit
    needUsd += missing * unit
  }
  return { owned, need, ownedUsd, needUsd }
}

export function toManaPoolUrl(lines: { qty: number; name: string }[]): string {
  const text = lines.map((l) => `${l.qty} ${l.name}`).join('\n')
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  return `https://manapool.com/add-deck?deck=${b64}`
}

export function toTcgPlayerUrl(lines: { qty: number; name: string }[]): string {
  const c = lines.map((l) => `${l.qty}+${l.name.replace(/ /g, '+')}`).join('||')
  return `https://www.tcgplayer.com/massentry?productLineName=magic&c=${c}`
}

export function decklistText(deck: GeneratedDeck): string {
  const commander = deck.entries.find((e) => e.isCommander)
  const rest = deck.entries.filter((e) => !e.isCommander)
  const lines = [
    'Commander',
    `${commander?.qty ?? 1} ${commander?.card.name ?? deck.commander.name}`,
    '',
    'Deck',
    ...rest.map((e) => `${e.qty} ${e.card.name}`),
    '',
    `Estimated USD (cheap printings): $${deck.totalUsd.toFixed(2)}`,
    `Theme: ${deck.theme || '(none)'}`,
    `Power level: ${deck.powerLevel}`,
  ]
  return lines.join('\n')
}

export function ebayListing(deck: GeneratedDeck): { title: string; body: string } {
  const cmdr = deck.commander.name.split(' // ')[0] ?? deck.commander.name
  const price = deck.totalUsd.toFixed(2)
  const title = `Budget Commander EDH Deck Lot - ${cmdr} - 100 Cards MTG Magic - $${price}`
    .slice(0, 80)

  const identity = deck.commander.color_identity.join('') || 'C'
  const list = deck.entries.map((e) => `${e.qty} ${e.card.name}`).join('\n')

  const body = [
    `${cmdr} Commander / EDH 100-card deck lot`,
    '',
    'Sold as a complete cheap Commander deck lot. Printings are budget-friendly copies (not collector/premium versions).',
    '',
    `Commander: ${deck.commander.name}`,
    `Color identity: ${identity}`,
    `Theme / strategy: ${deck.theme || 'General goodstuff'}`,
    `Power level: ${deck.powerLevel}`,
    `Estimated market (Scryfall USD, cheap printings): $${price}`,
    `Card count: ${deckQtyTotal(deck.entries)}`,
    '',
    'Condition: NM/LP mixed unless otherwise noted. No TCGPlayer tracking login required — this is a listing-ready export.',
    '',
    'DECKLIST',
    list,
    '',
    'Ships sleeved or bundled from Unite TCG. Message with questions before bidding/buying.',
  ].join('\n')

  return { title, body }
}

export function downloadTextFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function categoryOf(typeLine: string): string {
  const t = typeLine.toLowerCase()
  if (t.includes('battle')) return 'Battles'
  if (t.includes('planeswalker')) return 'Planeswalkers'
  if (t.includes('creature')) return 'Creatures'
  if (t.includes('land')) return 'Lands'
  if (t.includes('instant')) return 'Instants'
  if (t.includes('sorcery')) return 'Sorceries'
  if (t.includes('artifact')) return 'Artifacts'
  if (t.includes('enchantment')) return 'Enchantments'
  return 'Other'
}

export const CATEGORY_ORDER = [
  'Commander',
  'Creatures',
  'Planeswalkers',
  'Instants',
  'Sorceries',
  'Artifacts',
  'Enchantments',
  'Battles',
  'Lands',
  'Other',
]
