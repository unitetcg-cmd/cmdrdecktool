import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')

function fail(message) {
  console.error(`verify-static: ${message}`)
  process.exit(1)
}

if (!fs.existsSync(dist)) fail('dist/ missing — run npm run build first')

const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
if (!html.includes('/cmdrdecktool/assets/')) {
  fail('index.html does not prefix assets with /cmdrdecktool/')
}

const jsFiles = fs.readdirSync(path.join(dist, 'assets')).filter((f) => f.endsWith('.js'))
if (jsFiles.length === 0) fail('no JS assets in dist/assets')

const js = jsFiles.map((f) => fs.readFileSync(path.join(dist, 'assets', f), 'utf8')).join('\n')
if (!js.includes('https://api.scryfall.com')) {
  fail('production bundle does not call https://api.scryfall.com')
}
if (js.includes('fetch("/scryfall') || js.includes("fetch('/scryfall")) {
  fail('production bundle still uses the /scryfall Vite proxy')
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json',
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  let pathname = url.pathname
  if (pathname === '/cmdrdecktool') pathname = '/cmdrdecktool/'
  if (!pathname.startsWith('/cmdrdecktool/')) {
    res.writeHead(404)
    res.end('not under /cmdrdecktool/')
    return
  }
  let rel = pathname.slice('/cmdrdecktool/'.length)
  if (rel === '' || rel.endsWith('/')) rel += 'index.html'
  const file = path.join(dist, rel)
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404)
    res.end('missing')
    return
  }
  const ext = path.extname(file)
  res.writeHead(200, { 'content-type': mime[ext] || 'application/octet-stream' })
  res.end(fs.readFileSync(file))
})

await new Promise((resolve) => server.listen(4174, '127.0.0.1', resolve))

try {
  const page = await fetch('http://127.0.0.1:4174/cmdrdecktool/')
  if (!page.ok) fail(`static index returned ${page.status}`)
  const body = await page.text()
  if (!body.includes('Unite TCG Commander Deck Tool')) {
    fail('index HTML did not include the app title')
  }
  const asset = body.match(/\/cmdrdecktool\/assets\/[^"]+\.js/)
  if (!asset) fail('index HTML missing /cmdrdecktool/assets JS')
  const jsRes = await fetch(`http://127.0.0.1:4174${asset[0]}`)
  if (!jsRes.ok) fail(`JS asset returned ${jsRes.status}`)
  const sample = await fetch('http://127.0.0.1:4174/cmdrdecktool/sample-inventory.csv')
  if (!sample.ok) fail(`sample-inventory.csv returned ${sample.status}`)
  console.log('verify-static: GitHub Pages-style serve OK at http://127.0.0.1:4174/cmdrdecktool/')
} finally {
  server.close()
}
