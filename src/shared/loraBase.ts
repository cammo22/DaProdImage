// Da quali nomi dei tensori di un LoRA si capisce per quale modello è fatto. File puro (niente Electron): lo prova `node test/lora.mjs`.
//   Qwen-Image 2.1     transformer_blocks.N.attn.to_q / img_mlp (flusso singolo)
//   Qwen-Image 1.x     txt_mlp, add_q_proj… (due flussi)
//   FLUX 3 Klein       single_blocks.N.(qkv|q_proj|attn_out|mlp_in|mlp_out), content_mode_blocks, txt_mode_blocks (ComfyUI li mappa: comfy/lora.py, ramo Flux3)
//   FLUX.2 Klein 4B    double_blocks.N.(img_attn|txt_attn|img_mlp|txt_mlp) + single_blocks.N.(linear1|linear2), 5 doppi blocchi e dimensione 3072
//   FLUX.1 / FLUX.2 grandi / SD / SDXL: non compatibili con nessuno dei modelli dell'app
import type { Famiglia, InfoLora } from './tipi'

export interface AnalisiLora {
  compatibile: InfoLora['compatibile']
  base?: string
  /** per quali famiglie dell'app è buono (vuoto = nessuna / non si capisce) */
  famiglie: Famiglia[]
}

const SEP = '[._]'
const blocco = (nome: string, resto: string): RegExp => new RegExp(`${nome}${SEP}\\d+${SEP}(?:${resto})`)

/** `chiavi`: i nomi dei tensori; `forme`: (facoltativo) le forme, per distinguere FLUX.2 4B da 9B */
export function analizzaChiavi(chiavi: string[], forme?: Record<string, number[] | undefined>): AnalisiLora {
  const tutte = chiavi.join('\n')
  if (!chiavi.length) return { compatibile: '?', famiglie: [] }
  if (/txt_mlp|add_q_proj|txt_mod|img_mod\./.test(tutte) && !/double_blocks/.test(tutte)) return { compatibile: 'no', base: 'Qwen-Image 1.x', famiglie: [] }
  // FLUX 3 Klein: i blocchi «modali» sono solo suoi; `single_blocks` con qkv/attn_out/mlp_in/mlp_out pure (FLUX.1 e FLUX.2 usano linear1/linear2)
  if (/(content_mode_blocks|txt_mode_blocks)/.test(tutte) || blocco('single_blocks', 'qkv|q_proj|k_proj|v_proj|attn_out|mlp_in|mlp_out').test(tutte)) {
    return { compatibile: 'si', base: 'FLUX 3 Klein', famiglie: ['klein', 'klein-base'] }
  }
  if (/(?:double|single)_blocks/.test(tutte)) {
    // FLUX.2 Klein 4B: 5 blocchi doppi e dimensione 3072; il resto (FLUX.1, FLUX.2 9B/dev) non è dell'app
    const doppi = chiavi.map((k) => /double_blocks[._](\d+)/.exec(k)?.[1]).filter((x): x is string => x !== undefined).map(Number)
    const maxDoppio = doppi.length ? Math.max(...doppi) : -1
    const chiaveIn = chiavi.find((k) => /double_blocks[._]0[._]img_attn[._]qkv.*(lora_A|lora_down)/.test(k))
    const dimIn = chiaveIn ? forme?.[chiaveIn]?.[1] : undefined
    const flux2 = /linear1/.test(tutte) && /img_mlp|txt_mlp/.test(tutte)
    if (maxDoppio >= 0 && maxDoppio <= 4 && (dimIn === undefined || dimIn === 3072) && flux2) return { compatibile: 'si', base: 'FLUX.2 Klein 4B', famiglie: ['klein4b'] }
    return { compatibile: 'no', base: maxDoppio <= 4 ? 'FLUX.2' : 'FLUX.1 / FLUX.2 grande', famiglie: [] }
  }
  if (/lora_unet_|down_blocks|input_blocks|lora_te/.test(tutte)) return { compatibile: 'no', base: 'Stable Diffusion / SDXL', famiglie: [] }
  if (/transformer_blocks\.\d+\.(attn\.to_q|img_mlp)/.test(tutte)) return { compatibile: 'si', base: 'Qwen-Image 2.1', famiglie: ['qwen'] }
  return { compatibile: '?', famiglie: [] }
}

/** un LoRA va bene con questo modello? 'si' (provato dai nomi), 'no', o '?' (non si capisce: si lascia provare) */
export function vaBeneCon(l: { compatibile: InfoLora['compatibile']; famiglie?: Famiglia[] }, fam: Famiglia): 'si' | 'no' | '?' {
  if (l.compatibile === '?') return '?'
  if (!l.famiglie || !l.famiglie.length) return l.compatibile === 'si' ? 'si' : 'no'
  return l.famiglie.includes(fam) ? 'si' : 'no'
}
