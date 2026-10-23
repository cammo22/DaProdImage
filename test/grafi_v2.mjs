// Test dei grafi dell'engine v2 (src/main/motore/grafi.ts): FLUX.2 Klein 4B, LoRA multipli con pesi, senza sfondo, estrai fedele (SAM 2), riquadri nel prompt.
// grafi.ts importa altri file senza estensione: si impacchetta con esbuild in una cartella temporanea.
//
// Esecuzione: node test/grafi_v2.mjs
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { buildSync } from 'esbuild'

const QUI = dirname(fileURLToPath(import.meta.url))
const fuori = join(mkdtempSync(join(tmpdir(), 'daprod-grafi-')), 'grafi.mjs')
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

const imp = {
  cartellaModelli: 'C:/models', cartellaGalleria: 'C:/gallery',
  modello: 'qwen-image-2.1-UC-Q4_K_M.gguf', encoder: 'qwen3-vl-8b.safetensors', vae: 'ae.safetensors', upscaler: '4x.safetensors',
  famiglia: 'qwen', kleinModello: 'klein4b_fp8.safetensors', kleinBase: '', kleinEncoder: 'qwen_3_4b.safetensors', kleinVae: 'flux2-vae.safetensors',
  upscalerRtx: false, cacheKV: 'gpu', cacheTipo: 'default', encoderSuCpu: false, loraTurbo: '', memoria: 'auto', vramMB: 8192, traduci: false, modelloScelto: 'qwen-base'
}
const base = {
  prompt: 'a red fox in a forest', negativo: '', seed: 7, passi: 4, cfg: 1, sampler: 'euler', scheduler: 'simple', megapixel: 1,
  larghezza: 1024, altezza: 768, immagini: [], lora: [], quante: 1, trasparente: false
}
const tipi = (g) => Object.values(g.prompt).map((n) => n.class_type)
const nodi = (g, tipo) => Object.values(g.prompt).filter((n) => n.class_type === tipo)
const costruisci = (q, i = imp, ing = { immagini: [] }) => G.costruisci({ ...base, ...q }, i, ing, 'prova')

// --- FLUX.2 Klein 4B: Crea ---
const k4 = costruisci({ modalita: 'crea', famiglia: 'klein4b' })
uguale('4B: text encoder di tipo flux2', nodi(k4, 'CLIPLoader')[0].inputs.type, 'flux2')
uguale('4B: scaletta Flux2Scheduler con la misura', [nodi(k4, 'Flux2Scheduler')[0].inputs.steps, nodi(k4, 'Flux2Scheduler')[0].inputs.width, nodi(k4, 'Flux2Scheduler')[0].inputs.height], [4, 1024, 768])
uguale('4B: CFGGuider a 1 + SamplerCustomAdvanced', [nodi(k4, 'CFGGuider')[0].inputs.cfg, nodi(k4, 'SamplerCustomAdvanced').length], [1, 1])
uguale('4B: latente vuota Flux2', nodi(k4, 'EmptyFlux2LatentImage').length, 1)
uguale('4B: non c\'è la cache KV di Qwen', tipi(k4).includes('QwenImage21Cache'), false)
const k3 = costruisci({ modalita: 'crea', famiglia: 'klein', passi: 8 })
uguale('Klein 3: text encoder flux3', nodi(k3, 'CLIPLoader')[0].inputs.type, 'flux3')

// --- LoRA multipli con pesi: nell'ordine, forza 0 saltata, tetto a ±2 ---
const lora = [{ file: 'a.safetensors', forza: 0.6 }, { file: 'b.safetensors', forza: 0 }, { file: 'c.safetensors', forza: 5 }, { file: 'd.safetensors', forza: -0.5 }]
for (const fam of ['qwen', 'klein', 'klein-base', 'klein4b']) {
  const g = costruisci({ modalita: 'crea', famiglia: fam, lora })
  uguale(`LoRA ${fam}: tre applicati (il 0 salta)`, nodi(g, 'LoraLoaderModelOnly').map((n) => [n.inputs.lora_name, n.inputs.strength_model]), [['a.safetensors', 0.6], ['c.safetensors', 2], ['d.safetensors', -0.5]])
}
// in catena: ognuno prende il modello del precedente
{
  const g = costruisci({ modalita: 'crea', famiglia: 'klein4b', lora })
  const ls = Object.entries(g.prompt).filter(([, n]) => n.class_type === 'LoraLoaderModelOnly')
  uguale('LoRA in catena', ls[1][1].inputs.model[0], ls[0][0])
}
uguale('senza LoRA niente nodi LoRA', nodi(costruisci({ modalita: 'crea', famiglia: 'klein' }), 'LoraLoaderModelOnly').length, 0)

// --- Senza sfondo ---
const ing1 = { immagini: [{ nome: 'foto.png', larghezza: 1000, altezza: 800 }] }
const sf = costruisci({ modalita: 'sfondo', immagini: ['x.png'] }, imp, ing1)
uguale('sfondo: LoadImage → DaProdSfondo → salva, nessun modello che disegna', tipi(sf).sort(), ['DaProdSfondo', 'LoadImage', 'SaveImage'].sort())
uguale('sfondo: BiRefNet, colori dei bordi puliti', [nodi(sf, 'DaProdSfondo')[0].inputs.modello, nodi(sf, 'DaProdSfondo')[0].inputs.pulisci_bordi], ['birefnet', true])
// Klein «senza sfondo» in Crea: BiRefNet dopo il VAE
const kt = costruisci({ modalita: 'crea', famiglia: 'klein', trasparente: true, passi: 8 })
uguale('Klein trasparente: DaProdSfondo dopo il VAE', [tipi(kt).includes('DaProdSfondo'), tipi(kt).includes('SplitImageWithAlpha')], [true, false])
const qt = costruisci({ modalita: 'crea', famiglia: 'qwen', trasparente: true, passi: 20 })
uguale('Qwen trasparente: usa l\'alfa del modello, niente BiRefNet', tipi(qt).includes('DaProdSfondo'), false)

// --- Estrai fedele (SAM 2) ---
const sg = costruisci({ modalita: 'segmenta', immagini: ['x.png'], segmenta: { box: [0.1, 0.2, 0.6, 0.9], punti: [{ x: 0.3, y: 0.4, positivo: true }] } }, imp, ing1)
uguale('segmenta: nodo SAM 2 con riquadro e punti', [nodi(sg, 'DaProdSegmenta').length, JSON.parse(nodi(sg, 'DaProdSegmenta')[0].inputs.box), JSON.parse(nodi(sg, 'DaProdSegmenta')[0].inputs.punti)], [1, [0.1, 0.2, 0.6, 0.9], [{ x: 0.3, y: 0.4, positivo: true }]])
uguale('segmenta: ritaglia di serie', nodi(sg, 'DaProdSegmenta')[0].inputs.ritaglia, true)
let errore = ''
try {
  costruisci({ modalita: 'segmenta', immagini: ['x.png'], segmenta: {} }, imp, ing1)
} catch (e) {
  errore = e.message
}
uguale('segmenta: senza riquadro né punti → errore in italiano', /riquadro|punti/.test(errore), true)

// --- Riquadri (regional prompting) ---
const regioni = [{ id: 'a', box: [0, 0, 0.5, 0.5], prompt: 'a red fox' }, { id: 'b', box: [0.5, 0.5, 1, 1], prompt: 'a blue door' }]
const testoDi = (g) => nodi(g, 'CLIPTextEncode').map((n) => n.inputs.text).concat(nodi(g, 'TextEncodeQwenImage21').map((n) => n.inputs.prompt))[0] || ''
const rk = costruisci({ modalita: 'crea', famiglia: 'klein', passi: 8, regioni })
uguale('Klein 3 + riquadri: JSON con le coordinate', /"bbox":\[0,0,500,500\]/.test(testoDi(rk)), true)
const rq = costruisci({ modalita: 'crea', famiglia: 'qwen', passi: 20, regioni })
uguale('Qwen + riquadri: a parole', /Compose the image with these elements/.test(testoDi(rq)) && !testoDi(rq).includes('bbox'), true)
const r4 = costruisci({ modalita: 'crea', famiglia: 'klein4b', regioni })
uguale('Klein 4B + riquadri: a parole', /Compose the image with these elements/.test(testoDi(r4)), true)
uguale('senza riquadri il prompt è quello', testoDi(costruisci({ modalita: 'crea', famiglia: 'klein', passi: 8 })), base.prompt)

console.log(falliti ? `${falliti} FALLITI su ${fatti}` : `TUTTI OK (${fatti} controlli)`)
process.exit(falliti ? 1 : 0)
