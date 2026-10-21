// Confronto dei grafi di Qwen prima (commit 708b74d) e dopo il refactor dei modelli (HEAD).
// Legge entrambe le versioni di src/main/motore/grafi.ts da git (senza fare checkout nel repo),
// costruisce i grafi per qwen-base con le tre qualita (bozza, alta, massima) in Crea, Modifica
// (zona) ed Espandi, e li confronta in JSON canonico.
//
// Esecuzione: node --experimental-strip-types test/confronta_grafi.mjs
import { join, dirname } from 'node:path'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const OLD_COMMIT = '708b74d'
const TEMP = join(tmpdir(), 'DaProdImage-grafi-confronto')
mkdirSync(TEMP, { recursive: true })

function normalizza(sorgente) {
  let s = sorgente
  s = s.replace(/^import type .*? from '@shared\/tipi'\r?\n/gm, '')
  s = s.replace(/^import \{ modelloTurbo \} from '@shared\/tipi'\r?\n/m, 'const modelloTurbo = (file) => /turbo/i.test(file)\n')
  s = s.replace(
    "constructor(readonly memoria: Memoria = 'normale') {}",
    "memoria: Memoria = 'normale'\n  constructor(memoria: Memoria = 'normale') { this.memoria = memoria }"
  )
  return s
}

function estrai(commit) {
  const sorgente = execFileSync('git', ['show', `${commit}:src/main/motore/grafi.ts`], {
    encoding: 'utf8',
    cwd: REPO,
  })
  const percorso = join(TEMP, commit + '.ts')
  writeFileSync(percorso, normalizza(sorgente))
  return percorso
}

const moduloVecchio = await import(pathToFileURL(estrai(OLD_COMMIT)).href)
const moduloNuovo = await import(pathToFileURL(estrai('HEAD')).href)

const PASSI_QUALITA = { bozza: 20, alta: 40, massima: 50 }

const imp = {
  cartellaModelli: 'C:/models',
  cartellaGalleria: 'C:/gallery',
  modello: 'qwen-image-2.1-UC-Q4_K_M.gguf',
  encoder: 'qwen3-vl-8b.safetensors',
  vae: 'ae.safetensors',
  upscaler: '4x-UltraSharp.safetensors',
  famiglia: 'qwen',
  kleinModello: '',
  kleinBase: '',
  kleinEncoder: '',
  kleinVae: '',
  scaricaInIdle: false,
  upscalerRtx: false,
  porta: 8818,
  cacheKV: 'gpu',
  cacheTipo: 'default',
  encoderSuCpu: false,
  anteprimaLive: true,
  riservaVram: 0,
  argomentiExtra: '',
  predefiniti: {},
  installato: true,
  tokenCivitai: '',
  tokenHF: '',
  tempi: {},
  loraTurbo: '',
  memoria: 'auto',
  vramMB: 8192,
  veloce: false,
  traduci: false,
  traduttore: 'dedicato',
  unaCosaAllaVolta: true,
  potenziaKlein: true,
  scaricaDopo: 0,
  modelloScelto: 'qwen-base',
}

function ingressi(scenario) {
  if (scenario === 'crea') return { immagini: [], maschera: undefined }
  return {
    immagini: [{ nome: 'foto.png', larghezza: 1024, altezza: 768 }],
    maschera: 'mask.png',
  }
}

function richiesta(scenario, passi) {
  const base = {
    famiglia: 'qwen',
    modoModifica: 'scrivi',
    prompt: 'a calm landscape with a road',
    negativo: '',
    seed: 12345,
    passi,
    cfg: 1,
    sampler: 'euler',
    scheduler: 'simple',
    uscita: undefined,
    contesto: 0.8,
    riempi: false,
    forza: 1,
    allarga: undefined,
    sfuma: undefined,
    bordi: undefined,
    megapixel: (1024 * 768) / 1048576,
    immagini: [],
    lora: [],
  }
  if (scenario === 'crea') {
    return {
      ...base,
      modalita: 'crea',
      larghezza: 1024,
      altezza: 768,
      trasparente: false,
    }
  }
  if (scenario === 'zona') {
    return {
      ...base,
      modalita: 'zona',
      megapixel: 1,
      contesto: 0.8,
      riquadro: { x: 100, y: 80, w: 200, h: 150 },
      trasparente: false,
    }
  }
  return {
    ...base,
    modalita: 'espandi',
    megapixel: 1,
    bordi: { sinistra: 64, sopra: 0, destra: 64, sotto: 0 },
  }
}

function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
  }
  return JSON.stringify(v)
}

const scenari = [
  { id: 'crea', nome: 'Crea' },
  { id: 'zona', nome: 'Modifica zona' },
  { id: 'espandi', nome: 'Espandi' },
]

let totale = 0
let ok = 0
const righe = []
const dettagli = []
for (const q of Object.keys(PASSI_QUALITA)) {
  for (const s of scenari) {
    totale++
    const passi = PASSI_QUALITA[q]
    const rv = richiesta(s.id, passi)
    const iv = ingressi(s.id)
    const vecchio = moduloVecchio.costruisci(rv, imp, iv, 'pref', 'normale', null)
    const nuovo = moduloNuovo.costruisci(rv, imp, iv, 'pref', 'normale', null)
    const uguale = canon(vecchio) === canon(nuovo)
    if (uguale) ok++
    righe.push('| ' + q + ' | ' + s.nome + ' | ' + (uguale ? 'identici' : 'DIVERSI') + ' | ' + vecchio.passi + ' |')
    if (!uguale) {
      dettagli.push('Differenza rilevata in ' + q + ' / ' + s.id)
      dettagli.push('VECCHIO: ' + canon(vecchio))
      dettagli.push('NUOVO:   ' + canon(nuovo))
    }
  }
}

const esito =
  '# Confronto grafi di Qwen - commit ' + OLD_COMMIT + ' vs HEAD\n\n' +
  'Generato da `test/confronta_grafi.mjs`. ' +
  'Casi verificati: ' + totale + ', identici: ' + ok + ', diversi: ' + (totale - ok) + '.\n\n' +
  '| Qualita | Scenario | Esito | Passi nel grafo |\n' +
  '|---|---|---|---:|\n' +
  righe.join('\n') +
  '\n\n' +
  (dettagli.length ? dettagli.join('\n\n') + '\n' : 'Tutti i grafi di Qwen sono identici tra ' + OLD_COMMIT + ' e HEAD.\n')

writeFileSync(join(REPO, 'docs', 'confronto-grafi-qwen-708b74d-vs-head.md'), esito)
console.log(esito)
process.exit(ok === totale ? 0 : 1)
EOF
