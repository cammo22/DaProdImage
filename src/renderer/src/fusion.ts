// Fusion ed Esempio: come si costruisce la richiesta dalle foto e dal testo. Sta qui (e non in Modifica.tsx) per tenere la pagina leggera.
import { api, urlFile } from './api'
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

const SISTEMA_PIANO =
  'You write edit instructions for an AI image-editing model. You see ONE contact sheet that contains numbered photos: image 1 is the EXAMPLE (the picture that is the base and must stay), the other images (image 2, 3…) are REFERENCES: things the user wants to bring into the example. ' +
  'Decide for yourself, by looking, what in image 1 must be replaced or changed using which reference, and what must stay exactly as it is. This works for anything: people, faces, clothes, objects, parts of a body such as eyes or irises, products, logos, textures, styles, backgrounds, animals, food. ' +
  'If a reference is the same kind of thing as something in image 1, replace those things one by one with the references, matching which goes where by position, size or similarity; if there are more things than references, reuse or choose the most visible. If the user wrote a note, follow it. If there is no note, infer the most natural intent: recreate image 1 with what the references show. ' +
  'Write ONE precise instruction in English, at most 100 words: start with the edit of <image1>, say exactly what is replaced by what from <image2>, <image3>…, say to copy the reference faithfully (colors, patterns, texture, shape, details, identity), and say that everything else in <image1> (composition, pose, framing, light, background, every other detail) stays identical. Name images only with the tags <image1>, <image2>… Output only the instruction.'

const trim = (t: string): string => t.trim().replace(/^["']+|["']+$/g, '')

function caricaImg(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => ok(im)
    im.onerror = () => ko(new Error('non riesco ad aprire una foto'))
    im.src = src
  })
}

/** un foglio solo con tutte le foto numerate (l'esempio per primo): il modello le guarda insieme e sa quale è quale */
async function foglioFoto(foto: { percorso: string }[]): Promise<string> {
  const cella = 640
  const barra = 38
  const colonne = Math.min(3, foto.length)
  const righe = Math.ceil(foto.length / colonne)
  const c = document.createElement('canvas')
  c.width = colonne * cella
  c.height = righe * (cella + barra)
  const g = c.getContext('2d')!
  g.fillStyle = '#101014'
  g.fillRect(0, 0, c.width, c.height)
  g.imageSmoothingQuality = 'high'
  for (let i = 0; i < foto.length; i++) {
    const x = (i % colonne) * cella
    const y = Math.floor(i / colonne) * (cella + barra)
    const im = await caricaImg(urlFile(foto[i].percorso))
    const s = Math.min(cella / im.naturalWidth, cella / im.naturalHeight)
    const w = im.naturalWidth * s
    const h = im.naturalHeight * s
    g.drawImage(im, x + (cella - w) / 2, y + barra + (cella - h) / 2, w, h)
    g.fillStyle = i === 0 ? '#ffd54a' : '#5ec8ff'
    g.fillRect(x, y, cella, barra)
    g.fillStyle = '#101014'
    g.font = '700 22px sans-serif'
    g.textBaseline = 'middle'
    g.fillText(i === 0 ? 'image 1 - EXAMPLE (the base picture)' : `image ${i + 1} - reference`, x + 12, y + barra / 2)
    g.strokeStyle = '#101014'
    g.lineWidth = 3
    g.strokeRect(x, y, cella, cella + barra)
  }
  return api.file.salvaTemp(c.toDataURL('image/jpeg', 0.92))
}

/** cosa si è guardato per fare il piano: se cambia una foto o la nota, il piano si rifà */
export const chiaveEsempio = (s: StatoModifica): string => JSON.stringify([s.esempio?.percorso, s.riferimenti.map((r) => r.percorso), s.prompt.trim()])

/** il piano: il modello guarda l'esempio e le tue foto insieme, e decide da solo cosa va sostituito con cosa, in qualsiasi caso */
export async function pianificaEsempio(s: StatoModifica): Promise<string> {
  const n = s.riferimenti.length
  const tag = s.riferimenti.map((_, i) => `<image${i + 2}>`).join(', ')
  const foglio = await foglioFoto([s.esempio!, ...s.riferimenti])
  const richiesta = `The contact sheet has ${n + 1} photos: image 1 is the example, ${tag} ${n > 1 ? 'are the references' : 'is the reference'}.\nUser note: ${s.prompt.trim() || '(none: decide what is the most natural thing to do)'}`
  const t = trim(await api.testo.scrivi({ ...richiestaBase(), modalita: 'descrivi', prompt: richiesta, immagini: [foglio], sistema: SISTEMA_PIANO, maxToken: 280, temperatura: 0.3, seed: 11, etichetta: 'Pianifico la modifica' }))
  // se il modello non risponde, un'istruzione generica che vale per tutto
  return t || `Edit <image1>: replace the main subject (or the elements of the same kind) with the ones shown in ${tag || '<image2>'}, copying them faithfully in color, shape, texture and detail. Keep everything else in <image1> exactly the same.`
}

/** Esempio: l'esempio è la base (`image_1`), le altre foto sono i riferimenti; l'istruzione è il piano del modello (o quello che hai corretto) */
export function richiestaEsempio(s: StatoModifica, turboPronto: boolean, piano: string): Esito {
  if (!s.esempio) return { errore: 'Metti la foto di esempio: com\'è il risultato che vuoi' }
  if (!s.riferimenti.length) return { errore: 'Aggiungi almeno una foto di riferimento (quello che vuoi portare nell\'esempio)' }
  if (s.qualita === 'turbo' && !turboPronto) return { errore: 'Per il Turbo scarica prima il suo LoRA (il pulsante sotto Qualità), o scegli Alta' }
  return {
    q: {
      ...richiestaBase(),
      modalita: 'modifica',
      prompt: conParoleLora(piano.trim()),
      immagini: [s.esempio.percorso, ...s.riferimenti.map((r) => r.percorso)],
      megapixel: s.mp,
      ...perQualita(s.qualita),
      quante: s.quante,
      etichetta: 'Esempio · ' + (s.prompt.trim().slice(0, 50) || 'come l\'esempio'),
      ...conMisura(s.misura, s.esempio)
    }
  }
}
