// Prova di Modifica con l'app vera: apre l'ultima immagine della galleria, la allarga a 16:9 (Espandi),
// poi toglie un oggetto con "Rimuovi oggetto" (zona col rettangolo). Foto in test/.out/3x-*.png.
import { _electron as electron } from 'playwright'

const app = await electron.launch({ args: ['.'] })
const win = await app.firstWindow()
win.on('pageerror', (e) => console.log('[errore pagina]', e.message))
const foto = (n) => win.screenshot({ path: `test/.out/${n}.png` })
const pausa = (ms) => win.waitForTimeout(ms)
const t0 = Date.now()
const log = (s) => console.log(`[${Math.round((Date.now() - t0) / 1000)}s] ${s}`)

async function aspettaCoda() {
  const inizio = Date.now()
  for (;;) {
    await pausa(3000)
    if (!(await win.locator('.rotaia .badge').count())) return
    if (Date.now() - inizio > 15 * 60_000) throw new Error('troppo tempo')
  }
}

for (let i = 0; i < 120 && !(await win.locator('.pillola.pronto').count()); i++) await pausa(1000)
log('motore pronto')
await win.click('.rotaia button:has-text("Galleria")')
await pausa(1500)
await win.click('.tessera >> nth=0')
await pausa(800)
await win.click('.visore button:has-text("Modifica")')
await pausa(1500)

// Espandi a 16:9
await win.click('.segmenti button:has-text("Espandi")')
await win.click('.chip:has-text("+25% ovunque")')
await win.fill('.colonna.destra textarea', 'the rest of a cozy Neapolitan café interior')
await pausa(500)
await foto('30-espandi-pronto')
await win.click('.colonna.destra button.primario')
log('espandi in coda')
await aspettaCoda()
await pausa(2000)
await foto('31-espandi-fatto')
log('espandi fatto')
if (process.argv.includes('--solo-espandi')) {
  await app.close()
  process.exit(0)
}

// Rimuovi oggetto: rettangolo attorno al cucchiaino (coordinate nella foto → schermo, dalla foto vera)
await win.click('.segmenti button:has-text("Solo una zona")')
await pausa(800)
await win.click('.attrezzi button[title="Rettangolo (R)"]')
const img = await win.locator('.tela .strato img').boundingBox()
const nat = await win.locator('.tela .strato img').evaluate((i) => [i.naturalWidth, i.naturalHeight])
const k = img.width / nat[0]
// il cucchiaino nella foto 1280×832 della prova sta circa fra (720,515) e (1060,585); con Espandi la foto è più larga
const dx = (nat[0] - 1280) / 2
const da = { x: img.x + (700 + dx) * k, y: img.y + 500 * k }
const a = { x: img.x + (1070 + dx) * k, y: img.y + 595 * k }
await win.mouse.move(da.x, da.y)
await win.mouse.down()
await win.mouse.move(a.x, a.y, { steps: 8 })
await win.mouse.up()
await win.click('.chip:has-text("Rimuovi oggetto")')
await pausa(500)
await foto('32-rimuovi-pronto')
await win.click('.colonna.destra button.primario')
log('rimuovi in coda')
await aspettaCoda()
await pausa(2000)
await foto('33-rimuovi-fatto')
log('rimuovi fatto')
await app.close()
log('fine')
