// Prova dell'interfaccia SENZA Electron né motore: apre la build (out/renderer) in Chromium con un finto window.daprod (test/finto.js),
// apre Modifica → Estrai (la ricerca parte solo col pulsante), sceglie un oggetto e una persona, e stampa i prompt e le dimensioni delle richieste. Foto in test/.out/.
//   npm run build && python3 -m http.server 8765 --directory out/renderer &   poi:   node test/interfaccia.mjs
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'

const url = process.argv[2] || 'http://localhost:8765/index.html'
const out = 'test/.out'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH ? process.env.PLAYWRIGHT_BROWSERS_PATH + '/chromium' : undefined })
const pg = await b.newPage({ viewport: { width: 1480, height: 900 } })
pg.on('pageerror', (e) => console.log('[errore pagina]', e.message))
await pg.addInitScript(readFileSync('test/finto.js', 'utf8'))
await pg.goto(url)
const pausa = (ms) => pg.waitForTimeout(ms)
const ultima = (campo) => pg.evaluate((c) => window.__ultima[c], campo)
await pausa(1200)

await pg.click('.strip-modi button[data-modo="modifica"]')
await pg.click('.attrezzi button:has-text("Dal PC")')
await pausa(600)
await pg.fill('.colonna.destra textarea:visible', 'sostituisci il cielo con un tramonto molto drammatico, nuvole rosse, luce dorata sulla casetta')
await pg.screenshot({ path: `${out}/i1-casella-prompt.png` })

await pg.click('button[data-id="modo-estrai"]')
await pausa(1000)
console.log('ricerca partita da sola?', await pg.evaluate(() => !!window.__testo), '(deve essere false)')
await pg.screenshot({ path: `${out}/i2a-estrai-prima.png` })
// Estrai in due clic (SAM 2): un clic sulla foto, poi «Ritaglia»; nessuna ricerca col modello di testo
{
  const fo = await pg.locator('.pers-foto').boundingBox()
  await pg.mouse.click(fo.x + fo.width * 0.4, fo.y + fo.height * 0.5)
  await pausa(300)
  await pg.screenshot({ path: `${out}/i2b-estrai-punto.png` })
  await pg.click('button:has-text("Ritaglia")')
  await pausa(500)
  const q = await pg.evaluate(() => window.__ultima)
  if (q.modalita !== 'segmenta' || !q.segmenta?.punti?.length || !q.segmenta.punti[0].positivo || q.segmenta.ritaglia !== true || q.immagini.length !== 1) throw new Error('ritaglio a due clic: richiesta sbagliata ' + JSON.stringify(q.segmenta))
  console.log('RITAGLIO a due clic: OK', JSON.stringify(q.segmenta))
}
await pg.click('button:has-text("Trova persone e oggetti")')
await pausa(1200)
console.log('ricerca col pulsante:', await pg.evaluate(() => window.__testo?.modalita), '(deve essere descrivi)')
await pg.screenshot({ path: `${out}/i2-estrai-trovati.png` })
const f = await pg.locator('.pers-foto').boundingBox()
await pg.mouse.click(f.x + f.width * 0.45, f.y + f.height * 0.7)
await pausa(400)
await pg.screenshot({ path: `${out}/i3-estrai-oggetto.png` })
await pg.click('button:has-text("Ricrea l\'oggetto in studio")')
await pausa(500)
console.log('OGGETTO', await ultima('larghezza'), '×', await ultima('altezza'), '\n', await ultima('prompt'))

await pg.mouse.click(f.x + f.width * 0.12, f.y + f.height * 0.85)
await pg.click('.segmenti button:has-text("Disegnata")')
await pausa(300)
await pg.screenshot({ path: `${out}/i4-estrai-persona.png` })
await pg.click('button:has-text("Ricrea la persona in studio")')
await pausa(700)
console.log('PERSONA', await ultima('larghezza'), '×', await ultima('altezza'), 'immagini:', (await pg.evaluate(() => window.__ultima.immagini.length)), '\n', await ultima('prompt'))
await b.close()
