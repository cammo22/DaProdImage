// Prova degli asset della GUI v2 (resources/gui): ogni tessera con anteprima punta a un file che esiste davvero, i nomi dei file
// combaciano con gli id di stili.ts / controlli.ts / preset.ts / ricetteV2.ts, i file sono WebP veri, stanno nel manifest
// e i url() del CSS arrivano a un file. Senza interfaccia né Electron:   node test/asset.mjs
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
import { resolve, join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'

globalThis.window = { daprod: {} }
globalThis.localStorage = { getItem: () => null, setItem() {} }
mkdirSync('test/.out', { recursive: true })
buildSync({
  stdin: {
    contents: "export * from './src/renderer/src/anteprime'; export * from './src/renderer/src/controlli'; export * from './src/renderer/src/stili'; export { CATEGORIE } from './src/renderer/src/rapide'; export { PRESET } from './src/renderer/src/preset'; export { elencoWorkflow } from './src/renderer/src/workflow'",
    resolveDir: process.cwd(), loader: 'ts'
  },
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', alias: { '@shared': resolve('src/shared') }, outfile: 'test/.out/asset.cjs'
})
const m = createRequire(import.meta.url)('./.out/asset.cjs')

const RADICE = 'resources/gui'
const file = (chiave) => join(RADICE, `${chiave}.webp`)
const usate = new Set()
/** la chiave deve esistere come file; la registra fra quelle usate */
const esiste = (chiave, dove) => {
  assert.ok(chiave, `${dove}: nessuna chiave asset`)
  assert.ok(existsSync(file(chiave)), `${dove}: manca ${file(chiave)}`)
  usate.add(chiave)
}

// ---- stili: 28, uno per file
assert.equal(m.STILI.length, 28)
for (const s of m.STILI) esiste(m.chiaveStile(s.id), `stile ${s.id}`)

// ---- generi: ogni tessera è un genere vero (preset) e c'è «Libero»
const idPreset = new Set(m.PRESET.map((p) => p.id))
assert.equal(m.GENERI_TESSERA.length, 11)
for (const g of m.GENERI_TESSERA) {
  assert.ok(idPreset.has(g), `genere ${g}: non c'è in preset.ts`)
  esiste(m.chiaveGenere(g), `genere ${g}`)
}
esiste(m.chiaveGenere(''), 'genere libero')

// ---- controlli di Modifica con le anteprime: ogni opzione ha il suo file
let opzioni = 0
for (const [id, gruppo] of Object.entries(m.GRUPPO_CONTROLLO)) {
  const c = m.CONTROLLI.find((x) => x.id === id)
  assert.ok(c, `controllo ${id}: non esiste in controlli.ts`)
  for (const parte of c.parti.filter((p) => p.tipo === 'griglia')) {
    for (const o of parte.opzioni) {
      const k = m.chiaveOpzione(id, o.id)
      assert.ok(k.startsWith(gruppo + '/'), `${id}/${o.id}: finisce nella cartella sbagliata (${k})`)
      esiste(k, `controllo ${id}/${o.id}`)
      opzioni++
    }
  }
}
assert.equal(opzioni, 5 + 9 + 10 + 6 + 4 + 6, 'animali + costumi + luoghi + meteo + stagioni + espressioni')
// i controlli senza anteprima non devono avere la chiave (restano con l'icona)
assert.equal(m.chiaveOpzione('capelli', 'corti'), undefined)
assert.equal(m.chiaveOpzione('barba', 'rasata'), undefined)

// ---- categorie di Modifica, Estrai/Espandi, modi
const idCategorie = new Set(m.CATEGORIE.map((c) => c.id))
for (const id of m.CATEGORIE_CON_ASSET) {
  assert.ok(idCategorie.has(id), `categoria ${id}: non esiste in rapide.ts`)
  esiste(m.chiaveCategoria(id), `categoria ${id}`)
}
assert.equal(m.chiaveCategoria('zona-base'), undefined, 'la categoria Zona resta con l\'icona')
for (const id of ['scrivi', 'espandi', 'estrai']) esiste(m.chiaveModoModifica(id), `modo modifica ${id}`)
for (const id of ['crea', 'modifica', 'box', 'ricette']) esiste(m.chiaveModo(id), `modo ${id}`)

// ---- ricette: le sei di ricetteV2 (l'elenco di workflow.ts, senza quelle dell'utente), più le due metà di Mix
const ricette = m.elencoWorkflow().filter((w) => !w.utente)
assert.deepEqual(ricette.map((w) => w.nome), ['Foglio', 'Mondi', 'Mix', 'Set', 'Formati', 'Rinnova'])
for (const w of ricette) esiste(m.chiaveRicetta(w.id), `ricetta ${w.id}`)
assert.equal(m.chiaveRicetta('unisci'), 'ricette/mix')
assert.equal(m.chiaveRicetta('esempio'), 'ricette/mix')
assert.equal(m.chiaveRicetta('mia-ricetta'), undefined, 'le ricette dell\'utente non hanno locandina')

// ---- LoRA: la copertina generica della famiglia, e niente se non si capisce
assert.equal(m.chiaveLora({ famiglie: ['qwen'] }), 'lora/qwen')
assert.equal(m.chiaveLora({ famiglie: ['klein4b'] }), 'lora/klein')
assert.equal(m.chiaveLora({ famiglie: ['klein', 'klein-base', 'klein4b'] }), 'lora/klein')
assert.equal(m.chiaveLora({ famiglie: ['qwen', 'klein'] }), undefined)
assert.equal(m.chiaveLora({ compatibile: 'si' }), 'lora/qwen')
assert.equal(m.chiaveLora({ compatibile: '?' }), undefined)
esiste('lora/qwen', 'lora qwen'); esiste('lora/klein', 'lora klein')

// ---- sfondi e mascotte
for (const k of [...Object.values(m.SFONDI), ...Object.values(m.MASCOTTE)]) esiste(k, `fisso ${k}`)

// ---- i file: WebP veri, nel manifest, nessuno rotto; e quali non servono a nessuna tessera (solo da dire)
const manifest = JSON.parse(readFileSync(join(RADICE, 'manifest.json'), 'utf8')).asset
const tutti = []
for (const g of readdirSync(RADICE)) {
  const d = join(RADICE, g)
  if (!statSync(d).isDirectory()) continue
  for (const f of readdirSync(d)) if (f.endsWith('.webp')) tutti.push(`${g}/${f.slice(0, -5)}`)
}
assert.equal(tutti.length, 111, 'i WebP in resources/gui')
for (const k of tutti) {
  const b = readFileSync(file(k))
  assert.ok(b.length > 200 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP', `${k}: non è un WebP valido`)
  assert.ok(manifest[k], `${k}: non è nel manifest`)
}
for (const k of usate) assert.ok(tutti.includes(k), `${k}: usato ma non trovato`)
const nonUsati = tutti.filter((k) => !usate.has(k) && !k.startsWith('sfondi/'))
console.log(`asset: ${tutti.length} file, ${usate.size} usati da tessere, sfondi e mascotte; senza tessera: ${nonUsati.length ? nonUsati.join(', ') : 'nessuno'}`)
assert.deepEqual(nonUsati, [], 'ogni asset deve servire a una tessera (o va tolto/documentato)')

// ---- i url() del CSS arrivano a un file vero
let url = 0
for (const css of ['src/renderer/src/orbita.css', 'src/renderer/src/stile.css']) {
  for (const [, p] of readFileSync(css, 'utf8').matchAll(/url\(['"]?(\.\.\/[^'")]+)['"]?\)/g)) {
    assert.ok(existsSync(resolve(css, '..', p)), `${css}: url(${p}) non porta a un file`)
    url++
  }
}
assert.ok(url >= 5, 'i url() degli sfondi nel CSS')

// ---- l'installer: gli asset passano da Vite (import ?url) e non da extraResources; il codice non punta a percorsi assoluti
const codice = readFileSync('src/renderer/src/asset.ts', 'utf8')
assert.ok(/import\.meta\.glob\('\.\.\/\.\.\/\.\.\/resources\/gui\/\*\*\/\*\.webp'/.test(codice), 'asset.ts importa resources/gui con Vite')
assert.ok(/query: '\?url'/.test(codice))
console.log(`asset OK — ${usate.size} chiavi, ${opzioni} opzioni dei controlli, ${url} url() nel CSS`)
