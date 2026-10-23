// Test del regional prompting (src/main/motore/regioni.ts): riquadri → testo per Klein 3 (JSON con le coordinate) e per Qwen (a parole).
//
// Esecuzione: node test/regioni.mjs
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const QUI = dirname(fileURLToPath(import.meta.url))
const R = await import(pathToFileURL(join(QUI, '..', 'src', 'main', 'motore', 'regioni.ts')).href)

let falliti = 0
let fatti = 0
function uguale(nome, avuto, atteso) {
  fatti++
  const a = JSON.stringify(avuto)
  const b = JSON.stringify(atteso)
  if (a === b) return
  falliti++
  console.log(`NO  ${nome}\n    avuto:  ${a}\n    atteso: ${b}`)
}

// pulizia
uguale('niente regioni', R.regioniPronte(undefined), [])
uguale('prompt vuoto scartato', R.regioniPronte([{ id: 'a', box: [0, 0, 0.5, 0.5], prompt: '   ' }]), [])
uguale('riquadro troppo piccolo scartato', R.regioniPronte([{ id: 'a', box: [0.1, 0.1, 0.11, 0.5], prompt: 'cat' }]), [])
uguale('riquadro con 3 numeri scartato', R.regioniPronte([{ id: 'a', box: [0, 0, 1], prompt: 'cat' }]), [])
uguale('NaN scartato', R.regioniPronte([{ id: 'a', box: [0, 0, NaN, 1], prompt: 'cat' }]), [])
uguale('riquadro capovolto e fuori tela', R.regioniPronte([{ id: 'x', box: [1.2, 0.8, 0.5, -0.2], prompt: ' a  red\n ball ' }]), [{ id: 'obj_1', box: [0.5, 0, 1, 0.8], prompt: 'a red ball' }])
uguale('id obj_N in fila, saltando gli scartati', R.regioniPronte([
  { id: 'a', box: [0, 0, 0.5, 0.5], prompt: 'one' },
  { id: 'b', box: [0, 0, 0.5, 0.5], prompt: '' },
  { id: 'c', box: [0.5, 0.5, 1, 1], prompt: 'two' }
]).map((r) => r.id), ['obj_1', 'obj_2'])
const venti = Array.from({ length: 20 }, (_, i) => ({ id: `r${i}`, box: [0, 0, 0.5, 0.5], prompt: `p${i}` }))
uguale('al massimo 16', R.regioniPronte(venti).length, 16)

// Klein 3: bbox [y_min, x_min, y_max, x_max] su 0–1000
uguale('bbox di Klein', R.bboxKlein([0.1, 0.2, 0.6, 0.9]), [200, 100, 900, 600])
const reg = R.regioniPronte([
  { id: 'a', box: [0, 0, 0.5, 0.5], prompt: 'a red fox' },
  { id: 'b', box: [0.5, 0.5, 1, 1], prompt: 'a blue door.' }
])
const pk = R.promptKleinConBox('a forest at dawn', reg)
uguale('Klein: didascalia con gli id', pk.startsWith('A forest at dawn. A red fox <obj_1>. A blue door <obj_2>. ['), true)
const json = JSON.parse(pk.slice(pk.indexOf('[{')))
uguale('Klein: righe JSON', json, [
  { id: 'obj_1', bbox: [0, 0, 500, 500], desc: 'A red fox' },
  { id: 'obj_2', bbox: [500, 500, 1000, 1000], desc: 'A blue door.' }
])
const pm = JSON.parse(R.promptKleinConBox('', reg, true).slice(R.promptKleinConBox('', reg, true).indexOf('[{')))
uguale('Klein modifica: tgt_bbox', pm[0], { id: 'obj_1', from: 'target', src_bbox: null, tgt_bbox: [0, 0, 500, 500], desc: 'A red fox' })
uguale('senza regioni il testo non cambia', R.promptKleinConBox('x', []), 'x')

// Qwen: a parole
uguale('dove: in alto a sinistra, piccolo', R.dove([0.02, 0.02, 0.2, 0.2]), 'small, at the top left of the frame')
uguale('dove: al centro', R.dove([0.35, 0.35, 0.65, 0.65]), 'in the center of the frame')
uguale('dove: grande a destra', R.dove([0.5, 0.1, 1, 0.9]), 'large, at the right of the frame')
const pq = R.promptConPosizioni('a street', reg)
uguale('Qwen: scena + elementi', pq.startsWith('A street. Compose the image with these elements, each in its place:'), true)
uguale('Qwen: nessun JSON', pq.includes('{'), false)
uguale('Qwen modifica', R.promptConPosizioni('', reg, true).startsWith('Apply these changes, each one in its place:'), true)
uguale('senza regioni (Qwen)', R.promptConPosizioni('x', []), 'x')

console.log(falliti ? `${falliti} FALLITI su ${fatti}` : `TUTTI OK (${fatti} controlli)`)
process.exit(falliti ? 1 : 0)
