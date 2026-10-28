// Test dei grafi dell'engine v2 (src/main/motore/grafi.ts): LoRA multipli con pesi, senza sfondo, estrai fedele (SAM 2), riquadri nel prompt.
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
  famiglia: 'qwen', kleinModello: 'flux3_klein_int8.safetensors', kleinBase: '', kleinEncoder: 'qwen3vl_4b_int8.safetensors', kleinVae: 'flux2-vae.safetensors',
  upscalerRtx: false, cacheKV: 'gpu', cacheTipo: 'default', encoderSuCpu: false, loraTurbo: '', memoria: 'auto', vramMB: 8192, traduci: false, modelloScelto: 'qwen-base'
}
const base = {
  prompt: 'a red fox in a forest', negativo: '', seed: 7, passi: 4, cfg: 1, sampler: 'euler', scheduler: 'simple', megapixel: 1,
  larghezza: 1024, altezza: 768, immagini: [], lora: [], quante: 1, trasparente: false
}
const tipi = (g) => Object.values(g.prompt).map((n) => n.class_type)
const nodi = (g, tipo) => Object.values(g.prompt).filter((n) => n.class_type === tipo)
const costruisci = (q, i = imp, ing = { immagini: [] }) => G.costruisci({ ...base, ...q }, i, ing, 'prova')

// --- FLUX 3 Klein: Crea ---
const k3 = costruisci({ modalita: 'crea', famiglia: 'klein', passi: 8 })
uguale('Klein 3: text encoder flux3', nodi(k3, 'CLIPLoader')[0].inputs.type, 'flux3')

// --- LoRA multipli con pesi: nell'ordine, forza 0 saltata, tetto a ±2 ---
const lora = [{ file: 'a.safetensors', forza: 0.6 }, { file: 'b.safetensors', forza: 0 }, { file: 'c.safetensors', forza: 5 }, { file: 'd.safetensors', forza: -0.5 }]
for (const fam of ['qwen', 'klein', 'klein-base']) {
  const g = costruisci({ modalita: 'crea', famiglia: fam, lora })
  uguale(`LoRA ${fam}: tre applicati (il 0 salta)`, nodi(g, 'LoraLoaderModelOnly').map((n) => [n.inputs.lora_name, n.inputs.strength_model]), [['a.safetensors', 0.6], ['c.safetensors', 2], ['d.safetensors', -0.5]])
}
// in catena: ognuno prende il modello del precedente
{
  const g = costruisci({ modalita: 'crea', famiglia: 'klein', lora })
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
uguale('senza riquadri il prompt è quello', testoDi(costruisci({ modalita: 'crea', famiglia: 'klein', passi: 8 })), base.prompt)

// --- 1.4: Qwen veloce (LoRA Lightning a 4 passi): la scaletta spostata (max_shift 0,9) in TUTTE le modalità, non solo in Crea ---
const impL = { ...imp, loraTurbo: 'qwen-image-2.1-lightning-4step.safetensors' }
const turbo = { turbo: true, passi: 4 }
const shift = (g) => nodi(g, 'ModelSamplingFlux').map((n) => [n.inputs.max_shift, n.inputs.base_shift])
const conLightning = (q, ing = ing1) => costruisci({ ...base, ...q, ...turbo }, impL, ing)
uguale('Lightning: il LoRA a forza 1', nodi(conLightning({ modalita: 'crea', famiglia: 'qwen' }), 'LoraLoaderModelOnly').map((n) => [n.inputs.lora_name, n.inputs.strength_model]), [['qwen-image-2.1-lightning-4step.safetensors', 1]])
uguale('Lightning Crea: shift 0,9', shift(conLightning({ modalita: 'crea', famiglia: 'qwen' })), [[0.9, 0.5]])
uguale('Lightning Modifica: shift 0,9', shift(conLightning({ modalita: 'modifica', famiglia: 'qwen', immagini: ['a.png'] })), [[0.9, 0.5]])
uguale('Lightning Varia: shift 0,9', shift(conLightning({ modalita: 'varia', famiglia: 'qwen', immagini: ['a.png'] })), [[0.9, 0.5]])
uguale('Lightning Zona: shift 0,9', shift(conLightning({ modalita: 'zona', famiglia: 'qwen', immagini: ['a.png'], maschera: 'm.png', riquadro: { x: 10, y: 10, w: 50, h: 50 } }, { ...ing1, maschera: 'm.png' })), [[0.9, 0.5]])
uguale('senza Turbo niente ModelSamplingFlux', shift(costruisci({ ...base, modalita: 'modifica', famiglia: 'qwen', immagini: ['a.png'] }, impL, ing1)), [])
uguale('Klein non prende il Lightning', [nodi(costruisci({ ...base, modalita: 'crea', famiglia: 'klein', ...turbo }, impL), 'ModelSamplingFlux').length, nodi(costruisci({ ...base, modalita: 'crea', famiglia: 'klein', ...turbo }, impL), 'LoraLoaderModelOnly').length], [0, 0])
uguale('la cache KV di Qwen col tipo scelto', nodi(costruisci({ ...base, modalita: 'crea', famiglia: 'qwen' }, { ...imp, cacheTipo: 'int4' }), 'QwenImage21Cache').map((n) => n.inputs.dtype), ['int4'])

// --- 1.4: negativo di Klein = positivo azzerato (come BFL); se lo scrivi tu, quello ---
const kz = costruisci({ ...base, modalita: 'crea', famiglia: 'klein' })
uguale('Klein: negativo = ConditioningZeroOut del positivo', [nodi(kz, 'ConditioningZeroOut').length, nodi(kz, 'CLIPTextEncode').length], [1, 1])
const kn = costruisci({ ...base, modalita: 'crea', famiglia: 'klein-base', negativo: 'blurry' })
uguale('Klein Base: negativo scritto da te', [nodi(kn, 'ConditioningZeroOut').length, nodi(kn, 'CLIPTextEncode').map((n) => n.inputs.text).sort()], [0, ['a red fox in a forest', 'blurry']])

// --- 1.4: l'LLM che scrive il prompt guarda TUTTE le foto (BatchImagesNode → TextGenerate) ---
const desc = (immagini) => costruisci({ ...base, modalita: 'descrivi', famiglia: 'klein', encoderKlein: true, prompt: 'x', sistema: 's', maxToken: 100, immagini: [] }, imp, { immagini })
const foto = (n, l = 1024, a = 1024) => ({ nome: n, larghezza: l, altezza: a })
const d1 = desc([foto('a.png')])
uguale('descrivi con una foto: LoadImage diretto, niente lotto', [nodi(d1, 'BatchImagesNode').length, nodi(d1, 'LoadImage').length], [0, 1])
const d3 = desc([foto('a.png', 1024, 1024), foto('b.png', 800, 1200), foto('c.png', 500, 500)])
uguale('descrivi con tre foto: un lotto di tre, alla forma della prima', [nodi(d3, 'BatchImagesNode').length, Object.keys(nodi(d3, 'BatchImagesNode')[0].inputs).sort(), nodi(d3, 'ImageScale').every((n) => n.inputs.width === nodi(d3, 'ImageScale')[0].inputs.width && n.inputs.height === nodi(d3, 'ImageScale')[0].inputs.height)], [1, ['images.image0', 'images.image1', 'images.image2'], true])
uguale('descrivi: il lotto va al TextGenerate', nodi(d3, 'TextGenerate')[0].inputs.image[0], Object.keys(d3.prompt).find((k) => d3.prompt[k].class_type === 'BatchImagesNode'))
uguale('descrivi senza foto: niente image', 'image' in nodi(desc([]), 'TextGenerate')[0].inputs, false)

console.log(falliti ? `${falliti} FALLITI su ${fatti}` : `TUTTI OK (${fatti} controlli)`)
process.exit(falliti ? 1 : 0)
