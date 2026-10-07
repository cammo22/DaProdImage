// Le foto per il README (in risorse/): prova anche "Migliora" e una creazione in qualità Alta.
import { _electron as electron } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('risorse', { recursive: true })
const app = await electron.launch({ args: ['.'] })
const win = await app.firstWindow()
win.on('pageerror', (e) => console.log('[errore pagina]', e.message))
const pausa = (ms) => win.waitForTimeout(ms)
const t0 = Date.now()
const log = (s) => console.log(`[${Math.round((Date.now() - t0) / 1000)}s] ${s}`)
async function aspettaCoda() {
  for (const inizio = Date.now(); ; ) {
    await pausa(3000)
    if (!(await win.locator('.rotaia .badge').count())) return
    if (Date.now() - inizio > 15 * 60_000) throw new Error('troppo tempo')
  }
}

for (let i = 0; i < 120 && !(await win.locator('.pillola.pronto').count()); i++) await pausa(1000)
log('motore pronto')

await win.fill('.colonna:not(.destra) textarea >> nth=0', 'una vespa rossa in un vicolo di Positano al tramonto, panni stesi e buganvillea')
await win.click('button:has-text("Migliora")')
log('migliora…')
for (let i = 0; i < 240; i++) {
  await pausa(1000)
  if (await win.locator('button:has-text("Torna al mio")').count()) break
}
const testo = await win.locator('.colonna:not(.destra) textarea >> nth=0').inputValue()
log('prompt migliorato: ' + testo.slice(0, 160) + '…')

await win.click('.formato:has-text("3:2")')
await win.click('.segmenti button:has-text("Alta")')
await win.click('button.primario:has-text("Crea")')
log('creazione in coda (Alta, 40 passi)')
await pausa(25000)
await win.click('.rotaia button:has-text("Coda")')
await pausa(600)
await win.screenshot({ path: 'risorse/coda.png' })
await win.click('.rotaia button:has-text("Coda")')
await aspettaCoda()
await pausa(1500)
await win.screenshot({ path: 'risorse/crea.png' })
log('creata')

await win.click('.rotaia button:has-text("Galleria")')
await pausa(1500)
await win.screenshot({ path: 'risorse/galleria.png' })
await win.click('.rotaia button:has-text("LoRA")')
await pausa(1500)
await win.screenshot({ path: 'risorse/lora.png' })
await app.close()
log('fine')
