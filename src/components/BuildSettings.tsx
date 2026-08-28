import type { ColorCode, PowerLevel } from '../types.ts'
import { COLOR_OPTIONS, POWER_LEVELS } from '../types.ts'

type Props = {
  commander: string
  theme: string
  colors: ColorCode[]
  maxPrice: string
  powerLevel: PowerLevel
  busy: boolean
  status: string
  error: string
  inventoryCount: number
  inventoryCopies: number
  onCommander: (v: string) => void
  onTheme: (v: string) => void
  onToggleColor: (c: ColorCode) => void
  onMaxPrice: (v: string) => void
  onPowerLevel: (v: PowerLevel) => void
  onGenerate: () => void
  onImportCsv: (file: File) => void
  onClearInventory: () => void
}

export default function BuildSettings(props: Props) {
  const sampleHref = `${import.meta.env.BASE_URL}sample-inventory.csv`

  return (
    <aside className="settings-panel">
      <h2>Build Settings</h2>

      <div className="field">
        <label htmlFor="commander">Commander</label>
        <input
          id="commander"
          type="text"
          placeholder="Leave blank for random commander..."
          value={props.commander}
          onChange={(e) => props.onCommander(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="theme">Theme / Strategy</label>
        <input
          id="theme"
          type="text"
          placeholder="e.g. Artifact Tokens, Mill, Blink"
          value={props.theme}
          onChange={(e) => props.onTheme(e.target.value)}
        />
      </div>

      <div className="field">
        <label>Color Identity</label>
        <div className="color-row">
          {COLOR_OPTIONS.map((c) => (
            <label key={c.id} className="color-chip" title={c.title}>
              <input
                type="checkbox"
                checked={props.colors.includes(c.id)}
                onChange={() => props.onToggleColor(c.id)}
              />
              <span>{c.label}</span>
            </label>
          ))}
        </div>
        <div className="hint">Used when commander is blank. C = colorless.</div>
      </div>

      <div className="field">
        <label htmlFor="maxPrice">Max Total Price (USD)</label>
        <input
          id="maxPrice"
          type="text"
          inputMode="decimal"
          placeholder="e.g. 100"
          value={props.maxPrice}
          onChange={(e) => props.onMaxPrice(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="powerLevel">Power Level</label>
        <select
          id="powerLevel"
          value={props.powerLevel}
          onChange={(e) => props.onPowerLevel(e.target.value as PowerLevel)}
        >
          {POWER_LEVELS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="btn btn-lime btn-block"
        disabled={props.busy}
        onClick={props.onGenerate}
      >
        {props.busy ? 'Generating…' : 'Generate Deck'}
      </button>
      {props.status ? <div className="status-line">{props.status}</div> : null}
      {props.error ? <div className="error-line">{props.error}</div> : null}

      <div className="field" style={{ marginTop: 22 }}>
        <label htmlFor="inventory">Inventory CSV</label>
        <div className="file-row">
          <input
            id="inventory"
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) props.onImportCsv(file)
              e.target.value = ''
            }}
          />
          <button type="button" className="btn btn-ghost" onClick={props.onClearInventory}>
            Clear
          </button>
        </div>
        <div className="hint">
          Persisted in this browser (localStorage). No login.{' '}
          <a href={sampleHref} download>
            sample-inventory.csv
          </a>
          {props.inventoryCount > 0
            ? ` — ${props.inventoryCount} names / ${props.inventoryCopies} copies loaded.`
            : ' — none loaded.'}
        </div>
      </div>
    </aside>
  )
}
