// Dai nomi dei tensori di un LoRA di FLUX 3 Klein fatto con Diffusers/SimpleTuner (`transformer.mode_blocks.image.0.attn.to_q.lora_A.weight`)
// ai nomi che ComfyUI conosce (`diffusion_model.content_mode_blocks.image.0.q_proj.lora_A.weight`, quelli di AI Toolkit). File puro: lo prova `node test/lora.mjs`.
// La mappa è ricavata confrontando LoRA veri dello stesso modello nei due formati (Raume/alphajace-klein-lora, convertito da Diffusers, e gli ausboss di AI Toolkit).
//
//   transformer.mode_blocks.<modo>.N.attn.to_q|to_k|to_v   →  diffusion_model.content_mode_blocks.<modo>.N.q_proj|k_proj|v_proj
//   transformer.txt_mode_blocks.N...                       →  diffusion_model.txt_mode_blocks.N...
//   transformer.single_transformer_blocks.N...             →  diffusion_model.single_blocks.N...
//   ...attn.to_out.0 → attn_out · ff.linear_in → mlp_in · ff.linear_out → mlp_out
//   ...modulations.<modo>.linear → ...modulations.<modo>.lin

const SUFFISSI = ['lora_A.weight', 'lora_B.weight', 'lora_A.default.weight', 'lora_B.default.weight']

const DENTRO: [RegExp, string][] = [
  [/\.attn\.to_q$/, '.q_proj'],
  [/\.attn\.to_k$/, '.k_proj'],
  [/\.attn\.to_v$/, '.v_proj'],
  [/\.attn\.to_out\.0$/, '.attn_out'],
  [/\.ff\.linear_in$/, '.mlp_in'],
  [/\.ff\.linear_out$/, '.mlp_out']
]

/** il nome del modulo (senza `.lora_A.weight`) nel formato di ComfyUI; null se non si sa cosa farne */
export function moduloComfy(modulo: string): string | null {
  let m = modulo.replace(/^transformer\./, '')
  if (/^mode_blocks\./.test(m)) m = 'content_' + m
  else if (/^single_transformer_blocks\./.test(m)) m = m.replace(/^single_transformer_blocks\./, 'single_blocks.')
  else if (!/^(txt_mode_blocks|single_blocks|content_mode_blocks)\./.test(m) && !/modulations\.|^(time_in|ref_time_in|txt_in|emb_in|final_layer)\b/.test(m)) return null
  for (const [da, a] of DENTRO) if (da.test(m)) return 'diffusion_model.' + m.replace(da, a)
  m = m.replace(/(modulations\.[a-z_]+)\.linear$/, '$1.lin')
  return 'diffusion_model.' + m
}

/** la nuova chiave di un tensore (`transformer.….lora_A.weight` → `diffusion_model.….lora_A.weight`); null = non è un peso di LoRA che si sa portare */
export function chiaveComfy(chiave: string): string | null {
  for (const s of SUFFISSI) {
    if (!chiave.endsWith('.' + s)) continue
    const m = moduloComfy(chiave.slice(0, -(s.length + 1)))
    return m ? `${m}.${s.replace('.default', '')}` : null
  }
  return null
}

/** rango e alpha scritti da PEFT nell'intestazione (`lora_adapter_metadata`): con alpha ≠ rango ComfyUI vuole un tensore `.alpha` per modulo */
export function rangoEAlpha(meta: Record<string, string> | undefined): { r: number; alpha: number } | null {
  try {
    const m = JSON.parse(meta?.lora_adapter_metadata || '') as Record<string, unknown>
    const r = Number(m['transformer.r'] ?? m.r)
    const alpha = Number(m['transformer.lora_alpha'] ?? m.lora_alpha)
    return r > 0 && alpha > 0 ? { r, alpha } : null
  } catch {
    return null
  }
}
