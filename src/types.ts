export type ColorCode = 'W' | 'U' | 'B' | 'R' | 'G' | 'C'

export type PowerLevel = 'casual' | 'focused' | 'optimized'

export type ScryfallCard = {
  id: string
  oracle_id: string
  name: string
  type_line: string
  mana_cost?: string
  cmc: number
  color_identity: string[]
  oracle_text?: string
  keywords?: string[]
  legalities: { commander?: string }
  prices: { usd: string | null; usd_foil?: string | null }
  set: string
  set_name: string
  collector_number: string
  rarity: string
  edhrec_rank?: number | null
  image_uris?: { small?: string; normal?: string }
  card_faces?: Array<{
    name: string
    oracle_text?: string
    type_line?: string
    image_uris?: { small?: string; normal?: string }
  }>
  layout?: string
}

export type DeckEntry = {
  card: ScryfallCard
  qty: number
  isCommander: boolean
}

export type GeneratedDeck = {
  commander: ScryfallCard
  entries: DeckEntry[]
  totalUsd: number
  theme: string
  powerLevel: PowerLevel
  maxTotalUsd: number
  warnings: string[]
}

export type InventoryMap = Record<string, number>

export type GenerateOptions = {
  commanderName: string
  theme: string
  colors: ColorCode[]
  maxTotalUsd: number
  powerLevel: PowerLevel
  onStatus?: (message: string) => void
  scryfallBase?: string
}

export const POWER_LEVELS: { id: PowerLevel; label: string }[] = [
  { id: 'casual', label: 'Casual' },
  { id: 'focused', label: 'Focused (Synergy driven)' },
  { id: 'optimized', label: 'Optimized' },
]

export const COLOR_OPTIONS: { id: ColorCode; label: string; title: string }[] = [
  { id: 'W', label: 'W', title: 'White' },
  { id: 'U', label: 'U', title: 'Blue' },
  { id: 'B', label: 'B', title: 'Black' },
  { id: 'R', label: 'R', title: 'Red' },
  { id: 'G', label: 'G', title: 'Green' },
  { id: 'C', label: 'C', title: 'Colorless' },
]
