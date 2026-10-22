// Prova dell'Editor box (SENZA Electron né motore): disegna riquadri col mouse, scrivi i testi, scegli una disposizione, componi,
// e controlla la richiesta che arriva al motore (box, scena, prompt a parole, misura).
//   npm run build, poi un server statico su out/renderer (porta 8765), poi:   node test/box.mjs
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'

const url = process.argv[2] || 'http://localhost:8765/index.html'
const out = 'test/.out'
mkdirSync(out, { recursive: true })
const b = await chromium.launch()
const pg = await b.newPage({ viewport: { width: 1480, height: 960 } })
let errori = 0
pg.on('pageerror', (e) => { errori++; console.log('[errore pagina]', e.message) })
await pg.addInitScript(readFileSync('test/finto.js', 'utf8'))
await pg.goto(url)
const pausa = (ms) => pg.waitForTimeout(ms)
let male = 0
const prova = (nome, ok, extra = '') => { console.log(ok ? 'OK  ' : 'MALE', nome, extra); if (!ok) male++ }
await pausa(1200)

await pg.click('.strip-modi button[data-modo="box"]')
await pausa(300)
prova('Box: la tela c\'è e non ci sono riquadri', (await pg.locator('[data-box-tela]').count()) === 1 && (await pg.locator('.box-regione').count()) === 0)

// formato 16:9 per vedere la tela larga
await pg.click('.colonna.destra:visible button[data-formato="16:9"]')
await pausa(200)
const tela = await pg.locator('[data-box-tela]').boundingBox()
const trascina = async (fx0, fy0, fx1, fy1) => {
  await pg.mouse.move(tela.x + tela.width * fx0, tela.y + tela.height * fy0)
  await pg.mouse.down()
  await pg.mouse.move(tela.x + tela.width * ((fx0 + fx1) / 2), tela.y + tela.height * ((fy0 + fy1) / 2), { steps: 4 })
  await pg.mouse.move(tela.x + tela.width * fx1, tela.y + tela.height * fy1, { steps: 4 })
  await pg.mouse.up()
}
await trascina(0.05, 0.1, 0.45, 0.9)
await trascina(0.55, 0.1, 0.95, 0.5)
prova('due riquadri disegnati', (await pg.locator('.box-regione:not(.disegno)').count()) === 2)

// un clic senza trascinare non crea niente
await pg.mouse.click(tela.x + tela.width * 0.5, tela.y + tela.height * 0.95)
prova('un clic secco non crea un riquadro', (await pg.locator('.box-regione:not(.disegno)').count()) === 2)

// il secondo: il testo (il clic secco ha deselezionato)
await pg.locator('.box-scheda .testa').nth(1).click()
await pg.locator('.box-scheda.sel textarea').fill('un cane che dorme')
await pg.locator('.box-scheda.sel button[data-id="tipo-oggetto"]').click()
// il primo
await pg.locator('.box-scheda .testa').first().click()
await pg.locator('.box-scheda.sel textarea').fill('una ragazza con un cappotto rosso')
await pg.locator('.box-scheda.sel button[data-id="tipo-persona"]').click()
await pg.locator('.box-scheda.sel button[data-id="rigidita-blocca"]').click()
await pg.fill('.colonna.destra:visible textarea >> nth=0', 'al tramonto, colori caldi')
await pg.screenshot({ path: `${out}/b1-box.png` })

await pg.click('button[data-azione="componi"]')
await pausa(500)
const q = await pg.evaluate(() => window.__ultima)
prova('richiesta: modalità crea con box', q.modalita === 'crea' && Array.isArray(q.box) && q.box.length === 2, JSON.stringify(q.box?.map((r) => [r.tipo, r.rigidita])))
prova('richiesta: la scena', q.promptScena === 'al tramonto, colori caldi')
prova('richiesta: il prompt descrive i riquadri a parole', /ragazza con un cappotto rosso/.test(q.prompt) && /cane che dorme/.test(q.prompt) && /left side/.test(q.prompt) && /right side|top-right/.test(q.prompt), q.prompt.slice(0, 140))
prova('richiesta: misura 16:9 coerente (multipli di 16)', q.larghezza % 16 === 0 && Math.abs(q.larghezza / q.altezza - 16 / 9) < 0.06, `${q.larghezza}×${q.altezza}`)
prova('richiesta: niente espansione del prompt', q.potenzia === false)

// il lavoro è in corso: la tela mostra l'anteprima, e c'è il ritorno ai riquadri
prova("in corso: c'è «Torna ai riquadri»", (await pg.locator('button[data-azione="torna-riquadri"]').count()) === 1)
await pg.click('button[data-azione="torna-riquadri"]')
prova('tornati ai riquadri', (await pg.locator('.box-regione:not(.disegno)').count()) === 2)
await pg.screenshot({ path: `${out}/b2-box-in-corso.png` })

// disposizioni: tre colonne tiene i testi di prima
await pausa(300)
await pg.click('.strip-modi button[data-modo="box"]')
await pg.click('button[data-disposizione="tre"]')
await pausa(200)
prova('disposizione «tre colonne»: 3 riquadri', (await pg.locator('.box-regione:not(.disegno)').count()) >= 3)
await pg.screenshot({ path: `${out}/b3-box-tre.png` })

// riquadri senza testo: l'invio si ferma con un avviso
await pg.evaluate(() => { window.__ultimaPrima = window.__ultima })
await pg.click('button[data-azione="componi"]')
await pausa(300)
prova('l\'avviso «ogni riquadro ha bisogno di un testo» compare', (await pg.locator('.avviso.errore:has-text("riquadro")').count()) >= 1)

// i tasti: Canc toglie il selezionato
const prima = await pg.locator('.box-regione:not(.disegno)').count()
await pg.locator('.box-regione:not(.disegno)').first().click({ position: { x: 5, y: 5 } })
await pg.keyboard.press('Delete')
prova('Canc elimina il riquadro selezionato', (await pg.locator('.box-regione:not(.disegno)').count()) === prima - 1)
await pg.click('.strip-modi button[data-modo="crea"]')
await pausa(200)
await pg.click('.strip-modi button[data-modo="box"]')
prova('i riquadri restano cambiando modo', (await pg.locator('.box-regione:not(.disegno)').count()) === prima - 1)

await b.close()
console.log(male || errori ? `PROBLEMI: ${male} prove, ${errori} errori` : 'TUTTO BENE')
process.exit(male || errori ? 1 : 0)
