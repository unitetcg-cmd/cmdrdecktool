# Unite TCG Commander Deck Tool

Static GitHub Pages app that builds **budget 100-card Commander / EDH decks** from live [Scryfall](https://scryfall.com) data.

**Live site:** https://unitetcg-cmd.github.io/cmdrdecktool/

Bobby / Unite TCG does **not** need npm locally. Open the Pages URL, generate a deck, export, and send lists to ManaPool or TCGPlayer.

## What it does

- Dark charcoal UI with lime primary actions and purple **Export eBay**
- Build settings: commander (blank = random), theme/strategy, color identity W/U/B/R/G/C, max total USD, power level (Casual / Focused (Synergy driven) / Optimized)
- Generates a **legal 100-card Commander list** using real Scryfall cards and cheap printings, biased by theme, staying under the budget when possible
- Results show USD prices plus **owned vs need-to-buy** from a CSV inventory stored in `localStorage` (no tcgtracking login)
- Header exports: PDF, text decklist, eBay listing-ready cheap Commander deck lot
- Vendor buttons open live mass-entry:
  - ManaPool: `https://manapool.com/add-deck?deck=` + URL-safe Base64 of `1 Card Name` lines
  - TCGPlayer: `https://www.tcgplayer.com/massentry` with Magic product line and `c=qty+Name||qty+Name`

Sample inventory: [`public/sample-inventory.csv`](public/sample-inventory.csv) (also downloadable from the app).

## GitHub Pages

Production is a static Vite build (`dist/`). The app calls `https://api.scryfall.com` **from the browser** (CORS). There is **no** production `/scryfall` proxy.

`vite.config.ts` sets `base: '/cmdrdecktool/'` so assets resolve on the project Pages URL.

On every push to `main`, [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) builds and deploys `dist` with `upload-pages-artifact` + `deploy-pages`.

Repo setting required once: **Pages → Source = GitHub Actions**.

## Local development (optional)

```bash
npm install
npm run dev
```

Local Vite only: `/scryfall` proxies to `https://api.scryfall.com`. Production builds never use that proxy.

```bash
npm run build     # output: dist/
npm run preview   # serves with base /cmdrdecktool/
npm test
npm run verify    # production-like static serve + live Scryfall 100-card generation
```

## Inventory CSV

Supported shapes:

```csv
name,quantity
Sol Ring,1
Island,12
```

or decklist lines:

```
1 Arcane Signet
4x Forest
```

Import is saved in this browser’s localStorage until you hit Clear.
