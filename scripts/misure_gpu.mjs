#!/usr/bin/env node
// Misure GPU di DaProdImage (T12 del piano 1.1.0): tempi veri dei grafi che costruisce l'app (src/main/motore/grafi.ts),
// su un motore ComfyUI già avviato (non quello dell'app: una porta a parte, per non toccare il suo).
//
// Le prove sono SERIALI: una alla volta, con /free fra l'una e l'altra quando si misura «a freddo».
// Per ogni prova registra: tempo totale, tempo del KSampler (primo e ultimo passo), secondi per passo,
// picco di VRAM (nvidia-smi ogni secondo), e salva l'immagine in <out>.
//
// Uso:
//   node scripts/misure_gpu.mjs --porta 8819 --out cartella --prova klein-crea-8
//   node scripts/misure_gpu.mjs --porta 8819 --out cartella --prova elenco     (stampa i nomi delle prove)
//
// Il file grafi.ts si importa com'è (type stripping di Node >= 22.18), con le stesse due toppe di test/confronta_grafi.mjs.
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

const QUI = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(QUI, '..')
const args = process.argv.slice(2)
const opt = (n, d) => {
  const i = args.indexOf('--' + n)
  if (i < 0) return d
  const v = args[i + 1]
  return v && !v.startsWith('--') ? v : true
}
const PORTA = Number(opt('porta', 8819))
const BASE = `http://127.0.0.1:${PORTA}`
const OUT = resolve(String(opt('out', join(tmpdir(), 'misure-gpu'))))
const PROVA = String(opt('prova', 'elenco'))
const SEME = Number(opt('seed', 424242))
const ETICHETTA = String(opt('etichetta', ''))
mkdirSync(OUT, { recursive: true })

// ---- grafi.ts impacchettato con esbuild (importa regioni.ts e @shared: lo strip dei tipi di Node non basta) ----
async function caricaGrafi() {
  const { buildSync } = await import('esbuild')
  const fuori = join(tmpdir(), 'misure-gpu-grafi.mjs')
  buildSync({ entryPoints: [join(REPO, 'src', 'main', 'motore', 'grafi.ts')], bundle: true, format: 'esm', platform: 'node', outfile: fuori, alias: { '@shared': join(REPO, 'src', 'shared') }, logLevel: 'error' })
  return import(pathToFileURL(fuori).href + '?v=' + Date.now())
}
const { costruisci: costruisciGrezzo } = await caricaGrafi()
// FLUX.2 Klein 4B ha i suoi file: modello FP8 e Qwen3 4B di solo testo (il VAE è quello di FLUX.2, lo stesso di Klein 3)
const FILE_4B = { kleinModello: 'flux-2-klein-4b-fp8.safetensors', kleinEncoder: 'qwen_3_4b.safetensors' }
const costruisci = (q, i, ...resto) => costruisciGrezzo(q, q.famiglia === 'klein4b' ? { ...i, ...FILE_4B } : i, ...resto)
const { SISTEMA_MIGLIORA } = await (async () => {
  // la stringa di SISTEMA_MIGLIORA sta nel renderer (azioni.ts, ha import di React): la si legge dal sorgente
  const t = readFileSync(join(REPO, 'src', 'renderer', 'src', 'azioni.ts'), 'utf8')
  const m = /export const SISTEMA_MIGLIORA =\s*\n?\s*("(?:[^"\\]|\\.)*")/.exec(t)
  return { SISTEMA_MIGLIORA: JSON.parse(m[1]) }
})()

// ---- impostazioni: quelle vere dell'app, con i file di Klein al loro posto ----
const IMPOSTAZIONI_APP = join(process.env.APPDATA || '', 'DaProd Image', 'impostazioni.json')
const imp = JSON.parse(readFileSync(IMPOSTAZIONI_APP, 'utf8'))
Object.assign(imp, {
  kleinModello: 'flux3_image_klein_sd_int8_convrot.safetensors',
  kleinBase: 'flux3_image_klein_base_int8_convrot.safetensors',
  kleinEncoder: 'qwen3vl_4b_int8_convrot.safetensors',
  kleinVae: 'flux2-vae.safetensors'
})
const QWEN8_INT8 = 'qwen3vl_8b_int8_convrot.safetensors'
// ENCODER_QWEN=<file>: prova con un altro encoder di Qwen (di serie l'app usa l'8B int8 safetensors; qui si parte da quello nelle impostazioni)
if (process.env.ENCODER_QWEN) imp.encoder = process.env.ENCODER_QWEN

const PROMPT = 'a ceramic teapot with blue floral patterns on a rustic wooden table by a window, soft morning light, steam rising, shallow depth of field'
const PROMPT_ZONA = process.env.PROMPT_ZONA || 'make the teapot bright glossy red'
const PROMPT_ITA = 'una teiera di ceramica blu su un tavolo di legno vicino a una finestra, luce del mattino'

// ---- motore ----
const dorme = (ms) => new Promise((r) => setTimeout(r, ms))
async function http(path, opts) {
  const r = await fetch(BASE + path, { signal: AbortSignal.timeout(60_000), ...opts })
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${(await r.text()).slice(0, 300)}`)
  const t = await r.text()
  return t.trim() ? JSON.parse(t) : {}
}
function smi() {
  const r = spawnSync('nvidia-smi', ['--query-gpu=memory.used,utilization.gpu', '--format=csv,noheader,nounits'], { encoding: 'utf8', windowsHide: true })
  const p = (r.stdout || '').trim().split(',').map((x) => Number(x.trim()))
  return { vram: p[0], gpu: p[1] }
}
async function libera() {
  await http('/free', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ unload_models: true, free_memory: true }) })
  // come fa l'app: si aspetta che torch_vram_total scenda
  const t0 = Date.now()
  while (Date.now() - t0 < 60_000) {
    const s = await http('/system_stats')
    const d = s.devices[0]
    if (d.vram_total - d.vram_free < 600 * 1048576 || (d.torch_vram_total ?? 0) < 600 * 1048576) break
    await dorme(500)
  }
  await dorme(1500)
}

async function carica(file, nome) {
  const fd = new FormData()
  fd.append('image', new Blob([readFileSync(file)]), nome)
  fd.append('overwrite', 'true')
  await fetch(BASE + '/upload/image', { method: 'POST', body: fd })
  return nome
}

/** accoda un grafo e aspetta; ritorna i tempi e dove sta il risultato */
async function esegui(grafo, etichetta) {
  const clientId = 'misure-' + Math.random().toString(36).slice(2)
  const ws = new WebSocket(`ws://127.0.0.1:${PORTA}/ws?clientId=${clientId}`)
  await new Promise((ok) => {
    ws.addEventListener('open', ok)
    ws.addEventListener('error', ok)
  })
  const promptId = crypto.randomUUID()
  const prog = [] // [t, valore, max, nodo]
  const nodi = [] // [t, nodo]
  let testoOut = ''
  let fine = false
  let errore = ''
  ws.addEventListener('message', (ev) => {
    if (typeof ev.data !== 'string') return
    let m
    try { m = JSON.parse(ev.data) } catch { return }
    const d = m.data || {}
    if (d.prompt_id && d.prompt_id !== promptId) return
    const t = Date.now()
    if (m.type === 'progress') prog.push([t, d.value, d.max, d.node])
    else if (m.type === 'executing') nodi.push([t, d.node])
    else if (m.type === 'execution_error') { errore = d.exception_message || 'errore'; fine = true }
    else if (m.type === 'execution_success') fine = true
    else if (m.type === 'executing' && d.node === null) fine = true
  })
  const campioni = []
  let ferma = false
  const camp = (async () => {
    while (!ferma) {
      campioni.push({ t: Date.now(), ...smi() })
      await dorme(1000)
    }
  })()
  const t0 = Date.now()
  const r = await http('/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: grafo.prompt, client_id: clientId, prompt_id: promptId }) })
  if (r.node_errors && Object.keys(r.node_errors).length) throw new Error('node_errors ' + JSON.stringify(r.node_errors).slice(0, 600))
  let h = null
  while (Date.now() - t0 < 3_600_000) {
    await dorme(700)
    const hh = await http('/history/' + promptId).catch(() => ({}))
    if (hh[promptId]?.status?.completed || hh[promptId]?.status?.status_str === 'error' || errore) { h = hh[promptId]; break }
  }
  const t1 = Date.now()
  ferma = true
  await camp
  ws.close()
  if (errore || !h || h.status?.status_str === 'error') throw new Error('lavoro fallito: ' + (errore || JSON.stringify(h?.status?.messages?.slice(-2)).slice(0, 600)))
  const out = h.outputs?.[grafo.uscita] || {}
  if (out.text) testoOut = Array.isArray(out.text) ? out.text.join('') : String(out.text)
  // il KSampler (o TextGenerate): primo e ultimo messaggio di avanzamento
  const pk = prog.filter((p) => p[2] > 1)
  let sampler = null
  if (pk.length >= 2) {
    const a = pk[0]
    const b = pk[pk.length - 1]
    sampler = { passi: b[2], valore_ultimo: b[1], primo_ms: a[0] - t0, ultimo_ms: b[0] - t0, secondi: (b[0] - a[0]) / 1000, s_per_passo: (b[0] - a[0]) / 1000 / Math.max(1, b[1] - a[1]) }
  }
  const picco = Math.max(...campioni.map((c) => c.vram))
  const gpuMedia = campioni.filter((c) => c.t > t0 + 3000).reduce((s, c, _, v) => s + c.gpu / v.length, 0)
  const img = (out.images || [])[0]
  return {
    etichetta,
    totale_s: (t1 - t0) / 1000,
    sampler,
    picco_vram_mb: picco,
    gpu_media_pct: Math.round(gpuMedia),
    token: pk.length && grafo.prompt && Object.values(grafo.prompt).some((n) => n.class_type === 'TextGenerate') ? prog.length : undefined,
    testo: testoOut || undefined,
    immagine: img ? join(img.subfolder || '', img.filename) : undefined,
    nodi: nodi.length
  }
}

// ---- le prove ----
const FOTO = 'misure_foto.png'
const MASCHERA = 'misure_maschera.png'
const RIF2 = 'misure_rif2.png'

function reqBase(modalita, fam, passi, extra = {}) {
  return {
    modalita, famiglia: fam, prompt: PROMPT, negativo: '', seed: SEME, passi, cfg: fam === 'klein-base' ? 3.5 : 1, sampler: 'euler', scheduler: 'simple',
    larghezza: 1024, altezza: 1024, megapixel: 1, immagini: [], lora: [], quante: 1, trasparente: false, ...extra
  }
}
const MEM = 'normale'
const grafoCrea = (fam, passi) => costruisci(reqBase('crea', fam, passi), imp, { immagini: [] }, 'misura', MEM, null)
function grafoZona(fam, passi) {
  const riquadro = { x: 300, y: 380, w: 420, h: 380 }
  return costruisci(
    reqBase('zona', fam, passi, { prompt: PROMPT_ZONA, riquadro, contesto: 0.8, ritaglia: true, immagini: [FOTO] }),
    imp,
    { immagini: [{ nome: FOTO, larghezza: 1024, altezza: 1024 }], maschera: MASCHERA },
    'misura', MEM, null
  )
}
const grafoModifica = (fam, passi, conRif) =>
  costruisci(
    reqBase('modifica', fam, passi, { prompt: conRif ? 'replace the teapot with the object shown in the second image' : PROMPT_ZONA, immagini: conRif ? [FOTO, RIF2] : [FOTO] }),
    imp,
    { immagini: conRif ? [{ nome: FOTO, larghezza: 1024, altezza: 1024 }, { nome: RIF2, larghezza: 1024, altezza: 1024 }] : [{ nome: FOTO, larghezza: 1024, altezza: 1024 }] },
    'misura', MEM, null
  )
/** lo stesso grafo di Modifica con riferimenti, ma con un solo nodo ReferenceMultiLatent al posto della catena VAEEncode → ReferenceLatent */
function conMultiLatent(g) {
  const n = g.prompt
  const refs = Object.entries(n).filter(([, v]) => v.class_type === 'ReferenceLatent')
  if (!refs.length) throw new Error('nessun ReferenceLatent')
  // le immagini già pronte (prima dei VAEEncode), nell'ordine della catena
  const encs = Object.entries(n).filter(([, v]) => v.class_type === 'VAEEncode')
  const pronte = encs.map(([, v]) => v.inputs.pixels)
  const vae = encs[0][1].inputs.vae
  const primoRef = refs[0][1]
  const ultimoPos = refs.filter(([, v]) => true).map(([id]) => id)
  // positivo/negativo di partenza: i CLIPTextEncode
  const clipEnc = Object.entries(n).filter(([, v]) => v.class_type === 'CLIPTextEncode')
  const pos0 = [clipEnc[0][0], 0]
  const neg0 = [clipEnc[1][0], 0]
  const ks = Object.entries(n).find(([, v]) => v.class_type === 'KSampler')[1]
  for (const [id] of refs) delete n[id]
  for (const [id] of encs) delete n[id]
  const idMulti = String(900)
  const inputs = { positive: pos0, negative: neg0, vae, 'resolution': 'keep resolution' }
  pronte.forEach((p, i) => { inputs[`images.image${i + 1}`] = p })
  n[idMulti] = { class_type: 'ReferenceMultiLatent', inputs }
  ks.inputs.positive = [idMulti, 0]
  ks.inputs.negative = [idMulti, 1]
  return g
}

// 4B/8B per il testo
function grafoTesto(quale, maxToken = 380, prompt = PROMPT_ITA) {
  const q = reqBase('descrivi', quale === '4b' ? 'klein' : 'qwen', 1, {
    prompt, sistema: SISTEMA_MIGLIORA, maxToken, temperatura: 0.7, seed: 7, encoderKlein: quale === '4b'
  })
  const i2 = { ...imp }
  if (quale === '8b-int8') { i2.encoder = QWEN8_INT8 }
  return costruisci(q, i2, { immagini: [] }, 'misura', MEM, null)
}

const PROVE = {}
const prova = (nome, f) => { PROVE[nome] = f }
// Klein veloce: Crea 8 e 16 passi (a freddo il primo, poi caldo), zona 8 e 16
prova('klein-crea-8-freddo', async () => { await libera(); return esegui(grafoCrea('klein', 8), 'Klein 8 passi · Crea · a freddo') })
// la seconda foto (riferimento) per le prove con riferimenti: un oggetto diverso, fatto da Klein 8 passi
prova('rif-crea', async () => esegui(costruisci(reqBase('crea', 'klein', 8, { prompt: 'a vintage red bicycle leaning on a brick wall, golden hour' }), imp, { immagini: [] }, 'misura', MEM, null), 'riferimento (bicicletta)'))
prova('klein-crea-8', async () => esegui(grafoCrea('klein', 8), 'Klein 8 passi · Crea · caldo'))
prova('klein-crea-16', async () => esegui(grafoCrea('klein', 16), 'Klein 16 passi · Crea · caldo'))
prova('klein-zona-8', async () => esegui(grafoZona('klein', 8), 'Klein 8 passi · zona · caldo'))
prova('klein-zona-12', async () => esegui(grafoZona('klein', 12), 'Klein 12 passi · zona · caldo'))
prova('klein-zona-16', async () => esegui(grafoZona('klein', 16), 'Klein 16 passi · zona · caldo'))
prova('klein-zona-8-freddo', async () => { await libera(); return esegui(grafoZona('klein', 8), 'Klein 8 passi · zona · a freddo') })
prova('klein-mod-8', async () => esegui(grafoModifica('klein', 8, false), 'Klein 8 passi · Modifica tutta la foto'))
prova('klein-mod-16', async () => esegui(grafoModifica('klein', 16, false), 'Klein 16 passi · Modifica tutta la foto'))
// riferimenti: catena vs multi
prova('klein-rif-catena-8', async () => esegui(grafoModifica('klein', 8, true), 'Klein 8 passi · Modifica con riferimento · ReferenceLatent in catena'))
prova('klein-rif-multi-8', async () => esegui(conMultiLatent(grafoModifica('klein', 8, true)), 'Klein 8 passi · Modifica con riferimento · ReferenceMultiLatent'))
// FLUX.2 Klein 4B (distillato, 4 passi, Flux2Scheduler + CFGGuider)
prova('klein4b-crea-4-freddo', async () => { await libera(); return esegui(grafoCrea('klein4b', 4), 'Klein 4B 4 passi · Crea · a freddo') })
prova('klein4b-crea-4', async () => esegui(grafoCrea('klein4b', 4), 'Klein 4B 4 passi · Crea · caldo'))
prova('klein4b-crea-8', async () => esegui(grafoCrea('klein4b', 8), 'Klein 4B 8 passi · Crea · caldo'))
prova('klein4b-zona-4', async () => esegui(grafoZona('klein4b', 4), 'Klein 4B 4 passi · zona · caldo'))
prova('klein4b-mod-4', async () => esegui(grafoModifica('klein4b', 4, false), 'Klein 4B 4 passi · Modifica tutta la foto'))
// Klein Base
prova('base-crea-50-freddo', async () => { await libera(); return esegui(grafoCrea('klein-base', 50), 'Klein Base 50 passi · Crea · a freddo') })
prova('base-crea-50', async () => esegui(grafoCrea('klein-base', 50), 'Klein Base 50 passi · Crea · caldo'))
prova('base-crea-30', async () => esegui(grafoCrea('klein-base', 30), 'Klein Base 30 passi · Crea · caldo'))
prova('base-zona-50', async () => esegui(grafoZona('klein-base', 50), 'Klein Base 50 passi · zona · caldo'))
// Qwen
prova('qwen-crea-40-freddo', async () => { await libera(); return esegui(grafoCrea('qwen', 40), 'Qwen 40 passi · Crea · a freddo') })
prova('qwen-crea-40', async () => esegui(grafoCrea('qwen', 40), 'Qwen 40 passi · Crea · caldo'))
// testo
prova('testo-4b', async () => { await libera(); return esegui(grafoTesto('4b'), 'Migliora prompt · 4B · a freddo') })
prova('testo-8b', async () => { await libera(); return esegui(grafoTesto('8b'), 'Migliora prompt · encoder di Qwen (come nelle impostazioni) · a freddo') })
prova('testo-8b-int8', async () => { await libera(); return esegui(grafoTesto('8b-int8', 120), 'Migliora prompt · 8B int8 (120 token) · a freddo') })
prova('libera', async () => { await libera(); return { etichetta: 'libera' } })
// migliora + crea: come fa l'app (lavoro di testo, /free, lavoro di immagine). Si parte con un Crea caldo (il denoiser è già in VRAM).
async function migliora(con4B) {
  const prima = await esegui(grafoCrea('qwen', 4), 'riscaldamento Qwen (4 passi)') // il denoiser di Qwen e il suo encoder in VRAM, stato «immagine:qwen»
  const t0 = Date.now()
  await libera() // cambio di modello, come fattiSpazio
  const tl = (Date.now() - t0) / 1000
  const t = await esegui(grafoTesto(con4B ? '4b' : '8b'), 'testo ' + (con4B ? '4B' : '8B'))
  const t1 = Date.now()
  await libera()
  const tl2 = (Date.now() - t1) / 1000
  const g = costruisci(reqBase('crea', 'qwen', 40, { prompt: (t.testo || PROMPT).trim() }), imp, { immagini: [] }, 'misura', MEM, null)
  const c = await esegui(g, 'Crea Qwen 40 passi con il prompt migliorato')
  const totale = t.totale_s + tl2 + c.totale_s + tl
  return { etichetta: 'Migliora prompt + Crea · ' + (con4B ? 'con il 4B' : 'senza il 4B (encoder di Qwen)'), totale_s: totale, scarico_prima_s: tl, scarico_dopo_s: tl2, testo: t, crea: c, riscaldamento_s: prima.totale_s }
}
prova('migliora-crea-8b', () => migliora(false))
prova('migliora-crea-4b', () => migliora(true))

if (PROVA === 'elenco') {
  console.log(Object.keys(PROVE).join('\n'))
  process.exit(0)
}

// foto e maschera di prova (una volta)
async function preparaIngressi() {
  const foto = join(OUT, FOTO)
  const rif = join(OUT, RIF2)
  const maschera = join(OUT, MASCHERA)
  if (!existsSync(maschera)) {
    // maschera 1024x1024: rettangolo bianco nel riquadro della prova di zona
    const py = join(REPO, '..', '..').replace(/\\/g, '/')
    const r = spawnSync(
      process.env.PYTHON_ENGINE || 'C:/Users/cammo/AppData/Local/DaProdImage/engine/venv/Scripts/python.exe',
      ['-c', `from PIL import Image, ImageDraw\nm=Image.new('RGB',(1024,1024),(0,0,0))\nImageDraw.Draw(m).rectangle([300,380,720,760],fill=(255,255,255))\nm.save(r'${maschera.replace(/\\/g, '/')}')`],
      { encoding: 'utf8' }
    )
    if (r.status !== 0) throw new Error('maschera: ' + r.stderr)
  }
  await carica(maschera, MASCHERA)
  if (existsSync(foto)) await carica(foto, FOTO)
  if (existsSync(rif)) await carica(rif, RIF2)
}
await preparaIngressi()

const f = PROVE[PROVA]
if (!f) {
  console.error('prova sconosciuta: ' + PROVA)
  process.exit(2)
}
console.error(`# ${PROVA}`)
const t0 = Date.now()
let esito
try {
  esito = await f()
} catch (e) {
  esito = { errore: String(e.message || e) }
}
esito.prova = PROVA
esito.seed = SEME
esito.quando = new Date().toISOString()
if (ETICHETTA) esito.nota = ETICHETTA
// copia l'immagine in OUT (il motore salva nella sua cartella)
const copia = (r) => {
  if (r && r.immagine) {
    const sorg = join(process.env.MOTORE_OUT || OUT, r.immagine)
    if (existsSync(sorg)) {
      const dest = join(OUT, PROVA + '.png')
      if (sorg !== dest) copyFileSync(sorg, dest)
      r.file = dest
    }
  }
}
copia(esito)
copia(esito.crea)
appendFileSync(join(OUT, 'risultati.jsonl'), JSON.stringify(esito) + '\n')
console.log(JSON.stringify(esito, (k, v) => (k === 'testo' && typeof v === 'string' ? v.slice(0, 400) : v), 2))
process.exit(esito.errore ? 1 : 0)
