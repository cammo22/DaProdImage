// Da quali nomi dei tensori di un LoRA si capisce per quale modello è fatto. File puro (niente Electron): lo prova `node test/lora.mjs`.
//   Qwen-Image 2.1     transformer_blocks.N.attn.to_q / img_mlp (flusso singolo)
//   Qwen-Image 1.x     txt_mlp, add_q_proj… (due flussi)
//   FLUX 3 Klein       single_blocks.N.(qkv|q_proj|attn_out|mlp_in|mlp_out), content_mode_blocks, txt_mode_blocks (ComfyUI li mappa: comfy/lora.py, ramo Flux3)
//   FLUX.1 / FLUX.2 (Klein 4B compreso, tolto dall'app nella 1.2.1) / SD / SDXL: non compatibili con nessuno dei modelli dell'app
import type { Famiglia, GruppoLora, InfoLora } from './tipi'

export interface AnalisiLora {
  compatibile: InfoLora['compatibile']
  base?: string
  /** per quali famiglie dell'app è buono (vuoto = nessuna / non si capisce) */
  famiglie: Famiglia[]
}

const SEP = '[._]'
const blocco = (nome: string, resto: string): RegExp => new RegExp(`${nome}${SEP}\\d+${SEP}(?:${resto})`)

/** `chiavi`: i nomi dei tensori; `forme`: (facoltativo, oggi non serve più: serviva a distinguere FLUX.2 4B da 9B) */
export function analizzaChiavi(chiavi: string[], _forme?: Record<string, number[] | undefined>): AnalisiLora {
  const tutte = chiavi.join('\n')
  if (!chiavi.length) return { compatibile: '?', famiglie: [] }
  if (/txt_mlp|add_q_proj|txt_mod|img_mod\./.test(tutte) && !/double_blocks/.test(tutte)) return { compatibile: 'no', base: 'Qwen-Image 1.x', famiglie: [] }
  // FLUX 3 Klein: i blocchi «modali» sono solo suoi; `single_blocks` con qkv/attn_out/mlp_in/mlp_out pure (FLUX.1 e FLUX.2 usano linear1/linear2)
  if (/(content_mode_blocks|txt_mode_blocks)/.test(tutte) || blocco('single_blocks', 'qkv|q_proj|k_proj|v_proj|attn_out|mlp_in|mlp_out').test(tutte)) {
    return { compatibile: 'si', base: 'FLUX 3 Klein', famiglie: ['klein', 'klein-base'] }
  }
  if (/(?:double|single)_blocks/.test(tutte)) {
    // FLUX.1, FLUX.2 (anche Klein 4B/9B) non sono dell'app: il prompt dice solo di che famiglia sembra
    const doppi = chiavi.map((k) => /double_blocks[._](\d+)/.exec(k)?.[1]).filter((x): x is string => x !== undefined).map(Number)
    const maxDoppio = doppi.length ? Math.max(...doppi) : -1
    return { compatibile: 'no', base: maxDoppio >= 0 && maxDoppio <= 4 ? 'FLUX.2' : 'FLUX.1 / FLUX.2 grande', famiglie: [] }
  }
  if (/lora_unet_|down_blocks|input_blocks|lora_te/.test(tutte)) return { compatibile: 'no', base: 'Stable Diffusion / SDXL', famiglie: [] }
  if (/transformer_blocks\.\d+\.(attn\.to_q|img_mlp)/.test(tutte)) return { compatibile: 'si', base: 'Qwen-Image 2.1', famiglie: ['qwen'] }
  return { compatibile: '?', famiglie: [] }
}

export const GRUPPI_LORA: GruppoLora[] = ['qwen', 'flux']
export const NOME_GRUPPO: Record<GruppoLora, string> = { qwen: 'Qwen', flux: 'Flux (Klein 3)' }

/** lo scaffale di un modello: Qwen ha i suoi LoRA, Klein veloce e Klein Base (FLUX 3) gli stessi */
export const gruppoDiFamiglia = (f: Famiglia | undefined): GruppoLora => (f === 'klein' || f === 'klein-base' ? 'flux' : 'qwen')

/** a quale scaffale appartiene un LoRA: prima quello che dicono i nomi dei tensori (`famiglie`), poi la scelta di chi l'ha caricato (`gruppo`,
 *  anche per uno che l'app non riconosce: chi lo carica sa quello che fa); nelle librerie vecchie senza `famiglie` un 'si' è Qwen 2.1.
 *  undefined = non si sa (da verificare) o è di un altro modello (SD, SDXL, FLUX.1…). */
export function gruppoDa(l: { compatibile: InfoLora['compatibile']; famiglie?: Famiglia[]; gruppo?: GruppoLora }): GruppoLora | undefined {
  if (l.famiglie?.length) return gruppoDiFamiglia(l.famiglie[0])
  if (l.gruppo) return l.gruppo
  return l.compatibile === 'si' ? 'qwen' : undefined
}

/** un LoRA va bene con questo modello? 'si' (provato dai nomi o scelto da chi l'ha caricato), 'no', o '?' (non si capisce: si lascia provare) */
export function vaBeneCon(l: { compatibile: InfoLora['compatibile']; famiglie?: Famiglia[]; gruppo?: GruppoLora }, fam: Famiglia): 'si' | 'no' | '?' {
  if (l.famiglie?.length) return gruppoDiFamiglia(l.famiglie[0]) === gruppoDiFamiglia(fam) ? 'si' : 'no'
  if (l.gruppo) return l.gruppo === gruppoDiFamiglia(fam) ? 'si' : 'no'
  if (l.compatibile === 'no') return 'no'
  if (l.compatibile === '?') return '?'
  return fam === 'qwen' ? 'si' : 'no'
}
