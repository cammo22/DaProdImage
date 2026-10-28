// Regressioni GUI v2: controlli composti, scelte modello e nessun campo fittizio.
import assert from 'node:assert/strict'
import { provaBrowser } from './browser-prova.mjs'
const caso = process.argv[2] || 'controlli'
await provaBrowser(async (pg) => {
  const pannello = pg.locator('.studio-corpo .colonna.destra:visible')
  if (caso === 'box') {
    await pg.click('[data-modo="box"]')
    await pg.click('[data-disposizione="uno"]')
    await pannello.locator('textarea').first().fill('una piazza al tramonto')
    await pg.locator('.box-scheda.sel textarea').fill('CIAO MONDO')
    await pg.click('[data-id="tipo-testo"]')
    await pannello.locator('h3.chiudibile').filter({ hasText: 'Stile' }).click()
    await pannello.locator('[data-id="stile-cyberpunk"]').click()
    await pg.click('[data-azione="componi"]')
    await pg.waitForFunction(() => !!window.__ultima)
    const q = await pg.evaluate(() => window.__ultima)
    assert.match(q.promptScena, /neon cityscape/i, 'stile conservato dopo adattaRichiesta')
    assert.match(q.box[0].prompt, /text.*"CIAO MONDO"/, 'il tipo Testo arriva al motore con istruzioni letterali')
    assert.equal(await pg.locator('[data-id="rigidita-blocca"]:enabled').count(), 0, 'nessun controllo blocca senza implementazione engine')
    await pg.screenshot({ path: 'test/.out/v2-box-contratto.png' })
    return
  }
  if (caso === 'modello') {
    // dalla 1.2.1 il modello si sceglie solo dalla barra in alto; dalla 1.4 sono quattro (Qwen, Qwen veloce, Klein 3, Klein 3 Base) e Klein ha una pagina sola
    const barra = pg.locator('.barra-titolo [data-selettore-modello] [data-modello]')
    assert.deepEqual(await barra.evaluateAll((b) => b.map((x) => x.getAttribute('data-modello'))), ['qwen-base', 'qwen-veloce', 'klein', 'klein-base'], 'la barra in alto ha quattro modelli')
    assert.equal(await pannello.locator('[data-id^="modello-"]').count(), 0, "nel pannello non c'è più il selettore del modello")
    await pg.click('[data-modello="klein"]')
    await pg.locator('.strip-modi').waitFor({ state: 'detached' })
    assert.match(await pg.locator('.barra-titolo [data-modello][aria-checked="true"]').innerText(), /Klein/, 'Klein scelto')
    assert.equal(await pg.locator('.colonna.destra:visible h3.chiudibile:has-text("LoRA")').count(), 1, 'LoRA accessibili anche con Klein, dentro la pagina')
    return
  }
  await pg.click('[data-modo="modifica"]')
  await pg.click('.attrezzi button:has-text("Dal PC")')
  await pg.click('[data-id="cat-vestiti"]')
  const capo = pannello.locator('[data-controllo="capo"]')
  await capo.getByRole('button', { name: 'Rosa', exact: true }).click()
  assert.equal(await capo.getByRole('button', { name: 'Rosa', exact: true }).getAttribute('aria-pressed'), 'true', 'il colore resta selezionato prima del capo')
  await capo.locator('[data-id="ctl-capo-giacca"]').click()
  await capo.locator('[data-id="ctl-capo-seta"]').click()
  await pannello.getByRole('radio', { name: 'Fedele', exact: true }).click()
  await pannello.locator('button.primario.grande').click()
  await pg.waitForFunction(() => !!window.__ultima)
  const q = await pg.evaluate(() => window.__ultima)
  assert.match(q.prompt, /jacket.*pink silk/, 'la richiesta contiene capo, colore e materiale')
  assert.equal(q.modalita, 'modifica')
  await pg.click('[data-id="cat-testo"]')
  const titolo = pannello.locator('[data-controllo="titolo"]')
  await titolo.getByRole('button', { name: 'In alto', exact: true }).click()
  assert.equal(await titolo.getByRole('button', { name: 'In alto', exact: true }).getAttribute('aria-pressed'), 'true', 'posizione persistente prima del testo')
  await titolo.getByRole('textbox').fill('CIAO "MONDO"')
  assert.equal(await titolo.getByRole('textbox').inputValue(), 'CIAO "MONDO"')
  await pg.screenshot({ path: 'test/.out/v2-controlli.png' })
})
console.log('OK: regressioni GUI v2 / ' + caso)
