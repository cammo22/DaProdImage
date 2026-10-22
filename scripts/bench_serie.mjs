#!/usr/bin/env node
// Benchmark riproducibile di DaProdImage: ripete le prove di scripts/misure_gpu.mjs con semi diversi (così ComfyUI non risponde dalla cache),
// scarta un giro di riscaldamento per le prove «a caldo», e riassume con mediana e peggiore. Una sola variabile per volta: si lancia con lo stesso
// motore (porta 8819, avviato a parte) prima e dopo ogni modifica e si confrontano i due file.
//
// Uso:
//   node scripts/bench_serie.mjs --repo <cartella del repo> --out <cartella> --etichetta base [--rip 3] [--seed0 1000] [--porta 8819] prova1 prova2 …
//   node scripts/bench_serie.mjs --prova elenco          (stampa i nomi delle prove di misure_gpu.mjs)
//
// Le prove che finiscono in «-freddo» (e «libera», i testi «testo-…», «migliora-crea-…») girano una volta sola, senza riscaldamento.
// Prima di ogni giro si aspetta che la GPU sia ferma (< 15 %): se un altro programma la usa, il giro lo dice (`gpu_occupata`) e non finisce nella mediana.
// Scrive <out>/serie-<etichetta>.json e stampa una tabella in Markdown.
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const QUI = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opt = (n, d) => {
  const i = args.indexOf('--' + n)
  if (i < 0) return d
  const v = args[i + 1]
  return v && !v.startsWith('--') ? v : true
}
const REPO = resolve(String(opt('repo', join(QUI, '..'))))
const OUT = resolve(String(opt('out', join(QUI, '..', 'bench-out'))))
const ETICHETTA = String(opt('etichetta', 'prova'))
const RIP = Number(opt('rip', 3))
const SEED0 = Number(opt('seed0', 1000))
const PORTA = String(opt('porta', 8819))
const flag = new Set(['repo', 'out', 'etichetta', 'rip', 'seed0', 'porta', 'prova'])
const prove = []
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    if (flag.has(args[i].slice(2))) i++
    continue
  }
  prove.push(args[i])
}
if (opt('prova', '') === 'elenco') {
  const r = spawnSync('node', [join(REPO, 'scripts', 'misure_gpu.mjs'), '--prova', 'elenco', '--porta', PORTA, '--out', OUT], { encoding: 'utf8' })
  console.log(r.stdout)
  process.exit(0)
}
if (!prove.length) {
  console.error('nessuna prova: vedi --prova elenco')
  process.exit(2)
}
mkdirSync(OUT, { recursive: true })

const dorme = (ms) => new Promise((r) => setTimeout(r, ms))
function smi() {
  const r = spawnSync('nvidia-smi', ['--query-gpu=memory.used,utilization.gpu,clocks.sm,temperature.gpu', '--format=csv,noheader,nounits'], { encoding: 'utf8', windowsHide: true })
  const p = (r.stdout || '').trim().split(',').map((x) => Number(x.trim()))
  return { vram_mb: p[0], gpu_pct: p[1], clock_mhz: p[2], temp_c: p[3] }
}
async function aspettaGpuFerma() {
  for (let i = 0; i < 30; i++) {
    if (smi().gpu_pct < 15) return true
    await dorme(2000)
  }
  return false
}
function mediana(v) {
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const arr = (x, d = 2) => (x === undefined || x === null || Number.isNaN(x) ? null : Math.round(x * 10 ** d) / 10 ** d)

function giro(prova, seed) {
  const r = spawnSync('node', [join(REPO, 'scripts', 'misure_gpu.mjs'), '--porta', PORTA, '--out', OUT, '--prova', prova, '--seed', String(seed)], {
    encoding: 'utf8', env: { ...process.env, MOTORE_OUT: process.env.MOTORE_OUT || '' }, maxBuffer: 64 * 1024 * 1024
  })
  let j = null
  try {
    j = JSON.parse(r.stdout)
  } catch {
    /* niente */
  }
  return j || { errore: (r.stderr || r.stdout || 'nessun output').slice(0, 300) }
}

const risultati = []
const SOLO_UNA = /-freddo$|^libera$|^testo-|^migliora-crea-/
for (const prova of prove) {
  const giri = []
  const una = SOLO_UNA.test(prova)
  if (!una) {
    await aspettaGpuFerma()
    giro(prova, SEED0 - 1) // riscaldamento: carica i modelli, non conta
  }
  const n = una ? 1 : RIP
  for (let i = 0; i < n; i++) {
    const libera = await aspettaGpuFerma()
    const prima = smi()
    const r = giro(prova, SEED0 + i)
    const rr = r.crea || r // migliora-crea: il giro finale
    giri.push({
      seed: SEED0 + i,
      totale_s: arr(r.totale_s, 1),
      campionatore_s: arr(r.sampler?.secondi, 2),
      s_per_passo: arr(r.sampler?.s_per_passo, 3),
      passi: r.sampler?.passi,
      picco_vram_mb: r.picco_vram_mb,
      gpu_media_pct: r.gpu_media_pct,
      gpu_occupata: !libera,
      prima,
      errore: r.errore
    })
    void rr
  }
  const buoni = giri.filter((g) => !g.errore && !g.gpu_occupata && g.totale_s !== null)
  const ris = {
    prova,
    giri,
    mediana: buoni.length ? { totale_s: arr(mediana(buoni.map((g) => g.totale_s)), 1), s_per_passo: arr(mediana(buoni.filter((g) => g.s_per_passo !== null).map((g) => g.s_per_passo)), 3), picco_vram_mb: Math.max(...buoni.map((g) => g.picco_vram_mb || 0)) } : null,
    peggiore_s: buoni.length ? Math.max(...buoni.map((g) => g.totale_s)) : null,
    giri_validi: buoni.length,
    giri_scartati: giri.length - buoni.length
  }
  risultati.push(ris)
  console.error(`# ${prova}: ${buoni.length}/${giri.length} giri validi, mediana ${ris.mediana?.totale_s ?? '-'} s`)
}

const macchina = { gpu: spawnSync('nvidia-smi', ['--query-gpu=name,memory.total,driver_version', '--format=csv,noheader'], { encoding: 'utf8' }).stdout.trim(), quando: new Date().toISOString(), repo: REPO, rip: RIP, seed0: SEED0 }
const gitHead = spawnSync('git', ['-C', REPO, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
macchina.commit = gitHead
writeFileSync(join(OUT, `serie-${ETICHETTA}.json`), JSON.stringify({ etichetta: ETICHETTA, macchina, risultati }, null, 2))

console.log(`\n### ${ETICHETTA} (${gitHead}, ${macchina.gpu}, ${RIP} giri a caldo, mediana)\n`)
console.log('| Prova | Totale | s/passo | Passi | VRAM picco | Peggiore | Giri validi |')
console.log('|---|---:|---:|---:|---:|---:|---:|')
for (const r of risultati) {
  const g = r.giri.find((x) => x.passi) || {}
  console.log(`| ${r.prova} | ${r.mediana?.totale_s ?? '-'} s | ${r.mediana?.s_per_passo ?? '-'} | ${g.passi ?? '-'} | ${r.mediana ? (r.mediana.picco_vram_mb / 1024).toFixed(1) + ' GB' : '-'} | ${r.peggiore_s ?? '-'} s | ${r.giri_validi}/${r.giri.length} |`)
}
