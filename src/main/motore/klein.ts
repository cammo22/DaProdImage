// FLUX 3 Klein: quali file usare. Le impostazioni possono dirlo; se sono vuote si usano quelli scaricati dall'app (risolti.json) e,
// in mancanza, si cerca nelle cartelle dei modelli (chi ha già i file li mette lì a mano).
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Famiglia, Impostazioni } from '@shared/tipi'
import { risoltoSalvato } from '../installa/risolvi'

export interface FileKlein {
  modello: string
  encoder: string
  vae: string
}

const lista = (imp: Impostazioni, sotto: string): string[] => {
  try {
    return readdirSync(join(imp.cartellaModelli, sotto)).filter((f) => /\.(safetensors|gguf)$/i.test(f) && !f.endsWith('.part'))
  } catch {
    return []
  }
}
const sul = (imp: Impostazioni, sotto: string, nome: string | undefined): string => (nome && existsSync(join(imp.cartellaModelli, sotto, nome)) ? nome : '')
/** fra i candidati, il primo che soddisfa le espressioni in ordine di preferenza */
const preferisci = (nomi: string[], ordine: RegExp[]): string => {
  for (const re of ordine) {
    const n = nomi.find((x) => re.test(x))
    if (n) return n
  }
  return ''
}

const NON_PESI = /vae|qwen|text_enc|mmproj/i

/** i file di Klein (o di Klein Base) da usare adesso, o l'errore da mostrare in italiano se mancano */
export function fileKlein(imp: Impostazioni, famiglia: Famiglia): FileKlein | string {
  const base = famiglia === 'klein-base'
  const idModelli = base ? ['klein-base-int8', 'klein-base-bf16'] : ['klein-int8', 'klein-bf16']
  const scelto = base ? imp.kleinBase : imp.kleinModello
  let modello = sul(imp, 'diffusion_models', scelto)
  if (!modello) for (const id of idModelli) modello = modello || sul(imp, 'diffusion_models', risoltoSalvato(id)?.file)
  if (!modello) {
    const tutti = [...lista(imp, 'diffusion_models'), ...lista(imp, 'unet')].filter((n) => /klein/i.test(n) && !NON_PESI.test(n) && /base/i.test(n) === base)
    modello = preferisci(tutti, [/int8/i, /bf16/i, /fp8/i, /./])
  }
  let encoder = sul(imp, 'text_encoders', imp.kleinEncoder) || sul(imp, 'text_encoders', risoltoSalvato('klein-te')?.file)
  if (!encoder) encoder = preferisci(lista(imp, 'text_encoders'), [/^qwen3vl_4b_int8/i, /(qwen3|qwen_3).*vl.*4b.*(int8|fp8|q8)/i, /(qwen3|qwen_3).*4b.*(int8|fp8|q8)/i, /(qwen3|qwen_3).*vl.*4b/i, /(qwen3|qwen_3).*4b/i, /klein/i])
  let vae = sul(imp, 'vae', imp.kleinVae) || sul(imp, 'vae', risoltoSalvato('klein-vae')?.file)
  if (!vae) vae = preferisci(lista(imp, 'vae'), [/^flux2-vae\./i, /klein/i, /flux.?[23]/i, /^ae\./i, /flux/i])
  const mancano = [!modello && (base ? 'il modello Klein Base' : 'il modello Klein'), !encoder && 'il text encoder (Qwen3-VL 4B)', !vae && 'il VAE'].filter(Boolean)
  if (mancano.length) return `FLUX 3 Klein non è pronto: mancano ${mancano.join(', ')}. Scaricali dal selettore del modello (o da Opzioni → Scarica altri modelli).`
  return { modello, encoder, vae }
}
