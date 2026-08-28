import { useCallback, useMemo, useState } from 'react'
import Header from './components/Header.tsx'
import BuildSettings from './components/BuildSettings.tsx'
import DeckResults from './components/DeckResults.tsx'
import { generateDeck } from './lib/deckBuilder.ts'
import {
  clearInventory,
  loadInventory,
  parseInventoryCsv,
  saveInventory,
  totalOwnedCount,
  uniqueCardCount,
} from './lib/inventory.ts'
import {
  decklistText,
  downloadTextFile,
  ebayListing,
} from './lib/exports.ts'
import { buildSimplePdf, downloadBlob } from './lib/pdf.ts'
import { frontName } from './lib/scryfall.ts'
import type { ColorCode, GeneratedDeck, InventoryMap, PowerLevel } from './types.ts'
import './App.css'

export default function App() {
  const [commander, setCommander] = useState('')
  const [theme, setTheme] = useState('')
  const [colors, setColors] = useState<ColorCode[]>([])
  const [maxPrice, setMaxPrice] = useState('100')
  const [powerLevel, setPowerLevel] = useState<PowerLevel>('focused')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [deck, setDeck] = useState<GeneratedDeck | null>(null)
  const [inventory, setInventory] = useState<InventoryMap>(() => loadInventory())

  const inventoryCount = useMemo(() => uniqueCardCount(inventory), [inventory])
  const inventoryCopies = useMemo(() => totalOwnedCount(inventory), [inventory])

  const toggleColor = (c: ColorCode) => {
    setColors((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const importCsv = async (file: File) => {
    const text = await file.text()
    const parsed = parseInventoryCsv(text)
    setInventory(parsed)
    saveInventory(parsed)
  }

  const onClearInventory = () => {
    clearInventory()
    setInventory({})
  }

  const onGenerate = useCallback(async () => {
    setBusy(true)
    setError('')
    setStatus('Starting…')
    try {
      const parsedMax = Number.parseFloat(maxPrice.replace(/[^0-9.]/g, ''))
      const maxTotalUsd = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 100
      const result = await generateDeck({
        commanderName: commander,
        theme,
        colors,
        maxTotalUsd,
        powerLevel,
        onStatus: setStatus,
      })
      setDeck(result)
      setStatus(
        `Built ${result.entries.reduce((s, e) => s + e.qty, 0)} cards for ${result.commander.name} ($${result.totalUsd.toFixed(2)}).`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deck generation failed.'
      setError(message)
      setStatus('')
    } finally {
      setBusy(false)
    }
  }, [commander, theme, colors, maxPrice, powerLevel])

  const onPdf = () => {
    if (!deck) return
    const lines = [
      `Commander: ${deck.commander.name}`,
      `Theme: ${deck.theme || '(none)'}`,
      `Power: ${deck.powerLevel}   Budget cap: $${deck.maxTotalUsd.toFixed(2)}`,
      `Estimated USD (cheap printings): $${deck.totalUsd.toFixed(2)}`,
      '',
      ...deck.entries.map(
        (e) =>
          `${e.isCommander ? 'CMDR' : String(e.qty).padStart(3, ' ')}  ${e.card.name}   $${(Number.parseFloat(e.card.prices.usd ?? '0.01') * e.qty).toFixed(2)}`,
      ),
    ]
    const blob = buildSimplePdf('Unite TCG Commander Deck', lines)
    const slug = frontName(deck.commander).replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    downloadBlob(`${slug}-commander-deck.pdf`, blob)
  }

  const onText = () => {
    if (!deck) return
    const slug = frontName(deck.commander).replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    downloadTextFile(`${slug}-commander-deck.txt`, decklistText(deck))
  }

  const onEbay = () => {
    if (!deck) return
    const listing = ebayListing(deck)
    const slug = frontName(deck.commander).replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    downloadTextFile(
      `${slug}-ebay-listing.txt`,
      `TITLE\n${listing.title}\n\nDESCRIPTION\n${listing.body}\n`,
    )
  }

  return (
    <div className="app-shell">
      <Header canExport={Boolean(deck)} onPdf={onPdf} onText={onText} onEbay={onEbay} />
      <main className="layout">
        <BuildSettings
          commander={commander}
          theme={theme}
          colors={colors}
          maxPrice={maxPrice}
          powerLevel={powerLevel}
          busy={busy}
          status={status}
          error={error}
          inventoryCount={inventoryCount}
          inventoryCopies={inventoryCopies}
          onCommander={setCommander}
          onTheme={setTheme}
          onToggleColor={toggleColor}
          onMaxPrice={setMaxPrice}
          onPowerLevel={setPowerLevel}
          onGenerate={onGenerate}
          onImportCsv={importCsv}
          onClearInventory={onClearInventory}
        />
        <DeckResults deck={deck} inventory={inventory} />
      </main>
    </div>
  )
}
