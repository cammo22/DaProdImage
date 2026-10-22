// Test del catalogo (src/main/installa/catalogo.ts + scegli.ts): niente Electron, niente rete (gli alberi dei repo sono in test/campioni-hf/).
//  - ogni voce con `repo` trova il suo file nell'albero vero (percorso esatto per Klein, FLUX.2 Klein 4B, BiRefNet, SAM2, LLM uncensored)
//  - le voci uncensored hanno il flag, l'avviso e la guardia di scaricamento funziona
//  - ogni voce ha licenza e ruolo; i modelli Qwen Research hanno l'avviso; nessuna voce uncensored è `consigliato` (non si scarica mai da sola)
//
// Esecuzione: node test/catalogo.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const QUI = dirname(fileURLToPath(import.meta.url))
const { CATALOGO, motivoDiBlocco, AVVISO_UNCENSORED } = await import(pathToFileURL(join(QUI, '..', 'src', 'main', 'installa', 'catalogo.ts')).href)
const { scegli, tronco, TIPI_SAFETENSORS } = await import(pathToFileURL(join(QUI, '..', 'src', 'main', 'installa', 'scegli.ts')).href)

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

const alberi = {}
for (const f of readdirSync(join(QUI, 'campioni-hf'))) {
  const j = JSON.parse(readFileSync(join(QUI, 'campioni-hf', f), 'utf8'))
  alberi[j.repo] = j
}
const trova = (v) => {
  const albero = alberi[v.repo]
  if (!albero) return `(manca l'albero di ${v.repo})`
  const pesi = TIPI_SAFETENSORS.has(v.tipo) ? /\.(safetensors|bin)$/i : /\.gguf$/i
  const f = scegli(albero.file, v.cerca, true, pesi)
  return f ? f.path : null
}
const voce = (id) => CATALOGO.find((v) => v.id === id)

// Klein 3: percorsi esatti dell'albero del 22/10/2026 (e non il ripiego largo)
uguale('klein-int8', trova(voce('klein-int8')), 'diffusion_models/flux3-image-klein-int8-convrot.safetensors')
uguale('klein-bf16', trova(voce('klein-bf16')), 'diffusion_models/flux3-image-klein-bf16.safetensors')
uguale('klein-base-int8', trova(voce('klein-base-int8')), 'diffusion_models/flux3-image-klein-base-int8-convrot.safetensors')
uguale('klein-base-bf16', trova(voce('klein-base-bf16')), 'diffusion_models/flux3-image-klein-base-bf16.safetensors')
uguale('klein-te (non il PUP)', trova(voce('klein-te')), 'text_encoders/qwen3vl_4b_int8_convrot.safetensors')
uguale('klein-vae', trova(voce('klein-vae')), 'vae/flux2-vae.safetensors')
// i ripieghi larghi, da soli, non devono mai prendere l'upsampler (qwen3.5 9b) né il Base per il veloce
for (const id of ['klein-int8', 'klein-bf16']) {
  const v = voce(id)
  const larga = scegli(alberi[v.repo].file, [v.cerca[v.cerca.length - 1]], true, /\.(safetensors|bin)$/i)
  uguale(`ripiego largo di ${id}: non Base, non upsampler`, !!larga && !/base|upsampl/i.test(larga.path), true)
}
for (const id of ['klein-base-int8', 'klein-base-bf16']) {
  const v = voce(id)
  const larga = scegli(alberi[v.repo].file, [v.cerca[v.cerca.length - 1]], true, /\.(safetensors|bin)$/i)
  uguale(`ripiego largo di ${id}: è Base`, !!larga && /base/i.test(larga.path), true)
}
// i nomi vecchi (flux3_image_klein_sd_int8_convrot) restano riconosciuti
{
  const v = voce('klein-int8')
  const vecchi = [{ type: 'file', path: 'flux3_image_klein_sd_int8_convrot.safetensors' }, { type: 'file', path: 'flux3_image_klein_base_int8_convrot.safetensors' }]
  uguale('nome vecchio klein-int8', scegli(vecchi, v.cerca, true, /\.safetensors$/i)?.path, 'flux3_image_klein_sd_int8_convrot.safetensors')
  uguale('nome vecchio klein-base-int8', scegli(vecchi, voce('klein-base-int8').cerca, true, /\.safetensors$/i)?.path, 'flux3_image_klein_base_int8_convrot.safetensors')
}

// nuove voci
uguale('FLUX.2 Klein 4B fp8', trova(voce('klein4b-fp8')), 'flux-2-klein-4b-fp8.safetensors')
uguale('FLUX.2 Klein 4B encoder', trova(voce('klein4b-te')), 'split_files/text_encoders/qwen_3_4b.safetensors')
uguale('BiRefNet', trova(voce('sfondo-birefnet')), 'model.safetensors')
uguale('SAM2 small', trova(voce('seg-sam2')), 'model.safetensors')
uguale('LLM uncensored 4B', trova(voce('llm-huihui-4b')), 'Huihui-Qwen3-VL-4B-Instruct-abliterated-int8_convrot.safetensors')
// i file accanto (config, tokenizer) ci sono nell'albero
for (const id of ['sfondo-birefnet', 'seg-sam2']) {
  const v = voce(id)
  const nomi = alberi[v.repo].file.map((f) => tronco(f.path))
  for (const re of v.accanto) uguale(`${id}: accanto ${re}`, nomi.some((n) => new RegExp(re, 'i').test(n)), true)
}
// i repo con revisione fissata: l'albero è stato salvato a quella revisione
for (const v of CATALOGO.filter((x) => x.repo && x.revisione)) uguale(`revisione di ${v.id}`, alberi[v.repo].revisione, v.revisione)
for (const id of ['klein-int8', 'klein-te', 'klein4b-fp8', 'klein4b-te', 'sfondo-birefnet', 'seg-sam2', 'llm-huihui-4b']) uguale(`${id} ha una revisione fissata`, /^[0-9a-f]{40}$/.test(voce(id).revisione || ''), true)

// uncensored: flag, avviso e guardia
const unc = CATALOGO.filter((v) => v.uncensored).map((v) => v.id).sort()
uguale('le voci uncensored', unc, ['llm-huihui-4b', 'lora-uc', 'te-ac-q4', 'te-ac-q6', 'te-ac-q8', 'te-mr-q4', 'te-mr-q6', 'te-mr-q8'])
for (const v of CATALOGO.filter((x) => x.uncensored)) {
  uguale(`${v.id}: avviso`, v.avviso, AVVISO_UNCENSORED)
  uguale(`${v.id}: non consigliato (mai scaricato da solo)`, !!v.consigliato, false)
  uguale(`${v.id}: guardia con interruttore spento`, /Modelli uncensored/.test(motivoDiBlocco(v, { uncensored: false, uncensoredAccettato: true }) || ''), true)
  uguale(`${v.id}: guardia senza accettazione`, /accetta/.test(motivoDiBlocco(v, { uncensored: true, uncensoredAccettato: false }) || ''), true)
  uguale(`${v.id}: via libera con tutto acceso`, motivoDiBlocco(v, { uncensored: true, uncensoredAccettato: true }), null)
}
// il predefinito di fabbrica è tutto spento
uguale('guardia con impostazioni vuote', !!motivoDiBlocco(voce('te-ac-q4'), {}), true)
// le voci normali non sono mai bloccate
for (const v of CATALOGO.filter((x) => !x.uncensored)) uguale(`${v.id}: mai bloccata`, motivoDiBlocco(v, { uncensored: false, uncensoredAccettato: false }), null)
// niente voce uncensored fra i denoiser di Klein (licenza Kommunity §4(d): niente scorciatoie per togliere le protezioni)
uguale('nessun denoiser Klein uncensored', CATALOGO.filter((v) => (v.tipo === 'klein' || v.tipo === 'diffusione') && v.uncensored).length, 0)

// licenza e ruolo su tutte le voci dei modelli (non sui LoRA di terzi senza dato)
for (const v of CATALOGO.filter((x) => ['diffusione', 'klein', 'klein-te', 'klein-vae', 'sfondo', 'segmentatore', 'llm'].includes(x.tipo))) {
  uguale(`${v.id}: licenza`, typeof v.licenza === 'string' && v.licenza.length > 0, true)
  uguale(`${v.id}: ruolo`, typeof v.ruolo === 'string', true)
}
for (const v of CATALOGO.filter((x) => x.licenza === 'Qwen Research' && x.ruolo === 'denoiser')) uguale(`${v.id}: avviso licenza Qwen`, /Qwen Research/.test(v.avviso || ''), true)
for (const v of CATALOGO.filter((x) => x.licenza === 'FLUX Kommunity')) uguale(`${v.id}: avviso Kommunity`, /Kommunity/.test(v.avviso || ''), true)
// id unici
uguale('id unici', new Set(CATALOGO.map((v) => v.id)).size, CATALOGO.length)

console.log(falliti ? `\n${falliti} su ${fatti} controlli falliti` : `ok: ${fatti} controlli`)
process.exit(falliti ? 1 : 0)
