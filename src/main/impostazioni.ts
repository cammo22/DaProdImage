// Le impostazioni: un JSON nei dati dell'app, scritto subito a ogni modifica.
import { readFileSync, writeFileSync, renameSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Impostazioni } from '@shared/tipi'
import { allineaScelta, denoiserSenzaTurbo, famigliaDi, modelloDaImpostazioni } from '@shared/modelli'
import { DATI, GALLERIA_PREDEFINITA, MODELLI_PREDEFINITI, assicura } from './percorsi'

const FILE = join(DATI, 'impostazioni.json')

const PREDEFINITE: Impostazioni = {
  cartellaModelli: MODELLI_PREDEFINITI,
  cartellaGalleria: GALLERIA_PREDEFINITA,
  modello: 'qwen-image-2.1-UC-Q4_K_M.gguf',
  encoder: 'qwen3vl_8b_int8_convrot.safetensors',
  vae: 'texture_fix_vae_for_qwen_image_2.1_bf16.safetensors',
  upscaler: '4x-UltraSharp.pth',
  famiglia: 'qwen',
  modelloScelto: 'qwen-base',
  kleinModello: '',
  kleinBase: '',
  kleinEncoder: '',
  kleinVae: '',
  upscalerRtx: true,
  scaricaInIdle: true,
  porta: 8818,
  cacheKV: 'auto',
  cacheTipo: 'default',
  encoderSuCpu: false,
  anteprimaLive: true,
  riservaVram: 0,
  argomentiExtra: '',
  // gli step "standard" della pipeline ufficiale (40, euler, cfg 1): la qualità piena
  predefiniti: { passi: 40, cfg: 1, sampler: 'euler', scheduler: 'simple', megapixel: 1 },
  installato: false,
  tokenCivitai: '',
  tokenHF: '',
  tempi: {},
  loraTurbo: 'turbo8_lora_step2500.safetensors',
  memoria: 'auto',
  vramMB: 0,
  veloce: false,
  traduci: true,
  traduttore: 'dedicato',
  unaCosaAllaVolta: true,
  potenziaKlein: true,
  scaricaDopo: 120
}

let attuali: Impostazioni | null = null

function scrivi(imp: Impostazioni): void {
  assicura(DATI)
  writeFileSync(FILE + '.tmp', JSON.stringify(imp, null, 2))
  renameSync(FILE + '.tmp', FILE)
}

/** dalla 1.1 i modelli sono tre (`modelli.ts`) e il Turbo di Qwen non c'è più: le impostazioni senza `modelloScelto`
 *  lo prendono dalla famiglia (Qwen, anche col Turbo, → qwen-base) e, se il denoiser era il Turbo GGUF, tornano a quello pieno
 *  (stesso quant) se è nella cartella. Succede una volta sola: dopo, `modelloScelto` è nel file. */
function migra(letto: Partial<Impostazioni>, imp: Impostazioni): boolean {
  if (letto.modelloScelto) return false
  let presenti: string[] = []
  try {
    presenti = readdirSync(join(imp.cartellaModelli, 'diffusion_models'))
  } catch {
    /* cartella che non c'è: il denoiser resta com'è */
  }
  const pieno = denoiserSenzaTurbo(imp.modello, presenti)
  if (pieno) imp.modello = pieno
  return true
}

export function impostazioni(): Impostazioni {
  if (attuali) return attuali
  try {
    const letto = JSON.parse(readFileSync(FILE, 'utf8')) as Partial<Impostazioni>
    const imp: Impostazioni = { ...PREDEFINITE, ...letto, predefiniti: { ...PREDEFINITE.predefiniti, ...(letto.predefiniti || {}) } }
    // la scelta del modello e la famiglia vanno sempre d'accordo (anche con un file vecchio o scritto a mano)
    imp.modelloScelto = modelloDaImpostazioni(letto)
    imp.famiglia = famigliaDi(imp.modelloScelto)
    attuali = imp
    if (migra(letto, imp)) {
      try {
        scrivi(imp)
      } catch {
        /* si riscrive al primo salvataggio */
      }
    }
  } catch {
    attuali = structuredClone(PREDEFINITE)
  }
  return attuali
}

export function salvaImpostazioni(modifiche: Partial<Impostazioni>): Impostazioni {
  const nuove = { ...impostazioni(), ...modifiche, ...allineaScelta(modifiche) }
  if (modifiche.predefiniti) nuove.predefiniti = { ...impostazioni().predefiniti, ...modifiche.predefiniti }
  attuali = nuove
  scrivi(nuove)
  return nuove
}

/** segna quanti secondi ci vuole un passo a questa grandezza (media mobile) */
export function registraTempo(megapixel: number, secondiPerPasso: number): void {
  const chiave = (Math.round(megapixel * 4) / 4).toFixed(2)
  const tempi = { ...impostazioni().tempi }
  const prima = tempi[chiave]
  tempi[chiave] = prima ? prima * 0.6 + secondiPerPasso * 0.4 : secondiPerPasso
  salvaImpostazioni({ tempi })
}

/** il profilo di memoria da usare: quello scelto, o dalla VRAM della scheda */
export function profiloMemoria(vramByte?: number): 'bassa' | 'normale' | 'alta' {
  const imp = impostazioni()
  if (imp.memoria !== 'auto') return imp.memoria
  const mb = vramByte ? vramByte / 1048576 : imp.vramMB
  if (!mb) return 'normale'
  return mb < 7000 ? 'bassa' : mb < 14000 ? 'normale' : 'alta'
}

/** stima dei secondi per passo a questa grandezza (dalle misure, o dal conto sui pixel) */
export function stimaPasso(megapixel: number): number {
  const tempi = impostazioni().tempi
  const chiave = (Math.round(megapixel * 4) / 4).toFixed(2)
  if (tempi[chiave]) return tempi[chiave]
  // senza misure: ~2.9 s/passo a 1 MP su una 4060, l'attenzione cresce un po' più che lineare
  const base = tempi['1.00'] || 2.9
  return base * Math.pow(Math.max(0.1, megapixel), 1.15)
}
