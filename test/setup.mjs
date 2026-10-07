// Prova vera dell'installazione: apre l'app, fa la foto della pagina di setup, preme Installa e aspetta la fine.
import { _electron as electron } from 'playwright'
import { mkdirSync } from 'node:fs'

mkdirSync('test/.out', { recursive: true })
const app = await electron.launch({ args: ['.'] })
const win = await app.firstWindow()
await win.setViewportSize({ width: 1480, height: 920 }).catch(() => {})
await win.waitForTimeout(3000)
await win.screenshot({ path: 'test/.out/01-setup.png' })
console.log('setup visibile:', await win.locator('text=Installa e inizia').count())
if (process.argv.includes('--installa')) {
  await win.click('text=Installa e inizia')
  const inizio = Date.now()
  let ultimo = ''
  for (;;) {
    await win.waitForTimeout(5000)
    const testo = await win.locator('.passi-setup').innerText().catch(() => '')
    const riga = testo.replace(/\s+/g, ' ').slice(0, 400)
    if (riga !== ultimo) {
      console.log(`[${Math.round((Date.now() - inizio) / 1000)}s] ${riga}`)
      ultimo = riga
    }
    if (await win.locator('text=Tutto pronto').count()) { console.log('FATTO'); break }
    if (await win.locator('text=Riprova').count()) { console.log('ERRORE'); break }
    if (Date.now() - inizio > 40 * 60_000) { console.log('TROPPO TEMPO'); break }
  }
  await win.screenshot({ path: 'test/.out/02-setup-fine.png' })
}
await app.close()
