// Layout dello Studio: il pannello dei controlli sta a SINISTRA del palco in tutti i modi (Crea, Modifica, Box, Ricette),
// e in Crea il pulsante CREA sta fuori dallo scorrimento, in fondo al pannello.
//   npm run build, poi un server statico su out/renderer (porta 8765), poi:   node test/studio-layout.mjs
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const url = process.argv[2] || 'http://localhost:8765/index.html'
const b = await chromium.launch()
const pg = await b.newPage({ viewport: { width: 1480, height: 1000 } })
pg.on('pageerror', (e) => console.log('[errore pagina]', e.message))
await pg.addInitScript(readFileSync('test/finto.js', 'utf8'))
await pg.goto(url)
await pg.waitForTimeout(1200)

const misure = {}
for (const modo of ['crea', 'modifica', 'box', 'ricette']) {
  await pg.click(`button[data-modo="${modo}"]`)
  await pg.waitForTimeout(400)
  misure[modo] = await pg.evaluate(() => {
    const visibile = (el) => el.getBoundingClientRect().width > 0
    const colonna = [...document.querySelectorAll('.studio-corpo .colonna.destra')].find(visibile)
    const pagina = colonna && colonna.closest('.pagina')
    if (!colonna || !pagina) return null
    const c = colonna.getBoundingClientRect()
    const p = pagina.getBoundingClientRect()
    // il pannello è il più a sinistra della pagina (l'ordine visivo, non quello del DOM: il CSS lo mette per primo)
    const aSinistra = Math.abs(c.left - p.left) < 2 && c.right < p.right
    const azione = colonna.querySelector('.azione-prima')
    const scorri = colonna.querySelector(':scope > .scorri')
    return {
      pannelloASinistra: aSinistra,
      pannelloLarghezza: Math.round(c.width),
      scorrevole: !!scorri && getComputedStyle(scorri).overflowY === 'auto',
      azioneFuoriDalloScorrimento: !!azione && !scorri.contains(azione),
    }
  })
  console.log(modo, JSON.stringify(misure[modo]))
  assert.ok(misure[modo], `${modo}: pannello e palco visibili`)
  assert.equal(misure[modo].pannelloASinistra, true, `${modo}: il pannello dei controlli sta a sinistra del palco`)
}
// in Crea il pulsante CREA è fuori dallo scorrimento (resta in fondo anche con il pannello scorso)
await pg.click('button[data-modo="crea"]')
await pg.waitForTimeout(300)
assert.equal(misure.crea.azioneFuoriDalloScorrimento, true, 'Crea: CREA fisso in fondo al pannello')
assert.equal(misure.crea.scorrevole, true, 'Crea: il pannello scorre')

await b.close()
console.log('OK: Studio con pannello a sinistra in Crea, Modifica, Box e Ricette; CREA fisso in fondo')
