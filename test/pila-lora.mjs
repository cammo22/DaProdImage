// Prove senza desktop: ordine, limiti della forza e compatibilità della pila LoRA.
import assert from 'node:assert/strict'
import { spostaLora, forzaLora, compatibilitaLora } from '../src/renderer/src/pilaLora.ts'
const pila = [{ file: 'a', forza: 1 }, { file: 'b', forza: 0.5 }, { file: 'c', forza: 0 }]
assert.deepEqual(spostaLora(pila, 'b', -1).map(x => x.file), ['b', 'a', 'c'])
assert.deepEqual(spostaLora(pila, 'b', 1).map(x => x.file), ['a', 'c', 'b'])
assert.deepEqual(spostaLora(pila, 'a', -1), pila)
assert.deepEqual(spostaLora(pila, 'manca', 1), pila)
assert.deepEqual(pila.map(x => x.file), ['a', 'b', 'c'], 'non muta lo stato precedente')
assert.equal(forzaLora(3), 2)
assert.equal(forzaLora(-3), -2)
assert.equal(forzaLora(NaN), 0)
assert.equal(compatibilitaLora({ compatibile: 'si' }, 'qwen'), 'si')
assert.equal(compatibilitaLora({ compatibile: 'si' }, 'klein'), 'no', 'il vecchio si significa solo Qwen')
assert.equal(compatibilitaLora({ compatibile: '?', famiglie: ['klein', 'klein-base'] }, 'klein'), 'si')
assert.equal(compatibilitaLora({ compatibile: 'si', famiglie: ['qwen'] }, 'klein'), 'no')
assert.equal(compatibilitaLora({ compatibile: '?', famiglie: [] }, 'klein'), '?')
console.log('OK: pila LoRA (ordine immutabile, forza, compatibilità esplicita)')
