// Piccoli aiuti per l'interfaccia.
import { api, urlFile } from './api'
import type { FotoBase } from './stato'

export const FORMATI: { id: string; nome: string; w: number; h: number }[] = [
  { id: '1:1', nome: 'Quadrato', w: 1, h: 1 },
  { id: '4:3', nome: 'Foto', w: 4, h: 3 },
  { id: '3:4', nome: 'Ritratto', w: 3, h: 4 },
  { id: '3:2', nome: 'Reflex', w: 3, h: 2 },
  { id: '2:3', nome: 'Verticale', w: 2, h: 3 },
  { id: '16:9', nome: 'Schermo', w: 16, h: 9 },
  { id: '9:16', nome: 'Storia', w: 9, h: 16 },
  { id: '21:9', nome: 'Cinema', w: 21, h: 9 }
]

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
    im.onload = () => ok(im)
    im.onerror = () => ko(new Error('non riesco ad aprire questa immagine'))
    im.src = src
  })

/**
 * Porta una foto qualsiasi (jpg con rotazione EXIF, webp, png dagli appunti…) a un PNG pulito
 * nelle cartelle dell'app: così la maschera disegnata e quella che vede il motore combaciano al pixel.
 * Oltre i 24 MP la riduce.
 */
export async function normalizza(percorso: string): Promise<FotoBase> {
  const [dentro] = await api.file.portaDentro([percorso])
  const im = await carica(urlFile(dentro, Date.now()))
  let w = im.naturalWidth
  let h = im.naturalHeight
  const max = 24e6
  if (w * h > max) {
    const s = Math.sqrt(max / (w * h))
    w = Math.round(w * s)
    h = Math.round(h * s)
  }
  if (/\.png$/i.test(dentro) && w === im.naturalWidth && h === im.naturalHeight) {
    // un PNG senza rotazioni va già bene così
    return { percorso: dentro, larghezza: w, altezza: h }
  }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(im, 0, 0, w, h)
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
  crea: 'Creata', modifica: 'Modificata', zona: 'Zona', espandi: 'Espansa', rifinisci: 'Rifinita', varia: 'Variazione', ingrandisci: 'Ingrandita', descrivi: 'Testo'
}
