// Fusion ed Esempio: come si costruisce la richiesta dalle foto e dal testo. Sta qui (e non in Modifica.tsx) per tenere la pagina leggera.
import { api } from './api'
import { foglioFoto, riquadroNellaFoto, ritagliaFoto } from './foglio'
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
      potenzia: true,
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

const SISTEMA_PIANO =
  'You write edit instructions for an AI image-editing model. You see ONE contact sheet that contains numbered photos: image 1 is the EXAMPLE (the picture that is the base and must stay), the other images (image 2, 3…) are REFERENCES: things the user wants to bring into the example. ' +
  'Decide for yourself, by looking, what in image 1 must be replaced or changed using which reference, and what must stay exactly as it is. This works for anything: people, faces, clothes, objects, parts of a body such as eyes or irises, products, logos, textures, styles, backgrounds, animals, food. ' +
  'If a reference is the same kind of thing as something in image 1, replace those things one by one with the references, matching which goes where by position, size or similarity; if there are more things than references, reuse or choose the most visible. If the user wrote a note, follow it. If there is no note, infer the most natural intent: recreate image 1 with what the references show. ' +
  'COLORS AND DETAILS MATTER MOST: for each thing taken from a reference, write its exact visual attributes in words, looking carefully at the reference: precise color names and their distribution (for example "warm amber orange iris with a dark brown outer ring and fine radial streaks, black pupil"), pattern, texture, shape, material. The editing model follows the words, so they must be accurate. ' +
  'Answer with ONE JSON object and nothing else: {"instruction": "...", "crops": [{"image": 3, "box": [x1, y1, x2, y2]}]}. ' +
  '"instruction": ONE precise English instruction, at most 110 words: start with the edit of <image1>, say exactly what is replaced by what from <image2>, <image3>…, including the attribute words, say to copy the reference faithfully, and say that everything else in <image1> (composition, pose, framing, light, background, every other detail) stays identical. Name images only with the tags <image1>, <image2>… ' +
  '"crops": for every reference where only a PART matters (for example the iris inside a photo of a whole eye, one garment in a photo of a person), the box of that part on the contact sheet, integers 0-1000 relative to the whole contact sheet (x1,y1 top-left, x2,y2 bottom-right), tight around that part. If the whole reference matters, leave it out of the list.'

const trim = (t: string): string => t.trim().replace(/^["']+|["']+$/g, '')

/** legge la risposta del piano: JSON con istruzione e ritagli (tollera fence e testo attorno); se non è JSON, tutto il testo è l'istruzione */
export function leggiPiano(t: string): { istruzione: string; ritagli: { image: number; box: number[] }[] } {
  const m = t.match(/\{[\s\S]*\}/)
  if (m) {
    try {
      const j = JSON.parse(m[0]) as { instruction?: string; crops?: { image?: number; box?: number[] }[] }
      if (typeof j.instruction === 'string' && j.instruction.trim()) {
        const ritagli = (j.crops || []).filter((c): c is { image: number; box: number[] } => Number.isInteger(c.image) && Array.isArray(c.box) && c.box.length === 4 && c.box.every((v) => Number.isFinite(v)))
        return { istruzione: trim(j.instruction), ritagli }
      }
    } catch {
      /* si cade sul resto */
    }
  }
  // JSON rotto o tagliato: almeno l'istruzione, se si trova
  const i = t.match(/"instruction"\s*:\s*"((?:[^"\\]|\\.)*)"/)
  if (i) return { istruzione: trim(i[1].replace(/\\"/g, '"')), ritagli: [] }
  return { istruzione: trim(t.replace(/^```\w*|```$/g, '')), ritagli: [] }
}

/** cosa si è guardato per fare il piano: se cambia una foto o la nota, il piano si rifà */
export const chiaveEsempio = (s: StatoModifica): string => JSON.stringify([s.esempio?.percorso, s.riferimenti.map((r) => r.percorso), s.prompt.trim()])

/** il piano: il modello guarda l'esempio e le tue foto insieme, e decide da solo cosa sostituire con cosa, in qualsiasi caso;
 *  per ogni riferimento di cui conta solo una parte (l'iride in una foto di un occhio) fa anche il ritaglio, così si vede meglio */
export async function pianificaEsempio(s: StatoModifica): Promise<{ testo: string; ritagli: (string | null)[] }> {
  const n = s.riferimenti.length
  const tag = s.riferimenti.map((_, i) => `<image${i + 2}>`).join(', ')
  const foglio = await foglioFoto([s.esempio!, ...s.riferimenti], 'EXAMPLE (the base picture)')
  const richiesta = `The contact sheet has ${n + 1} photos: image 1 is the example, ${tag} ${n > 1 ? 'are the references' : 'is the reference'}.\nUser note: ${s.prompt.trim() || '(none: decide what is the most natural thing to do)'}`
  const t = await api.testo.scrivi({ ...richiestaBase(), modalita: 'descrivi', prompt: richiesta, immagini: [foglio.percorso], sistema: SISTEMA_PIANO, maxToken: 420, temperatura: 0.3, seed: 11, etichetta: 'Pianifico la modifica' })
  const p = leggiPiano(t || '')
  const ritagli: (string | null)[] = s.riferimenti.map(() => null)
  for (const c of p.ritagli) {
    const k = c.image - 1
    if (k < 1 || k > n) continue
    try {
      const box = riquadroNellaFoto(foglio, k, c.box)
      if (box) ritagli[k - 1] = await ritagliaFoto(s.riferimenti[k - 1].percorso, box, 0.12)
    } catch {
      /* senza ritaglio si usa la foto intera */
    }
  }
  // se il modello non risponde, un'istruzione generica che vale per tutto
  const testo = p.istruzione || `Edit <image1>: replace the main subject (or the elements of the same kind) with the ones shown in ${tag || '<image2>'}, copying them faithfully in color, shape, texture and detail. Keep everything else in <image1> exactly the same.`
  return { testo, ritagli }
}

/** Esempio: l'esempio è la base (`image_1`), le altre foto sono i riferimenti (ritagliati se serviva); l'istruzione è il piano del modello (o quello che hai corretto) */
export function richiestaEsempio(s: StatoModifica, turboPronto: boolean, piano: { testo: string; ritagli?: (string | null)[] }): Esito {
  if (!s.esempio) return { errore: 'Metti la foto di esempio: com\'è il risultato che vuoi' }
  if (!s.riferimenti.length) return { errore: 'Aggiungi almeno una foto di riferimento (quello che vuoi portare nell\'esempio)' }
  if (s.qualita === 'turbo' && !turboPronto) return { errore: 'Per il Turbo scarica prima il suo LoRA (il pulsante sotto Qualità), o scegli Alta' }
  return {
    q: {
      ...richiestaBase(),
      modalita: 'modifica',
      prompt: conParoleLora(piano.testo.trim()),
      immagini: [s.esempio.percorso, ...s.riferimenti.map((r, i) => piano.ritagli?.[i] || r.percorso)],
      megapixel: s.mp,
      ...perQualita(s.qualita),
      quante: s.quante,
      etichetta: 'Esempio · ' + (s.prompt.trim().slice(0, 50) || 'come l\'esempio'),
      ...conMisura(s.misura, s.esempio)
    }
  }
}
