// Lo stato dell'album aperto: modifiche con annulla/ripeti, salvataggio da solo, importazione delle foto (qualsiasi formato,
// anche RAW: diventano JPEG grandi per la stampa e miniature per lavorare).
import { create } from 'zustand'
import { api, urlFile, type RiassuntoAlbum } from '../api'
import { usaStato as usaApp } from '../stato'
import { ALBUM_VUOTO, DENSITA, type Album, type FotoAlbum } from './tipi'
import { costruisciSpread, ordina, piazza } from './costruisci'
import { proposte } from './proposte'
import { modelloPer } from './modelli'

const LATO_GRANDE = 6000
const LATO_MINI = 800

export interface Lavoro {
  testo: string
  fatto: number
  totale: number
}

interface StatoAlbum {
  album: Album | null
  elenco: RiassuntoAlbum[]
  corrente: number
  cella: number | null
  /** l'elemento (testo o forma) scelto sullo spread */
  elemento: string | null
  storia: string[]
  futuro: string[]
  lavoro: Lavoro | null
  aggiornaElenco(): Promise<void>
  apri(id: string): Promise<void>
  nuovo(nome?: string): Promise<void>
  elimina(id: string): Promise<void>
  /** cambia l'album (si può annullare con Ctrl+Z) */
  mod(f: (a: Album) => void, senzaStoria?: boolean): void
  annulla(): void
  ripeti(): void
  importa(percorsi: string[]): Promise<number>
  costruisci(): void
  scegli(spread: number, cella?: number | null): void
  scegliElemento(id: string | null): void
  /** mette una foto nello spread aperto: al posto di una cella (si scambiano se c'era già) o in più */
  metti(id: string, cella?: number, spread?: number): void
  /** toglie la foto dalla cella dello spread aperto (le altre si impaginano da sole) */
  togli(cella: number): void
}

/** un album fatto con una versione vecchia: il titolo della copertina diventa un elemento che si può spostare */
function vecchioInNuovo(a: Album): Album {
  for (const sp of a.spreads) {
    if (!sp.testo) continue
    const y = sp.posTesto === 'alto' ? 0.08 : sp.posTesto === 'centro' ? 0.5 : 0.9
    sp.elementi = [...(sp.elementi || []), { id: crypto.randomUUID(), tipo: 'testo', x: 0.5, y, w: 0.6, testo: sp.testo, dim: 14, colore: sp.posTesto === 'centro' || sp.stile === 'pieno' ? '#ffffff' : a.coloreTesto, font: a.font, ombra: sp.posTesto === 'centro' || sp.stile === 'pieno' }]
    delete sp.testo
    delete sp.posTesto
  }
  return a
}

/** cambiato il numero di foto di uno spread: prende il miglior layout per quelle che ci sono */
export function riproponi(a: Album, idx: number): void {
  const sp = a.spreads[idx]
  const p = sp && proposte(a, sp, false, 1)[0]
  if (!sp || !p) return
  sp.modello = p.sp.modello
  sp.layout = 0
  sp.stile = p.sp.stile
  sp.piazze = p.sp.piazze
}

/** cambiato il foglio (aperto / pagina singola): i modelli fatti per l'altro foglio si sostituiscono con i migliori per questo */
export function riadatta(a: Album): void {
  a.spreads.forEach((sp, i) => {
    const m = modelloPer(sp.modello)
    if (m && m.per !== 'tutti' && m.per !== (a.doppie ? 'doppia' : 'singola')) riproponi(a, i)
  })
}

const clona = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

let timer: ReturnType<typeof setTimeout> | undefined
function salvaPresto(a: Album): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void api.album.salva(a).then(() => usaAlbum.getState().aggiornaElenco()), 700)
}

export const usaAlbum = create<StatoAlbum>((set, get) => ({
  album: null,
  elenco: [],
  corrente: 0,
  cella: null,
  elemento: null,
  storia: [],
  futuro: [],
  lavoro: null,
  async aggiornaElenco() {
    set({ elenco: await api.album.elenco() })
  },
  async apri(id) {
    const a = (await api.album.carica(id)) as Album | null
    if (a) set({ album: vecchioInNuovo({ ...ALBUM_VUOTO(), ...a }), corrente: 0, cella: null, elemento: null, storia: [], futuro: [] })
  },
  async nuovo(nome) {
    const a = ALBUM_VUOTO(nome || `Album ${new Date().toLocaleDateString('it-IT')}`)
    await api.album.salva(a)
    set({ album: a, corrente: 0, cella: null, storia: [], futuro: [] })
    await get().aggiornaElenco()
  },
  async elimina(id) {
    await api.album.elimina(id)
    if (get().album?.id === id) set({ album: null })
    await get().aggiornaElenco()
  },
  mod(f, senzaStoria) {
    const a = get().album
    if (!a) return
    const nuovo = clona(a)
    f(nuovo)
    nuovo.aggiornato = Date.now()
    set((s) => ({
      album: nuovo,
      storia: senzaStoria ? s.storia : [...s.storia.slice(-39), JSON.stringify(a)],
      futuro: senzaStoria ? s.futuro : [],
      corrente: Math.max(0, Math.min(s.corrente, nuovo.spreads.length - 1))
    }))
    salvaPresto(nuovo)
  },
  annulla() {
    const { album, storia, futuro } = get()
    if (!album || !storia.length) return
    const prima = JSON.parse(storia[storia.length - 1]) as Album
    set({ album: prima, storia: storia.slice(0, -1), futuro: [...futuro, JSON.stringify(album)], cella: null, corrente: Math.min(get().corrente, Math.max(0, prima.spreads.length - 1)) })
    salvaPresto(prima)
  },
  ripeti() {
    const { album, storia, futuro } = get()
    if (!album || !futuro.length) return
    const dopo = JSON.parse(futuro[futuro.length - 1]) as Album
    set({ album: dopo, futuro: futuro.slice(0, -1), storia: [...storia, JSON.stringify(album)], cella: null, corrente: Math.min(get().corrente, Math.max(0, dopo.spreads.length - 1)) })
    salvaPresto(dopo)
  },
  costruisci() {
    get().mod((a) => {
      a.min = DENSITA[a.densita].min
      a.max = DENSITA[a.densita].max
      a.spreads = costruisciSpread(a)
    })
    set({ corrente: 0, cella: null, elemento: null })
  },
  scegli(spread, cella = null) {
    set({ corrente: spread, cella, elemento: null })
  },
  scegliElemento(id) {
    set({ elemento: id, cella: null })
  },
  metti(id, cella, spread) {
    const idx = spread ?? get().corrente
    get().mod((a) => {
      const sp = a.spreads[idx]
      if (!sp) return
      const gia = sp.piazze.findIndex((q) => q.foto === id)
      if (cella !== undefined && sp.piazze[cella]) {
        if (gia >= 0) [sp.piazze[gia], sp.piazze[cella]] = [sp.piazze[cella], sp.piazze[gia]]
        else sp.piazze[cella] = piazza(id)
      } else if (gia < 0 && sp.piazze.length < 8) {
        sp.piazze.push(piazza(id))
        riproponi(a, idx)
      }
    })
  },
  togli(cella) {
    const idx = get().corrente
    get().mod((a) => {
      const sp = a.spreads[idx]
      if (!sp) return
      sp.piazze.splice(cella, 1)
      if (sp.piazze.length === 0) a.spreads.splice(idx, 1)
      else riproponi(a, idx)
    })
    set({ cella: null })
  },
  async importa(percorsi) {
    const a0 = get().album
    if (!a0 || !percorsi.length) return 0
    const nuove: FotoAlbum[] = []
    let errori = 0
    for (let i = 0; i < percorsi.length; i++) {
      set({ lavoro: { testo: `Preparo le foto… ${i + 1} di ${percorsi.length}`, fatto: i, totale: percorsi.length } })
      try {
        nuove.push(await convertiFoto(a0.id, percorsi[i]))
      } catch (e) {
        errori++
        if (errori <= 2) usaApp.getState().avvisa((e as Error).message, 'errore')
      }
    }
    set({ lavoro: null })
    if (!nuove.length) return 0
    get().mod((a) => {
      a.foto.push(...nuove)
      // la prima volta, se non c'è ancora niente, si impagina da sola
      if (!a.spreads.length) {
        a.min = DENSITA[a.densita].min
        a.max = DENSITA[a.densita].max
        a.spreads = costruisciSpread({ ...a, foto: ordina(a.foto, a.ordine) })
      }
    })
    return nuove.length
  }
}))

function apriImg(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const im = new Image()
    // daprod:// ha il CORS: con crossOrigin il canvas non si "sporca" e si può esportare
    im.crossOrigin = 'anonymous'
    im.onload = () => ok(im)
    im.onerror = () => ko(new Error('non riesco ad aprire la foto'))
    im.src = src
  })
}

/** una foto qualsiasi → JPEG grande (6000 px al massimo, per la stampa) + miniatura, dentro la cartella dell'album */
async function convertiFoto(idAlbum: string, percorso: string): Promise<FotoAlbum> {
  const p = await api.album.prepara(percorso)
  let im: HTMLImageElement
  try {
    im = await apriImg(urlFile(p.percorso, Date.now()))
  } catch {
    const w = await api.file.inPng(p.percorso, 6500)
    im = await apriImg(urlFile(w.percorso, Date.now()))
  }
  const disegna = (lato: number, qualita: number): { url: string; w: number; h: number } => {
    const s = Math.min(1, lato / Math.max(im.naturalWidth, im.naturalHeight))
    const w = Math.max(1, Math.round(im.naturalWidth * s))
    const h = Math.max(1, Math.round(im.naturalHeight * s))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')!
    g.imageSmoothingQuality = 'high'
    g.fillStyle = '#fff'
    g.fillRect(0, 0, w, h)
    g.drawImage(im, 0, 0, w, h)
    return { url: c.toDataURL('image/jpeg', qualita), w, h }
  }
  const grande = disegna(LATO_GRANDE, 0.93)
  const mini = disegna(LATO_MINI, 0.82)
  const id = crypto.randomUUID()
  const file = await api.album.salvaFoto(idAlbum, id, grande.url, mini.url)
  return { id, nome: p.nome, w: grande.w, h: grande.h, data: p.data, grande: file.grande, mini: file.mini }
}
