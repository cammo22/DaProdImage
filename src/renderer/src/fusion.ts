// Fusion ed Esempio: come si costruisce la richiesta dalle foto e dal testo. Sta qui (e non in Modifica.tsx) per tenere la pagina leggera.
import { api } from './api'
import { perQualita, richiestaBase } from './azioni'
import { conMisura } from './componenti/Misura'
import { conParoleLora } from './componenti/SceltaLora'
import type { StatoModifica } from './stato'
import type { Richiesta } from '@shared/tipi'

/** le proporzioni della foto nuova di Fusion (senza `r`: come la prima foto) */
export const FORMATI_FUSION: { id: string; nome: string; r?: [number, number] }[] = [
  { id: 'prima', nome: 'Prima foto' },
  { id: '1:1', nome: '1:1', r: [1, 1] },
  { id: '4:5', nome: '4:5', r: [4, 5] },
  { id: '3:2', nome: '3:2', r: [3, 2] },
  { id: '16:9', nome: '16:9', r: [16, 9] },
  { id: '9:16', nome: '9:16', r: [9, 16] }
]

export type Esito = { q: Richiesta } | { errore: string }

/** Fusion: tutte le foto sono riferimenti, ne esce una immagine nuova in base al testo */
export function richiestaFusion(s: StatoModifica, turboPronto: boolean): Esito {
  if (!s.riferimenti.length) return { errore: 'Aggiungi almeno una foto' }
  if (!s.prompt.trim()) return { errore: 'Scrivi cosa deve nascere dalle foto (es. "la donna di <image1> con la giacca di <image2> in una strada di Tokyo di notte")' }
  if (s.qualita === 'turbo' && !turboPronto) return { errore: 'Per il Turbo scarica prima il suo LoRA (il pulsante sotto Qualità), o scegli Alta' }
  const mis = s.misura && s.misura.tipo === 'custom' ? s.misura : null
  const [a, b] = mis ? [mis.w, mis.h] : FORMATI_FUSION.find((f) => f.id === s.formatoFusion)?.r || [s.riferimenti[0].larghezza, s.riferimenti[0].altezza]
  const px = s.mp * 1048576
  const t = (x: number): number => Math.max(256, Math.round(x / 32) * 32)
  const w = t(Math.sqrt(px * (a / b)))
  const h = t(Math.sqrt(px / (a / b)))
  return {
    q: {
      ...richiestaBase(),
      modalita: 'crea',
      prompt: conParoleLora(s.prompt.trim()),
      larghezza: w,
      altezza: h,
      megapixel: (w * h) / 1048576,
      immagini: s.riferimenti.map((r) => r.percorso),
      ...perQualita(s.qualita),
      quante: s.quante,
      etichetta: 'Fusion · ' + s.prompt.trim().slice(0, 50),
      // la misura esatta scelta: il modello lavora ai megapixel, poi il motore porta l'immagine a quella misura
      ...(mis ? { uscita: { w: mis.w, h: mis.h } } : {})
    }
  }
}

/** cosa si può tenere dell'esempio: l'etichetta per te, la frase per il modello */
export const TIENI_ESEMPIO: { id: string; nome: string; en: string }[] = [
  { id: 'posa', nome: 'Posa', en: 'the exact pose, gesture and body position of the people' },
  { id: 'inquadratura', nome: 'Inquadratura', en: 'the framing, crop, distance and camera angle' },
  { id: 'sfondo', nome: 'Sfondo', en: 'the background and the place' },
  { id: 'luce', nome: 'Luce e colori', en: 'the lighting, the color grading and the mood' },
  { id: 'vestiti', nome: 'Vestiti', en: 'the clothes and accessories' }
]

const SISTEMA_ESEMPIO =
  'You look at a photo that will be used as a template. Describe it in one English paragraph of at most 80 words: how many people or subjects, what each one does (pose, gesture, where they look), the framing and camera angle, the background and place, the light and colors. Facts only, no opinions, no names.'

/** la descrizione dell'esempio si fa una volta sola per foto */
const descrizioni = new Map<string, string>()

async function descriviEsempio(percorso: string): Promise<string> {
  const gia = descrizioni.get(percorso)
  if (gia) return gia
  const t = (await api.testo.scrivi({ ...richiestaBase(), modalita: 'descrivi', prompt: 'Describe this photo.', immagini: [percorso], sistema: SISTEMA_ESEMPIO, maxToken: 200, temperatura: 0.2, seed: 3, etichetta: 'Guardo l\'esempio' })).trim()
  if (t) descrizioni.set(percorso, t)
  return t
}

/** Esempio: il modello rifà la foto d'esempio (<image1>) con le persone/oggetti dei riferimenti (<image2>…).
 *  L'esempio è il bersaglio: resta com'è (a parte quello che scegli di non tenere) e cambiano solo i soggetti. */
export async function richiestaEsempio(s: StatoModifica, turboPronto: boolean): Promise<Esito> {
  if (!s.esempio) return { errore: 'Metti la foto di esempio: com\'è il risultato che vuoi' }
  if (!s.riferimenti.length) return { errore: 'Aggiungi almeno una foto di riferimento (la persona o l\'oggetto da usare)' }
  if (s.qualita === 'turbo' && !turboPronto) return { errore: 'Per il Turbo scarica prima il suo LoRA (il pulsante sotto Qualità), o scegli Alta' }
  const tag = s.riferimenti.map((_, i) => `<image${i + 2}>`)
  const lista = tag.length > 1 ? `${tag.slice(0, -1).join(', ')} and ${tag[tag.length - 1]}` : tag[0]
  const tieni = TIENI_ESEMPIO.filter((t) => s.esempioTieni.includes(t.id))
  const tieniVestiti = s.esempioTieni.includes('vestiti')
  let descr = ''
  if (s.esempioDescrivi) {
    try {
      descr = await descriviEsempio(s.esempio.percorso)
    } catch {
      /* senza descrizione si va avanti lo stesso */
    }
  }
  const note = s.prompt.trim()
  const parti = [
    'Edit the photo <image1>: it is the TARGET and it stays the same, except for who is in it.',
    tieni.length ? `Keep EXACTLY from <image1>: ${tieni.map((t) => t.en).join('; ')}. Do not change them.` : '',
    `Replace the person (or the main subject) of <image1> with the person (or subject) shown in ${lista}: reproduce their face, hair, skin tone and body faithfully, so that they are clearly recognizable, and never keep the face of the original person.`,
    tieniVestiti ? 'They wear the clothes of <image1>.' : `They wear the clothes shown in ${lista}.`,
    descr ? `For reference, <image1> shows: ${descr}` : '',
    note
  ]
  return {
    q: {
      ...richiestaBase(),
      modalita: 'modifica',
      prompt: conParoleLora(parti.filter(Boolean).join(' ')),
      immagini: [s.esempio.percorso, ...s.riferimenti.map((r) => r.percorso)],
      megapixel: s.mp,
      ...perQualita(s.qualita),
      quante: s.quante,
      etichetta: 'Esempio · ' + (note.slice(0, 50) || 'come l\'esempio'),
      ...conMisura(s.misura, s.esempio)
    }
  }
}
