// Interfaccia 1.2.1 in Chromium (finto window.daprod): modello scelto dalla barra in alto (solo Qwen e Klein 3), Editor box che permette
// di disegnare più di tre riquadri e di disegnarne uno dentro un altro, LoRA divisi in due scaffali (Qwen e Flux) con pile separate.
//   npm run build, poi:   node test/box-lora-ui.mjs
import assert from 'node:assert/strict'
import { provaBrowser } from './browser-prova.mjs'

const lore = [
  { file: 'qwen\\stile-qwen.safetensors', nome: 'Stile Qwen', dimensione: 1e8, parole: 'qwenstyle', forza: 1, compatibile: 'si', base: 'Qwen-Image 2.1', famiglie: ['qwen'], aggiunta: 3 },
  { file: 'flux\\stile-flux.safetensors', nome: 'Stile Flux', dimensione: 1e8, parole: 'fluxstyle', forza: 0.8, compatibile: 'si', base: 'FLUX 3 Klein', famiglie: ['klein', 'klein-base'], aggiunta: 2 },
  { file: 'misterioso.safetensors', nome: 'Misterioso', dimensione: 1e8, parole: '', forza: 1, compatibile: '?', famiglie: [], aggiunta: 1 }
]

await provaBrowser(async (pg) => {
  // ---- 1. il modello si sceglie dalla barra in alto: Qwen, Klein 3 e Klein 3 Base, niente Klein 4B ----
  const pillole = pg.locator('.barra-titolo [data-selettore-modello] [data-modello]')
  assert.deepEqual(await pillole.evaluateAll((b) => b.map((x) => x.getAttribute('data-modello'))), ['qwen-base', 'qwen-veloce', 'klein', 'klein-base'])
  assert.equal(await pg.locator('[data-modello="klein4b"], [data-id="modello-klein4b"]').count(), 0, 'niente Klein 4B')
  for (const modo of ['crea', 'modifica', 'box']) {
    await pg.click(`button[data-modo="${modo}"]`)
    assert.equal(await pg.locator('.studio-corpo .colonna.destra:visible [data-id^="modello-"]').count(), 0, `${modo}: nel pannello non c'è un secondo selettore`)
  }
  await pg.click('.barra-titolo [data-modello="klein"]')
  await pg.waitForFunction(() => document.querySelector('.barra-titolo [data-modello="klein"]')?.getAttribute('aria-checked') === 'true')
  await pg.click('.barra-titolo [data-modello="qwen-base"]')
  await pg.waitForFunction(() => document.querySelector('.barra-titolo [data-modello="qwen-base"]')?.getAttribute('aria-checked') === 'true')
  await pg.screenshot({ path: 'test/.out/121-barra-modelli.png' })

  // ---- 2. Editor box: più di tre riquadri, e uno dentro un altro ----
  await pg.click('button[data-modo="box"]')
  const tela = pg.locator('[data-box-tela]')
  await tela.waitFor()
  const r = await tela.boundingBox()
  const trascina = async (x0, y0, x1, y1) => {
    await pg.mouse.move(r.x + r.width * x0, r.y + r.height * y0)
    await pg.mouse.down()
    await pg.mouse.move(r.x + r.width * ((x0 + x1) / 2), r.y + r.height * ((y0 + y1) / 2), { steps: 3 })
    await pg.mouse.move(r.x + r.width * x1, r.y + r.height * y1, { steps: 3 })
    await pg.mouse.up()
  }
  const quanti = async () => {
    await pg.waitForTimeout(120)
    return pg.locator('[data-box-tela] .box-regione:not(.disegno)').count()
  }
  await trascina(0.02, 0.02, 0.98, 0.98) // un riquadro che copre tutta la tela
  assert.equal(await quanti(), 1)
  // dentro quello grande se ne possono fare altri (prima il riquadro grande si prendeva il mouse)
  await trascina(0.1, 0.1, 0.3, 0.3)
  await trascina(0.4, 0.1, 0.6, 0.3)
  await trascina(0.7, 0.1, 0.9, 0.3)
  await trascina(0.1, 0.5, 0.3, 0.7)
  assert.equal(await quanti(), 5, 'più di tre riquadri, anche dentro uno grande')
  // un riquadro dentro uno dei piccoli
  await trascina(0.15, 0.15, 0.25, 0.25)
  assert.equal(await quanti(), 6, 'un riquadro dentro un altro piccolo')
  assert.match(await pg.locator('.box-lista').locator('xpath=ancestor::div[contains(@class,"sezione")][1]/h3').innerText(), /6 \/ 16/, 'il tetto è 16 come nel motore')

  // un clic su un punto dentro i riquadri sceglie il più piccolo che lo contiene
  await pg.mouse.click(r.x + r.width * 0.2, r.y + r.height * 0.2)
  const scelto = await pg.evaluate(() => document.querySelector('.box-regione.sel')?.querySelector('.numero')?.textContent)
  assert.equal(scelto, '6', 'il clic sceglie il riquadro più piccolo sotto il mouse')

  // con «Sposta» il corpo di un riquadro si afferra e si trascina; con «Disegna» lo si sposta dal numero
  const num = pg.locator('[data-box-tela] .box-regione').nth(2).locator('.numero')
  const prima = await pg.locator('[data-box-tela] .box-regione').nth(2).boundingBox()
  const b = await num.boundingBox()
  await pg.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await pg.mouse.down()
  await pg.mouse.move(b.x + b.width / 2 + 30, b.y + b.height / 2 + 40, { steps: 4 })
  await pg.mouse.up()
  const dopo = await pg.locator('[data-box-tela] .box-regione').nth(2).boundingBox()
  assert.ok(Math.abs(dopo.x - prima.x - 30) < 3 && Math.abs(dopo.y - prima.y - 40) < 3, 'il numero sposta il riquadro')
  assert.equal(await quanti(), 6, 'spostare non crea riquadri')
  await pg.click('[data-strumento="sposta"]')
  const c = await pg.locator('[data-box-tela] .box-regione').nth(0).boundingBox()
  // un punto del riquadro grande lontano dagli altri: lo trascina invece di disegnarne uno
  await pg.mouse.move(c.x + c.width * 0.5, c.y + c.height * 0.9)
  await pg.mouse.down()
  await pg.mouse.move(c.x + c.width * 0.5 - 20, c.y + c.height * 0.9 - 5, { steps: 3 })
  await pg.mouse.up()
  assert.equal(await quanti(), 6, 'con «Sposta» il corpo si trascina e non nasce niente')
  await pg.click('[data-strumento="disegna"]')
  await pg.screenshot({ path: 'test/.out/121-box.png' })

  // ---- 3. LoRA: due scaffali, pile separate ----
  await pg.evaluate((l) => { window.daprod.lora.elenco = async () => l }, lore)
  await pg.evaluate(() => document.querySelector('.strip-modi button[title^="La pila"]').click())
  await pg.locator('[data-schede-lora]').waitFor()
  const schede = await pg.locator('[data-scheda-lora]').evaluateAll((b) => b.map((x) => x.getAttribute('data-scheda-lora')))
  assert.deepEqual(schede, ['qwen', 'flux', 'altri'], 'Qwen, Flux e Altri (il LoRA non riconosciuto)')
  // scheda Qwen (il modello scelto): solo il LoRA di Qwen
  assert.equal(await pg.locator('.carta .nome').allInnerTexts().then((t) => t.join('|')), 'Stile Qwen')
  await pg.click('[data-scheda-lora="flux"]')
  assert.equal(await pg.locator('.carta .nome').allInnerTexts().then((t) => t.join('|')), 'Stile Flux')
  assert.match(await pg.locator('.zona-rilascio').innerText(), /per Flux/)
  // si accende il LoRA di Flux: sta nella pila di Flux, non in quella di Qwen
  await pg.click('.carta .copertina')
  await pg.screenshot({ path: 'test/.out/121-lora-flux.png' })
  assert.match(await pg.locator('section[aria-label^="Pila LoRA"]').innerText(), /Stile Flux/)
  await pg.click('[data-scheda-lora="qwen"]')
  assert.doesNotMatch(await pg.locator('section[aria-label^="Pila LoRA"]').innerText(), /Stile Flux/, 'la pila di Qwen non ha il LoRA di Flux')
  await pg.click('[data-scheda-lora="altri"]')
  assert.equal(await pg.locator('[data-assegna]').count(), 2, 'un LoRA non riconosciuto si assegna a Qwen o a Flux')
}, () => { window.daprod.impostazioni.salva({ famiglia: 'qwen', modelloScelto: 'qwen-base' }) })

// ---- 4. se i file di Klein non ci sono: puntino sulla pillola e il pannellino con il peso e il pulsante per scaricarli ----
await provaBrowser(async (pg) => {
  const klein = pg.locator('.barra-titolo [data-modello="klein"]')
  assert.equal(await klein.locator('.puntino').count(), 1, 'Klein da scaricare ha il puntino')
  await klein.click()
  const pop = pg.locator('.barra-titolo .sel-modello-pop')
  await pop.waitFor()
  assert.match(await pop.innerText(), /Scarica FLUX 3 Klein/)
  assert.doesNotMatch(await pop.innerText(), /4B/i, 'nessuna traccia di Klein 4B')
  // il pannellino sta sopra il resto dell'app: il suo pulsante riceve il clic
  const b = await pop.locator('button').boundingBox()
  assert.equal(await pg.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.sel-modello-pop'), [b.x + b.width / 2, b.y + b.height / 2]), true, 'il pannellino non è coperto')
  await pg.screenshot({ path: 'test/.out/121-modello-da-scaricare.png' })
}, () => {
  window.daprod.impostazioni.salva({ famiglia: 'qwen', modelloScelto: 'qwen-base' })
  window.daprod.modelli.file = async () => ({ diffusione: [], encoder: [], vae: [], upscaler: [], klein: [], kleinTe: [], kleinVae: [] })
})
console.log('OK: modelli in alto, Editor box con più riquadri e riquadri dentro riquadri, LoRA divisi Qwen/Flux')
