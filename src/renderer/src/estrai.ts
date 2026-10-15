// Estrai: da una foto scegli una persona o un oggetto (il modello li trova, o li riquadri tu) e li ottieni da soli, su sfondo pulito:
// una persona a figura intera (T-pose, A-pose, disegnata con l'omino…), un busto o un volto; un oggetto intero, da davanti, di lato, dall'alto.
// Qui sta lo stato (le cose trovate, i risultati) e come si costruiscono le richieste; l'interfaccia è in componenti/Estrai.tsx.
import { create } from 'zustand'
import { api, urlFile } from './api'
import { ascoltatoriLavoro, usaStato, type FotoBase, type Qualita } from './stato'
import { perQualita, richiestaBase } from './azioni'
import type { Opera, Richiesta } from '@shared/tipi'
import { leggiElementi, type Elemento, type TipoElemento } from './riquadri'
import { istruzionePosa, posaDi, type Posa } from './omino'
import { immagineOmino } from './ominoImmagine'
import { SENZA_SCHELETRO } from './pulisciOmino'

export type { Elemento, TipoElemento }

export interface Risultato {
  opera: Opera
  etichetta: string
}

// ---------------------------------------------------------------------------------------------------------------
// le scelte
// ---------------------------------------------------------------------------------------------------------------
export type PosaId = 'tpose' | 'apose' | 'piedi' | 'come' | 'omino'
export const POSE_ESTRAI: { id: PosaId; nome: string; sotto: string; testo: string }[] = [
  { id: 'tpose', nome: 'T-pose', sotto: 'braccia aperte', testo: 'Pose: a perfect T-pose, standing straight and facing the camera, legs slightly apart, arms stretched out horizontally to the sides at shoulder height, palms down.' },
  { id: 'apose', nome: 'A-pose', sotto: 'braccia un po\' scostate', testo: 'Pose: an A-pose, standing straight and facing the camera, arms relaxed and slightly away from the body, legs slightly apart.' },
  { id: 'piedi', nome: 'In piedi', sotto: 'dritto, a riposo', testo: 'Pose: standing straight and facing the camera in a neutral relaxed stance, arms along the body.' },
  { id: 'omino', nome: 'Disegnata', sotto: 'con l\'omino', testo: '' },
  { id: 'come', nome: 'Come foto', sotto: 'completa il corpo', testo: 'Pose: keep the pose of the person in <image1> as it is, and complete the body if some part is cut off or hidden, so the whole figure is visible.' }
]

export type InquadraturaId = 'intera' | 'vita' | 'volto'
export const INQUADRATURE: { id: InquadraturaId; nome: string; sotto: string; testo: string }[] = [
  { id: 'intera', nome: 'Figura intera', sotto: 'dalla testa ai piedi', testo: 'Show the entire body from head to feet, centered, with nothing cropped.' },
  { id: 'vita', nome: 'Fino alla vita', sotto: 'mezzo busto', testo: 'Waist-up portrait: head, shoulders, arms and torso down to the waist, centered, facing the camera.' },
  { id: 'volto', nome: 'Solo il volto', sotto: 'primo piano', testo: 'Close-up portrait of the head and shoulders, centered, facing the camera, the face sharp and fully visible.' }
]

export type VistaId = 'come' | 'davanti' | 'tre' | 'alto' | 'lato'
export const VISTE_OGGETTO: { id: VistaId; nome: string; sotto: string; testo: string }[] = [
  { id: 'come', nome: 'Come foto', sotto: 'stesso angolo', testo: 'View: keep the same viewing angle as in <image1>.' },
  { id: 'davanti', nome: 'Davanti', sotto: 'dritto', testo: 'View: straight from the front, the object upright and facing the camera.' },
  { id: 'tre', nome: '¾', sotto: 'da un po\' in alto', testo: 'View: a three-quarter view from slightly above, like a product photo.' },
  { id: 'alto', nome: 'Dall\'alto', sotto: 'dritto giù', testo: 'View: from directly above, a top-down flat lay.' },
  { id: 'lato', nome: 'Di lato', sotto: 'profilo', testo: 'View: a clean side profile view.' }
]

export type SfondoId = 'bianco' | 'grigio' | 'trasparente' | 'foto'
export const SFONDI_ESTRAI: { id: SfondoId; nome: string; testo: string }[] = [
  { id: 'bianco', nome: 'Bianco', testo: 'Plain pure white studio background.' },
  { id: 'grigio', nome: 'Grigio studio', testo: 'Plain neutral light gray studio background.' },
  { id: 'trasparente', nome: 'Trasparente', testo: 'Isolated on a plain background with clean, sharp edges, no floor.' },
  { id: 'foto', nome: 'Come foto', testo: 'Keep a background similar to the one behind it in <image1>.' }
]

/** le proporzioni: "auto" le sceglie l'app (dal tipo di cosa e dal suo riquadro) */
export type FormatoId = 'auto' | '1:1' | '3:4' | '4:3' | '2:3' | '3:2' | '16:9' | '9:16'
export const FORMATI_ESTRAI: { id: FormatoId; r?: [number, number] }[] = [
  { id: 'auto' }, { id: '1:1', r: [1, 1] }, { id: '3:4', r: [3, 4] }, { id: '4:3', r: [4, 3] }, { id: '2:3', r: [2, 3] }, { id: '3:2', r: [3, 2] }, { id: '16:9', r: [16, 9] }, { id: '9:16', r: [9, 16] }
]

interface StatoEstrai {
  /** la foto a cui si riferiscono le cose trovate */
  foto: string | null
  elementi: Elemento[]
  scelto: string | null
  cercando: boolean
  ris: Risultato[]
  // come lo vuoi
  posa: PosaId
  inquadratura: InquadraturaId
  vista: VistaId
  sfondo: SfondoId
  ombra: boolean
  formato: FormatoId
  nota: string
  /** la posa disegnata con l'omino */
  omino: Posa
}

export const usaEstrai = create<StatoEstrai>(() => ({
  foto: null, elementi: [], scelto: null, cercando: false, ris: [],
  posa: 'tpose', inquadratura: 'intera', vista: 'come', sfondo: 'bianco', ombra: true, formato: 'auto', nota: '', omino: posaDi('t')
}))

export const impostaEstrai = (p: Partial<StatoEstrai>): void => usaEstrai.setState(p)

// ---------------------------------------------------------------------------------------------------------------
// trovare persone e oggetti
// ---------------------------------------------------------------------------------------------------------------
const SISTEMA_ELEMENTI =
  'You are an object detector. List every real person and every distinct, clearly visible object or item in the image that someone could want to cut out: people (full or partial, also small ones), animals, vehicles, furniture, products, bags, shoes, clothes or accessories that stand out, food, plants, toys, tools, devices, decorations. Do NOT list the background, the sky, the floor, walls, or people printed on posters or screens. ' +
  'Output ONLY a JSON array, at most 12 items, the most prominent first: [{"bbox_2d":[x1,y1,x2,y2],"label":"2-5 words: color and name","kind":"person" or "object"}]. ' +
  'Coordinates are integers from 0 to 1000, relative to the image width and height (x1,y1 = top-left corner, x2,y2 = bottom-right corner). A person box contains the whole visible body; an object box is tight around the whole object. No other text.'

/** col rilevatore piccolo (Florence-2); con «Qwen3-VL» in Opzioni, o se il rilevatore non c'è, si chiede all'LLM (molto più lento) */
async function chiediRiquadri(foto: FotoBase): Promise<string> {
  if (usaStato.getState().imp?.trova !== 'llm') {
    try {
      return await api.testo.scrivi({ ...richiestaBase(), modalita: 'trova', prompt: '', immagini: [foto.percorso], etichetta: 'Cerco persone e oggetti' })
    } catch (e) {
      usaStato.getState().avvisa(`Il rilevatore non risponde (${(e as Error).message.split('\n')[0]}): uso il Qwen3-VL, più lento`, 'info')
    }
  }
  return api.testo.scrivi({
    ...richiestaBase(), modalita: 'descrivi', prompt: 'Detect all the people and objects in this image.', immagini: [foto.percorso],
    sistema: SISTEMA_ELEMENTI, maxToken: 900, temperatura: 0.1, seed: 7, etichetta: 'Cerco persone e oggetti'
  })
}

/** cerca persone e oggetti nella foto (solo quando premi il pulsante) */
export async function trovaElementi(foto: FotoBase): Promise<void> {
  impostaEstrai({ cercando: true, foto: foto.percorso, elementi: [], scelto: null })
  try {
    const t = await chiediRiquadri(foto)
    const elementi = leggiElementi(t || '', foto.larghezza, foto.altezza)
    if (usaEstrai.getState().foto !== foto.percorso) return
    // se c'è una sola persona e nient'altro di grosso, è già scelta
    impostaEstrai({ elementi, scelto: elementi.length === 1 ? elementi[0].id : null })
    if (!elementi.length) usaStato.getState().avvisa('Non trovo niente di preciso: riquadra tu quello che vuoi trascinando sulla foto', 'info')
  } catch (e) {
    usaStato.getState().avvisa((e as Error).message, 'errore')
  } finally {
    impostaEstrai({ cercando: false })
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

/** il ritaglio attorno alla cosa scelta (con un po' di aria), salvato come foto temporanea */
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
const SNAP: [number, number][] = [[1, 2], [2, 3], [3, 4], [4, 5], [1, 1], [5, 4], [4, 3], [3, 2], [2, 1]]

/** le proporzioni con cui esce: quelle scelte, o (auto) le più adatte a quello che si estrae */
export function proporzioniEstrai(s: Pick<StatoEstrai, 'formato' | 'posa' | 'inquadratura'>, el: Elemento | undefined, foto: { larghezza: number; altezza: number } | null): [number, number] {
  const f = FORMATI_ESTRAI.find((x) => x.id === s.formato)
  if (f?.r) return f.r
  if (el?.tipo === 'oggetto') {
    // come il riquadro dell'oggetto, a una proporzione "da fotografia"
    const ar = foto ? ((el.box[2] - el.box[0]) * foto.larghezza) / Math.max(1, (el.box[3] - el.box[1]) * foto.altezza) : 1
    return SNAP.reduce((m, r) => (Math.abs(Math.log(r[0] / r[1] / ar)) < Math.abs(Math.log(m[0] / m[1] / ar)) ? r : m))
  }
  if (s.inquadratura === 'volto') return [1, 1]
  if (s.inquadratura === 'vita') return [4, 5]
  // figura intera: la T-pose è larga quanto è alta
  return s.posa === 'tpose' ? [1, 1] : [3, 4]
}

/** larghezza e altezza (multipli di 32) di quello che esce: le stesse cifre che l'interfaccia mostra */
export function dimensioniEstrai(mp: number, r: [number, number]): { w: number; h: number } {
  const px = mp * 1048576
  return { w: m32(Math.sqrt(px * (r[0] / r[1]))), h: m32(Math.sqrt(px / (r[0] / r[1]))) }
}

/** estrae la cosa scelta su sfondo pulito, come dicono le scelte */
export async function richiestaEstrai(foto: FotoBase, el: Elemento, o: { qualita: Qualita; mp: number; quante: number }): Promise<Richiesta> {
  const s = usaEstrai.getState()
  const sfondo = SFONDI_ESTRAI.find((x) => x.id === s.sfondo) || SFONDI_ESTRAI[0]
  const r = proporzioniEstrai(s, el, foto)
  const { w, h } = dimensioniEstrai(o.mp, r)
  const ritaglio = await ritaglia(foto, el.box)
  const chi = el.nome ? ` (${el.nome.replace(/["<>]/g, '')})` : ''
  const ombra = s.sfondo === 'trasparente' ? '' : s.ombra ? 'Soft contact shadow on the floor only.' : 'No shadow.'
  let prompt: string
  let immagini: string[]
  let nome: string
  let trasparente = s.sfondo === 'trasparente'

  if (el.tipo === 'persona') {
    const intera = s.inquadratura === 'intera'
    const posa = POSE_ESTRAI.find((x) => x.id === s.posa) || POSE_ESTRAI[0]
    const conOmino = intera && s.posa === 'omino'
    const scheletro = conOmino ? await immagineOmino(s.omino, w, h) : null
    // con l'omino il manichino è la PRIMA immagine (solo una guida di posa) e il ritaglio della persona la seconda
    const testoPosa = !intera ? '' : conOmino ? istruzionePosa(s.omino, '<image1>', `the person shown in <image2>${chi}`) : posa.testo
    const sfondoTesto = conOmino ? sfondo.testo.replace('<image1>', '<image2>') : sfondo.testo
    prompt = [
      conOmino
        ? 'Reference picture of the one person at the center of <image2>; ignore anyone else visible at the edges of <image2>.'
        : `Reference picture of the person shown in <image1>${chi}: only that one person, the one at the center of <image1>; ignore anyone else visible at the edges.`,
      'Keep exactly the same identity, face, hair, skin tone, body build and clothes, with every detail, pattern and color.',
      testoPosa,
      INQUADRATURE.find((x) => x.id === s.inquadratura)!.testo,
      sfondoTesto,
      ombra,
      s.nota.trim(),
      conOmino ? SENZA_SCHELETRO : ''
    ].filter(Boolean).join(' ')
    immagini = scheletro ? [scheletro, ritaglio] : [ritaglio]
    nome = intera ? posa.nome : INQUADRATURE.find((x) => x.id === s.inquadratura)!.nome
  } else {
    const vista = VISTE_OGGETTO.find((x) => x.id === s.vista) || VISTE_OGGETTO[0]
    prompt = [
      `Clean isolated picture of the object shown in <image1>${chi}: only that one object, the one at the center of <image1>; ignore everything else around it.`,
      'Keep exactly the same shape, proportions, colors, materials, textures, logos, text and every small detail of that object.',
      vista.testo,
      'Show the whole object, centered, with nothing cropped; if a part is hidden or cut off in <image1>, complete it naturally and consistently.',
      sfondo.testo,
      ombra,
      s.nota.trim()
    ].filter(Boolean).join(' ')
    immagini = [ritaglio]
    nome = el.nome ? el.nome.split(/[,.;]/)[0].slice(0, 30) : 'Oggetto'
    trasparente = s.sfondo === 'trasparente'
  }
  return {
    ...richiestaBase(),
    modalita: 'crea',
    prompt,
    larghezza: w,
    altezza: h,
    megapixel: (w * h) / 1048576,
    immagini,
    ...perQualita(o.qualita),
    quante: o.quante,
    trasparente,
    etichetta: `Estrai · ${nome}`
  }
}

// ---------------------------------------------------------------------------------------------------------------
// i risultati: quando un lavoro nostro finisce la foto compare fra gli estratti
// ---------------------------------------------------------------------------------------------------------------
export const attesiEstrai = new Map<string, { etichetta: string }>()

ascoltatoriLavoro.push((uno) => {
  const a = attesiEstrai.get(uno.id)
  if (!a) return
  if (uno.stato === 'fatto') {
    attesiEstrai.delete(uno.id)
    void Promise.all(uno.risultati.map((id) => api.galleria.opera(id))).then((l) => {
      const nuovi = (l.filter(Boolean) as Opera[]).map((opera): Risultato => ({ opera, etichetta: a.etichetta }))
      usaEstrai.setState((s) => ({ ris: [...[...nuovi].reverse(), ...s.ris] }))
    })
  } else if (uno.stato === 'errore' || uno.stato === 'annullato') attesiEstrai.delete(uno.id)
})
