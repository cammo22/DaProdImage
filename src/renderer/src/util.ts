// Piccoli aiuti per l'interfaccia.
import { api, urlFile } from './api'
import type { FotoBase } from './stato'

export const FORMATI: { id: string; nome: string; w: number; h: number }[] = [
  { id: '1:1', nome: 'Quadrato', w: 1, h: 1 },
  { id: '4:5', nome: 'Post Instagram', w: 4, h: 5 },
  { id: '3:4', nome: 'Ritratto', w: 3, h: 4 },
  { id: '2:3', nome: 'Poster', w: 2, h: 3 },
  { id: '9:16', nome: 'Storia', w: 9, h: 16 },
  { id: '5:4', nome: 'Stampa', w: 5, h: 4 },
  { id: '4:3', nome: 'Foto', w: 4, h: 3 },
  { id: '3:2', nome: 'Reflex', w: 3, h: 2 },
  { id: '16:9', nome: 'Schermo', w: 16, h: 9 },
  { id: '21:9', nome: 'Cinema', w: 21, h: 9 }
]

/** le risoluzioni di Crea: il lato corto in pixel. Sopra i 4,2 MP (2048×2048, il massimo nativo) si riduce */
export const RISOLUZIONI: { id: number; nome: string; sotto: string; titolo: string }[] = [
  { id: 256, nome: '256p', sotto: 'lampo', titolo: 'Piccolissima: per provare un\'idea in pochi secondi' },
  { id: 384, nome: '384p', sotto: 'schizzo', titolo: 'Per esplorare in fretta composizioni e colori' },
  { id: 480, nome: '480p', sotto: 'SD', titolo: 'Definizione standard' },
  { id: 576, nome: '576p', sotto: 'web', titolo: 'Va bene per il web e le chat' },
  { id: 720, nome: '720p', sotto: 'HD', titolo: 'HD: già bella, ancora veloce' },
  { id: 1024, nome: '1K', sotto: '1 MP', titolo: 'L\'equilibrio giusto (1 megapixel a 1:1)' },
  { id: 1080, nome: '1080p', sotto: 'Full HD', titolo: 'Full HD' },
  { id: 1440, nome: '1440p', sotto: '2K', titolo: 'Per i testi piccoli, poster e infografiche' },
  { id: 2048, nome: 'MAX', sotto: '4,2 MP', titolo: 'Il massimo nativo di Qwen-Image 2.1 (2048×2048): lento su 6-8 GB' }
]
const PIXEL_MAX = 2048 * 2048
const LATO_MAX = 2688
const m16 = (x: number): number => Math.max(128, Math.round(x / 16) * 16)

/** larghezza e altezza (multipli di 16) per quel formato con quel lato corto, entro il massimo nativo */
export function dimensioniRis(formato: string, corto: number): { w: number; h: number } {
  const f = FORMATI.find((x) => x.id === formato) || FORMATI[0]
  const ar = f.w / f.h
  const w = ar >= 1 ? corto * ar : corto
  const h = ar >= 1 ? corto : corto / ar
  const s = Math.min(1, Math.sqrt(PIXEL_MAX / (w * h)), LATO_MAX / Math.max(w, h))
  return { w: m16(w * s), h: m16(h * s) }
}

/** secondi per passo che ci si aspetta da una scheda da 8 GB tipo 4060 a quei megapixel */
export const passoAtteso = (mp: number): number => 2.9 * Math.pow(Math.max(0.1, mp), 1.15)

/** è molto più lenta del normale? (di solito la VRAM finita nella RAM condivisa di Windows) */
export const troppoLenta = (secondiPasso: number | undefined, mp: number): boolean => !!secondiPasso && secondiPasso > passoAtteso(mp) * 4 + 2

export const m32 = (x: number): number => Math.max(256, Math.round(x / 32) * 32)

/** larghezza e altezza (multipli di 32) per quel formato e quei megapixel */
export function dimensioni(formato: string, mp: number): { w: number; h: number } {
  const f = FORMATI.find((x) => x.id === formato) || FORMATI[0]
  const px = mp * 1024 * 1024
  const s = Math.sqrt(px / (f.w * f.h))
  return { w: m32(f.w * s), h: m32(f.h * s) }
}

export function durata(sec: number | undefined): string {
  if (sec === undefined || !isFinite(sec)) return ''
  sec = Math.max(0, Math.round(sec))
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m < 60 ? `${m}m ${String(s).padStart(2, '0')}s` : `${Math.floor(m / 60)}h ${m % 60}m`
}

export function byte(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' KB'
  return n + ' B'
}

/** secondi per passo stimati (dalle misure dell'app, o ~2.9 s a 1 MP su una 4060) */
export function stimaSecondi(tempi: Record<string, number> | undefined, mp: number, passi: number): number {
  const chiave = (Math.round(mp * 4) / 4).toFixed(2)
  const base = tempi?.['1.00'] || 2.9
  const sp = tempi?.[chiave] || base * Math.pow(Math.max(0.1, mp), 1.15)
  return sp * passi + 8
}

const carica = (src: string): Promise<HTMLImageElement> =>
  new Promise((ok, ko) => {
    const im = new Image()
    // senza crossOrigin il canvas resta "sporco" e toDataURL si rifiuta (il protocollo daprod:// manda il CORS)
    im.crossOrigin = 'anonymous'
    im.onload = () => ok(im)
    im.onerror = () => ko(new Error('non riesco ad aprire questa immagine'))
    im.src = src
  })

const MAX_PIXEL = 24e6

/**
 * Porta una foto qualsiasi a un PNG pulito nelle cartelle dell'app: così la maschera disegnata e quella che vede
 * il motore combaciano al pixel. Chromium apre JPG/WEBP/AVIF/GIF/BMP e applica la rotazione EXIF; quello che non
 * sa aprire (HEIC, RAW, TIFF, JXL…) lo converte WIC di Windows nel processo principale. Oltre i 24 MP si riduce.
 */
export async function normalizza(percorso: string): Promise<FotoBase> {
  const [dentro] = await api.file.portaDentro([percorso])
  let im: HTMLImageElement
  try {
    im = await carica(urlFile(dentro, Date.now()))
  } catch {
    const w = await api.file.inPng(dentro)
    im = await carica(urlFile(w.percorso, Date.now()))
    if (w.larghezza * w.altezza <= MAX_PIXEL) return { percorso: w.percorso, larghezza: w.larghezza, altezza: w.altezza }
  }
  let w = im.naturalWidth
  let h = im.naturalHeight
  if (w * h > MAX_PIXEL) {
    const s = Math.sqrt(MAX_PIXEL / (w * h))
    w = Math.round(w * s)
    h = Math.round(h * s)
  }
  if (/\.png$/i.test(dentro) && w === im.naturalWidth && h === im.naturalHeight) {
    // un PNG che non va ridotto va già bene così
    return { percorso: dentro, larghezza: w, altezza: h }
  }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.drawImage(im, 0, 0, w, h)
  const p = await api.file.salvaTemp(c.toDataURL('image/png'))
  return { percorso: p, larghezza: w, altezza: h }
}

export async function daDataUrl(dataUrl: string): Promise<FotoBase> {
  const p = await api.file.salvaTemp(dataUrl)
  return normalizza(p)
}

/** immagini dagli appunti (Ctrl+V) */
export function immagineDaIncolla(e: ClipboardEvent): Promise<string> | null {
  const it = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith('image/'))
  const f = it?.getAsFile()
  if (!f) return null
  return new Promise((ok) => {
    const r = new FileReader()
    r.onload = () => ok(r.result as string)
    r.readAsDataURL(f)
  })
}

export const ETICHETTE_MODALITA: Record<string, string> = {
  crea: 'Creata', modifica: 'Modificata', zona: 'Zona', espandi: 'Espansa', rifinisci: 'Rifinita', varia: 'Variazione', ingrandisci: 'Ingrandita', descrivi: 'Testo', importa: 'Importata'
}
