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
uguale('Klein 3 (content_mode_blocks)', ris(['diffusion_model.content_mode_blocks.0.attn.lora_A.weight']), ['si', 'FLUX 3 Klein', ['klein', 'klein-base']])

const doppi = (n) => Array.from({ length: n }, (_, i) => `diffusion_model.double_blocks.${i}.img_attn.qkv.lora_A.weight`)
const flux2 = (n) => [...doppi(n), 'diffusion_model.double_blocks.0.img_mlp.0.lora_A.weight', 'diffusion_model.double_blocks.0.txt_mlp.0.lora_A.weight', 'diffusion_model.single_blocks.0.linear1.lora_A.weight']
uguale('Klein 4B (5 blocchi doppi)', ris(flux2(5)), ['si', 'FLUX.2 Klein 4B', ['klein4b']])
uguale('Klein 4B con forma 3072', ris(flux2(5), { 'diffusion_model.double_blocks.0.img_attn.qkv.lora_A.weight': [16, 3072] }), ['si', 'FLUX.2 Klein 4B', ['klein4b']])
uguale('FLUX.2 grande (8 doppi)', ris(flux2(8)), ['no', 'FLUX.1 / FLUX.2 grande', []])
uguale('FLUX.2 9B (forma 4096)', ris(flux2(5), { 'diffusion_model.double_blocks.0.img_attn.qkv.lora_A.weight': [16, 4096] }), ['no', 'FLUX.2', []])
uguale('sconosciuto', ris(['foo.bar.weight']), ['?', undefined, []])

// vaBeneCon
uguale('Qwen con Qwen', L.vaBeneCon({ compatibile: 'si', famiglie: ['qwen'] }, 'qwen'), 'si')
uguale('Qwen con Klein', L.vaBeneCon({ compatibile: 'si', famiglie: ['qwen'] }, 'klein'), 'no')
uguale('Klein 3 vale per Base', L.vaBeneCon({ compatibile: 'si', famiglie: ['klein', 'klein-base'] }, 'klein-base'), 'si')
uguale('Klein 3 non per 4B', L.vaBeneCon({ compatibile: 'si', famiglie: ['klein', 'klein-base'] }, 'klein4b'), 'no')
uguale('vecchio LoRA senza famiglie (si) vale', L.vaBeneCon({ compatibile: 'si' }, 'qwen'), 'si')
uguale('vecchio LoRA senza famiglie (no)', L.vaBeneCon({ compatibile: 'no' }, 'qwen'), 'no')
uguale('non si capisce → si lascia provare', L.vaBeneCon({ compatibile: '?' }, 'klein'), '?')

console.log(falliti ? `${falliti} FALLITI su ${fatti}` : `TUTTI OK (${fatti} controlli)`)
process.exit(falliti ? 1 : 0)
