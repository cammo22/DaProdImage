// Foto veloci della GUI v2 (SENZA Electron né motore): Studio nei vari modi.
//   npm run build, poi un server statico su out/renderer (porta 8765), poi:   node test/gui.mjs
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'

const url = process.argv[2] || 'http://localhost:8765/index.html'
const out = 'test/.out'
mkdirSync(out, { recursive: true })
const b = await chromium.launch()
const pg = await b.newPage({ viewport: { width: 1480, height: 1000 } })
pg.on('pageerror', (e) => console.log('[errore pagina]', e.message))
await pg.addInitScript(readFileSync('test/finto.js', 'utf8'))
await pg.goto(url)
const pausa = (ms) => pg.waitForTimeout(ms)
await pausa(1200)
await pg.click('button[data-id="genere-poster"]')
await pg.click('button[data-id="stile-synthwave"]')
await pg.click('button[data-id="sfondo-trasparente"]')
await pausa(300)
await pg.screenshot({ path: `${out}/g1-crea.png` })
await b.close()
