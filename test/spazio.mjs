// Test della regola "una cosa alla volta in VRAM" (src/main/motore/spazio.ts, usata da fattiSpazio in lavori.ts):
// la chiave è per famiglia (immagine:qwen / immagine:klein / immagine:klein-base) e per LLM (testo:4b / testo:8b).
//
// Esecuzione: node test/spazio.mjs
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const QUI = dirname(fileURLToPath(import.meta.url))
const S = await import(pathToFileURL(join(QUI, '..', 'src', 'main', 'motore', 'spazio.ts')).href)

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

// le chiavi
uguale('qwen', S.occupaImmagine('qwen'), 'immagine:qwen')
uguale('klein', S.occupaImmagine('klein'), 'immagine:klein')
uguale('klein-base', S.occupaImmagine('klein-base'), 'immagine:klein-base')
uguale('testo col 4B', S.occupaTesto(true), 'testo:4b')
uguale('testo con l\'8B', S.occupaTesto(false), 'testo:8b')
uguale('testo senza dire niente = 8B', S.occupaTesto(undefined), 'testo:8b')

// una sequenza di lavori come in coda: [chiave, si libera?]
function sequenza(nome, passi) {
  let ultimo = null
  const liberati = []
  for (const k of passi) {
    const { libera, ricorda } = S.cambioDiModello(ultimo, k)
    liberati.push(libera)
    ultimo = ricorda
  }
  return liberati
}

// il caso per cui c'è T4: da Qwen a Klein (prima restavano tutti e due "immagine" e non partiva /free)
uguale('qwen → klein libera', sequenza('', ['immagine:qwen', 'immagine:klein']), [false, true])
uguale('klein → klein-base libera (Rifai in qualità piena)', sequenza('', ['immagine:klein', 'immagine:klein-base']), [false, true])
uguale('stessa famiglia non libera', sequenza('', ['immagine:klein', 'immagine:klein', 'immagine:klein']), [false, false, false])
uguale('4B ↔ 8B libera', sequenza('', ['testo:4b', 'testo:8b', 'testo:4b']), [false, true, true])
uguale('disegno ↔ testo libera (come prima)', sequenza('', ['immagine:qwen', 'testo:8b', 'immagine:qwen']), [false, true, true])
uguale('il primo lavoro non libera mai', sequenza('', ['testo:4b']), [false])

// traduttore e ingranditore non contano e non cancellano il ricordo
uguale('cpu in mezzo: qwen, cpu, qwen', sequenza('', ['immagine:qwen', 'cpu', 'immagine:qwen']), [false, false, false])
uguale('cpu in mezzo: qwen, cpu, klein', sequenza('', ['immagine:qwen', 'cpu', 'immagine:klein']), [false, false, true])
uguale('ingranditore in mezzo: klein, leggero, klein', sequenza('', ['immagine:klein', 'leggero', 'immagine:klein']), [false, false, false])
uguale('ingranditore in mezzo: klein, leggero, testo:4b', sequenza('', ['immagine:klein', 'leggero', 'testo:4b']), [false, false, true])
uguale('cpu all\'inizio: non ricorda niente', S.cambioDiModello(null, 'cpu'), { libera: false, ricorda: null })

// chi scrive nei lavori di testo: scriveCol4B(modalita, famiglia, encoderKlein della richiesta, testoCon4B, il 4B c'è)
uguale('4B: Klein scrive col 4B', S.scriveCol4B('descrivi', 'klein', undefined, false, true), true)
uguale('4B: Klein Base scrive col 4B', S.scriveCol4B('descrivi', 'klein-base', undefined, false, true), true)
uguale('4B: Qwen con impostazione spenta = encoder 8B', S.scriveCol4B('descrivi', 'qwen', undefined, false, true), false)
uguale('4B: Qwen con impostazione accesa = 4B', S.scriveCol4B('descrivi', 'qwen', undefined, true, true), true)
uguale('4B: Qwen accesa ma il 4B manca = 8B', S.scriveCol4B('descrivi', 'qwen', undefined, true, false), false)
uguale('4B: Klein senza il 4B = encoder di prima', S.scriveCol4B('descrivi', 'klein', undefined, false, false), false)
uguale('4B: encoderKlein false esclude anche con Qwen accesa', S.scriveCol4B('descrivi', 'qwen', false, true, true), false)
uguale('4B: encoderKlein false esclude con Klein', S.scriveCol4B('descrivi', 'klein', false, false, true), false)
uguale('4B: un lavoro che disegna non scrive', S.scriveCol4B('crea', 'qwen', undefined, true, true), false)
// Qwen + 4B insieme: disegno Qwen, testo 4B, disegno Qwen = si libera due volte (non stanno in VRAM insieme su 8 GB)
uguale('qwen, testo:4b, qwen: libera ogni volta', sequenza('', ['immagine:qwen', 'testo:4b', 'immagine:qwen']), [false, true, true])
uguale('testo:4b, testo:4b, qwen', sequenza('', ['testo:4b', 'testo:4b', 'immagine:qwen']), [false, false, true])

// le fasi mostrate mentre si libera
uguale('fase da qwen', S.faseScarico('immagine:qwen'), 'Scarico Qwen-Image')
uguale('fase da klein', S.faseScarico('immagine:klein'), 'Scarico FLUX 3 Klein')
uguale('fase da klein-base', S.faseScarico('immagine:klein-base'), 'Scarico FLUX 3 Klein Base')
uguale('fase da testo', [S.faseScarico('testo:4b'), S.faseScarico('testo:8b')], ['Scarico l\'LLM', 'Scarico l\'LLM'])

console.log(`${fatti - falliti}/${fatti} ok`)
if (falliti) process.exit(1)
