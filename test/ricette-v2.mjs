// Le sei ricette nuove, i loro passi veri e la lettura delle ricette storiche.
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'
globalThis.window = { daprod: {} }
globalThis.localStorage = { getItem: () => null, setItem() {} }
mkdirSync('test/.out', { recursive: true })
buildSync({ entryPoints: ['src/renderer/src/workflow.ts'], bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', alias: { '@shared': resolve('src/shared') }, outfile: 'test/.out/ricette-v2.cjs' })
const { elencoWorkflow, workflowDa, valoriIniziali } = createRequire(import.meta.url)('./.out/ricette-v2.cjs')
const elenco = elencoWorkflow()
assert.deepEqual(elenco.map(w => w.nome), ['Foglio', 'Mondi', 'Mix', 'Set', 'Formati', 'Rinnova'])
for (const w of elenco) {
  const v = valoriIniziali(w)
  const passi = w.passi({ v, nRif: 2, camera: false })
  assert.ok(passi.length, `${w.nome}: almeno un passo`)
  assert.equal(new Set(passi.map(p => p.etichetta)).size, passi.length, `${w.nome}: etichette univoche`)
  assert.ok(passi.every(p => p.prompt.trim().length > 10))
  for (const g of w.ingressi.filter(g => g.tipo === 'scelta')) for (const o of g.opzioni) {
    assert.ok(w.passi({ v: { ...v, [g.id]: o.id }, nRif: 2, camera: false }).length, `${w.nome}/${o.id}`)
  }
}
assert.ok(workflowDa('turnaround'), 'il PNG vecchio trova ancora il suo workflow')
assert.ok(workflowDa('esempio'), 'il percorso Esempio rimane accessibile da Mix')
assert.ok(elenco.find(w => w.nome === 'Set').passi({ v: { soggetti: 'gatto\ncane', tipo: 'icone' }, nRif: 0, camera: false }).every(p => p.trasparente))
console.log('OK: sei ricette, tutte le varianti producono passi, Set trasparente, compatibilità storica')
