// Prova con l'app vera: foto di tutte le pagine in test/.out/, e (con --genera) un giro completo:
// Crea una bozza → Rifinisci → Modifica una zona col pennello → prima/dopo.
import { _electron as electron } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('test/.out', { recursive: true })
const genera = process.argv.includes('--genera')
const app = await electron.launch({ args: ['.'] })
const win = await app.firstWindow()
win.on('pageerror', (e) => console.log('[errore pagina]', e.message))
win.on('console', (m) => m.type() === 'error' && console.log('[console]', m.text()))
const foto = (n) => win.screenshot({ path: `test/.out/${n}.png` })
const pausa = (ms) => win.waitForTimeout(ms)
const t0 = Date.now()
const log = (s) => console.log(`[${Math.round((Date.now() - t0) / 1000)}s] ${s}`)

/** aspetta che la coda sia vuota (niente in corso o in coda) */
async function aspettaCoda(massimo = 15 * 60_000) {
  const inizio = Date.now()
  let ultimo = ''
  for (;;) {
    await pausa(3000)
    const badge = await win.locator('.rotaia .badge').count()
    const fase = (await win.locator('.in-corso .sopra').allInnerTexts().catch(() => [])).join(' ')
    const r = fase.replace(/\s+/g, ' ').slice(0, 120)
    if (r && r !== ultimo) {
      log(r)
      ultimo = r
    }
    if (!badge) return
    if (Date.now() - inizio > massimo) throw new Error('troppo tempo')
  }
}

await pausa(2500)
// il motore parte da solo: si aspetta che sia pronto
for (let i = 0; i < 120; i++) {
  if (await win.locator('.pillola.pronto').count()) break
  await pausa(1000)
}
log('motore: ' + (await win.locator('.barra-titolo .pillola').innerText()))
await foto('10-crea')

for (const [n, nome] of [['11-modifica', 'Modifica'], ['12-galleria', 'Galleria'], ['13-lora', 'LoRA'], ['14-opzioni', 'Opzioni']]) {
  await win.click(`.rotaia button:has-text("${nome}")`)
  await pausa(1200)
  await foto(n)
}

if (genera) {
  await win.click('.rotaia button:has-text("Crea")')
  await win.fill('textarea', 'Una tazzina di caffè espresso su un tavolino di marmo in un bar di Napoli, mattina, luce morbida dalla vetrina, fotografia realistica, profondità di campo')
  await win.click('.segmenti button:has-text("Bozza")')
  await win.click('.formato:has-text("3:2")')
  await foto('20-crea-pronta')
  await win.click('button.primario:has-text("Crea")')
  log('bozza in coda')
  await pausa(20000)
  await foto('21-crea-in-corso')
  await aspettaCoda()
  await pausa(1500)
  await foto('22-crea-bozza')
  log('bozza fatta')

  await win.click('button:has-text("Rifinisci")')
  log('rifinitura in coda')
  await aspettaCoda()
  await pausa(1500)
  await foto('23-crea-rifinita')
  log('rifinita')

  // Modifica: zona col pennello sulla tazzina
  await win.click('.azioni-risultato button:has-text("Modifica")')
  await pausa(1500)
  await win.click('.segmenti button:has-text("Solo una zona")')
  await pausa(500)
  const tela = await win.locator('.tela').boundingBox()
  const cx = tela.x + tela.width / 2
  const cy = tela.y + tela.height / 2
  await win.mouse.move(cx - 60, cy - 30)
  await win.mouse.down()
  for (let i = 0; i <= 12; i++) await win.mouse.move(cx - 60 + i * 10, cy - 30 + Math.sin(i) * 25, { steps: 2 })
  for (let i = 0; i <= 12; i++) await win.mouse.move(cx + 60 - i * 10, cy + 20 + Math.cos(i) * 25, { steps: 2 })
  await win.mouse.up()
  await win.fill('.colonna.destra textarea', 'Replace it with a small glass of fresh orange juice')
  await foto('24-modifica-zona')
  await win.click('.colonna.destra button.primario')
  log('zona in coda')
  await aspettaCoda()
  await pausa(2000)
  await foto('25-modifica-prima-dopo')
  log('zona fatta')

  await win.click('.rotaia button:has-text("Galleria")')
  await pausa(1500)
  await foto('26-galleria-piena')
  await win.click('.tessera >> nth=0')
  await pausa(1200)
  await foto('27-visore')
}

await app.close()
log('fine')
