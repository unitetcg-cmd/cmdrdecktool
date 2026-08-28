import type {
  ColorCode,
  GeneratedDeck,
  GenerateOptions,
  PowerLevel,
  ScryfallCard,
  DeckEntry,
} from '../types.ts'
import {
  cardPrice,
  colorIdentityOk,
  getScryfallBase,
  identityQuery,
  isBasicLand,
  isCreature,
  isLand,
  isLegalCommander,
  namedCard,
  oracleText,
  randomCard,
  searchCards,
  withinIdentityQuery,
} from './scryfall.ts'

const BASIC_NAMES: Record<string, string> = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
  C: 'Wastes',
}

const THEME_HINTS: Record<string, string[]> = {
  mill: ['mill', 'put the top', 'from the top of', 'into their graveyard'],
  blink: ['blink', 'flicker', 'exile', 'return', 'battlefield'],
  token: ['token', 'create a', 'create two', 'create three'],
  tokens: ['token', 'create a', 'create two'],
  artifact: ['artifact'],
  artifacts: ['artifact'],
  treasure: ['treasure'],
  graveyard: ['graveyard'],
  reanimator: ['graveyard', 'return', 'creature card'],
  counters: ['+1/+1', 'counter'],
  spellslinger: ['instant', 'sorcery'],
  dragons: ['dragon'],
  dragon: ['dragon'],
  elves: ['elf', 'elves'],
  zombies: ['zombie'],
  vampires: ['vampire'],
  goblins: ['goblin'],
  aristocrats: ['sacrifice', 'dies', 'drain'],
  voltron: ['equip', 'aura', 'commander'],
  stompy: ['creature', 'power', 'trample'],
  control: ['counter', 'draw', 'destroy'],
  ramp: ['search your library', 'add {', 'land'],
  stax: ['skip', "can't", 'tax', 'sphere'],
  lands: ['landfall', 'land'],
  landfall: ['landfall', 'land enters'],
  enchantress: ['enchantment'],
  auras: ['aura', 'enchant'],
  equipment: ['equipment', 'equip'],
  sacrifice: ['sacrifice'],
  tokensac: ['token', 'sacrifice'],
  energy: ['energy'],
  modified: ['modified', '+1/+1', 'aura', 'equipment'],
  clone: ['copy', 'clone'],
  extra: ['extra turn', 'extra combat'],
  lifegain: ['life', 'gain'],
  burn: ['damage', 'burn'],
  infect: ['infect', 'poison', 'toxic'],
  proliferate: ['proliferate', 'counter'],
}

function themeWords(theme: string): string[] {
  const raw = theme
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1)
  const extra: string[] = []
  for (const w of raw) {
    extra.push(...(THEME_HINTS[w] ?? []))
  }
  return [...new Set([...raw, ...extra])]
}

function themeQuery(theme: string): string {
  const words = theme
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((w) => w.length > 2)
  if (words.length === 0) return ''
  return words.map((w) => `(o:${w} OR t:${w} OR name:${w})`).join(' ')
}

function unitCap(maxTotal: number, level: PowerLevel): number {
  if (level === 'casual') return Math.min(1.75, Math.max(0.4, maxTotal / 45))
  if (level === 'optimized') return Math.min(12, Math.max(0.8, maxTotal / 10))
  return Math.min(4.5, Math.max(0.55, maxTotal / 20))
}

function landTarget(level: PowerLevel): number {
  if (level === 'casual') return 38
  if (level === 'optimized') return 35
  return 36
}

function isRamp(card: ScryfallCard): boolean {
  if (isLand(card)) return false
  if (card.cmc > 5) return false
  const t = oracleText(card).toLowerCase()
  const type = card.type_line.toLowerCase()
  if (type.includes('artifact') && /add \{|add one mana|add two mana|\{t\}:.*add/.test(t)) return true
  if (/search your library for .*(land|plains|island|swamp|mountain|forest)/.test(t)) return true
  if (type.includes('creature') && card.cmc <= 3 && /\{t\}:.*add |add \{[wubrgc]/.test(t)) return true
  return false
}

function isDraw(card: ScryfallCard): boolean {
  if (isLand(card)) return false
  return /draw (a|one|two|three|[0-9]+) cards?/.test(oracleText(card).toLowerCase())
}

function isRemoval(card: ScryfallCard): boolean {
  if (isLand(card)) return false
  return /(destroy target|exile target|counter target spell|fights? target|damage to any target|damage to target)/.test(
    oracleText(card).toLowerCase(),
  )
}

function matchesTheme(card: ScryfallCard, words: string[]): boolean {
  if (words.length === 0) return false
  const text = `${card.name} ${card.type_line} ${oracleText(card)}`.toLowerCase()
  return words.some((w) => w.length > 2 && text.includes(w))
}

function scoreCard(
  card: ScryfallCard,
  words: string[],
  level: PowerLevel,
): number {
  let s = 0
  const text = `${card.name} ${card.type_line} ${oracleText(card)}`.toLowerCase()
  for (const w of words) {
    if (w.length > 1 && text.includes(w)) s += 45
  }
  if (level === 'focused' && matchesTheme(card, words)) s += 30
  if (level === 'optimized' && card.edhrec_rank) {
    s += Math.max(0, 50 - card.edhrec_rank / 400)
  }
  if (level === 'casual') {
    if (isCreature(card)) s += 10
    if (card.cmc <= 4) s += 6
  }
  if (isRamp(card)) s += 8
  if (isDraw(card)) s += 8
  if (isRemoval(card)) s += 7
  s -= Math.min(cardPrice(card), 6)
  return s
}

function usable(
  card: ScryfallCard,
  identity: string[],
  used: Set<string>,
  commanderOracle: string,
): boolean {
  if (used.has(card.oracle_id) || used.has(card.name.toLowerCase())) return false
  if (card.oracle_id === commanderOracle) return false
  if (card.legalities?.commander !== 'legal') return false
  if (!colorIdentityOk(card, identity)) return false
  if (card.layout === 'token' || card.layout === 'emblem') return false
  return true
}

type PickCtx = {
  used: Set<string>
  identity: string[]
  commanderOracle: string
  spent: number
  maxTotal: number
  maxUnit: number
  slotsLeft: number
}

function pickCards(
  pool: ScryfallCard[],
  want: number,
  ctx: PickCtx,
  reservePerSlot = 0.02,
): ScryfallCard[] {
  const out: ScryfallCard[] = []
  for (const card of pool) {
    if (out.length >= want) break
    if (!usable(card, ctx.identity, ctx.used, ctx.commanderOracle)) continue
    if (isBasicLand(card)) continue
    const price = cardPrice(card)
    if (price > ctx.maxUnit) continue
    const slotsAfter = ctx.slotsLeft - 1
    const reserved = Math.max(0, slotsAfter) * reservePerSlot
    if (ctx.spent + price + reserved > ctx.maxTotal + 0.5) continue
    out.push(card)
    ctx.used.add(card.oracle_id)
    ctx.used.add(card.name.toLowerCase())
    ctx.spent += price
    ctx.slotsLeft -= 1
  }
  return out
}

function addEntry(entries: DeckEntry[], card: ScryfallCard, qty = 1, isCommander = false) {
  const existing = entries.find((e) => e.card.oracle_id === card.oracle_id)
  if (existing) {
    existing.qty += qty
    return
  }
  entries.push({ card, qty, isCommander })
}

async function resolveCommander(
  opts: GenerateOptions,
  base: string,
): Promise<ScryfallCard> {
  const name = opts.commanderName.trim()
  if (name) {
    opts.onStatus?.(`Looking up commander “${name}”…`)
    const card = await namedCard(name, base)
    if (!isLegalCommander(card)) {
      throw new Error(
        `${card.name} is not a legal commander. Try a legendary creature, or leave the field blank for a random commander.`,
      )
    }
    return card
  }

  const colorFilter = opts.colors.length ? identityQuery(opts.colors) : ''
  const usd = Math.min(6, Math.max(0.4, opts.maxTotalUsd / 20)).toFixed(2)
  const query = [
    'is:commander',
    'f:commander',
    'game:paper',
    `usd<=${usd}`,
    colorFilter,
  ]
    .filter(Boolean)
    .join(' ')

  opts.onStatus?.('Picking a random commander…')
  try {
    return await randomCard(query, base)
  } catch {
    try {
      return await randomCard(
        ['is:commander', 'f:commander', 'game:paper', colorFilter].filter(Boolean).join(' '),
        base,
      )
    } catch {
      throw new Error(
        'Could not find a legal commander for that color identity and budget. Try different colors or a named commander.',
      )
    }
  }
}

function mergeUnique(pools: ScryfallCard[][]): ScryfallCard[] {
  const seen = new Set<string>()
  const out: ScryfallCard[] = []
  for (const pool of pools) {
    for (const card of pool) {
      if (seen.has(card.oracle_id)) continue
      seen.add(card.oracle_id)
      out.push(card)
    }
  }
  return out
}

function sortByScore(cards: ScryfallCard[], words: string[], level: PowerLevel): ScryfallCard[] {
  return [...cards].sort((a, b) => {
    const ds = scoreCard(b, words, level) - scoreCard(a, words, level)
    if (Math.abs(ds) > 0.01) return ds
    return cardPrice(a) - cardPrice(b)
  })
}

function basicsForIdentity(
  identity: string[],
  basicPool: ScryfallCard[],
): ScryfallCard[] {
  const colors = identity.length ? identity : ['C']
  const found: ScryfallCard[] = []
  for (const color of colors) {
    const want = BASIC_NAMES[color] ?? 'Wastes'
    const card = basicPool.find((c) => c.name === want)
    if (card) found.push(card)
  }
  if (found.length === 0) {
    const wastes = basicPool.find((c) => c.name === 'Wastes')
    if (wastes) found.push(wastes)
  }
  return found
}

function splitBasics(total: number, basics: ScryfallCard[]): { card: ScryfallCard; qty: number }[] {
  if (basics.length === 0 || total <= 0) return []
  const base = Math.floor(total / basics.length)
  let rem = total - base * basics.length
  return basics.map((card) => {
    const extra = rem > 0 ? 1 : 0
    rem -= extra
    return { card, qty: base + extra }
  })
}

export function validateDeck(entries: DeckEntry[], commander: ScryfallCard): string[] {
  const warnings: string[] = []
  const total = entries.reduce((s, e) => s + e.qty, 0)
  if (total !== 100) warnings.push(`Deck has ${total} cards (need 100).`)
  const identity = commander.color_identity
  const names = new Map<string, number>()
  for (const e of entries) {
    if (!colorIdentityOk(e.card, identity) && !e.isCommander) {
      warnings.push(`${e.card.name} is outside the commander’s color identity.`)
    }
    if (e.card.legalities?.commander && e.card.legalities.commander !== 'legal') {
      warnings.push(`${e.card.name} is not Commander-legal.`)
    }
    const key = e.card.name.toLowerCase()
    names.set(key, (names.get(key) ?? 0) + e.qty)
    if (!isBasicLand(e.card) && (names.get(key) ?? 0) > 1 && !e.isCommander) {
      warnings.push(`${e.card.name} appears more than once (singleton format).`)
    }
  }
  return warnings
}

export async function generateDeck(opts: GenerateOptions): Promise<GeneratedDeck> {
  const base = opts.scryfallBase ?? getScryfallBase()
  const commander = await resolveCommander(opts, base)
  const identity = commander.color_identity
  const idFilter = withinIdentityQuery(identity.length ? (identity as ColorCode[]) : ['C'])
  const cap = unitCap(opts.maxTotalUsd, opts.powerLevel)
  const words = themeWords(opts.theme)
  const legal = `f:commander game:paper -is:digital`
  const warnings: string[] = []

  if (
    opts.colors.length > 0 &&
    opts.commanderName.trim() &&
    !identityMatchesSelection(identity, opts.colors)
  ) {
    warnings.push(
      `${commander.name}’s color identity (${identity.join('') || 'C'}) differs from the selected colors. The deck uses the commander’s identity.`,
    )
  }

  opts.onStatus?.('Searching Scryfall for cheap, legal cards…')
  const tq = themeQuery(opts.theme)
  const themeCards = tq
    ? await searchCards(`${legal} ${idFilter} ${tq} usd<=${cap.toFixed(2)} -t:land`, {
        order: 'usd',
        pages: 2,
        base,
      })
    : []

  const cheapSpells = await searchCards(
    `${legal} ${idFilter} usd<=${Math.min(cap, opts.powerLevel === 'casual' ? 0.6 : 1.25).toFixed(2)} -t:land`,
    { order: 'usd', pages: 2, base },
  )

  const stapleQuery =
    opts.powerLevel === 'casual'
      ? `${legal} ${idFilter} usd<=${cap.toFixed(2)} -t:land t:creature`
      : `${legal} ${idFilter} usd<=${cap.toFixed(2)} -t:land edhrec<=8000`

  const staples = await searchCards(stapleQuery, { order: 'usd', pages: 1, base })

  const lands = await searchCards(
    `${legal} ${idFilter} t:land usd<=${Math.min(cap, 1.75).toFixed(2)}`,
    { order: 'usd', pages: 1, base },
  )

  const basics = await searchCards(
    '!"Plains" OR !"Island" OR !"Swamp" OR !"Mountain" OR !"Forest" OR !"Wastes"',
    { order: 'usd', unique: 'cards', pages: 1, base },
  )

  const spellPool = sortByScore(
    mergeUnique([themeCards, staples, cheapSpells]),
    words,
    opts.powerLevel,
  )
  const landPool = sortByScore(
    lands.filter((c) => isLand(c)),
    words,
    opts.powerLevel,
  )
  const basicCards = basicsForIdentity(identity, basics)

  const used = new Set<string>([commander.oracle_id, commander.name.toLowerCase()])
  const ctx: PickCtx = {
    used,
    identity,
    commanderOracle: commander.oracle_id,
    spent: cardPrice(commander),
    maxTotal: opts.maxTotalUsd,
    maxUnit: cap,
    slotsLeft: 99,
  }

  const entries: DeckEntry[] = [{ card: commander, qty: 1, isCommander: true }]
  const landsWanted = landTarget(opts.powerLevel)
  const spellWanted = 99 - landsWanted

  const themeWant = opts.theme.trim()
    ? opts.powerLevel === 'focused'
      ? 28
      : opts.powerLevel === 'optimized'
        ? 20
        : 16
    : 0
  const rampWant = opts.powerLevel === 'casual' ? 8 : 10
  const drawWant = opts.powerLevel === 'optimized' ? 11 : 9
  const removalWant = 8

  opts.onStatus?.('Assembling a 100-card list under budget…')

  const themePicked = pickCards(
    spellPool.filter((c) => matchesTheme(c, words) && !isLand(c)),
    themeWant,
    ctx,
  )
  const rampPicked = pickCards(spellPool.filter(isRamp), rampWant, ctx)
  const drawPicked = pickCards(spellPool.filter(isDraw), drawWant, ctx)
  const removalPicked = pickCards(spellPool.filter(isRemoval), removalWant, ctx)
  const remainingSpells = spellWanted - themePicked.length - rampPicked.length - drawPicked.length - removalPicked.length
  const fillerPool =
    opts.powerLevel === 'casual' ? spellPool.filter((c) => isCreature(c) || !isLand(c)) : spellPool
  const filler = pickCards(fillerPool, Math.max(0, remainingSpells), ctx)

  for (const card of [...themePicked, ...rampPicked, ...drawPicked, ...removalPicked, ...filler]) {
    addEntry(entries, card, 1, false)
  }

  const nonbasicWant = Math.min(
    Math.max(8, Math.round(landsWanted * 0.35)),
    Math.max(0, ctx.slotsLeft - 12),
  )
  const nonbasics = pickCards(
    landPool.filter((c) => !isBasicLand(c)),
    nonbasicWant,
    ctx,
    0.01,
  )
  for (const card of nonbasics) addEntry(entries, card, 1, false)

  let leftover = ctx.slotsLeft
  if (leftover > 0 && basicCards.length === 0) {
    const extraLands = pickCards(landPool, leftover, ctx, 0)
    for (const card of extraLands) addEntry(entries, card, 1, false)
    leftover = ctx.slotsLeft
  }

  const basicSplits = splitBasics(Math.max(0, leftover), basicCards)
  for (const row of basicSplits) {
    if (row.qty <= 0) continue
    addEntry(entries, row.card, row.qty, false)
    ctx.spent += cardPrice(row.card) * row.qty
    ctx.slotsLeft -= row.qty
  }

  // If still short, dump cheapest remaining legal cards, then more basics.
  if (ctx.slotsLeft > 0) {
    const more = pickCards(spellPool.concat(landPool), ctx.slotsLeft, ctx, 0)
    for (const card of more) addEntry(entries, card, 1, false)
  }
  if (ctx.slotsLeft > 0 && basicCards[0]) {
    addEntry(entries, basicCards[0], ctx.slotsLeft, false)
    ctx.spent += cardPrice(basicCards[0]) * ctx.slotsLeft
    ctx.slotsLeft = 0
  }

  trimToBudget(entries, ctx, spellPool, landPool, basicCards)

  const totalUsd = entries.reduce((s, e) => s + cardPrice(e.card) * e.qty, 0)
  warnings.push(...validateDeck(entries, commander))
  if (totalUsd > opts.maxTotalUsd + 0.05) {
    warnings.push(
      `Could not fully stay under $${opts.maxTotalUsd.toFixed(2)} (total $${totalUsd.toFixed(2)}). Commander and lands still included.`,
    )
  }

  return {
    commander,
    entries: sortEntries(entries),
    totalUsd,
    theme: opts.theme.trim(),
    powerLevel: opts.powerLevel,
    maxTotalUsd: opts.maxTotalUsd,
    warnings: [...new Set(warnings)],
  }
}

function identityMatchesSelection(identity: string[], selected: ColorCode[]): boolean {
  const sel = selected.filter((c) => c !== 'C').sort().join('')
  const id = [...identity].sort().join('')
  if (sel === '' && selected.includes('C')) return identity.length === 0
  if (sel === '') return true
  return sel === id
}

function sortEntries(entries: DeckEntry[]): DeckEntry[] {
  const commander = entries.filter((e) => e.isCommander)
  const rest = entries
    .filter((e) => !e.isCommander)
    .sort((a, b) => a.card.name.localeCompare(b.card.name))
  return [...commander, ...rest]
}

function trimToBudget(
  entries: DeckEntry[],
  ctx: PickCtx,
  spellPool: ScryfallCard[],
  landPool: ScryfallCard[],
  basics: ScryfallCard[],
): void {
  const totalOf = () => entries.reduce((s, e) => s + cardPrice(e.card) * e.qty, 0)
  let guard = 0
  while (totalOf() > ctx.maxTotal && guard++ < 40) {
    const idx = entries.reduce((best, e, i) => {
      if (e.isCommander || isBasicLand(e.card)) return best
      if (best < 0) return i
      return cardPrice(e.card) / e.qty > cardPrice(entries[best]!.card) / entries[best]!.qty
        ? i
        : best
    }, -1)
    if (idx < 0) break
    const removed = entries.splice(idx, 1)[0]
    if (!removed) break
    ctx.used.delete(removed.card.oracle_id)
    ctx.used.delete(removed.card.name.toLowerCase())
    ctx.slotsLeft += removed.qty
    ctx.spent = totalOf()
    const replacement =
      pickCards(spellPool.concat(landPool), 1, ctx, 0)[0] ??
      basics[0]
    if (replacement && replacement.oracle_id !== removed.card.oracle_id) {
      if (isBasicLand(replacement)) {
        addEntry(entries, replacement, removed.qty, false)
        ctx.slotsLeft -= removed.qty
        ctx.spent += cardPrice(replacement) * removed.qty
      } else {
        addEntry(entries, replacement, 1, false)
        if (removed.qty > 1 && basics[0]) {
          addEntry(entries, basics[0], removed.qty - 1, false)
          ctx.slotsLeft -= removed.qty - 1
          ctx.spent += cardPrice(basics[0]) * (removed.qty - 1)
        }
      }
    } else if (basics[0]) {
      addEntry(entries, basics[0], removed.qty, false)
      ctx.slotsLeft -= removed.qty
      ctx.spent += cardPrice(basics[0]) * removed.qty
    } else {
      entries.push(removed)
      break
    }
  }
}
