// Misure di velocità (e immagini) sul motore vero: costruisce i grafi come l'app (src/main/motore/grafi.ts), li manda a un ComfyUI che
// gira già (di solito uno a parte, sulla porta 8899, così la tua app non c'entra) e dice quanto ci mette ogni fase.
//
//   node test/bench-motore.mjs casi.json [--porta 8899] [--esci cartella]
//
// casi.json = [{ "nome": "qwen-25", "richiesta": { ...campi di Richiesta... }, "imp": { ...impostazioni da cambiare... }, "immagini": ["C:/foto.png"],
//                "sistemaDa": "PUP_I2I_BREVE" (il prompt di sistema da src/main/motore/pup.ts), "ripeti": 2 (il seed sale di uno a ogni giro), "ritocca": [{ "classe": "KSampler", "campo": "cfg", "valore": 1.5 } | { "classe": "KSampler", "campo": "model", "avvolgi": "FluxKVCache" }] }]
// Le impostazioni di base sono quelle vere dell'utente (%APPDATA%/DaProd Image/impostazioni.json) più quello che metti in "imp".
// Prima di ogni caso non si scarica niente: il primo giro include il caricamento dei pesi, quindi i casi si ripetono con "ripeti".
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, basename } from 'node:path'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { buildSync } from 'esbuild'

const QUI = dirname(fileURLToPath(import.meta.url))
const arg = (n, d) => {
  const i = process.argv.indexOf('--' + n)
  return i > 0 ? process.argv[i + 1] : d
}
const PORTA = Number(arg('porta', '8899'))
const ESCI = arg('esci', join(QUI, '.out', 'bench'))
const FILE = process.argv[2]
if (!FILE || FILE.startsWith('--')) {
  console.log('uso: node test/bench-motore.mjs casi.json [--porta 8899] [--esci cartella]')
  process.exit(1)
}
mkdirSync(ESCI, { recursive: true })

const fuori = join(mkdtempSync(join(tmpdir(), 'daprod-bench-')), 'grafi.mjs')
buildSync({
  entryPoints: [join(QUI, '..', 'src', 'main', 'motore', 'grafi.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: fuori,
  alias: { '@shared': join(QUI, '..', 'src', 'shared') },
  logLevel: 'error'
})
const G = await import(pathToFileURL(fuori).href)
// i prompt di sistema dell'upsampler: un caso può dire "sistemaDa": "PUP_I2I_BREVE" invece di ricopiarlo
const fuoriPup = join(mkdtempSync(join(tmpdir(), 'daprod-bench-')), 'pup.mjs')
buildSync({ entryPoints: [join(QUI, '..', 'src', 'main', 'motore', 'pup.ts')], bundle: true, format: 'esm', platform: 'node', outfile: fuoriPup, logLevel: 'error' })
const PUP = await import(pathToFileURL(fuoriPup).href)

const IMP_VERE = join(process.env.APPDATA || '', 'DaProd Image', 'impostazioni.json')
const impBase = existsSync(IMP_VERE) ? JSON.parse(readFileSync(IMP_VERE, 'utf8')) : {}
const base = {
  modalita: 'crea', prompt: '', negativo: '', seed: 12345, passi: 16, cfg: 1, sampler: 'euler', scheduler: 'simple', megapixel: 1,
  larghezza: 1024, altezza: 1024, immagini: [], lora: [], quante: 1, trasparente: false
}
const URL = `http://127.0.0.1:${PORTA}`
const s = (ms) => Math.round(ms / 100) / 10

async function carica(percorso) {
  const f = new FormData()
  f.append('image', new Blob([readFileSync(percorso)]), basename(percorso))
  f.append('overwrite', 'true')
  const r = await fetch(`${URL}/upload/image`, { method: 'POST', body: f })
  const j = await r.json()
  return j.name
}

function dimensioniPng(percorso) {
  const b = readFileSync(percorso)
  return { larghezza: b.readUInt32BE(16), altezza: b.readUInt32BE(20) }
}

async function esegui(caso, giro) {
  const imp = { ...impBase, ...(caso.imp || {}) }
  const q = { ...base, ...(caso.richiesta || {}) }
  q.seed += giro
  if (caso.sistemaDa) q.sistema = PUP[caso.sistemaDa]
  const ing = { immagini: [] }
  for (const p of caso.immagini || []) {
    const nome = await carica(p)
    ing.immagini.push({ nome, ...dimensioniPng(p) })
  }
  const g = G.costruisci(q, imp, ing, `bench_${caso.nome}`, imp.memoria === 'bassa' ? 'bassa' : 'normale')
  // ritocchi al grafo già costruito, per provare un valore senza toccare il codice: [{ "classe": "KSampler", "campo": "cfg", "valore": 1.5 }]
  for (const r of caso.ritocca || []) {
    for (const n of Object.values(g.prompt)) {
      if (n.class_type !== r.classe) continue
      // "avvolgi": mette un nodo nuovo fra quello che c'era e questo campo (es. FluxKVCache fra il modello e il KSampler)
      if (r.avvolgi) {
        const id = String(1000 + Object.keys(g.prompt).length)
        g.prompt[id] = { class_type: r.avvolgi, inputs: { [r.campo]: n.inputs[r.campo], ...(r.extra || {}) } }
        n.inputs[r.campo] = [id, 0]
      } else n.inputs[r.campo] = r.valore
    }
  }
  const idPrompt = crypto.randomUUID()
  const ws = new WebSocket(`ws://127.0.0.1:${PORTA}/ws?clientId=${idPrompt}`)
  ws.binaryType = 'arraybuffer'
  const fasi = {}
  let ultimo = null
  let t0 = 0
  let passoPrimo = 0
  let passoUltimo = 0
  let passi = 0
  let fatto
  const finito = new Promise((ok, ko) => (fatto = { ok, ko }))
  const nodo = (n) => g.fasi[n] || `nodo ${n} (${g.prompt[n]?.class_type})`
  const chiudiFase = (t) => {
    if (ultimo !== null) fasi[ultimo.f] = (fasi[ultimo.f] || 0) + (t - ultimo.t)
  }
  ws.onmessage = (e) => {
    if (typeof e.data !== 'string') return
    const m = JSON.parse(e.data)
    const t = performance.now()
    if (m.type === 'execution_start') t0 = t
    if (m.type === 'executing' && m.data.prompt_id === idPrompt) {
      chiudiFase(t)
      ultimo = m.data.node ? { f: nodo(m.data.node), t } : null
      if (!m.data.node) fatto.ok(t)
    }
    if (m.type === 'progress' && m.data.prompt_id === idPrompt && g.prompt[m.data.node]?.class_type === 'KSampler') {
      if (!passoPrimo) passoPrimo = t
      passoUltimo = t
      passi = m.data.max
    }
    if (m.type === 'execution_error') fatto.ko(new Error(m.data.exception_message || 'errore del motore'))
  }
  await new Promise((ok) => (ws.onopen = ok))
  const tInvio = performance.now()
  const r = await fetch(`${URL}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: g.prompt, client_id: idPrompt, prompt_id: idPrompt }) })
  if (!r.ok) throw new Error('il motore rifiuta il grafo: ' + (await r.text()).slice(0, 600))
  let tFine
  try {
    tFine = await finito
  } finally {
    ws.close()
  }
  const h = await (await fetch(`${URL}/history/${idPrompt}`)).json()
  const usc = h[idPrompt]?.outputs?.[g.uscita]
  let file = ''
  if (usc?.images?.[0]) {
    const im = usc.images[0]
    const bin = await fetch(`${URL}/view?filename=${encodeURIComponent(im.filename)}&subfolder=${encodeURIComponent(im.subfolder)}&type=${im.type}`)
    file = join(ESCI, `${caso.nome}${giro ? '_' + giro : ''}.png`)
    writeFileSync(file, Buffer.from(await bin.arrayBuffer()))
  }
  if (usc?.text) file = String(usc.text).slice(0, 4000)
  const campiona = passi > 1 ? s((passoUltimo - passoPrimo) / (passi - 1)) : null
  return { totale: s(tFine - tInvio), fasi: Object.fromEntries(Object.entries(fasi).map(([k, v]) => [k, s(v)])), passi, sPerPasso: campiona, file }
}

const casi = JSON.parse(readFileSync(FILE, 'utf8'))
const righe = []
for (const caso of casi) {
  for (let giro = 0; giro < (caso.ripeti || 1); giro++) {
    try {
      const r = await esegui(caso, giro)
      righe.push({ caso: caso.nome, giro, ...r })
      console.log(`${caso.nome}#${giro}: ${r.totale} s  | passi ${r.passi} a ${r.sPerPasso} s/passo | ${JSON.stringify(r.fasi)}${r.file ? '\n    → ' + r.file : ''}`)
    } catch (e) {
      console.log(`${caso.nome}#${giro}: ERRORE ${e.message}`)
      righe.push({ caso: caso.nome, giro, errore: String(e.message) })
    }
  }
}
writeFileSync(join(ESCI, 'ultimo.json'), JSON.stringify(righe, null, 2))
