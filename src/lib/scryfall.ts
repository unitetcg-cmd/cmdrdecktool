import type { ScryfallCard } from '../types.ts'

export function getScryfallBase(): string {
  // Production GitHub Pages MUST call Scryfall directly (CORS). The Vite
  // /scryfall proxy exists only for local `npm run dev`.
  if (import.meta.env.PROD) return 'https://api.scryfall.com'
  return '/scryfall'
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function headers(): HeadersInit {
  const h: Record<string, string> = { Accept: 'application/json' }
  if (typeof window === 'undefined') {
    h['User-Agent'] = 'UniteTCGCmdrDeckTool/1.0'
  }
  return h
}

async function scryfallFetch(url: string): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: headers() })
    if (res.status === 429) {
      await sleep(600 * (attempt + 1))
      continue
    }
    if (res.status >= 500) {
      lastError = new Error(`Scryfall ${res.status}`)
      await sleep(400 * (attempt + 1))
      continue
    }
    return res
  }
  throw lastError ?? new Error('Scryfall rate limited')
}

export async function scryfallGet<T>(
  pathAndQuery: string,
  base = getScryfallBase(),
): Promise<T> {
  const url = `${base}${pathAndQuery}`
  const res = await scryfallFetch(url)
  if (!res.ok) {
    let details = res.statusText
    try {
      const body = (await res.json()) as { details?: string }
      if (body.details) details = body.details
    } catch {
      // ignore
    }
    const err = new Error(`Scryfall ${res.status}: ${details}`)
    ;(err as Error & { status: number }).status = res.status
    throw err
  }
  return res.json() as Promise<T>
}

type SearchResponse = {
  object: string
  total_cards?: number
  has_more?: boolean
  next_page?: string
  data: ScryfallCard[]
}

export async function searchCards(
  query: string,
  opts?: {
    order?: string
    unique?: string
    dir?: string
    pages?: number
    base?: string
  },
): Promise<ScryfallCard[]> {
  const order = opts?.order ?? 'usd'
  const unique = opts?.unique ?? 'cards'
  const dir = opts?.dir
  const pages = opts?.pages ?? 1
  const base = opts?.base ?? getScryfallBase()
  const params = new URLSearchParams({
    q: query,
    unique,
    order,
  })
  if (dir) params.set('dir', dir)

  const cards: ScryfallCard[] = []
  let path = `/cards/search?${params.toString()}`
  for (let i = 0; i < pages; i++) {
    await sleep(110)
    try {
      const json = await scryfallGet<SearchResponse>(path, base)
      cards.push(...(json.data ?? []))
      if (!json.has_more || !json.next_page) break
      const next = new URL(json.next_page)
      path = `${next.pathname}${next.search}`
    } catch (err) {
      const status = (err as Error & { status?: number }).status
      if (status === 404) break
      throw err
    }
  }
  return cards
}

export async function namedCard(
  name: string,
  base = getScryfallBase(),
): Promise<ScryfallCard> {
  const params = new URLSearchParams({ fuzzy: name })
  return scryfallGet<ScryfallCard>(`/cards/named?${params.toString()}`, base)
}

export async function randomCard(
  query: string,
  base = getScryfallBase(),
): Promise<ScryfallCard> {
  const params = new URLSearchParams({ q: query })
  return scryfallGet<ScryfallCard>(`/cards/random?${params.toString()}`, base)
}

export function cardPrice(card: ScryfallCard): number {
  const raw = card.prices?.usd ?? card.prices?.usd_foil
  if (!raw) return 0.01
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : 0.01
}

export function cardImage(card: ScryfallCard): string | undefined {
  return card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small
}

export function oracleText(card: ScryfallCard): string {
  if (card.oracle_text) return card.oracle_text
  return (card.card_faces ?? []).map((f) => f.oracle_text ?? '').join('\n')
}

export function frontName(card: ScryfallCard): string {
  const n = card.name.split(' // ')[0]
  return n ?? card.name
}

export function isBasicLand(card: ScryfallCard): boolean {
  return card.type_line.toLowerCase().includes('basic')
}

export function isLand(card: ScryfallCard): boolean {
  return /\bland\b/i.test(card.type_line)
}

export function isCreature(card: ScryfallCard): boolean {
  return /\bcreature\b/i.test(card.type_line)
}

export function isLegalCommander(card: ScryfallCard): boolean {
  if (card.legalities?.commander !== 'legal') return false
  const type = card.type_line.toLowerCase()
  if (type.includes('legendary') && (type.includes('creature') || type.includes('planeswalker'))) {
    return true
  }
  const text = oracleText(card).toLowerCase()
  return text.includes('can be your commander')
}

export function colorIdentityOk(card: ScryfallCard, identity: string[]): boolean {
  return card.color_identity.every((c) => identity.includes(c))
}

export function identityQuery(colors: string[]): string {
  const pip = colors.filter((c) => c !== 'C').join('').toLowerCase()
  if (!pip) return 'id:c'
  return `id:${pip}`
}

export function withinIdentityQuery(colors: string[]): string {
  const pip = colors.filter((c) => c !== 'C').join('').toLowerCase()
  if (!pip) return 'id:c'
  return `id<=${pip}`
}
