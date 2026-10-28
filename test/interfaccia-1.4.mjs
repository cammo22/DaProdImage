// La 1.4 nel browser di prova (finto window.daprod): quattro modelli in alto, Qwen col suo Studio a quattro modi, Klein con una pagina sola
// (scrivi, aggiungi foto), l'interruttore «L'LLM legge il prompt» in tutti e due. Foto in test/.out/.
//   node test/interfaccia-1.4.mjs
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { provaBrowser } from './browser-prova.mjs'
mkdirSync('test/.out', { recursive: true })

// --- Qwen (di serie) ---
await provaBrowser(async (pg) => {
  const pillole = pg.locator('.barra-titolo [data-selettore-modello] [data-modello]')
  assert.deepEqual(await pillole.evaluateAll((b) => b.map((x) => x.getAttribute('data-modello'))), ['qwen-base', 'qwen-veloce', 'klein', 'klein-base'], 'quattro modelli in alto')
  assert.equal(await pg.locator('.strip-modi [data-modo]').count(), 4, 'Qwen: Crea, Modifica, Box, Ricette')
  assert.equal(await pg.locator('.llm-int[data-llm="no"]').count() >= 1, true, 'Qwen: l\'LLM che legge il prompt è spento di serie')
  await pg.screenshot({ path: 'test/.out/v14-qwen-crea.png' })
  // Qwen veloce: 4 passi, LoRA Lightning
  await pg.click('[data-modello="qwen-veloce"]')
  await pg.locator('.studio-corpo .colonna.destra:visible textarea').first().fill('una volpe nella nebbia')
  await pg.keyboard.press('Control+Enter')
  await pg.waitForFunction(() => !!window.__ultima)
  const q = await pg.evaluate(() => window.__ultima)
  assert.equal(q.famiglia, 'qwen'); assert.equal(q.passi, 4, 'Qwen veloce: 4 passi'); assert.equal(q.turbo, true, 'Qwen veloce: LoRA Lightning acceso')
  // l'interruttore si accende e il motore lo sa
  await pg.click('.llm-int label')
  assert.equal(await pg.evaluate(async () => (await window.daprod.impostazioni.leggi()).potenziaQwen), true, 'interruttore Qwen salvato')
}, undefined)

// --- Klein: una pagina sola ---
await provaBrowser(async (pg) => {
  assert.equal(await pg.locator('.strip-modi').count(), 0, 'Klein: niente modi dello Studio')
  const pannello = pg.locator('.studio-corpo .colonna.destra:visible')
  assert.equal(await pannello.locator('h3.chiudibile').filter({ hasText: /Genere|Stile/ }).count(), 0, 'Klein: niente Genere né Stile')
  assert.equal(await pannello.locator('.llm-int[data-llm="si"]').count(), 1, 'Klein: l\'LLM legge il prompt, acceso di serie')
  assert.equal(await pannello.locator('h3:has-text("Foto")').count(), 1, 'Klein: la sezione Foto')
  await pg.screenshot({ path: 'test/.out/v14-klein-crea.png' })
  await pannello.locator('textarea').first().fill('una volpe nella nebbia')
  await pg.keyboard.press('Control+Enter')
  await pg.waitForFunction(() => !!window.__ultima)
  const q = await pg.evaluate(() => window.__ultima)
  assert.equal(q.famiglia, 'klein'); assert.equal(q.passi, 16, 'Klein: 16 passi'); assert.equal(q.modalita, 'crea'); assert.equal(q.potenzia, true)
  // con una foto: è una modifica, la misura è quella della foto 1; con «Scelgo io» torna una creazione con quei riferimenti
  await pg.evaluate(() => { window.__ultima = null })
  await pannello.locator('.rif .aggiungi').click()
  await pg.getByRole('button', { name: 'Dal PC…' }).click()
  await pg.waitForFunction(() => document.querySelectorAll('.colonna.destra .rif .r').length === 1)
  assert.equal(await pannello.locator('h3:has-text("Cosa cambio?")').count(), 1, 'con una foto la domanda diventa «Cosa cambio?»')
  assert.equal(await pannello.locator('h3:has-text("Formato")').count(), 0, 'con una foto niente Formato: esce come la foto 1')
  await pg.screenshot({ path: 'test/.out/v14-klein-foto.png' })
  await pannello.locator('textarea').first().fill('metti un cappello rosso')
  await pg.keyboard.press('Control+Enter')
  await pg.waitForFunction(() => !!window.__ultima)
  const m = await pg.evaluate(() => window.__ultima)
  assert.equal(m.modalita, 'modifica'); assert.equal(m.immagini.length, 1); assert.equal(m.famiglia, 'klein'); assert.equal(m.potenzia, true)
  await pg.evaluate(() => { window.__ultima = null })
  await pannello.locator('button:has-text("Scelgo io")').click()
  assert.equal(await pannello.locator('h3:has-text("Formato")').count(), 1, 'Scelgo io: torna il Formato')
  await pg.keyboard.press('Control+Enter')
  await pg.waitForFunction(() => !!window.__ultima)
  assert.equal((await pg.evaluate(() => window.__ultima)).modalita, 'crea', 'Scelgo io: foto nuova con i riferimenti')
  // le scorciatoie dei modi non portano via da Crea
  await pg.keyboard.press('2')
  assert.equal(await pg.locator('.studio-corpo .colonna.destra:visible h3:has-text("Foto")').count(), 1, 'Klein: il tasto 2 resta su Crea')
}, () => { window.daprod.impostazioni.salva({ famiglia: 'klein', modelloScelto: 'klein' }) })
console.log('interfaccia 1.4: ok (foto in test/.out/v14-*.png)')
