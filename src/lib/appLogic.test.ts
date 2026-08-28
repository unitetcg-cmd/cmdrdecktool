import { describe, expect, it } from 'vitest'
import { parseInventoryCsv, normalizeCardName, ownedQty } from './inventory.ts'
import { toManaPoolUrl, toTcgPlayerUrl, ebayListing, decklistText } from './exports.ts'
import { validateDeck } from './deckBuilder.ts'
import { identityQuery, pipString, withinIdentityQuery } from './scryfall.ts'
import type { DeckEntry, GeneratedDeck, ScryfallCard } from '../types.ts'

function fakeCard(name: string, extra?: Partial<ScryfallCard>): ScryfallCard {
  return {
    id: name,
    oracle_id: `oracle-${name}`,
    name,
    type_line: extra?.type_line ?? 'Creature',
    cmc: 1,
    color_identity: extra?.color_identity ?? ['G'],
    legalities: { commander: 'legal' },
    prices: { usd: extra?.prices?.usd ?? '0.10' },
    set: 'm21',
    set_name: 'Core Set 2021',
    collector_number: '1',
    rarity: 'common',
    ...extra,
  }
}

describe('inventory csv', () => {
  it('parses headered csv and qty-name lines', () => {
    const map = parseInventoryCsv(`name,quantity\nSol Ring,2\nIsland,12`)
    expect(ownedQty(map, 'Sol Ring')).toBe(2)
    expect(ownedQty(map, 'Island')).toBe(12)
  })

  it('parses decklist-style lines', () => {
    const map = parseInventoryCsv(`1 Arcane Signet\n4x Forest`)
    expect(ownedQty(map, 'Arcane Signet')).toBe(1)
    expect(ownedQty(map, 'Forest')).toBe(4)
  })

  it('normalizes punctuation and DFC faces', () => {
    expect(normalizeCardName("Wear // Tear")).toBe('wear')
    expect(normalizeCardName("Sensei's Divining Top")).toBe('senseis divining top')
  })
})

describe('vendor urls', () => {
  it('builds URL-safe ManaPool add-deck links', () => {
    const url = toManaPoolUrl([{ qty: 1, name: 'Madame Masque' }])
    expect(url).toBe('https://manapool.com/add-deck?deck=MSBNYWRhbWUgTWFzcXVl')
  })

  it('builds TCGPlayer mass-entry with Magic product line', () => {
    const url = toTcgPlayerUrl([
      { qty: 1, name: 'Sol Ring' },
      { qty: 2, name: 'Command Tower' },
    ])
    expect(url).toBe(
      'https://www.tcgplayer.com/massentry?productLineName=magic&c=1+Sol+Ring||2+Command+Tower',
    )
  })
})

describe('exports', () => {
  const commander = fakeCard('Krenko, Mob Boss', {
    type_line: 'Legendary Creature — Goblin Warrior',
    color_identity: ['R'],
  })
  const deck: GeneratedDeck = {
    commander,
    entries: [
      { card: commander, qty: 1, isCommander: true },
      { card: fakeCard('Lightning Bolt', { type_line: 'Instant', color_identity: ['R'] }), qty: 1, isCommander: false },
    ],
    totalUsd: 1.23,
    theme: 'Goblins',
    powerLevel: 'focused',
    maxTotalUsd: 100,
    warnings: [],
  }

  it('writes a text decklist with commander section', () => {
    const text = decklistText(deck)
    expect(text).toContain('Commander')
    expect(text).toContain('1 Krenko, Mob Boss')
    expect(text).toContain('1 Lightning Bolt')
  })

  it('builds an eBay listing with title and decklist', () => {
    const listing = ebayListing(deck)
    expect(listing.title.toLowerCase()).toContain('krenko')
    expect(listing.body).toContain('DECKLIST')
    expect(listing.body).toContain('Lightning Bolt')
  })
})

describe('color identity queries', () => {
  it('emits Scryfall pips in WUBRG order', () => {
    expect(pipString(['G', 'W'])).toBe('wg')
    expect(identityQuery(['G', 'W'])).toBe('id:wg')
    expect(withinIdentityQuery(['R', 'U'])).toBe('id<=ur')
    expect(identityQuery(['C'])).toBe('id:c')
  })
})

describe('validateDeck', () => {
  it('flags non-100 lists and identity breaks', () => {
    const commander = fakeCard('Krenko, Mob Boss', {
      type_line: 'Legendary Creature — Goblin Warrior',
      color_identity: ['R'],
    })
    const entries: DeckEntry[] = [
      { card: commander, qty: 1, isCommander: true },
      { card: fakeCard('Counterspell', { color_identity: ['U'], type_line: 'Instant' }), qty: 1, isCommander: false },
    ]
    const warnings = validateDeck(entries, commander)
    expect(warnings.some((w) => w.includes('100'))).toBe(true)
    expect(warnings.some((w) => w.includes('color identity'))).toBe(true)
  })
})
