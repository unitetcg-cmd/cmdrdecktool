import { describe, expect, it } from 'vitest'
import { generateDeck } from './deckBuilder.ts'
import { cardPrice, colorIdentityOk, isBasicLand } from './scryfall.ts'

const live = process.env.LIVE_SCRYFALL === '1'

describe.skipIf(!live)('live Scryfall commander deck', () => {
  it(
    'generates a legal 100-card cheap deck from api.scryfall.com',
    { timeout: 90_000 },
    async () => {
      const deck = await generateDeck({
        commanderName: '',
        theme: 'Tokens',
        colors: ['G', 'W'],
        maxTotalUsd: 75,
        powerLevel: 'focused',
        scryfallBase: 'https://api.scryfall.com',
      })

      const total = deck.entries.reduce((s, e) => s + e.qty, 0)
      expect(total).toBe(100)
      expect(deck.entries.some((e) => e.isCommander)).toBe(true)
      expect(deck.commander.legalities.commander).toBe('legal')

      const identity = deck.commander.color_identity
      for (const entry of deck.entries) {
        expect(colorIdentityOk(entry.card, identity)).toBe(true)
        expect(entry.card.legalities.commander).toBe('legal')
        if (!isBasicLand(entry.card) && !entry.isCommander) {
          expect(entry.qty).toBe(1)
        }
      }

      expect(deck.totalUsd).toBeLessThanOrEqual(75 + 8)
      expect(cardPrice(deck.commander)).toBeGreaterThan(0)
      expect(deck.entries[0]?.card.name.length).toBeGreaterThan(0)
    },
  )
})
