// Le azioni che servono a più pagine: costruire le richieste, aprire una foto in Modifica, rifinire, variare.
import { modelloTurbo } from '@shared/tipi'
import type { Opera, Richiesta } from '@shared/tipi'
import { api } from './api'
import { PASSI_QUALITA, usaStato, type FotoBase, type Qualita } from './stato'
import { dimensioniRis } from './util'
import type { ChiaveLora } from './rapide'

/** il passo "Sorpresa" di ogni ricetta: il modello inventa una variazione nuova, nello stesso stile di quelle che ci sono */
export const SISTEMA_SORPRESA =
  'You write prompts for the Qwen-Image 2.1 image model. You are given the name and description of a recipe (a series of variations of one idea) and example prompts of some of its variations. Invent ONE brand-new variation that is very different from the examples: creative, specific and surprising. Follow exactly the same structure, wording style and constraints as the examples, including every reference tag like <image1> and any instruction to keep things identical, but with a new subject, idea or style of your own choice. Never repeat an example. Output only the prompt, in English, as one paragraph.'

export const SISTEMA_MIGLIORA =
  "You are an expert prompt writer for the Qwen-Image 2.1 text-to-image model. Rewrite the user's request (it may be in Italian or any language) as one rich English paragraph of 80-160 words describing the finished image: the main subject and its details, action, setting and background, composition and framing, lighting, color palette, style or medium, and mood. Keep every element, count, color, position and constraint the user gave. Any text that must appear in the image goes inside double quotes, in its original language. No quality tags such as 8K or masterpiece. Output only the paragraph."

export const SISTEMA_MIGLIORA_MODIFICA =
  "You are an expert at writing edit instructions for the Qwen-Image 2.1 image editing model. Look at the image and rewrite the user's edit request (it may be in Italian or any language) as one clear, specific English instruction of at most 60 words: say exactly what to change and how it should look, and state that everything else stays unchanged. Keep references like <image2> exactly as written. Output only the instruction."

export const SISTEMA_DESCRIVI =
  'Describe this image as a prompt for a text-to-image model: one English paragraph of 100-150 words covering subject, details, setting, composition, lighting, colors, style and mood. Output only the paragraph.'

export function richiestaBase(): Richiesta {
  const { imp, loraAttive } = usaStato.getState()
  const d = imp?.predefiniti || { passi: 40, cfg: 1, sampler: 'euler', scheduler: 'simple', megapixel: 1 }
  return {
    modalita: 'crea',
    prompt: '',
    negativo: '',
    seed: -1,
    passi: d.passi,
    cfg: d.cfg,
    sampler: d.sampler,
    scheduler: d.scheduler,
    larghezza: 1024,
    altezza: 1024,
    megapixel: d.megapixel,
    immagini: [],
    lora: loraAttive.filter((l) => l.forza !== 0),
    quante: 1
  }
}

/** il LoRA Turbo è fra i LoRA? */
export function turboPresente(): boolean {
  const { imp, lore } = usaStato.getState()
  if (imp && modelloTurbo(imp.modello)) return true
  return !!imp?.loraTurbo && lore.some((l) => l.file === imp.loraTurbo)
}

/** passi (e Turbo) per una qualità; il Turbo vuole CFG 1, euler, simple */
export function perQualita(q: Qualita): Pick<Richiesta, 'passi' | 'turbo'> & Partial<Pick<Richiesta, 'cfg' | 'sampler' | 'scheduler'>> {
  if (q === 'turbo') return { passi: PASSI_QUALITA.turbo, turbo: true, cfg: 1, sampler: 'euler', scheduler: 'simple' }
  return { passi: PASSI_QUALITA[q], turbo: false }
}

/** la qualità per i lavori "di servizio" (rifinisci, varia): Turbo se è acceso in Crea */
const qualitaServizio = (): Qualita => (usaStato.getState().crea.qualita === 'turbo' && turboPresente() ? 'turbo' : 'alta')

export const fotoDaOpera = (o: Opera): FotoBase => ({ percorso: o.file, larghezza: o.larghezza, altezza: o.altezza, operaId: o.id, prompt: o.prompt })

export function apriInModifica(f: FotoBase): void {
  const s = usaStato.getState()
  s.setModifica({ base: f, versioni: [f] })
  s.apriVisore(null)
  s.vai('modifica')
}

async function accoda(q: Richiesta, messaggio: string): Promise<void> {
  try {
    await api.lavori.accoda(q)
    usaStato.getState().avvisa(messaggio, 'ok')
  } catch (e) {
    usaStato.getState().avvisa((e as Error).message, 'errore')
  }
}

/** Rifinisci: ingrandisce e ridisegna i dettagli (le bozze tornano alla grandezza scelta in Crea) */
export function rifinisci(o: Opera, fattore?: number, forza?: number): Promise<void> {
  const { crea } = usaStato.getState()
  const mp = (o.larghezza * o.altezza) / 1048576
  const bozza = o.etichetta === 'Bozza'
  const d = dimensioniRis(crea.formato, crea.ris)
  const scelta = (d.w * d.h) / 1048576
  const f = fattore ?? (bozza ? Math.max(1, Math.sqrt(scelta / mp)) : Math.min(2, Math.sqrt(4.2 / mp)))
  return accoda(
    {
      ...richiestaBase(),
      modalita: 'rifinisci',
      prompt: o.prompt,
      negativo: o.negativo,
      seed: o.seed,
      lora: o.lora.length ? o.lora : richiestaBase().lora,
      immagini: [o.file],
      fattore: f,
      forza: forza ?? (bozza ? 0.55 : 0.35),
      ...perQualita(qualitaServizio()),
      trasparente: o.trasparente,
      origine: o.id,
      etichetta: bozza ? 'Rifinita' : `Rifinita ×${f.toFixed(1)}`
    },
    'Rifinitura in coda'
  )
}

export function varia(o: Opera, forza = 0.6, quante = 2): Promise<void> {
  return accoda(
    {
      ...richiestaBase(),
      modalita: 'varia',
      prompt: o.prompt,
      negativo: o.negativo,
      lora: o.lora.length ? o.lora : richiestaBase().lora,
      immagini: [o.file],
      forza,
      quante,
      ...perQualita(qualitaServizio()),
      trasparente: o.trasparente,
      origine: o.id,
      etichetta: 'Variazione'
    },
    quante > 1 ? `${quante} variazioni in coda` : 'Variazione in coda'
  )
}

export function ingrandisci(o: Opera, fattore = 2): Promise<void> {
  return accoda(
    { ...richiestaBase(), modalita: 'ingrandisci', prompt: o.prompt, immagini: [o.file], fattore, origine: o.id, etichetta: `Ingrandita ×${fattore}`, seed: o.seed },
    'Ingrandimento in coda'
  )
}

/** Riusa: rimette prompt, seed e LoRA dell'opera nella pagina Crea */
export function riusa(o: Opera): void {
  const s = usaStato.getState()
  s.setCrea({ prompt: o.prompt, negativo: o.negativo, seed: o.seed, casuale: false, cfg: o.cfg, sampler: o.sampler, scheduler: o.scheduler, trasparente: !!o.trasparente })
  if (o.lora?.length) s.setLoraAttive(o.lora.filter((l) => s.lore.some((x) => x.file === l.file)))
  s.apriVisore(null)
  s.vai('crea')
  s.avvisa('Impostazioni rimesse in Crea (seed fisso)', 'ok')
}

const FILE_LORA: Record<Exclude<ChiaveLora, 'camera'>, string> = {
  coerenza: 'qwen-image-2.1-consistency.safetensors',
  vestiti: 'qwen-image-2.1-outfit-swap.safetensors'
}

/** il file del LoRA delle angolazioni (akhaliq, "Multiple Angles"), se è fra i LoRA */
export function fileLoraCamera(): string | undefined {
  return usaStato.getState().lore.find((l) => /multiple-angles/i.test(l.fonte || '') || /multiple.?angles|(^|[-_.])mva([-_.]|$)/i.test(l.file))?.file
}

/** i LoRA che un'azione rapida accende da sola, se ci sono nella cartella (se no si va col modello da solo) */
export function loraPer(chiavi: ChiaveLora[] | undefined): { file: string; forza: number }[] {
  const { lore } = usaStato.getState()
  const out: { file: string; forza: number }[] = []
  for (const k of chiavi || []) {
    const file = k === 'camera' ? fileLoraCamera() : FILE_LORA[k]
    if (file && lore.some((l) => l.file === file) && !out.some((o) => o.file === file)) out.push({ file, forza: k === 'camera' ? 0.9 : 1 })
  }
  return out
}
