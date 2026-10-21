#!/usr/bin/env node
// Benchmark del PROMPT UPSAMPLER di DaProdImage.
//
// Misura, sul motore ComfyUI gia' avviato (quello che avvia l'app), i tempi veri
// dell'upsampler: il nodo "TextGenerate" che scrive la didascalia. confrontando
// l'encoder di FLUX 3 Klein (Qwen3-VL 4B, type 'krea2', come in produzione) con quello di Qwen-Image
// (Qwen3-VL 8B, type 'qwen_image').
//
// Per ogni caso misura:
//   - i token al secondo (dai messaggi 'progress' del websocket: la stessa fonte
//     del tok/s che l'app mostra in Coda)
//   - il tempo di caricamento del text encoder e quello di generazione (separati)
//   - la VRAM (torch_vram_total) e la RAM del processo del motore
//   - il carico della GPU (nvidia-smi) e i core CPU usati dal processo
//   - quante parole ha scritto davvero (l'upsampler che risponde "#" non serve a nulla)
//
// I prompt di sistema sono presi direttamente da src/main/motore/pup.ts: le misure
// riguardano cio' il codice di produzione, non una copia.
//
// Uso:
//   node scripts/bench_upsampler.mjs
//   node scripts/bench_upsampler.mjs --porta 8818 --out report.json --etichetta prima-fix
//   node scripts/bench_upsampler.mjs --casi klein-4b-libera,qwen-8b
//   node scripts/bench_upsampler.mjs --ripeti 3
//
// Il file JSON e' pensato per essere confrontato fra un run prima e uno dopo il fix:
// i campioni hanno sempre gli stessi nomi.
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// i prompt di sistema della produzione (type stripping di Node >= 22.18)
const { PUP_T2I, PUP_I2I, PUP_T2I_BREVE, PUP_I2I_BREVE } = await import(
  pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'main', 'motore', 'pup.ts')).href
)

const args = process.argv.slice(2)
const opt = (nome, def) => {
  const i = args.indexOf('--' + nome)
  if (i < 0) return def
  const v = args[i + 1]
  return v && !v.startsWith('--') ? v : true
}
const PORTA = Number(opt('porta', 8818))
const BASE = `http://127.0.0.1:${PORTA}`
const ETICHETTA = String(opt('etichetta', 'run'))
const RIPETI = Number(opt('ripeti', 1))
const MAX_TOKEN = Number(opt('max-token', 300))
const SOLO = String(opt('casi', ''))
const SOLO_LISTA = SOLO ? SOLO.split(',').map((s) => s.trim()) : []
const TIMEOUT_CASO = Number(opt('timeout', 1200)) * 1000
const CARICA_MODELLO = opt('carica-modello', '') // file del modello di diffusione da tenere in VRAM
const LIBERA = opt('libera', true) !== false // /free prima di ogni caso

const KLEIN = 'qwen3vl_4b_int8_convrot.safetensors'
const QWEN = 'qwen3vl_8b_int8_convrot.safetensors'
const IMG = 'bench_test.png' // foto nel cartellone input del motore (per i casi i2i)

const T2I = 'TARGET CANVAS: 1:1\na cat sitting on a windowsill in the rain'
const I2I = 'Reference images follow in order (the first image, the second image, ...).\nUser request: Make the scene look like it was shot in the rain at night.\nOutput the caption.'

// i casi: encoder, tipo del loader, prompt di sistema, testo utente, con foto
const CASI = {
  'klein-4b-libera': { clip: KLEIN, tipo: 'krea2', sistema: PUP_T2I_BREVE, testo: T2I, foto: false },
  'klein-4b-lungo': { clip: KLEIN, tipo: 'krea2', sistema: PUP_T2I, testo: T2I, foto: false },
  'klein-4b-i2i': { clip: KLEIN, tipo: 'krea2', sistema: PUP_I2I_BREVE, testo: I2I, foto: true },
  'klein-4b-cpu': { clip: KLEIN, tipo: 'krea2', sistema: PUP_T2I_BREVE, testo: T2I, foto: false, device: 'cpu' },
  'qwen-8b-libera': { clip: QWEN, tipo: 'qwen_image', sistema: PUP_T2I, testo: T2I, foto: false },
  'qwen-8b-breve': { clip: QWEN, tipo: 'qwen_image', sistema: PUP_T2I_BREVE, testo: T2I, foto: false },
  'qwen-8b-i2i': { clip: QWEN, tipo: 'qwen_image', sistema: PUP_I2I, testo: I2I, foto: true }
}
const ordine = ['klein-4b-libera', 'klein-4b-lungo', 'klein-4b-i2i', 'qwen-8b-libera', 'qwen-8b-breve', 'qwen-8b-i2i', 'klein-4b-cpu']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function httpJson(path, opts) {
  const r = await fetch(BASE + path, { signal: AbortSignal.timeout(30_000), ...opts })
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${(await r.text()).slice(0, 200)}`)
  const testo = await r.text()
  if (!testo.trim()) return {} // /free risponde vuoto
  return JSON.parse(testo)
}

// --- il campionatore di sistema: GPU, RAM e CPU del processo del motore ---
function nvidiaSmi() {
  const r = spawnSync('nvidia-smi', ['--query-gpu=utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'], {
    encoding: 'utf8',
    windowsHide: true
  })
  if (r.status !== 0 || !r.stdout) return null
  const p = r.stdout.trim().split(',').map((x) => Number(x.trim()))
  return { gpuUtil: p[0], vramUsata: p[1], vramTotale: p[2] }
}

// il PID del processo python che gira main.py (il motore)
function pidMotore() {
  if (process.platform === 'win32') {
    const r = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { $_.CommandLine -like '*main.py*' } | Select-Object -First 1 -ExpandProperty ProcessId"
      ],
      { encoding: 'utf8', windowsHide: true }
    )
    const v = Number(String(r.stdout || '').trim())
    return v > 0 ? v : null
  }
  return null
}

// campiona i tempi CPU del processo del motore: in Windows con PowerShell, altrove con /proc
function avviaCpu(pid) {
  if (!pid) return null
  if (process.platform === 'win32') {
    const ps = `$ErrorActionPreference='SilentlyContinue'
$id=${pid}
while ($true) {
  $pr = Get-Process -Id $id -ErrorAction SilentlyContinue
  if (-not $pr) { break }
  "{0},{1},{2}" -f [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(), $pr.TotalProcessorTime.TotalSeconds, [math]::Round($pr.WorkingSet64/1MB)
  Start-Sleep -Milliseconds 400
}`
    const p = spawn('powershell', ['-NoProfile', '-Command', ps], { windowsHide: true })
    return p
  }
  return null
}

function leggiCpu(proc) {
  return new Promise((ok) => {
    if (!proc) return ok([])
    let buf = ''
    const righe = []
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (b) => {
      buf += b
      const rr = buf.split(/\r?\n/)
      buf = rr.pop() || ''
      for (const r of rr) if (r.trim()) righe.push(r.trim())
    })
    proc.on('close', () => ok(righe))
    proc.on('error', () => ok(righe))
  })
}

// --- il grafo del benchmark (uguale a quello che costruisce l'app) ---
function grafo(c) {
  const nodi = {
    '1': { class_type: 'CLIPLoader', inputs: { clip_name: c.clip, type: c.tipo, device: c.device || 'default' } },
    '2': {
      class_type: 'TextGenerate',
      inputs: {
        clip: ['1', 0],
        prompt: c.testo,
        max_length: c.maxToken,
        sampling_mode: 'on',
        'sampling_mode.temperature': 0.15,
        'sampling_mode.top_k': 20,
        'sampling_mode.top_p': 0.9,
        'sampling_mode.min_p': 0,
        'sampling_mode.repetition_penalty': 1.05,
        'sampling_mode.seed': 0,
        'sampling_mode.presence_penalty': 1.5,
        thinking: c.tipo === 'krea2', // come grafi.ts: col 4B (krea2) `false` aggiunge un <think></think> vuoto e risponde vuoto/«user»
        use_default_template: true,
        system_prompt: c.sistema
      }
    },
    '3': { class_type: 'PreviewAny', inputs: { source: ['2', 0] } }
  }
  if (c.foto) nodi['4'] = { class_type: 'LoadImage', inputs: { image: IMG } }
  if (c.foto) nodi['2'].inputs.image = ['4', 0]
  return nodi
}

// --- un caso: accoda, ascolta i progress, aspetta la fine ---
async function eseguiCaso(nome, c) {
  const clientId = 'bench-ollamo-' + Math.random().toString(36).slice(2)
  const ws = new WebSocket(`ws://127.0.0.1:${PORTA}/ws?clientId=${clientId}`)
  await new Promise((res) => {
    ws.addEventListener('open', res)
    ws.addEventListener('error', res)
  })
  const campioni = []
  const eventi = []
  let pid = null
  let esito = 'timeout'
  let errore = ''
  ws.addEventListener('message', (ev) => {
    if (typeof ev.data !== 'string') return
    let m
    try {
      m = JSON.parse(ev.data)
    } catch {
      return
    }
    const d = m.data || {}
    if (d.prompt_id && d.prompt_id !== pid) return
    if (m.type === 'progress' && d.node === '2') campioni.push({ n: d.value, max: d.max, t: Date.now() })
    else if (m.type === 'executing') eventi.push({ t: Date.now(), tipo: 'executing', nodo: d.node })
    else if (m.type === 'execution_error') {
      esito = 'errore'
      errore = `${d.node_type}: ${String(d.exception_message || '').slice(0, 300)}`
    } else if (m.type === 'execution_success') esito = 'ok'
    else if (m.type === 'execution_interrupted') esito = 'annullato'
  })

  const grafoDaMandare = grafo({ ...c, maxToken: c.maxToken || MAX_TOKEN })
  const accodato = await httpJson('/prompt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: grafoDaMandare, client_id: clientId })
  })
  pid = accodato.prompt_id

  // il campionatore di sistema gira durante il caso
  const pidMot = pidMotore()
  const procCpu = avviaCpu(pidMot)
  const t0 = Date.now()
  const campioniSys = []
  const timer = setInterval(async () => {
    try {
      const s = await httpJson('/system_stats')
      const d = (s.devices || []).find((x) => x.type === 'cuda') || (s.devices || [])[0]
      const g = nvidiaSmi()
      campioniSys.push({
        t: Date.now() - t0,
        torchVram: d?.torch_vram_total ?? null,
        vramLibera: d?.vram_free ?? null,
        gpuUtil: g?.gpuUtil ?? null,
        vramNvidia: g?.vramUsata ?? null
      })
    } catch {
      /* il motore potrebbe essere occupato: si prosegue */
    }
  }, 500)

  while (Date.now() - t0 < TIMEOUT_CASO && esito === 'timeout') await sleep(300)
  clearInterval(timer)
  const durata = Date.now() - t0
  if (procCpu) procCpu.kill()
  const righeCpu = await leggiCpu(procCpu)
  ws.close()

  // il testo prodotto
  let testo = ''
  try {
    const h = await httpJson('/history/' + pid)
    for (const out of Object.values(h[pid]?.outputs || {})) {
      if (out && Array.isArray(out.text)) testo += out.text.join('\n')
    }
  } catch {
    /* niente */
  }

  // il tok/s: finestra fra il 25% e il 75% dei token (la parte "a regime")
  const max = campioni.length ? campioni[campioni.length - 1].max : 0
  const finestra = campioni.filter((c2) => c2.n >= max * 0.25 && c2.n <= max * 0.75)
  const usata = finestra.length >= 3 ? finestra : campioni
  let tokSec = null
  if (usata.length >= 2) {
    const a = usata[0]
    const b = usata[usata.length - 1]
    const dt = (b.t - a.t) / 1000
    if (dt > 0 && b.n > a.n) tokSec = (b.n - a.n) / dt
  }
  // il tempo di caricamento: il primo messaggio 'progress' arriva quando il modello e' gia' in memoria
  const primo = campioni.length ? campioni[0].t : null
  const caricamento = primo ? primo - t0 : null
  const cpu = calcolaCpu(righeCpu)
  const parole = testo.trim() ? testo.trim().split(/\s+/).length : 0

  return {
    caso: nome,
    esito,
    errore,
    encoder: c.clip,
    tipo: c.tipo,
    device: c.device || 'default',
    promptSistema: c.sistema === PUP_T2I_BREVE ? 'breve' : c.sistema === PUP_T2I ? 'lungo' : c.sistema === PUP_I2I_BREVE ? 'breve-i2i' : 'lungo-i2i',
    conFoto: !!c.foto,
    maxToken: c.maxToken || MAX_TOKEN,
    durataTotaleS: ar(1, durata / 1000),
    caricamentoModelloS: caricamento === null ? null : ar(1, caricamento / 1000),
    generazioneS: primo === null ? null : ar(1, (durata - caricamento) / 1000),
    tokenGenerati: max,
    tokenCampioni: campioni.length,
    tokAlSecondo: tokSec === null ? null : ar(2, tokSec),
    secondiPerToken: tokSec ? ar(3, 1 / tokSec) : null,
    paroleScritte: parole,
    testo: testo.trim().slice(0, 400),
    torchVramMaxMB: maxVram(campioniSys),
    gpuUtilMedio: media(campioniSys.map((x) => x.gpuUtil)),
    gpuUtilMax: maxVram2(campioniSys.map((x) => x.gpuUtil)),
    cpuCoreMedio: cpu ? ar(2, cpu.coreMedio) : null,
    ramProcessoMB: cpu ? ar(0, cpu.ramMB) : null
  }
}

function ar(n, v) {
  if (v === null || v === undefined || Number.isNaN(v)) return null
  const p = Math.pow(10, n)
  return Math.round(v * p) / p
}
function media(a) {
  const b = a.filter((x) => typeof x === 'number' && !Number.isNaN(x))
  if (!b.length) return null
  return b.reduce((x, y) => x + y, 0) / b.length
}
function maxVram(c) {
  const b = c.map((x) => x.torchVram).filter((x) => typeof x === 'number')
  return b.length ? ar(0, Math.max(...b) / 1048576) : null
}
function maxVram2(a) {
  const b = a.filter((x) => typeof x === 'number' && !Number.isNaN(x))
  return b.length ? ar(0, Math.max(...b)) : null
}
function calcolaCpu(righe) {
  if (!righe || righe.length < 2) return null
  const p = righe
    .map((r) => r.split(','))
    .map((a) => ({ t: Number(a[0]), cpu: Number(a[1]), ram: Number(a[2]) }))
    .filter((x) => Number.isFinite(x.t) && Number.isFinite(x.cpu))
  if (p.length < 2) return null
  const dt = (p[p.length - 1].t - p[0].t) / 1000
  const dc = p[p.length - 1].cpu - p[0].cpu
  return { coreMedio: dt > 0 ? dc / dt : null, ramMB: p[p.length - 1].ram }
}

// --- il modello di diffusione da tenere in VRAM (per misurare l'effetto "GPU occupata") ---
async function caricaModello(file) {
  const g = {
    '1': { class_type: 'UNETLoader', inputs: { unet_name: file, weight_dtype: 'default' } },
    '2': { class_type: 'EmptyLatentImage', inputs: { width: 256, height: 256, batch_size: 1 } },
    '3': { class_type: 'KSampler', inputs: { model: ['1', 0], seed: 0, steps: 1, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise: 1, latent_image: ['2', 0] } },
    '4': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['5', 0] } },
    '5': { class_type: 'VAELoader', inputs: { vae_name: 'flux2-vae.safetensors' } },
    '6': { class_type: 'SaveImage', inputs: { filename_prefix: 'bench_carica', images: ['4', 0] } }
  }
  await httpJson('/prompt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: g, client_id: 'bench-ollamo-carica' })
  })
  console.log(`  (modello di diffusione caricato: ${file})`)
}

async function liberaMemoria() {
  await httpJson('/free', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ unload_models: true, free_memory: true })
  })
}

// --- main ---
console.log('='.repeat(78))
console.log(`BENCHMARK PROMPT UPSAMPLER DaProdImage — etichetta: ${ETICHETTA}`)
console.log('='.repeat(78))
try {
  const s = await httpJson('/system_stats')
  const d = (s.devices || [])[0]
  console.log(`  motore: ComfyUI ${s.system?.comfyui_version} | ${(d?.name || '').replace(/^cuda:\d+\s*/, '')} | VRAM ${ar(0, (d?.vram_total || 0) / 1048576)} MB`)
} catch (e) {
  console.error(`  il motore non risponde sulla porta ${PORTA}: ${e.message}`)
  console.error('  avvialo con l-app (Opzioni -> Riavvia il motore) e rilancia')
  process.exit(2)
}
console.log(`  casi: ${ordine.filter((n) => !SOLO_LISTA.length || SOLO_LISTA.includes(n)).join(', ')} | ripeti: ${RIPETI} | max token: ${MAX_TOKEN}\n`)

if (CARICA_MODELLO) await caricaModello(String(CARICA_MODELLO))

const risultati = []
for (let giro = 1; giro <= RIPETI; giro++) {
  for (const nome of ordine) {
    if (SOLO_LISTA.length && !SOLO_LISTA.includes(nome)) continue
    const c = CASI[nome]
    if (LIBERA) await liberaMemoria()
    await sleep(500)
    process.stdout.write(`  [giro ${giro}] ${nome.padEnd(18)} `)
    const r = await eseguiCaso(nome, c)
    risultati.push(r)
    if (r.esito !== 'ok') {
      console.log(`ERRORE (${r.esito}) ${r.errore || ''}`)
      continue
    }
    console.log(
      `${String(r.tokAlSecondo ?? 'N/D').padStart(6)} tok/s | ${r.tokenGenerati} tok | ` +
        `caric. ${r.caricamentoModelloS}s | gen ${r.generazioneS}s | ${r.paroleScritte} parole | ` +
        `VRAM ${r.torchVramMaxMB} MB | GPU ${r.gpuUtilMedio}% | CPU ${r.cpuCoreMedio} core`
    )
  }
}

// confronto
const klein = risultati.filter((r) => r.caso.startsWith('klein') && r.tokAlSecondo)
const qwen = risultati.filter((r) => r.caso.startsWith('qwen') && r.tokAlSecondo)
const confronto = {}
if (klein.length && qwen.length) {
  const km = Math.max(...klein.map((r) => r.tokAlSecondo))
  const qm = Math.max(...qwen.map((r) => r.tokAlSecondo))
  confronto.kleinMiglioreTokSec = km
  confronto.qwenMiglioreTokSec = qm
  confronto.rapporto = ar(1, km / qm)
}

const report = {
  etichetta: ETICHETTA,
  quando: new Date().toISOString(),
  porta: PORTA,
  gpu: (() => {
    const g = nvidiaSmi()
    return g ? { gpuUtil: g.gpuUtil, vramUsataMB: g.vramUsata, vramTotaleMB: g.vramTotale } : null
  })(),
  modelloTenutoInVram: CARICA_MODELLO || null,
  casi: risultati,
  confronto
}

const out = String(opt('out', ''))
if (out) {
  mkdirSync(dirname(resolve(out)), { recursive: true })
  writeFileSync(resolve(out), JSON.stringify(report, null, 2), 'utf8')
  console.log(`\n  report scritto in ${resolve(out)}`)
} else {
  console.log('\n' + JSON.stringify(report, null, 2))
}
if (confronto.rapporto) console.log(`\n  Klein 4B ${confronto.kleinMiglioreTokSec} tok/s vs Qwen 8B ${confronto.qwenMiglioreTokSec} tok/s -> ${confronto.rapporto}x`)
