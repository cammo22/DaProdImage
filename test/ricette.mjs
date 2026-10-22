// Prova della scheda Ricette (SENZA Electron né motore): il catalogo dentro Modifica, Unisci foto e Come l'esempio come ricette.
//   npm run build && python -m http.server 8765 --directory out/renderer &   poi:   node test/ricette.mjs
import { chromium } from 'playwright'
import { readFileSync, mkdirSync } from 'node:fs'

const url = process.argv[2] || 'http://localhost:8765/index.html'
const out = 'test/.out'
mkdirSync(out, { recursive: true })
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH ? process.env.PLAYWRIGHT_BROWSERS_PATH + '/chromium' : undefined })
const pg = await b.newPage({ viewport: { width: 1480, height: 900 } })
let errori = 0
pg.on('pageerror', (e) => { errori++; console.log('[errore pagina]', e.message) })
await pg.addInitScript(readFileSync('test/finto.js', 'utf8'))
await pg.goto(url)
const pausa = (ms) => pg.waitForTimeout(ms)
let male = 0
const prova = (nome, ok) => { console.log(ok ? 'OK  ' : 'MALE', nome); if (!ok) male++ }
await pausa(1200)

// la rotaia non ha più il Laboratorio
prova('rotaia senza Laboratorio', (await pg.locator('.rotaia button:has-text("Laboratorio")').count()) === 0)
await pg.click('.strip-modi button[data-modo="modifica"]')
await pausa(300)
const voci = (await pg.locator('.modi-modifica button:visible').allInnerTexts()).map((x) => x.trim()).join('|')
prova(`selettore: ${voci}`, voci === 'Scrivi|Espandi|Estrai')

// il catalogo
await pg.click('.strip-modi button[data-modo="ricette"]')
await pausa(500)
await pg.screenshot({ path: `${out}/r1-catalogo.png` })
prova('catalogo con le carte', (await pg.locator('.carta-wf').count()) > 20)
prova("Unisci foto e Come l'esempio nel catalogo", (await pg.locator('.carta-wf:has-text("Unisci foto")').count()) === 1 && (await pg.locator(".carta-wf:has-text(\"Come l'esempio\")").count()) === 1)

// una ricetta normale: colonna di destra con i passi e Avvia
await pg.locator('.carta-wf').first().click()
await pausa(300)
await pg.screenshot({ path: `${out}/r2-ricetta.png` })
prova('ricetta normale: colonna destra con Avvia', (await pg.locator('.colonna.destra button:has-text("Avvia")').count()) === 1)

// Unisci foto: la griglia di Modifica e il pulsante di sempre
await pg.locator('.carta-wf:has-text("Unisci foto")').click()
await pausa(500)
await pg.screenshot({ path: `${out}/r3-unisci.png` })
prova('Unisci: c\'è il ritorno a "tutte le ricette"', (await pg.locator('.attrezzi button:has-text("tutte le ricette")').count()) === 1)
prova('Unisci: pulsante "crea la foto nuova"', (await pg.locator('.colonna.destra button:has-text("crea la foto nuova")').count()) === 1)
await pg.locator('.fusion button:has-text("Dal PC")').first().click()
await pausa(500)
await pg.fill('.colonna.destra textarea:visible', 'la ragazza di <image1> in una strada di Tokyo')
await pg.click('.colonna.destra button:has-text("crea la foto nuova")')
await pausa(500)
const q = await pg.evaluate(() => window.__ultima)
prova('Unisci: accodato un lavoro "crea" con la foto', !!q && q.modalita === 'crea' && q.immagini?.length === 1)

// Come l'esempio
await pg.click('.attrezzi button:has-text("tutte le ricette")')
await pausa(300)
await pg.locator(".carta-wf:has-text(\"Come l'esempio\")").click()
await pausa(500)
await pg.screenshot({ path: `${out}/r4-esempio.png` })
prova("Esempio: pulsante \"Crea come l'esempio\"", (await pg.locator(".colonna.destra button:has-text(\"Crea come l'esempio\")").count()) === 1)

// tornando a Scrivi la pagina è quella di sempre
await pg.click('.strip-modi button[data-modo="modifica"]')
await pausa(300)
prova('Scrivi: pulsante Modifica', (await pg.locator('.colonna.destra button:has-text("Modifica")').count()) >= 1)
await b.close()
console.log(male || errori ? `FALLITA (${male} prove, ${errori} errori di pagina)` : 'TUTTO BENE')
process.exit(male || errori ? 1 : 0)
