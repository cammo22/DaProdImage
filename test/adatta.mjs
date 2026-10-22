// Test dell'adattatore GUI v2 → motore (src/main/motore/adatta.ts): box → regioni, sfondo → trasparente / tinta.
//
// Esecuzione: node test/adatta.mjs
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const QUI = dirname(fileURLToPath(import.meta.url))
const A = await import(pathToFileURL(join(QUI, '..', 'src', 'main', 'motore', 'adatta.ts')).href)

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
const q = { modalita: 'crea', prompt: 'old flat prompt', lora: [] }
const bx = (id, ordine, o = {}) => ({ id, rect: [0, 0, 0.5, 0.5], tipo: 'oggetto', prompt: 'p' + id, rigidita: 'decisa', ordine, ...o })

uguale('senza box né sfondo: invariata', A.adattaRichiesta(q), q)
const r = A.adattaRichiesta({ ...q, promptScena: 'a harbour at dusk', box: [bx('b', 2), bx('a', 1), bx('n', 0, { nascosta: true }), bx('v', 3, { prompt: '  ' })] })
uguale('box → regioni nell\'ordine, senza nascoste né vuote', r.regioni.map((x) => x.id), ['a', 'b'])
uguale('box → riquadro e prompt', r.regioni[0], { id: 'a', box: [0, 0, 0.5, 0.5], prompt: 'pa' })
uguale('la scena diventa il prompt', r.prompt, 'a harbour at dusk')
uguale('box senza promptScena: il prompt resta', A.adattaRichiesta({ ...q, box: [bx('a', 0)] }).prompt, 'old flat prompt')
uguale('tutti nascosti: prompt e regioni non cambiano', A.adattaRichiesta({ ...q, promptScena: 'x', box: [bx('a', 0, { nascosta: true })] }), { ...q, promptScena: 'x', box: [bx('a', 0, { nascosta: true })] })
uguale('regioni già presenti si tengono', A.adattaRichiesta({ ...q, regioni: [{ id: 'z', box: [0, 0, 1, 1], prompt: 'zz' }], box: [bx('a', 0)] }).regioni.map((x) => x.id), ['z', 'a'])

uguale('sfondo trasparente', A.adattaRichiesta({ ...q, sfondo: 'trasparente' }).trasparente, true)
uguale('sfondo scena: niente', A.adattaRichiesta({ ...q, sfondo: 'scena' }), { ...q, sfondo: 'scena' })
uguale('tinta unita nel prompt', A.adattaRichiesta({ ...q, sfondo: { tinta: '#ff8800' } }).prompt, 'old flat prompt, on a plain solid #ff8800 background')
uguale('tinta senza #', A.adattaRichiesta({ ...q, sfondo: { tinta: 'ABC' } }).prompt, 'old flat prompt, on a plain solid #ABC background')
uguale('tinta non valida: ignorata', A.adattaRichiesta({ ...q, sfondo: { tinta: 'rosso' } }).prompt, 'old flat prompt')
uguale('tinta con punto finale nel prompt', A.adattaRichiesta({ ...q, prompt: 'a cat.', sfondo: { tinta: '#000' } }).prompt, 'a cat, on a plain solid #000 background')

console.log(falliti ? `${falliti} FALLITI su ${fatti}` : `TUTTI OK (${fatti} controlli)`)
process.exit(falliti ? 1 : 0)
