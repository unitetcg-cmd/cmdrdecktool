type Props = {
  canExport: boolean
  onPdf: () => void
  onText: () => void
  onEbay: () => void
}

export default function Header(props: Props) {
  return (
    <header className="app-header">
      <div className="brand">Unite TCG Commander Deck Tool</div>
      <div className="header-actions">
        <button type="button" className="btn btn-ghost" disabled={!props.canExport} onClick={props.onPdf}>
          Export PDF
        </button>
        <button type="button" className="btn btn-ghost" disabled={!props.canExport} onClick={props.onText}>
          Export Text
        </button>
        <button
          type="button"
          className="btn btn-purple"
          disabled={!props.canExport}
          onClick={props.onEbay}
        >
          Export eBay
        </button>
      </div>
    </header>
  )
}
