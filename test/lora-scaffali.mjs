// I LoRA nei due scaffali (src/main/lora.ts): niente Electron né motore. Si compila lora.ts con un finto `electron` e si prova su una cartella vuota:
//  - un LoRA di Qwen va in loras/qwen, uno di Klein in loras/flux, qualunque scheda sia aperta quando lo si carica (i nomi dei tensori decidono)
//  - uno che non si riconosce va nello scaffale della scheda (e ricorda la scelta); uno di un altro modello (SDXL) resta fuori, in «Altri»
//  - l'elenco porta `famiglie` (nella 1.2.0 non le portava e ogni LoRA di Klein risultava «non compatibile» con Klein)
//   node test/lora-scaffali.mjs
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const require = createRequire(import.meta.url)
const tmp = mkdtempSync(join(tmpdir(), 'daprod-lora-'))
process.env.LOCALAPPDATA = tmp
mkdirSync('test/.out', { recursive: true })

// un finto `electron`: serve solo per i percorsi
const stub = resolve('test/.out/electron-finto.cjs')
writeFileSync(stub, `module.exports = { app: { getPath: (k) => require('node:path').join(${JSON.stringify(tmp)}, k), isPackaged: false, getAppPath: () => ${JSON.stringify(tmp)} }, shell: { trashItem: async () => {}, openPath: async () => '' } }`)
buildSync({
  stdin: { contents: "export { importaLora, elencoLora, aggiornaLora } from './src/main/lora'", resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'cjs', outfile: 'test/.out/lora-main.cjs',
  alias: { '@shared': resolve('src/shared'), electron: stub }, external: ['electron-updater']
})
const { importaLora, elencoLora, aggiornaLora } = require(resolve('test/.out/lora-main.cjs'))

/** un .safetensors vuoto con solo l'intestazione: i nomi dei tensori bastano a riconoscerlo */
function creaLora(nome, chiavi) {
  const h = {}
  for (const k of chiavi) h[k] = { dtype: 'F32', shape: [1, 1], data_offsets: [0, 0] }
  const j = Buffer.from(JSON.stringify(h), 'utf8')
  const n = Buffer.alloc(8)
  n.writeBigUInt64LE(BigInt(j.length))
  const p = join(tmp, nome)
  writeFileSync(p, Buffer.concat([n, j]))
  return p
}
const qwen = creaLora('stile-qwen.safetensors', ['transformer_blocks.3.attn.to_q.lora_A.weight', 'transformer_blocks.3.img_mlp.net.0.proj.lora_B.weight'])
const klein = creaLora('stile-klein.safetensors', ['diffusion_model.single_blocks.2.qkv.lora_A.weight', 'diffusion_model.single_blocks.2.qkv.lora_B.weight'])
const ignoto = creaLora('misterioso.safetensors', ['foo.bar.weight'])
const sdxl = creaLora('sdxl.safetensors', ['lora_unet_down_blocks_0_attentions_0.lora_down.weight'])
const flux2 = creaLora('flux2-4b.safetensors', ['diffusion_model.double_blocks.0.img_attn.qkv.lora_A.weight', 'diffusion_model.double_blocks.0.img_mlp.0.lora_A.weight', 'diffusion_model.double_blocks.0.txt_mlp.0.lora_A.weight', 'diffusion_model.single_blocks.0.linear1.lora_A.weight'])

// ---- si carica dalla scheda sbagliata: i tensori decidono ----
assert.deepEqual(importaLora([qwen], 'flux'), ['qwen\\stile-qwen.safetensors'], 'un LoRA di Qwen caricato dalla scheda Flux va nello scaffale Qwen')
assert.deepEqual(importaLora([klein], 'qwen'), ['flux\\stile-klein.safetensors'], 'un LoRA di Klein caricato dalla scheda Qwen va nello scaffale Flux')
// ---- non si riconosce: vale la scheda ----
assert.deepEqual(importaLora([ignoto], 'flux'), ['flux\\misterioso.safetensors'])
// ---- di un altro modello: fuori dagli scaffali, anche se la scheda è aperta ----
assert.deepEqual(importaLora([sdxl], 'qwen'), ['sdxl.safetensors'])
assert.deepEqual(importaLora([flux2], 'flux'), ['flux2-4b.safetensors'], 'FLUX.2 Klein 4B non è dell\'app: non entra in Flux')
// ---- senza scheda: niente sottocartella se non si riconosce ----
assert.deepEqual(importaLora([ignoto]), ['misterioso.safetensors'])
assert.ok(existsSync(join(tmp, 'DaProdImage', 'models', 'loras', 'qwen', 'stile-qwen.safetensors')))
assert.ok(existsSync(join(tmp, 'DaProdImage', 'models', 'loras', 'flux', 'stile-klein.safetensors')))

const el = Object.fromEntries(elencoLora().map((l) => [l.file, l]))
const q = el['qwen\\stile-qwen.safetensors']
const k = el['flux\\stile-klein.safetensors']
assert.deepEqual(q.famiglie, ['qwen'], 'l\'elenco porta le famiglie (Qwen)')
assert.deepEqual(k.famiglie, ['klein', 'klein-base'], 'l\'elenco porta le famiglie (Klein veloce e Base)')
assert.equal(k.compatibile, 'si')
assert.equal(k.gruppo, 'flux', 'un LoRA dentro loras/flux sta nello scaffale Flux')
assert.equal(q.gruppo, 'qwen')
const m = el['flux\\misterioso.safetensors']
assert.equal(m.gruppo, 'flux', 'scelto dalla scheda')
assert.equal(m.compatibile, '?')
const s = el['sdxl.safetensors']
assert.equal(s.compatibile, 'no')
assert.equal(s.gruppo, undefined, 'SDXL non ha scaffale')
assert.equal(el['flux2-4b.safetensors'].compatibile, 'no')

// ---- chi sa cosa fa può assegnare a mano uno che l'app non riconosce ----
aggiornaLora('misterioso.safetensors', { gruppo: 'qwen' })
assert.equal(elencoLora().find((l) => l.file === 'misterioso.safetensors').gruppo, 'qwen')

// ---- le note vecchie con «klein4b» (modello tolto nella 1.2.1) si rianalizzano da sole ----
const note = join(tmp, 'userData', 'lora.json')
const n = JSON.parse(readFileSync(note, 'utf8'))
n['flux2-4b.safetensors'] = { ...n['flux2-4b.safetensors'], compatibile: 'si', base: 'FLUX.2 Klein 4B', famiglie: ['klein4b'] }
writeFileSync(note, JSON.stringify(n))
const rian = elencoLora().find((l) => l.file === 'flux2-4b.safetensors')
assert.equal(rian.compatibile, 'no', 'il vecchio «klein4b» non conta più')
assert.deepEqual(rian.famiglie, [])

console.log('OK: LoRA negli scaffali Qwen e Flux, famiglie nell\'elenco, note vecchie ripulite')
