// Il "regista": il modello guarda la foto e mescola le idee scelte (azioni rapide) in una sola istruzione di modifica,
// inventando lui i dettagli. Così le idee si sommano (notte + neve + anni '80…) e non sono più frasi fisse.
import { api } from './api'
import { richiestaBase } from './azioni'
import { foglioFoto } from './foglio'
import type { FotoBase } from './stato'
import type { Rapida } from './rapide'

export type Fantasia = 'fedele' | 'normale' | 'tanta'

export const FANTASIE: { id: Fantasia; nome: string; sotto: string }[] = [
  { id: 'fedele', nome: 'Fedele', sotto: 'poche invenzioni' },
  { id: 'normale', nome: 'Normale', sotto: 'dettagli suoi' },
  { id: 'tanta', nome: 'Tanta', sotto: 'osa di più' }
]

const SISTEMA_IDEE =
  'You are a creative director who writes edit instructions for an AI image-editing model. You see the user\'s photo (image 1; if there are more images, they are reference photos on a contact sheet). ' +
  'The user picked one or more IDEAS, each with a short hint of what it means, and may have written a note. Merge ALL the ideas into ONE coherent edit of the photo. ' +
  'Do not copy the hints literally: use them as inspiration. A "…" in a hint means you must invent that part yourself. ' +
  'Look at the photo and decide by yourself what must stay recognizable (the identity, face and body of people and animals, the main composition and framing) and what can change; do not write generic "keep everything the same" filler, say only what matters. ' +
  'When several ideas are given, make them work together in a way that feels intentional and visually striking (for example a time of day, a place and a style that fit each other), not a list of separate changes. ' +
  'If the user wrote a note, it has priority. If reference photos exist, bring from them what the ideas or the note ask, naming them with the tags <image2>, <image3>…; the photo itself is <image1>. ' +
  'Write ONE instruction in English, 60 to 120 words, starting with the edit of <image1>, with specific vivid details (colors, materials, objects, light, mood, style). Output only the instruction.'

const FANTASIA_TESTO: Record<Fantasia, string> = {
  fedele: 'Stay close to the plain meaning of the ideas; invent few details and change as little as possible beyond them.',
  normale: 'Invent the specific details yourself and make the result feel designed, but stay plausible for this photo.',
  tanta: 'Be bold and imaginative: surprising, specific and cinematic choices, an unexpected but fitting combination. Still keep the subject recognizable.'
}

const TEMPERATURA: Record<Fantasia, number> = { fedele: 0.35, normale: 0.85, tanta: 1.15 }

/** il piano: una istruzione sola che mescola le idee (e la nota) guardando la foto */
export async function pianificaIdee(o: { base: FotoBase; idee: Rapida[]; nota: string; riferimenti: FotoBase[]; fantasia: Fantasia; zona: boolean }): Promise<string> {
  const elenco = o.idee.map((r) => `- ${r.nome.replace('…', '')}: ${r.prompt.replace(/\s*Keep[^.]*\./g, '').replace(/…/g, '[invent this]')}`).join('\n')
  const n = o.riferimenti.length
  const richiesta = [
    `Ideas picked by the user:\n${elenco || '- (none)'}`,
    `User note: ${o.nota || '(none)'}`,
    n ? `The contact sheet has ${n + 1} photos: image 1 is the photo to edit, ${o.riferimenti.map((_, i) => `<image${i + 2}>`).join(', ')} ${n > 1 ? 'are references' : 'is a reference'}.` : '',
    o.zona ? 'The change will be applied only inside a region of the photo that the user selects: describe what that region should become, without mentioning where it is.' : '',
    FANTASIA_TESTO[o.fantasia]
  ].filter(Boolean).join('\n')
  const immagine = n ? (await foglioFoto([o.base, ...o.riferimenti], 'PHOTO (the base picture)')).percorso : o.base.percorso
  const seed = Math.floor(Math.random() * 2 ** 31)
  const t = (await api.testo.scrivi({ ...richiestaBase(), modalita: 'descrivi', prompt: richiesta, immagini: [immagine], sistema: SISTEMA_IDEE, maxToken: 320, temperatura: TEMPERATURA[o.fantasia], seed, etichetta: 'Mescolo le idee' })).trim().replace(/^["']+|["']+$/g, '')
  if (t) return t
  // senza risposta: le frasi delle idee una dopo l'altra
  return o.idee.map((r) => r.prompt.replace(/…/g, '')).join(' ') + (o.nota ? ' ' + o.nota : '')
}

/** le idee scelte come un'azione sola (LoRA, trasparenza, riferimenti, forza di tutte) */
export function unisciRapide(l: Rapida[]): Rapida | null {
  if (!l.length) return null
  if (l.length === 1) return l[0]
  const forze = l.map((r) => r.forza).filter((f): f is number => f !== undefined)
  const rif = Math.max(0, ...l.map((r) => r.rif || 0))
  return {
    id: l.map((r) => r.id).join('+'),
    nome: l.map((r) => r.nome.replace('…', '')).join(' + '),
    prompt: '',
    lora: [...new Set(l.flatMap((r) => r.lora || []))],
    trasparente: l.some((r) => r.trasparente),
    forza: forze.length ? Math.min(...forze) : undefined,
    rif: rif || undefined,
    rifNome: l.find((r) => r.rif)?.rifNome
  }
}
