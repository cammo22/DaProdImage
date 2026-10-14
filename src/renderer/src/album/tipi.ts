// Gli album: tipi, formati di stampa e misure. Tutto in millimetri (la stampa vuole misure vere); i pixel vengono dopo.

export interface FotoAlbum {
  id: string
  nome: string
  /** pixel della foto grande (quella per la stampa) */
  w: number
  h: number
  /** data di scatto (EXIF) o del file, in ms */
  data: number
  grande: string
  mini: string
  /** le preferite possono avere una pagina tutta per loro */
  preferita?: boolean
}

/** una foto messa in una cella: dove guardare (fx, fy da 0 a 1) e quanto ingrandire (≥ 1) */
export interface Piazza {
  foto: string
  fx: number
  fy: number
  zoom: number
}

export type Stile = 'classico' | 'dinamico' | 'pieno'

/** una cosa messa sopra lo spread: un testo o una forma. Posizione e misure in frazioni dello spread (senza abbondanza) */
export interface Elemento {
  id: string
  tipo: 'testo' | 'forma'
  /** il centro */
  x: number
  y: number
  /** larghezza (e altezza, per le forme) */
  w: number
  h?: number
  testo?: string
  /** corpo del testo in mm */
  dim: number
  colore: string
  font?: string
  allinea?: 'centro' | 'sinistra'
  grassetto?: boolean
  ombra?: boolean
  forma?: 'rett' | 'cerchio' | 'linea' | 'cornice'
  opacita?: number
}

export interface Spread {
  id: string
  piazze: Piazza[]
  /** quale fra i layout automatici possibili (0 = il migliore) */
  layout: number
  stile: Stile
  /** se c'è, l'impaginazione è quel modello della libreria (le foto stanno già nell'ordine delle sue celle) */
  modello?: string
  elementi?: Elemento[]
  /** vecchio: il titolo della copertina (si trasforma in un elemento quando si apre l'album) */
  testo?: string
  posTesto?: 'basso' | 'alto' | 'centro'
}

export type Sfondo = { tipo: 'colore'; colore: string } | { tipo: 'immagine'; percorso: string; colore: string }

export interface Album {
  id: string
  nome: string
  creato: number
  aggiornato: number
  formato: string
  /** misura della pagina se il formato è "scelgo io" (mm) */
  pagina: { w: number; h: number }
  /** due pagine affiancate (aperto) o una pagina alla volta */
  doppie: boolean
  margine: number
  spazio: number
  abbondanza: number
  angoli: number
  /** quanto si può tagliare una foto per riempire la cella (0 – 0,5) */
  taglioMax: number
  /** niente foto a cavallo della piega (tranne quelle a tutta pagina) */
  evitaPiega: boolean
  sfondo: Sfondo
  font: string
  coloreTesto: string
  /** lo stile scelto (vedi temi.ts) */
  tema: string
  /** cornice bianca attorno a ogni foto (mm) e il suo colore */
  bordoFoto: number
  coloreBordo: string
  /** ombra morbida sotto le foto */
  ombra: boolean
  densita: 'aerea' | 'normale' | 'fitta'
  /** impaginazione automatica */
  min: number
  max: number
  stileAuto: 'classico' | 'dinamico' | 'misto'
  preferiteGrandi: boolean
  copertina: boolean
  momento: number
  ordine: 'data' | 'nome' | 'scelta'
  foto: FotoAlbum[]
  spreads: Spread[]
}

export interface FormatoAlbum {
  id: string
  nome: string
  /** pagina in mm */
  w: number
  h: number
}

export const FORMATI: FormatoAlbum[] = [
  { id: 'q20', nome: 'Quadrato 20 × 20 cm', w: 200, h: 200 },
  { id: 'q25', nome: 'Quadrato 25 × 25 cm', w: 250, h: 250 },
  { id: 'q30', nome: 'Quadrato 30 × 30 cm', w: 300, h: 300 },
  { id: 'v20x30', nome: 'Verticale 20 × 30 cm', w: 200, h: 300 },
  { id: 'o30x20', nome: 'Orizzontale 30 × 20 cm', w: 300, h: 200 },
  { id: 'a4v', nome: 'A4 verticale', w: 210, h: 297 },
  { id: 'a4o', nome: 'A4 orizzontale', w: 297, h: 210 },
  { id: 'o40x30', nome: 'Orizzontale 40 × 30 cm', w: 400, h: 300 },
  { id: 'custom', nome: 'Misura mia', w: 300, h: 300 }
]

export const DPI = [150, 200, 300] as const

/** quante foto per spread, secondo quanto "fitto" vuoi l'album */
export const DENSITA: Record<Album['densita'], { nome: string; sotto: string; min: number; max: number }> = {
  aerea: { nome: 'Aerea', sotto: '1–3 per pagina', min: 1, max: 3 },
  normale: { nome: 'Normale', sotto: '2–5', min: 2, max: 5 },
  fitta: { nome: 'Fitta', sotto: '4–8', min: 4, max: 8 }
}

/** la pagina dell'album, in mm */
export function paginaDi(a: Pick<Album, 'formato' | 'pagina'>): { w: number; h: number } {
  if (a.formato === 'custom') return { w: Math.max(50, a.pagina.w), h: Math.max(50, a.pagina.h) }
  const f = FORMATI.find((x) => x.id === a.formato) || FORMATI[2]
  return { w: f.w, h: f.h }
}

/** lo spread (una pagina o due affiancate), senza abbondanza, in mm */
export function spreadDi(a: Pick<Album, 'formato' | 'pagina' | 'doppie'>): { w: number; h: number } {
  const p = paginaDi(a)
  return { w: a.doppie ? p.w * 2 : p.w, h: p.h }
}

export const COLORI_SFONDO = ['#ffffff', '#f6f1e7', '#e9e4d8', '#bdbdbd', '#4a4a4a', '#1b1b1f', '#000000', '#1f2a44', '#3d2b2b']

export const FONT_ALBUM = [
  { id: 'Rajdhani', nome: 'Moderno' },
  { id: 'Georgia', nome: 'Classico' },
  { id: 'Segoe Script', nome: 'Corsivo' },
  { id: 'Impact', nome: 'Titolo' }
]

export const ALBUM_VUOTO = (nome = 'Il mio album'): Album => ({
  id: crypto.randomUUID(),
  nome,
  creato: Date.now(),
  aggiornato: Date.now(),
  formato: 'q30',
  pagina: { w: 300, h: 300 },
  doppie: true,
  margine: 10,
  spazio: 4,
  abbondanza: 3,
  angoli: 0,
  taglioMax: 0.2,
  evitaPiega: true,
  sfondo: { tipo: 'colore', colore: '#ffffff' },
  font: 'Georgia',
  coloreTesto: '#222222',
  tema: 'classico',
  bordoFoto: 0,
  coloreBordo: '#ffffff',
  ombra: false,
  densita: 'normale',
  min: 2,
  max: 5,
  stileAuto: 'misto',
  preferiteGrandi: true,
  copertina: true,
  momento: 0,
  ordine: 'data',
  foto: [],
  spreads: []
})
