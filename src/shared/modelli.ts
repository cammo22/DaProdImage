// I modelli che si scelgono nell'interfaccia: due famiglie, tre voci (D1 del piano, rivista da Cammo il 21/10/2026).
//   qwen-base  = Qwen-Image 2.1 pieno, 40 passi, coi LoRA: la qualità piena di Qwen.
//   klein      = FLUX 3 Klein distillato, 8 passi senza CFG: il modello veloce.
//   klein-base = FLUX 3 Klein Base, 50 passi con CFG 3,5: la qualità piena di Klein.
// Niente Qwen veloce col LoRA Turbo8: a Cammo non piace. Dalla 1.2.1 niente FLUX.2 Klein 4B: sono rimasti Qwen e FLUX 3 Klein.
//
// Il motore continua a ragionare per `Famiglia` (+ `turbo`, che resta nella Richiesta solo per i PNG e le ricette vecchie):
// questa è l'unica mappa fra le due cose. È pura (niente Electron, niente React), così `test/modelli.mjs` la prova con Node.
// I grafi di Qwen non cambiano: qwen-base manda la stessa richiesta di prima con la qualità «Alta».
import type { Famiglia } from './tipi'

export type IdModello = 'qwen-base' | 'klein' | 'klein-base'

export interface InfoModello {
  id: IdModello
  famiglia: Famiglia
  /** sempre false: il Turbo di Qwen non c'è più (il campo c'è per dirlo chiaro a chi costruisce la richiesta) */
  turbo: false
  passi: number
  /** il CFG che vuole il modello (null = quello delle impostazioni, 1 per Qwen) */
  cfg: number | null
  nome: string
  corto: string
  sotto: string
  /** accetta i LoRA (fatti per Qwen-Image 2.1) */
  lora: boolean
  /** è un modello distillato, fatto per esplorare: il risultato si può rifare in qualità piena */
  veloce: boolean
}

export const MODELLI: Record<IdModello, InfoModello> = {
  'qwen-base': { id: 'qwen-base', famiglia: 'qwen', turbo: false, passi: 40, cfg: null, nome: 'Qwen-Image 2.1', corto: 'Qwen', sotto: '40 passi · LoRA', lora: true, veloce: false },
  klein: { id: 'klein', famiglia: 'klein', turbo: false, passi: 8, cfg: 1, nome: 'FLUX 3 Klein', corto: 'Klein veloce', sotto: '8 passi · senza CFG · il più veloce', lora: true, veloce: true },
  'klein-base': { id: 'klein-base', famiglia: 'klein-base', turbo: false, passi: 50, cfg: 3.5, nome: 'FLUX 3 Klein Base', corto: 'Klein Base', sotto: '50 passi · CFG 3,5 · la qualità piena', lora: true, veloce: false }
}

/** l'ordine delle pillole nell'interfaccia */
export const ORDINE_MODELLI: IdModello[] = ['qwen-base', 'klein', 'klein-base']
export const MODELLO_PREDEFINITO: IdModello = 'qwen-base'

export const eModello = (x: unknown): x is IdModello => typeof x === 'string' && Object.prototype.hasOwnProperty.call(MODELLI, x)

/** dalla famiglia (e dal vecchio Turbo) al modello: il Turbo di Qwen diventa Qwen base, tutto quello che non si riconosce pure
 *  (FLUX.2 Klein 4B, tolto nella 1.2.1, compreso) */
export function modelloDa(famiglia?: unknown, _turbo?: boolean): IdModello {
  if (famiglia === 'klein') return 'klein'
  if (famiglia === 'klein-base') return 'klein-base'
  return 'qwen-base'
}

export const famigliaDi = (id: IdModello): Famiglia => MODELLI[id].famiglia

/** il modello di impostazioni lette da disco (anche vecchie, senza `modelloScelto`, o rovinate) */
export function modelloDaImpostazioni(imp: { modelloScelto?: unknown; famiglia?: unknown } | null | undefined): IdModello {
  if (imp && eModello(imp.modelloScelto)) return imp.modelloScelto
  return modelloDa(imp?.famiglia)
}

/** quando si salvano le impostazioni, `modelloScelto` e `famiglia` restano d'accordo (vince quello che cambia; se cambiano tutti e due, il modello) */
export function allineaScelta(modifiche: { modelloScelto?: unknown; famiglia?: unknown }): { modelloScelto?: IdModello; famiglia?: Famiglia } {
  if (eModello(modifiche.modelloScelto)) return { modelloScelto: modifiche.modelloScelto, famiglia: famigliaDi(modifiche.modelloScelto) }
  if (modifiche.famiglia !== undefined) {
    const id = modelloDa(modifiche.famiglia)
    return { modelloScelto: id, famiglia: famigliaDi(id) }
  }
  return {}
}

/** il modello con cui è stata fatta un'opera della galleria (anche dai PNG vecchi): `Opera.modello` è
 *  «FLUX 3 Klein Base · file», «FLUX 3 Klein · file» o il file del denoiser di Qwen (Turbo compreso, che ora vale Qwen base) */
export function modelloDaOpera(o: { modello?: string | null } | null | undefined): IdModello {
  const m = (o?.modello || '').trim()
  if (/^FLUX 3 Klein Base\b/i.test(m)) return 'klein-base'
  if (/^FLUX 3 Klein\b/i.test(m)) return 'klein'
  return 'qwen-base'
}

/** quello che il modello mette nella Richiesta: famiglia, passi, niente Turbo (CFG e sampler di Klein li decide il motore) */
export function parametriModello(id: IdModello): { famiglia: Famiglia; passi: number; turbo: false } {
  const m = MODELLI[id]
  return { famiglia: m.famiglia, passi: m.passi, turbo: false }
}

/** «Rifai in qualità piena» (stesso seed, stesso prompt): da Klein veloce si va a Klein Base (il più vicino) o a Qwen base.
 *  I modelli già pieni non hanno niente sopra: lista vuota. */
export function inQualitaPiena(id: IdModello): IdModello[] {
  return MODELLI[id].veloce ? ['klein-base', 'qwen-base'] : []
}

/** le qualità salvate (localStorage, ricette tue, lavori vecchi): «turbo» non c'è più e diventa «alta» */
export function senzaTurbo<Q extends string>(q: Q | 'turbo'): Exclude<Q, 'turbo'> | 'alta' {
  return (q === 'turbo' ? 'alta' : q) as Exclude<Q, 'turbo'> | 'alta'
}

/** il denoiser era il Turbo GGUF (già distillato a 8 passi)? Per Qwen base serve quello pieno: lo stesso quant se c'è,
 *  se no il primo UC che c'è nella cartella (Q4, Q6, Q8). null = va bene così, o non c'è niente con cui sostituirlo. */
export function denoiserSenzaTurbo(file: string, presenti: string[]): string | null {
  if (!/turbo/i.test(file)) return null
  const pieni = presenti.filter((f) => /\.gguf$/i.test(f) && /qwen.?image/i.test(f) && !/turbo/i.test(f) && !/mmproj/i.test(f))
  if (!pieni.length) return null
  const quant = /(Q\d)/i.exec(file)?.[1]?.toUpperCase()
  const stesso = quant ? pieni.find((f) => f.toUpperCase().includes(quant)) : undefined
  if (stesso) return stesso
  return [...pieni].sort((a, b) => a.localeCompare(b))[0]
}
