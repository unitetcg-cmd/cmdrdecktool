import type { GeneratedDeck, InventoryMap } from '../types.ts'
import { cardImage, cardPrice, frontName } from '../lib/scryfall.ts'
import { ownedQty } from '../lib/inventory.ts'
import {
  CATEGORY_ORDER,
  categoryOf,
  collapsedNeedList,
  ownedNeedTotals,
  toManaPoolUrl,
  toTcgPlayerUrl,
} from '../lib/exports.ts'

type Props = {
  deck: GeneratedDeck | null
  inventory: InventoryMap
}

export default function DeckResults({ deck, inventory }: Props) {
  if (!deck) {
    return (
      <section className="results-panel results-empty">
        Generate a 100-card Commander deck to see the list, prices, and vendor mass-entry
        buttons.
      </section>
    )
  }

  const totals = ownedNeedTotals(deck, inventory)
  const needLines = collapsedNeedList(deck, inventory)
  const buyLines = needLines.length > 0 ? needLines : deck.entries.map((e) => ({
    qty: e.qty,
    name: frontName(e.card),
  }))

  const grouped = new Map<string, typeof deck.entries>()
  for (const entry of deck.entries) {
    const cat = entry.isCommander ? 'Commander' : categoryOf(entry.card.type_line)
    const list = grouped.get(cat) ?? []
    list.push(entry)
    grouped.set(cat, list)
  }

  return (
    <section className="results-panel">
      <div className="commander-hero">
        {cardImage(deck.commander) ? (
          <img src={cardImage(deck.commander)} alt={deck.commander.name} />
        ) : null}
        <div>
          <h2 style={{ margin: 0 }}>{deck.commander.name}</h2>
          <div className="hint">
            {deck.commander.type_line} · {deck.commander.set_name} ({deck.commander.set.toUpperCase()}) ·{' '}
            {deck.commander.color_identity.join('') || 'C'}
          </div>
        </div>
      </div>

      <div className="summary-grid">
        <div className="stat">
          <div className="label">Cards</div>
          <div className="value">{deck.entries.reduce((s, e) => s + e.qty, 0)}</div>
        </div>
        <div className="stat">
          <div className="label">Deck USD</div>
          <div className="value">${deck.totalUsd.toFixed(2)}</div>
        </div>
        <div className="stat">
          <div className="label">Owned</div>
          <div className="value owned">{totals.owned}</div>
        </div>
        <div className="stat">
          <div className="label">Need to buy</div>
          <div className="value need">{totals.need}</div>
        </div>
        <div className="stat">
          <div className="label">Buy list USD</div>
          <div className="value">${totals.needUsd.toFixed(2)}</div>
        </div>
        <div className="stat">
          <div className="label">Budget cap</div>
          <div className="value">${deck.maxTotalUsd.toFixed(2)}</div>
        </div>
      </div>

      {deck.warnings.length > 0 ? (
        <div className="warnings">
          {deck.warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
      ) : null}

      <div className="vendor-row">
        <a
          className="btn btn-lime"
          href={toManaPoolUrl(buyLines)}
          target="_blank"
          rel="noreferrer"
        >
          ManaPool mass-entry ({buyLines.reduce((s, l) => s + l.qty, 0)})
        </a>
        <a
          className="btn"
          href={toTcgPlayerUrl(buyLines)}
          target="_blank"
          rel="noreferrer"
        >
          TCGPlayer mass-entry ({buyLines.reduce((s, l) => s + l.qty, 0)})
        </a>
      </div>
      <div className="hint" style={{ marginBottom: 12 }}>
        Vendor buttons open live mass-entry with the need-to-buy list (full deck if nothing is
        owned). Inventory is local only — no tcgtracking login.
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const rows = grouped.get(cat)
        if (!rows?.length) return null
        return (
          <div key={cat}>
            <h3 className="section-title">
              {cat} ({rows.reduce((s, r) => s + r.qty, 0)})
            </h3>
            <table className="card-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Qty</th>
                  <th>Card</th>
                  <th>USD</th>
                  <th>Owned</th>
                  <th>Need</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const have = Math.min(row.qty, ownedQty(inventory, row.card.name))
                  const need = row.qty - have
                  return (
                    <tr
                      key={row.card.oracle_id + (row.isCommander ? '-cmdr' : '')}
                      className={row.isCommander ? 'commander-row' : undefined}
                    >
                      <td>
                        {cardImage(row.card) ? (
                          <img className="thumb" src={cardImage(row.card)} alt="" />
                        ) : null}
                      </td>
                      <td>{row.qty}</td>
                      <td>
                        <div className="name-cell">
                          <span>{row.card.name}</span>
                          <span className="sub">
                            {row.card.set.toUpperCase()} #{row.card.collector_number} ·{' '}
                            {row.card.rarity}
                          </span>
                        </div>
                      </td>
                      <td>${(cardPrice(row.card) * row.qty).toFixed(2)}</td>
                      <td className={have > 0 ? 'owned' : undefined}>{have}</td>
                      <td className={need > 0 ? 'need' : 'owned'}>{need}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </section>
  )
}
