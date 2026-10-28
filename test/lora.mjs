// Test del riconoscimento dei LoRA dai nomi dei tensori (src/shared/loraBase.ts).
//
// Esecuzione: node test/lora.mjs
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const QUI = dirname(fileURLToPath(import.meta.url))
const L = await import(pathToFileURL(join(QUI, '..', 'src', 'shared', 'loraBase.ts')).href)

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
const ris = (c, f) => {
  const a = L.analizzaChiavi(c, f)
  return [a.compatibile, a.base, a.famiglie]
}

uguale('vuoto', ris([]), ['?', undefined, []])
uguale('Qwen 2.1', ris(['transformer_blocks.3.attn.to_q.lora_A.weight', 'transformer_blocks.3.img_mlp.net.0.proj.lora_B.weight']), ['si', 'Qwen-Image 2.1', ['qwen']])
uguale('Qwen 1.x', ris(['transformer_blocks.0.txt_mlp.net.0.lora_A.weight']), ['no', 'Qwen-Image 1.x', []])
uguale('SDXL', ris(['lora_unet_down_blocks_0_attentions_0.lora_down.weight']), ['no', 'Stable Diffusion / SDXL', []])
uguale('Klein 3 (single_blocks qkv)', ris(['diffusion_model.single_blocks.2.qkv.lora_A.weight']), ['si', 'FLUX 3 Klein', ['klein', 'klein-base']])
uguale('Klein 3 Diffusers (mode_blocks)', ris(['transformer.mode_blocks.image.0.attn.to_q.lora_A.weight', 'transformer.mode_blocks.image.0.ff.linear_in.lora_B.weight']), ['si', 'FLUX 3 Klein (Diffusers)', ['klein', 'klein-base']])
uguale('Klein 3 Diffusers: formato', L.analizzaChiavi(['transformer.txt_mode_blocks.1.attn.to_out.0.lora_A.weight']).formato, 'diffusers')
uguale('Klein 3 AI Toolkit: formato', L.analizzaChiavi(['diffusion_model.single_blocks.2.q_proj.lora_A.weight', 'diffusion_model.content_mode_blocks.image.0.q_proj.lora_A.weight']).formato, undefined)
uguale('Klein 3 Diffusers solo blocchi singoli', ris(['transformer.single_transformer_blocks.3.attn.to_q.lora_A.weight', 'transformer.single_transformer_blocks.3.ff.linear_in.lora_B.weight']), ['si', 'FLUX 3 Klein (Diffusers)', ['klein', 'klein-base']])
uguale('FLUX.2 Diffusers (to_qkv_mlp_proj) non è Klein 3', ris(['transformer.single_transformer_blocks.3.attn.to_qkv_mlp_proj.lora_A.weight', 'transformer.transformer_blocks.0.ff.linear_in.lora_A.weight'])[0], '?')
uguale('Klein 3 (content_mode_blocks)', ris(['diffusion_model.content_mode_blocks.0.attn.lora_A.weight']), ['si', 'FLUX 3 Klein', ['klein', 'klein-base']])

const doppi = (n) => Array.from({ length: n }, (_, i) => `diffusion_model.double_blocks.${i}.img_attn.qkv.lora_A.weight`)
const flux2 = (n) => [...doppi(n), 'diffusion_model.double_blocks.0.img_mlp.0.lora_A.weight', 'diffusion_model.double_blocks.0.txt_mlp.0.lora_A.weight', 'diffusion_model.single_blocks.0.linear1.lora_A.weight']
// FLUX.2 Klein 4B/9B non sono più dell'app (1.2.1): i loro LoRA non vanno con nessun modello
uguale('FLUX.2 Klein 4B (5 blocchi doppi): non dell\'app', ris(flux2(5)), ['no', 'FLUX.2', []])
uguale('FLUX.2 grande (8 doppi)', ris(flux2(8)), ['no', 'FLUX.1 / FLUX.2 grande', []])
uguale('FLUX.2 9B (forma 4096)', ris(flux2(5), { 'diffusion_model.double_blocks.0.img_attn.qkv.lora_A.weight': [16, 4096] }), ['no', 'FLUX.2', []])
uguale('sconosciuto', ris(['foo.bar.weight']), ['?', undefined, []])

// vaBeneCon
uguale('Qwen con Qwen', L.vaBeneCon({ compatibile: 'si', famiglie: ['qwen'] }, 'qwen'), 'si')
uguale('Qwen con Klein', L.vaBeneCon({ compatibile: 'si', famiglie: ['qwen'] }, 'klein'), 'no')
uguale('Klein 3 vale per Base', L.vaBeneCon({ compatibile: 'si', famiglie: ['klein', 'klein-base'] }, 'klein-base'), 'si')
uguale('Klein 3 non per Qwen', L.vaBeneCon({ compatibile: 'si', famiglie: ['klein', 'klein-base'] }, 'qwen'), 'no')
uguale('vecchio LoRA senza famiglie (si) vale', L.vaBeneCon({ compatibile: 'si' }, 'qwen'), 'si')
uguale('vecchio LoRA senza famiglie (no)', L.vaBeneCon({ compatibile: 'no' }, 'qwen'), 'no')
uguale('non si capisce → si lascia provare', L.vaBeneCon({ compatibile: '?' }, 'klein'), '?')

// --- gli scaffali: Qwen e Flux (Klein veloce e Klein Base) ---
uguale('gruppoDiFamiglia', ['qwen', 'klein', 'klein-base'].map(L.gruppoDiFamiglia), ['qwen', 'flux', 'flux'])
uguale('gruppoDiFamiglia di niente = qwen', L.gruppoDiFamiglia(undefined), 'qwen')
uguale('scaffale: Qwen dai tensori', L.gruppoDa({ compatibile: 'si', famiglie: ['qwen'] }), 'qwen')
uguale('scaffale: Klein dai tensori', L.gruppoDa({ compatibile: 'si', famiglie: ['klein', 'klein-base'] }), 'flux')
uguale('scaffale: i tensori battono la scelta di chi carica', L.gruppoDa({ compatibile: 'si', famiglie: ['qwen'], gruppo: 'flux' }), 'qwen')
uguale('scaffale: non riconosciuto → quello scelto', L.gruppoDa({ compatibile: '?', famiglie: [], gruppo: 'flux' }), 'flux')
uguale('scaffale: non riconosciuto e non scelto → nessuno', L.gruppoDa({ compatibile: '?', famiglie: [] }), undefined)
uguale('scaffale: SDXL senza scelta → nessuno (sta in «Altri»)', L.gruppoDa({ compatibile: 'no', famiglie: [] }), undefined)
uguale('scaffale: SDXL che l\'utente assegna a Flux', L.gruppoDa({ compatibile: 'no', famiglie: [], gruppo: 'flux' }), 'flux')
uguale('scaffale: libreria vecchia, si senza famiglie → Qwen', L.gruppoDa({ compatibile: 'si' }), 'qwen')
uguale('Flux scelto a mano: vale per Klein veloce e Base, non per Qwen', ['klein', 'klein-base', 'qwen'].map((f) => L.vaBeneCon({ compatibile: '?', famiglie: [], gruppo: 'flux' }, f)), ['si', 'si', 'no'])
uguale('Qwen scelto a mano su un LoRA non riconosciuto', ['qwen', 'klein'].map((f) => L.vaBeneCon({ compatibile: 'no', famiglie: [], gruppo: 'qwen' }, f)), ['si', 'no'])
// il bug della 1.2.0: l'elenco non portava `famiglie` e ogni LoRA di Klein risultava «non compatibile» con Klein
uguale('LoRA di Klein con Klein veloce e con Klein Base: sì', ['klein', 'klein-base'].map((f) => L.vaBeneCon({ compatibile: 'si', famiglie: ['klein', 'klein-base'] }, f)), ['si', 'si'])

console.log(falliti ? `${falliti} FALLITI su ${fatti}` : `TUTTI OK (${fatti} controlli)`)
process.exit(falliti ? 1 : 0)
