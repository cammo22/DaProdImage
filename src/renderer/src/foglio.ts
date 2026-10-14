// Il foglio di foto numerate (per far guardare al modello più foto insieme) e i ritagli: servono al "piano" del modello
// (Esempio e idee di Modifica). Il Qwen3-VL guarda una sola immagine per volta: le foto vanno in un foglio con le etichette.
import { api, urlFile } from './api'

export function caricaImg(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => ok(im)
    im.onerror = () => ko(new Error('non riesco ad aprire una foto'))
    im.src = src
  })
}

export interface Foglio {
  percorso: string
  W: number
  H: number
  /** dove sta ogni foto sul foglio (px del foglio) */
  celle: { x: number; y: number; w: number; h: number }[]
}

const CELLA = 640
const BARRA = 38

/** un foglio con le foto una accanto all'altra (tre per riga), ognuna con la sua etichetta: `image 1`, `image 2`… */
export async function foglioFoto(foto: { percorso: string }[], etichettaPrima: string): Promise<Foglio> {
  const colonne = Math.min(3, foto.length)
  const righe = Math.ceil(foto.length / colonne)
  const c = document.createElement('canvas')
  c.width = colonne * CELLA
  c.height = righe * (CELLA + BARRA)
  const g = c.getContext('2d')!
  g.fillStyle = '#101014'
  g.fillRect(0, 0, c.width, c.height)
  g.imageSmoothingQuality = 'high'
  const celle: Foglio['celle'] = []
  for (let i = 0; i < foto.length; i++) {
    const x = (i % colonne) * CELLA
    const y = Math.floor(i / colonne) * (CELLA + BARRA)
    const im = await caricaImg(urlFile(foto[i].percorso))
    const s = Math.min(CELLA / im.naturalWidth, CELLA / im.naturalHeight)
    const w = im.naturalWidth * s
    const h = im.naturalHeight * s
    const px = x + (CELLA - w) / 2
    const py = y + BARRA + (CELLA - h) / 2
    g.drawImage(im, px, py, w, h)
    celle.push({ x: px, y: py, w, h })
    g.fillStyle = i === 0 ? '#ffd54a' : '#5ec8ff'
    g.fillRect(x, y, CELLA, BARRA)
    g.fillStyle = '#101014'
    g.font = '700 22px sans-serif'
    g.textBaseline = 'middle'
    g.fillText(i === 0 ? `image 1 - ${etichettaPrima}` : `image ${i + 1} - reference`, x + 12, y + BARRA / 2)
    g.strokeStyle = '#101014'
    g.lineWidth = 3
    g.strokeRect(x, y, CELLA, CELLA + BARRA)
  }
  const percorso = await api.file.salvaTemp(c.toDataURL('image/jpeg', 0.92))
  return { percorso, W: c.width, H: c.height, celle }
}

/** un ritaglio di una foto (frazioni 0–1 della foto) con un po' di aria attorno, salvato come foto temporanea; null se è troppo piccolo */
export async function ritagliaFoto(percorso: string, box: [number, number, number, number], margine = 0.1, maxLato = 1280): Promise<string | null> {
  const im = await caricaImg(urlFile(percorso))
  const W = im.naturalWidth
  const H = im.naturalHeight
  const bw = (box[2] - box[0]) * W
  const bh = (box[3] - box[1]) * H
  const x1 = Math.max(0, Math.floor(box[0] * W - bw * margine))
  const y1 = Math.max(0, Math.floor(box[1] * H - bh * margine))
  const x2 = Math.min(W, Math.ceil(box[2] * W + bw * margine))
  const y2 = Math.min(H, Math.ceil(box[3] * H + bh * margine))
  if (x2 - x1 < 48 || y2 - y1 < 48) return null
  // se il ritaglio è quasi tutta la foto non serve
  if ((x2 - x1) * (y2 - y1) > 0.85 * W * H) return null
  const s = Math.min(1, maxLato / Math.max(x2 - x1, y2 - y1))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round((x2 - x1) * s))
  c.height = Math.max(1, Math.round((y2 - y1) * s))
  const g = c.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.drawImage(im, x1, y1, x2 - x1, y2 - y1, 0, 0, c.width, c.height)
  return api.file.salvaTemp(c.toDataURL('image/png'))
}

/** un riquadro dato sul foglio (0–1000 sul foglio intero) → la stessa zona dentro la foto numero `k` (frazioni 0–1 di quella foto) */
export function riquadroNellaFoto(f: Foglio, k: number, box: number[]): [number, number, number, number] | null {
  const c = f.celle[k]
  if (!c || box.length !== 4) return null
  const [a, b, d, e] = [box[0] * f.W / 1000, box[1] * f.H / 1000, box[2] * f.W / 1000, box[3] * f.H / 1000]
  const x1 = Math.max(c.x, Math.min(a, d))
  const x2 = Math.min(c.x + c.w, Math.max(a, d))
  const y1 = Math.max(c.y, Math.min(b, e))
  const y2 = Math.min(c.y + c.h, Math.max(b, e))
  if (x2 - x1 < 4 || y2 - y1 < 4) return null
  return [(x1 - c.x) / c.w, (y1 - c.y) / c.h, (x2 - c.x) / c.w, (y2 - c.y) / c.h]
}
