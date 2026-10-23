// Prova nel browser (senza Electron né motore, con test/finto.js): le tessere mostrano davvero le immagini di resources/gui,
// le immagini si caricano (naturalWidth > 0), e se un'immagine si rompe la tessera ripiega sull'icona senza errori in console.
//   npm run build, poi un server statico su out/renderer (porta 8791), poi:   node test/asset-ui.mjs
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'

const url = process.argv[2] || 'http://localhost:8791/index.html'
const out = 'test/.out'
mkdirSync(out, { recursive: true })
const b = await chromium.launch()
const pg = await b.newPage({ viewport: { width: 1480, height: 1000 } })
const errori = []
pg.on('pageerror', (e) => errori.push(e.message))
pg.on('console', (m) => { if (m.type() === 'error') errori.push(m.text()) })
pg.on('requestfailed', (r) => errori.push(`richiesta fallita: ${r.url()}`))
pg.on('response', (r) => { if (r.status() >= 400) errori.push(`${r.status()} ${r.url()}`) })
await pg.addInitScript(readFileSync('test/finto.js', 'utf8'))
await pg.goto(url)
await pg.waitForTimeout(1500)

/** quante immagini visibili dentro il selettore sono caricate bene (i pannelli degli altri modi restano montati ma nascosti) */
const caricate = (sel) => pg.evaluate((s) => {
  const imgs = [...document.querySelectorAll(s)].filter((i) => i.getClientRects().length > 0)
  return { tot: imgs.length, ok: imgs.filter((i) => i.complete && i.naturalWidth > 0).length }
}, sel)
const aspetta = async (sel, n) => {
  for (let i = 0; i < 20; i++) {
    const c = await caricate(sel)
    if (c.tot >= n && c.ok === c.tot) return c
    await pg.waitForTimeout(150)
  }
  return caricate(sel)
}

// Crea: 11 generi + Libero con l'icona 3D; lo stato vuoto con la mascotte e il pianeta
let c = await aspetta('.tessera-o .ic-img', 12)
console.log('Crea, generi:', c)
assert.ok(c.tot >= 12 && c.ok === c.tot, 'le 12 tessere dei generi hanno l\'immagine')
c = await aspetta('.mascotte-vuoto', 1)
assert.equal(c.ok, 1, 'mascotte nello stato vuoto')
c = await aspetta('.hero-pianeta', 1)
assert.equal(c.ok, 1, 'pianeta nello stato vuoto')
assert.equal((await caricate('.strip-modi .ic-modo')).ok, 4, 'i 4 modi nella strip')
await pg.screenshot({ path: `${out}/a1-crea.png` })

// le anteprime degli stili in Crea (sezione Stile, aperta di serie): a tutta tessera
c = await aspetta('.tessera-o.foto .pieno', 28)
console.log('Crea, stili:', c)
assert.equal(c.ok, 28, 'le 28 anteprime degli stili in Crea')
await pg.locator('[data-id="stile-pixel"]:visible').first().scrollIntoViewIfNeeded()
await pg.screenshot({ path: `${out}/a2-crea-stili.png` })

// Modifica: categorie con l'immagine, controlli con le anteprime
await pg.click('.strip-modi button[data-modo="modifica"]')
await pg.click('.attrezzi button:has-text("Dal PC")')
await pg.waitForTimeout(800)
c = await aspetta('[data-id^="cat-"] .ic-img', 8)
console.log('Modifica, categorie + estrai/espandi:', c)
assert.ok(c.tot >= 10 && c.ok === c.tot, 'le 8 categorie e Estrai/Espandi hanno l\'immagine')
for (const [cat, prefisso, n] of [['persone', 'ctl-animale-', 5], ['persone', 'ctl-espressione-', 6], ['vestiti', 'ctl-costume-', 9], ['situazioni', 'ctl-luogo-', 10], ['situazioni', 'ctl-meteo-', 6], ['situazioni', 'ctl-stagione-', 4]]) {
  await pg.click(`button[data-id="cat-${cat}"]`)
  await pg.waitForTimeout(400)
  const k = await aspetta(`[data-id^="${prefisso}"] .ic-img`, n)
  console.log(`  ${prefisso}`, k)
  assert.equal(k.tot, n, `${prefisso}: ${n} tessere con l'immagine`)
  assert.equal(k.ok, n, `${prefisso}: tutte caricate`)
}
await pg.screenshot({ path: `${out}/a3-modifica-situazioni.png` })
await pg.click('button[data-id="cat-stili"]')
await pg.waitForTimeout(500)
c = await aspetta('.tessera-o.foto .pieno', 28)
assert.equal(c.ok, 28, 'le 28 anteprime degli stili in Modifica')
await pg.locator('[data-id="stile-pixel"]:visible').first().scrollIntoViewIfNeeded()
await pg.screenshot({ path: `${out}/a4-modifica-stili.png` })

// Ricette: la locandina di ognuna delle sei
await pg.click('.strip-modi button[data-modo="ricette"]')
await pg.waitForTimeout(800)
c = await aspetta('.carta-wf .locandina-wf', 6)
console.log('Ricette:', c)
assert.equal(c.ok, 6, 'le sei ricette con la locandina')
await pg.screenshot({ path: `${out}/a5-ricette.png` })

// ripiego: se l'immagine di una tessera non si carica resta l'icona di prima, senza errori di pagina
await pg.click('.strip-modi button[data-modo="crea"]')
await pg.waitForTimeout(400)
await pg.route('**/assets/foto-*.webp', (r) => r.abort())
await pg.reload()
await pg.waitForTimeout(1500)
const rotta = await pg.evaluate(() => {
  const t = document.querySelector('[data-id="genere-foto"]')
  return { img: !!t?.querySelector('img'), icona: !!t?.querySelector('.ic svg, .ic span'), classe: t?.className }
})
console.log('con foto.webp bloccata:', rotta)
assert.equal(rotta.img, false, 'immagine rotta: non resta l\'<img>')
assert.equal(rotta.icona, true, 'immagine rotta: torna l\'icona')
await pg.screenshot({ path: `${out}/a6-ripiego.png` })

const veri = errori.filter((e) => !/foto-.*\.webp|ERR_FAILED|Failed to load resource/.test(e))
console.log('errori inattesi:', veri)
assert.deepEqual(veri, [], 'nessun errore di pagina o richiesta fallita')
await b.close()
console.log('asset-ui OK')
