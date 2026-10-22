// FLUX 3 Klein e FLUX.2 Klein 4B: quali file usare. Le impostazioni possono dirlo; se sono vuote si usano quelli scaricati dall'app (risolti.json) e,
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

const NON_PESI = /vae|qwen|text_enc|mmproj|upsampl/i
/** i file di FLUX.2 Klein 4B / 9B (altra architettura di FLUX 3): non vanno mai presi per quelli di Klein */
const E_FLUX2 = /klein.*[-_](4b|9b)|[-_](4b|9b).*klein/i

/** il Qwen3-VL 4B di Klein (impostazioni → scaricato dall'app → cercato nelle cartelle), o '' se non c'è: serve anche a scrivere testo senza il modello che disegna.
 *  Non prende mai il Qwen3 4B di solo testo di FLUX.2 Klein 4B (`qwen_3_4b.safetensors`: è un altro encoder) né l'LLM uncensored (si sceglie a parte: `encoderDiTesto`). */
export function encoderKleinFile(imp: Impostazioni): string {
  const encoder = sul(imp, 'text_encoders', imp.kleinEncoder) || sul(imp, 'text_encoders', risoltoSalvato('klein-te')?.file)
  if (encoder) return encoder
  const candidati = lista(imp, 'text_encoders').filter((n) => !/^qwen_3_4b/i.test(n) && !/abliterated|uncensored/i.test(n))
  return preferisci(candidati, [/^qwen3vl_4b_int8/i, /(qwen3|qwen_3).*vl.*4b.*(int8|fp8|q8)/i, /(qwen3|qwen_3).*4b.*(int8|fp8|q8)/i, /(qwen3|qwen_3).*vl.*4b/i, /klein/i])
}

/** l'LLM uncensored per i testi (voce `llm-huihui-4b`), se l'interruttore è acceso, l'avviso accettato, la scelta fatta e il file c'è; se no '' */
export function llmUncensoredFile(imp: Impostazioni): string {
  if (!imp.uncensored || !imp.uncensoredAccettato || !imp.testoUncensored) return ''
  return sul(imp, 'text_encoders', risoltoSalvato('llm-huihui-4b')?.file)
}

/** chi scrive i testi con le famiglie Klein: l'LLM uncensored se scelto, se no il Qwen3-VL 4B di Klein ('' = nessuno dei due: si resta con l'encoder di Qwen).
 *  L'LLM uncensored scrive solo i testi: il conditioning del disegno resta sempre l'encoder ufficiale (`fileKlein`). */
export function encoderDiTesto(imp: Impostazioni): string {
  return llmUncensoredFile(imp) || encoderKleinFile(imp)
}

/** i file di Klein (o di Klein Base, o di FLUX.2 Klein 4B) da usare adesso, o l'errore da mostrare in italiano se mancano */
export function fileKlein(imp: Impostazioni, famiglia: Famiglia): FileKlein | string {
  if (famiglia === 'klein4b') return fileKlein4b(imp)
  const base = famiglia === 'klein-base'
  const idModelli = base ? ['klein-base-int8', 'klein-base-bf16'] : ['klein-int8', 'klein-bf16']
  const scelto = base ? imp.kleinBase : imp.kleinModello
  let modello = sul(imp, 'diffusion_models', scelto)
  if (!modello) for (const id of idModelli) modello = modello || sul(imp, 'diffusion_models', risoltoSalvato(id)?.file)
  if (!modello) {
    const tutti = [...lista(imp, 'diffusion_models'), ...lista(imp, 'unet')].filter((n) => /klein/i.test(n) && !NON_PESI.test(n) && !E_FLUX2.test(n) && /base/i.test(n) === base)
    modello = preferisci(tutti, [/int8/i, /bf16/i, /fp8/i, /./])
  }
  const encoder = encoderKleinFile(imp)
  const vae = vaeKlein(imp)
  const mancano = [!modello && (base ? 'il modello Klein Base' : 'il modello Klein'), !encoder && 'il text encoder (Qwen3-VL 4B)', !vae && 'il VAE'].filter(Boolean)
  if (mancano.length) return `FLUX 3 Klein non è pronto: mancano ${mancano.join(', ')}. Scaricali dal selettore del modello (o da Opzioni → Scarica altri modelli).`
  return { modello, encoder, vae }
}

/** il VAE di FLUX.2 (lo stesso per Klein 3 e Klein 4B) */
function vaeKlein(imp: Impostazioni): string {
  const vae = sul(imp, 'vae', imp.kleinVae) || sul(imp, 'vae', risoltoSalvato('klein-vae')?.file)
  return vae || preferisci(lista(imp, 'vae'), [/^flux2-vae\./i, /klein/i, /flux.?[23]/i, /^ae\./i, /flux/i])
}

/** FLUX.2 Klein 4B: il denoiser (FP8 ufficiale), il Qwen3 4B di solo testo e il VAE di FLUX.2 */
function fileKlein4b(imp: Impostazioni): FileKlein | string {
  let modello = sul(imp, 'diffusion_models', risoltoSalvato('klein4b-fp8')?.file)
  if (!modello) {
    const tutti = [...lista(imp, 'diffusion_models'), ...lista(imp, 'unet')].filter((n) => /klein.*4b|4b.*klein/i.test(n) && !/base/i.test(n) && !/vae|text_enc/i.test(n))
    modello = preferisci(tutti, [/fp8/i, /bf16/i, /./])
  }
  const encoder = sul(imp, 'text_encoders', risoltoSalvato('klein4b-te')?.file) || preferisci(lista(imp, 'text_encoders'), [/^qwen_3_4b\.safetensors$/i, /^qwen_?3_4b/i])
  const vae = vaeKlein(imp)
  const mancano = [!modello && 'il modello FLUX.2 Klein 4B', !encoder && 'il text encoder (Qwen3 4B)', !vae && 'il VAE'].filter(Boolean)
  if (mancano.length) return `FLUX.2 Klein 4B non è pronto: mancano ${mancano.join(', ')}. Scaricali dal selettore del modello (o da Opzioni → Scarica altri modelli).`
  return { modello, encoder, vae }
}
