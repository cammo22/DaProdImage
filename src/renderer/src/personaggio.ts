// Personaggio: da una foto con più persone ne scegli una (il modello le trova, o le riquadri tu), la estrai a figura intera
// (T-pose, A-pose, in piedi…) su sfondo pulito, e poi muovi la camera attorno a lei: una vista sola o il giro completo.
// Qui sta lo stato (le persone trovate, i risultati) e come si costruiscono le richieste; l'interfaccia è in componenti/Personaggio.tsx.
import { create } from 'zustand'
import { api, urlFile } from './api'
import { ascoltatoriLavoro, usaStato, type FotoBase, type Qualita } from './stato'
import { fileLoraCamera, loraPer, perQualita, richiestaBase } from './azioni'
import { componiCamera, conLora, type PosizioneCamera } from './componenti/Camera'
import type { Opera, Richiesta } from '@shared/tipi'
import { leggiPersone, type Persona } from './riquadri'
import { descriviPosa, posaDi, type Posa } from './omino'
import { immagineOmino } from './ominoImmagine'

export type { Persona }

export interface Risultato {
  opera: Opera
  tipo: 'estratto' | 'vista'
  etichetta: string
}

interface StatoPersonaggio {
  /** la foto a cui si riferiscono le persone */
  foto: string | null
  persone: Persona[]
  scelta: string | null
  cercando: boolean
  ris: Risultato[]
  /** il risultato su cui lavora la camera */
  sorgente: string | null
  posa: PosaId
  sfondo: SfondoId
  formato: FormatoId
  nota: string
  camera: PosizioneCamera
  /** la posa disegnata con l'omino */
  omino: Posa
}

export const usaPersonaggio = create<StatoPersonaggio>(() => ({
  foto: null, persone: [], scelta: null, cercando: false, ris: [], sorgente: null,
  posa: 'tpose', sfondo: 'bianco', formato: 'verticale', nota: '', camera: { az: 45, el: 0, dist: 0 }, omino: posaDi('t')
}))

export const impostaPersonaggio = (p: Partial<StatoPersonaggio>): void => usaPersonaggio.setState(p)

// ---------------------------------------------------------------------------------------------------------------
// le scelte
// ---------------------------------------------------------------------------------------------------------------
export type PosaId = 'tpose' | 'apose' | 'piedi' | 'come' | 'omino'
export const POSE_ESTRAI: { id: PosaId; nome: string; sotto: string; testo: string }[] = [
  { id: 'tpose', nome: 'T-pose', sotto: 'braccia aperte', testo: 'Pose: a perfect T-pose, standing straight and facing the camera, legs slightly apart, arms stretched out horizontally to the sides at shoulder height, palms down.' },
  { id: 'apose', nome: 'A-pose', sotto: 'braccia un po\' scostate', testo: 'Pose: an A-pose, standing straight and facing the camera, arms relaxed and slightly away from the body, legs slightly apart.' },
  { id: 'piedi', nome: 'In piedi', sotto: 'dritto, a riposo', testo: 'Pose: standing straight and facing the camera in a neutral relaxed stance, arms along the body.' },
  { id: 'omino', nome: 'Disegnata', sotto: 'con l\'omino', testo: '' },
  { id: 'come', nome: 'Come nella foto', sotto: 'completa il corpo', testo: 'Pose: keep the pose of the person in <image1> as it is, and complete the body if some part is cut off or hidden, so the whole figure is visible.' }
]

export type SfondoId = 'bianco' | 'grigio' | 'trasparente' | 'foto'
export const SFONDI_ESTRAI: { id: SfondoId; nome: string; testo: string }[] = [
  { id: 'bianco', nome: 'Bianco', testo: 'Plain pure white studio background, soft contact shadow on the floor only.' },
  { id: 'grigio', nome: 'Grigio studio', testo: 'Plain neutral light gray studio background, soft contact shadow on the floor only.' },
  { id: 'trasparente', nome: 'Trasparente', testo: 'Isolated on a plain background with clean, sharp edges, no floor, no shadow.' },
  { id: 'foto', nome: 'Come la foto', testo: 'Keep a background similar to the one behind the person in <image1>.' }
]

export type FormatoId = 'verticale' | 'alto' | 'quadrato'
export const FORMATI_PERSONAGGIO: { id: FormatoId; nome: string; sotto: string; r: [number, number] }[] = [
  { id: 'verticale', nome: '3:4', sotto: 'figura intera', r: [3, 4] },
  { id: 'alto', nome: '2:3', sotto: 'più alta', r: [2, 3] },
  { id: 'quadrato', nome: '1:1', sotto: 'T-pose larga', r: [1, 1] }
]

/** le viste del giro: la camera gira attorno alla persona (stesso comando Camera) */
export const VISTE_GIRO: { nome: string; c: PosizioneCamera }[] = [
  { nome: 'Davanti', c: { az: 0, el: 0, dist: 0 } },
  { nome: '¾ destra', c: { az: 45, el: 0, dist: 0 } },
  { nome: 'Lato destro', c: { az: 90, el: 0, dist: 0 } },
  { nome: 'Dietro ¾ destra', c: { az: 135, el: 0, dist: 0 } },
  { nome: 'Dietro', c: { az: 180, el: 0, dist: 0 } },
  { nome: 'Dietro ¾ sinistra', c: { az: -135, el: 0, dist: 0 } },
  { nome: 'Lato sinistro', c: { az: -90, el: 0, dist: 0 } },
  { nome: '¾ sinistra', c: { az: -45, el: 0, dist: 0 } }
]
/** il giro "da foglio personaggio": davanti, ¾, lato, dietro */
export const VISTE_CLASSICHE = ['Davanti', '¾ destra', 'Lato destro', 'Dietro']

// ---------------------------------------------------------------------------------------------------------------
// trovare le persone
// ---------------------------------------------------------------------------------------------------------------
const SISTEMA_PERSONE =
  'You are an object detector. Find EVERY real person visible in the image (full or partial, including small ones in the background; ignore people printed on posters or screens). Output ONLY a JSON array, one item per person, ordered from left to right: [{"bbox_2d":[x1,y1,x2,y2],"label":"short English description: man/woman/child, clothes and colors, position"}]. Coordinates are integers from 0 to 1000, relative to the image width and height (x1,y1 = top-left corner, x2,y2 = bottom-right corner); the box must contain the whole visible body of that person. No other text.'

export async function trovaPersone(foto: FotoBase): Promise<void> {
  impostaPersonaggio({ cercando: true, foto: foto.percorso, persone: [], scelta: null })
  try {
    const t = await api.testo.scrivi({
      ...richiestaBase(), modalita: 'descrivi', prompt: 'Detect all the people in this image.', immagini: [foto.percorso],
      sistema: SISTEMA_PERSONE, maxToken: 700, temperatura: 0.1, seed: 7, etichetta: 'Trovo le persone'
    })
    const persone = leggiPersone(t || '', foto.larghezza, foto.altezza)
    if (usaPersonaggio.getState().foto !== foto.percorso) return
    impostaPersonaggio({ persone, scelta: persone.length === 1 ? persone[0].id : null })
    if (!persone.length) usaStato.getState().avvisa('Non vedo persone: riquadrale tu trascinando sulla foto', 'info')
  } catch (e) {
    usaStato.getState().avvisa((e as Error).message, 'errore')
  } finally {
    impostaPersonaggio({ cercando: false })
  }
}

// ---------------------------------------------------------------------------------------------------------------
// le richieste
// ---------------------------------------------------------------------------------------------------------------
function carica(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => ok(im)
    im.onerror = () => ko(new Error('non riesco ad aprire la foto'))
    im.src = src
  })
}

/** il ritaglio attorno alla persona (con un po' di aria), salvato come foto temporanea */
async function ritaglia(foto: FotoBase, box: [number, number, number, number]): Promise<string> {
  const im = await carica(urlFile(foto.percorso))
  const W = im.naturalWidth
  const H = im.naturalHeight
  const bw = (box[2] - box[0]) * W
  const bh = (box[3] - box[1]) * H
  const m = 0.12
  const x1 = Math.max(0, Math.floor(box[0] * W - bw * m))
  const y1 = Math.max(0, Math.floor(box[1] * H - bh * m))
  const x2 = Math.min(W, Math.ceil(box[2] * W + bw * m))
  const y2 = Math.min(H, Math.ceil(box[3] * H + bh * m))
  const s = Math.min(1, 1536 / Math.max(x2 - x1, y2 - y1))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round((x2 - x1) * s))
  c.height = Math.max(1, Math.round((y2 - y1) * s))
  const g = c.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.drawImage(im, x1, y1, x2 - x1, y2 - y1, 0, 0, c.width, c.height)
  return api.file.salvaTemp(c.toDataURL('image/png'))
}

const m32 = (x: number): number => Math.max(256, Math.round(x / 32) * 32)

/** estrae la persona scelta: figura intera nella posa scelta, su sfondo pulito */
export async function richiestaEstrai(foto: FotoBase, p: Persona, o: { qualita: Qualita; mp: number; quante: number }): Promise<Richiesta> {
  const s = usaPersonaggio.getState()
  const posa = POSE_ESTRAI.find((x) => x.id === s.posa) || POSE_ESTRAI[0]
  const sfondo = SFONDI_ESTRAI.find((x) => x.id === s.sfondo) || SFONDI_ESTRAI[0]
  const [a, b] = (FORMATI_PERSONAGGIO.find((f) => f.id === s.formato) || FORMATI_PERSONAGGIO[0]).r
  const px = o.mp * 1048576
  const w = m32(Math.sqrt(px * (a / b)))
  const h = m32(Math.sqrt(px / (a / b)))
  const ritaglio = await ritaglia(foto, p.box)
  const chi = p.nome ? ` (${p.nome.replace(/["<>]/g, '')})` : ''
  // con l'omino la posa si dà come immagine (mappa di posa) più la descrizione a parole
  const conOmino = s.posa === 'omino'
  const scheletro = conOmino ? await immagineOmino(s.omino, w, h) : null
  const testoPosa = conOmino
    ? `Pose: make the person take EXACTLY the pose shown by the pose guide in <image2> (colored lines are the limbs, dots are the joints, the thin colored lines are the fingers of each hand). Copy the position of every arm, leg, hand and finger exactly. The guide is only a reference for the pose: never draw its lines or dots. ${descriviPosa(s.omino)}`
    : posa.testo
  const prompt = [
    `Full-body character reference of the person shown in <image1>${chi}: only that one person, the one at the center of <image1>; ignore anyone else visible at the edges.`,
    'Keep exactly the same identity, face, hair, skin tone, body build and clothes, with every detail, pattern and color.',
    testoPosa,
    'Show the entire body from head to feet, centered, with nothing cropped.',
    sfondo.testo,
    s.nota.trim()
  ].filter(Boolean).join(' ')
  return {
    ...richiestaBase(),
    modalita: 'crea',
    prompt,
    larghezza: w,
    altezza: h,
    megapixel: (w * h) / 1048576,
    immagini: scheletro ? [ritaglio, scheletro] : [ritaglio],
    ...perQualita(o.qualita),
    quante: o.quante,
    trasparente: s.sfondo === 'trasparente',
    etichetta: `Personaggio · ${posa.nome}`
  }
}

/** una vista nuova di un risultato: la camera gira attorno alla persona */
export function richiestaVista(r: Risultato, c: PosizioneCamera, nome: string, o: { qualita: Qualita; mp: number }): Richiesta {
  const lora = !!fileLoraCamera()
  const testo = componiCamera(c, lora) || 'Show the same subject from the front, facing the camera. Keep the same subject, outfit, colors and lighting; only the camera position changes.'
  const base = richiestaBase()
  const extra = loraPer(lora && conLora(c) ? ['camera'] : []).filter((x) => !base.lora.some((l) => l.file === x.file))
  const fermo = ' Keep the same background, the same full-body framing and the same pose of the body.'
  return {
    ...base,
    lora: [...base.lora, ...extra],
    modalita: 'modifica',
    prompt: testo + fermo,
    immagini: [r.opera.file],
    megapixel: o.mp,
    ...perQualita(o.qualita),
    quante: 1,
    origine: r.opera.id,
    trasparente: !!r.opera.trasparente,
    etichetta: `Personaggio · ${nome}`
  }
}

// ---------------------------------------------------------------------------------------------------------------
// i risultati: quando un lavoro nostro finisce la foto compare fra i personaggi
// ---------------------------------------------------------------------------------------------------------------
export const attesiPersonaggio = new Map<string, { tipo: Risultato['tipo']; etichetta: string }>()

ascoltatoriLavoro.push((uno) => {
  const a = attesiPersonaggio.get(uno.id)
  if (!a) return
  if (uno.stato === 'fatto') {
    attesiPersonaggio.delete(uno.id)
    void Promise.all(uno.risultati.map((id) => api.galleria.opera(id))).then((l) => {
      const nuovi = (l.filter(Boolean) as Opera[]).map((opera): Risultato => ({ opera, tipo: a.tipo, etichetta: a.etichetta }))
      const primo = nuovi[0]?.opera.id
      // una persona estratta diventa la foto su cui lavora la camera; una vista no (si continua a girare attorno alla stessa)
      usaPersonaggio.setState((s) => ({ ris: [...[...nuovi].reverse(), ...s.ris], sorgente: a.tipo === 'estratto' ? primo ?? s.sorgente : s.sorgente ?? primo ?? null }))
    })
  } else if (uno.stato === 'errore' || uno.stato === 'annullato') attesiPersonaggio.delete(uno.id)
})
