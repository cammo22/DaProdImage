// Conversione dei LoRA di FLUX 3 Klein dal formato Diffusers/SimpleTuner a quello di ComfyUI (src/shared/loraConverti.ts + src/main/loraConverti.ts).
// Niente Electron né motore: si crea un .safetensors piccolo con i nomi veri di un LoRA Diffusers, lo si converte e si guarda che
//  - i nomi siano quelli che ComfyUI conosce (la mappa viene dal confronto di LoRA veri nei due formati)
//  - i pesi non cambino di un byte, e con alpha ≠ rango compaia un tensore `.alpha` per modulo
//   node test/lora-converti.mjs
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const require = createRequire(import.meta.url)
buildSync({
  stdin: { contents: "export * from './src/main/loraConverti'; export * from './src/shared/loraConverti'", resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'cjs', outfile: 'test/.out/lora-converti.cjs', alias: { '@shared': resolve('src/shared') }
})
const C = require(resolve('test/.out/lora-converti.cjs'))

// la mappa dei nomi
const M = (k) => C.chiaveComfy(k)
assert.equal(M('transformer.mode_blocks.image.3.attn.to_q.lora_A.weight'), 'diffusion_model.content_mode_blocks.image.3.q_proj.lora_A.weight')
assert.equal(M('transformer.mode_blocks.image_cond.0.attn.to_out.0.lora_B.weight'), 'diffusion_model.content_mode_blocks.image_cond.0.attn_out.lora_B.weight')
assert.equal(M('transformer.txt_mode_blocks.4.ff.linear_in.lora_A.weight'), 'diffusion_model.txt_mode_blocks.4.mlp_in.lora_A.weight')
assert.equal(M('transformer.single_transformer_blocks.27.ff.linear_out.lora_B.weight'), 'diffusion_model.single_blocks.27.mlp_out.lora_B.weight')
assert.equal(M('transformer.single_transformer_blocks.2.attn.to_v.lora_A.weight'), 'diffusion_model.single_blocks.2.v_proj.lora_A.weight')
assert.equal(M('transformer.early_stream_modulations.image_cond.linear.lora_A.weight'), 'diffusion_model.early_stream_modulations.image_cond.lin.lora_A.weight')
assert.equal(M('transformer.mode_blocks.image.0.attn.to_k.lora_A.default.weight'), 'diffusion_model.content_mode_blocks.image.0.k_proj.lora_A.weight')
assert.equal(M('transformer.qualcosa_di_strano.lora_A.weight'), null)
assert.equal(M('transformer.mode_blocks.image.0.attn.to_k.alpha'), null)
assert.deepEqual(C.rangoEAlpha({ lora_adapter_metadata: '{"transformer.r": 16, "transformer.lora_alpha": 32}' }), { r: 16, alpha: 32 })
assert.equal(C.rangoEAlpha({}), null)

// un file vero in piccolo: due moduli, pesi riconoscibili byte per byte
function crea(percorso, chiavi, meta) {
  const h = { __metadata__: meta }
  let pos = 0
  const dati = []
  for (const k of chiavi) {
    const b = Buffer.alloc(8)
    b.fill(dati.length + 1)
    h[k] = { dtype: 'BF16', shape: [2, 2], data_offsets: [pos, pos + 8] }
    pos += 8
    dati.push(b)
  }
  let t = JSON.stringify(h)
  t += ' '.repeat((8 - (Buffer.byteLength(t) % 8)) % 8)
  const l = Buffer.alloc(8)
  l.writeBigUInt64LE(BigInt(Buffer.byteLength(t)))
  writeFileSync(percorso, Buffer.concat([l, Buffer.from(t), ...dati]))
  return dati
}
function leggi(percorso) {
  const b = readFileSync(percorso)
  const n = Number(b.readBigUInt64LE(0))
  const h = JSON.parse(b.subarray(8, 8 + n).toString())
  return { h, dati: b.subarray(8 + n) }
}

const tmp = mkdtempSync(join(tmpdir(), 'daprod-conv-'))
const chiavi = [
  'transformer.mode_blocks.image.0.attn.to_q.lora_A.weight',
  'transformer.mode_blocks.image.0.attn.to_q.lora_B.weight',
  'transformer.single_transformer_blocks.1.ff.linear_in.lora_A.weight',
  'transformer.single_transformer_blocks.1.ff.linear_in.lora_B.weight'
]
const orig = join(tmp, 'a.safetensors')
const dati = crea(orig, chiavi, { format: 'pt', lora_adapter_metadata: '{"transformer.r": 16, "transformer.lora_alpha": 16}' })
const r = C.convertiSulPosto(orig)
assert.deepEqual(r, { rinominati: 4, scartati: 0 })
assert.ok(existsSync(orig + '.diffusers.bak'), "l'originale resta accanto")
const c = leggi(orig)
const nomi = Object.keys(c.h).filter((k) => k !== '__metadata__')
assert.deepEqual(nomi.sort(), [
  'diffusion_model.content_mode_blocks.image.0.q_proj.lora_A.weight',
  'diffusion_model.content_mode_blocks.image.0.q_proj.lora_B.weight',
  'diffusion_model.single_blocks.1.mlp_in.lora_A.weight',
  'diffusion_model.single_blocks.1.mlp_in.lora_B.weight'
])
// i pesi sono quelli di prima, byte per byte
chiavi.forEach((k, i) => {
  const t = c.h[C.chiaveComfy(k)]
  assert.deepEqual(c.dati.subarray(t.data_offsets[0], t.data_offsets[1]), dati[i], k)
})
assert.equal(c.h.__metadata__.ss_base_model_version, 'flux3')

// alpha ≠ rango: un tensore alpha per modulo, F32 scalare, col valore giusto
const b = join(tmp, 'b.safetensors')
crea(b, chiavi, { lora_adapter_metadata: '{"transformer.r": 16, "transformer.lora_alpha": 8}' })
C.convertiSulPosto(b)
const cb = leggi(b)
const alphas = Object.keys(cb.h).filter((k) => k.endsWith('.alpha'))
assert.deepEqual(alphas.sort(), ['diffusion_model.content_mode_blocks.image.0.q_proj.alpha', 'diffusion_model.single_blocks.1.mlp_in.alpha'])
for (const k of alphas) {
  assert.deepEqual(cb.h[k].shape, [])
  assert.equal(cb.h[k].dtype, 'F32')
  assert.equal(cb.dati.readFloatLE(cb.h[k].data_offsets[0]), 8)
}

// un file che non è un LoRA di Klein: errore chiaro e il file resta com'è
const x = join(tmp, 'x.safetensors')
crea(x, ['foo.bar.lora_A.weight'], {})
assert.throws(() => C.convertiSulPosto(x), /nessun tensore riconosciuto/)
assert.ok(!existsSync(x + '.nuovo') && !existsSync(x + '.diffusers.bak'), 'niente file a metà')
console.log('TUTTI OK (conversione dei LoRA Diffusers → ComfyUI)')
