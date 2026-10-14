// Il disegno di uno spread su un canvas: sfondo, foto nelle celle (con il taglio che dici tu), angoli, testo.
// Lo stesso codice serve per lo schermo (miniature leggere) e per l'esportazione (foto grandi, 300 dpi).
import { layoutDi, reginaDi, type Cella, type Rett } from './layout'
import { celleModello, modelloPer } from './modelli'
import { spreadDi, type Album, type Elemento, type FotoAlbum, type Spread } from './tipi'
import { urlFile } from '../api'

export interface Geometria {
  /** lo spread, senza abbondanza (mm) */
  w: number
  h: number
  /** abbondanza (mm) attorno */
  b: number
  /** tela completa (mm): spread + abbondanza */
  tw: number
  th: number
  celle: Cella[]
  /** la piega al centro, in mm sulla tela (se ci sono due pagine) */
  piega?: number
  /** dove cadono i margini (mm sulla tela) */
  area: Rett
}

export const mappaFoto = (a: Album): Map<string, FotoAlbum> => new Map(a.foto.map((f) => [f.id, f]))

/** le celle di uno spread, in mm sulla tela (abbondanza compresa) */
export function geometria(a: Album, sp: Spread, foto: Map<string, FotoAlbum>): Geometria {
  const s = spreadDi(a)
  const b = a.abbondanza
  const tw = s.w + 2 * b
  const th = s.h + 2 * b
  const piazze = sp.piazze.filter((p) => foto.has(p.foto))
  const ars = piazze.map((p) => foto.get(p.foto)!.w / foto.get(p.foto)!.h)
  const pieno = sp.stile === 'pieno'
  const m = a.margine
  const area: Rett = { x: b + m, y: b + m, w: s.w - 2 * m, h: s.h - 2 * m }
  let celle: Cella[]
  const modello = modelloPer(sp.modello)
  if (modello && modello.n === piazze.length) {
    // un modello della libreria: le foto stanno già nell'ordine delle sue celle
    celle = celleModello(modello, area, { x: 0, y: 0, w: tw, h: th }, a.spazio)
  } else if (pieno && piazze.length === 1) {
    // a tutta pagina: arriva fino al vivo (abbondanza compresa)
    celle = [{ x: 0, y: 0, w: tw, h: th, foto: 0, vivo: true }]
  } else {
    const pesi = piazze.map((p) => foto.get(p.foto)!.w * foto.get(p.foto)!.h)
    const regina = reginaDi(ars, pesi, piazze.map((p) => !!foto.get(p.foto)!.preferita))
    celle = layoutDi(ars, area, { spazio: a.spazio, stile: sp.stile === 'dinamico' ? 'dinamico' : 'classico', piega: a.doppie && a.evitaPiega && piazze.length > 1, regina, taglioMax: a.taglioMax }, sp.layout)
  }
  return { w: s.w, h: s.h, b, tw, th, celle, area, piega: a.doppie ? b + s.w / 2 : undefined }
}

const cacheImg = new Map<string, Promise<HTMLImageElement>>()
/** apre un'immagine; le miniature restano in memoria, le foto grandi (decine di megapixel) no */
export function caricaImg(src: string, tieni = true): Promise<HTMLImageElement> {
  let p = tieni ? cacheImg.get(src) : undefined
  if (!p) {
    p = new Promise((ok, ko) => {
      const im = new Image()
      im.crossOrigin = 'anonymous'
      im.onload = () => ok(im)
      im.onerror = () => {
        cacheImg.delete(src)
        ko(new Error('non riesco ad aprire una foto dell\'album'))
      }
      im.src = src
    })
    if (tieni) {
      cacheImg.set(src, p)
      // la cache non cresce all'infinito
      if (cacheImg.size > 120) cacheImg.delete(cacheImg.keys().next().value as string)
    }
  }
  return p
}

function rettondo(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2))
  g.beginPath()
  g.moveTo(x + k, y)
  g.arcTo(x + w, y, x + w, y + h, k)
  g.arcTo(x + w, y + h, x, y + h, k)
  g.arcTo(x, y + h, x, y, k)
  g.arcTo(x, y, x + w, y, k)
  g.closePath()
}

/** dove va una foto dentro la sua cella: ingrandita quanto basta a riempirla, ma tagliando al massimo `taglioMax` */
export function adatta(cella: { w: number; h: number }, fw: number, fh: number, fx: number, fy: number, zoom: number, taglioMax: number): { x: number; y: number; w: number; h: number } {
  const scalaCopre = Math.max(cella.w / fw, cella.h / fh)
  const scalaStaDentro = Math.min(cella.w / fw, cella.h / fh)
  const s = Math.min(scalaCopre, scalaStaDentro / Math.max(0.05, 1 - taglioMax)) * Math.max(1, zoom)
  const w = fw * s
  const h = fh * s
  const x = w > cella.w ? -(w - cella.w) * fx : (cella.w - w) / 2
  const y = h > cella.h ? -(h - cella.h) * fy : (cella.h - h) / 2
  return { x, y, w, h }
}

// ---------------------------------------------------------------------------------------------------------------
// gli elementi (testi e forme)
// ---------------------------------------------------------------------------------------------------------------
let misuratore: CanvasRenderingContext2D | null = null
const misura = (): CanvasRenderingContext2D => (misuratore ??= document.createElement('canvas').getContext('2d')!)

const fontDi = (el: Elemento, px: number): string => `${el.grassetto === false ? '' : el.font === 'Impact' ? '' : '600 '}${px}px "${el.font || 'Georgia'}", serif`

/** il testo a capo dentro la larghezza data (le unità sono quelle di `dim`: mm) */
function righeTesto(el: Elemento, larghezza: number): string[] {
  const g = misura()
  g.font = fontDi(el, el.dim)
  const out: string[] = []
  for (const par of (el.testo || '').split('\n')) {
    let riga = ''
    for (const parola of par.split(/\s+/).filter(Boolean)) {
      const prova = riga ? `${riga} ${parola}` : parola
      if (riga && g.measureText(prova).width > larghezza) {
        out.push(riga)
        riga = parola
      } else riga = prova
    }
    out.push(riga)
  }
  return out.length ? out : ['']
}

/** il rettangolo dell'elemento sulla tela (mm, abbondanza compresa) */
export function rettElemento(el: Elemento, geo: Pick<Geometria, 'w' | 'h' | 'b'>): Rett {
  const w = el.w * geo.w
  let h: number
  if (el.tipo === 'testo') h = righeTesto(el, w).length * el.dim * 1.2
  else if (el.forma === 'linea') h = Math.max(0.4, el.dim)
  else h = (el.h ?? el.w) * geo.h
  return { x: geo.b + el.x * geo.w - w / 2, y: geo.b + el.y * geo.h - h / 2, w, h }
}

function disegnaElemento(g: CanvasRenderingContext2D, el: Elemento, geo: Geometria, k: number): void {
  const r = rettElemento(el, geo)
  g.save()
  g.globalAlpha = el.opacita ?? 1
  if (el.tipo === 'testo') {
    const px = el.dim * k
    g.font = fontDi(el, px)
    g.fillStyle = el.colore
    g.textBaseline = 'middle'
    g.textAlign = el.allinea === 'sinistra' ? 'left' : 'center'
    if (el.ombra) {
      g.shadowColor = 'rgba(0,0,0,.55)'
      g.shadowBlur = px * 0.25
    }
    const righe = righeTesto(el, r.w)
    const x = el.allinea === 'sinistra' ? r.x * k : (r.x + r.w / 2) * k
    righe.forEach((t, i) => g.fillText(t, x, (r.y + el.dim * 1.2 * (i + 0.5)) * k))
  } else {
    g.fillStyle = el.colore
    g.strokeStyle = el.colore
    if (el.forma === 'cerchio') {
      g.beginPath()
      g.ellipse((r.x + r.w / 2) * k, (r.y + r.h / 2) * k, (r.w / 2) * k, (r.h / 2) * k, 0, 0, Math.PI * 2)
      g.fill()
    } else if (el.forma === 'cornice') {
      g.lineWidth = Math.max(0.5, el.dim) * k
      g.strokeRect((r.x + el.dim / 2) * k, (r.y + el.dim / 2) * k, (r.w - el.dim) * k, (r.h - el.dim) * k)
    } else g.fillRect(r.x * k, r.y * k, r.w * k, r.h * k)
  }
  g.restore()
}

export interface OpzioniDisegno {
  /** pixel per millimetro */
  px: number
  /** foto grandi (stampa) o miniature (schermo) */
  grande: boolean
  guide?: boolean
  selezione?: number
  /** l'elemento scelto (riquadro con la maniglia per allargarlo) */
  elemento?: string
}

/** disegna lo spread; il canvas è grande (tw × px, th × px) */
export async function disegnaSpread(c: HTMLCanvasElement, a: Album, sp: Spread, o: OpzioniDisegno): Promise<void> {
  const foto = mappaFoto(a)
  const geo = geometria(a, sp, foto)
  c.width = Math.max(1, Math.round(geo.tw * o.px))
  c.height = Math.max(1, Math.round(geo.th * o.px))
  const g = c.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  const k = o.px
  g.fillStyle = a.sfondo.colore
  g.fillRect(0, 0, c.width, c.height)
  if (a.sfondo.tipo === 'immagine') {
    try {
      const im = await caricaImg(urlFile(a.sfondo.percorso), !o.grande)
      const s = Math.max(c.width / im.naturalWidth, c.height / im.naturalHeight)
      const w = im.naturalWidth * s
      const h = im.naturalHeight * s
      g.drawImage(im, (c.width - w) / 2, (c.height - h) / 2, w, h)
    } catch {
      /* resta il colore */
    }
  }
  const piazze = sp.piazze.filter((p) => foto.has(p.foto))
  // le celle da sotto a sopra (gli inserti sopra la foto a tutto foglio)
  const ordine = geo.celle.map((_, i) => i).filter((i) => i < piazze.length).sort((x, y) => (geo.celle[x].z ?? 0) - (geo.celle[y].z ?? 0) || x - y)
  for (const i of ordine) {
    const cella = geo.celle[i]
    const p = piazze[i]
    const f = foto.get(p.foto)!
    let im: HTMLImageElement
    try {
      im = await caricaImg(urlFile(o.grande ? f.grande : f.mini), !o.grande)
    } catch {
      g.fillStyle = '#888'
      g.fillRect(cella.x * k, cella.y * k, cella.w * k, cella.h * k)
      continue
    }
    const pieno = !!cella.vivo || (sp.stile === 'pieno' && piazze.length === 1)
    // la cornice (bianca o del colore dello stile) sta attorno alla foto, dentro la cella
    const bordo = pieno ? 0 : cella.cornice ?? a.bordoFoto
    const dentro = { x: cella.x + bordo, y: cella.y + bordo, w: Math.max(1, cella.w - 2 * bordo), h: Math.max(1, cella.h - 2 * bordo) }
    // a tutta pagina la foto riempie sempre (si taglia quel che serve)
    const pos = adatta(dentro, f.w, f.h, p.fx, p.fy, p.zoom, pieno ? 0.95 : a.taglioMax)
    // la parte della cella che la foto copre davvero (se non la riempie del tutto resta lo sfondo)
    const x0 = Math.max(0, pos.x)
    const y0 = Math.max(0, pos.y)
    const x1 = Math.min(dentro.w, pos.x + pos.w)
    const y1 = Math.min(dentro.h, pos.y + pos.h)
    const r = pieno ? 0 : a.angoli
    if (!pieno && (bordo > 0 || a.ombra)) {
      g.save()
      if (a.ombra) {
        g.shadowColor = 'rgba(0,0,0,.30)'
        g.shadowBlur = 3 * k
        g.shadowOffsetY = 0.9 * k
      }
      g.fillStyle = bordo > 0 ? a.coloreBordo : '#000'
      rettondo(g, (dentro.x + x0 - bordo) * k, (dentro.y + y0 - bordo) * k, (x1 - x0 + 2 * bordo) * k, (y1 - y0 + 2 * bordo) * k, r + bordo * 0.5)
      g.fill()
      g.restore()
    }
    g.save()
    rettondo(g, (dentro.x + x0) * k, (dentro.y + y0) * k, (x1 - x0) * k, (y1 - y0) * k, r)
    g.clip()
    g.drawImage(im, (dentro.x + pos.x) * k, (dentro.y + pos.y) * k, pos.w * k, pos.h * k)
    g.restore()
  }
  for (const el of sp.elementi || []) disegnaElemento(g, el, geo, k)
  if (sp.testo) {
    const px = Math.max(8, (Math.min(geo.w, geo.h) * 0.06) * k)
    g.font = `${a.font === 'Impact' ? '' : '600 '}${px}px "${a.font}", serif`
    g.fillStyle = a.coloreTesto
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const cx = (geo.b + geo.w / 2) * k
    const y = sp.posTesto === 'alto' ? (geo.b + a.margine * 0.5) * k + px * 0.3 : sp.posTesto === 'centro' ? (geo.b + geo.h / 2) * k : (geo.b + geo.h - a.margine * 0.5) * k - px * 0.3
    if (sp.posTesto === 'centro' || sp.stile === 'pieno') {
      g.shadowColor = 'rgba(0,0,0,.55)'
      g.shadowBlur = px * 0.25
      g.fillStyle = '#ffffff'
    }
    g.fillText(sp.testo, cx, y, geo.w * k * 0.9)
    g.shadowBlur = 0
  }
  if (o.guide) {
    g.save()
    g.lineWidth = Math.max(1, k * 0.25)
    g.setLineDash([k * 2, k * 2])
    // il vivo (dove si taglia)
    g.strokeStyle = 'rgba(255,60,120,.8)'
    g.strokeRect(geo.b * k, geo.b * k, geo.w * k, geo.h * k)
    g.strokeStyle = 'rgba(80,160,255,.6)'
    g.strokeRect(geo.area.x * k, geo.area.y * k, geo.area.w * k, geo.area.h * k)
    if (geo.piega) {
      g.strokeStyle = 'rgba(0,0,0,.45)'
      g.beginPath()
      g.moveTo(geo.piega * k, geo.b * k)
      g.lineTo(geo.piega * k, (geo.b + geo.h) * k)
      g.stroke()
    }
    g.restore()
  }
  if (o.selezione !== undefined && geo.celle[o.selezione]) {
    const s = geo.celle[o.selezione]
    g.save()
    g.lineWidth = Math.max(3, k * 0.8)
    g.strokeStyle = '#ffd54a'
    g.strokeRect(s.x * k, s.y * k, s.w * k, s.h * k)
    g.restore()
  }
  const sel = o.elemento ? (sp.elementi || []).find((e) => e.id === o.elemento) : undefined
  if (sel) {
    const r = rettElemento(sel, geo)
    g.save()
    g.lineWidth = Math.max(2, k * 0.5)
    g.strokeStyle = '#5ec8ff'
    g.setLineDash([k * 1.5, k * 1.2])
    g.strokeRect(r.x * k, r.y * k, r.w * k, r.h * k)
    g.setLineDash([])
    const m = Math.max(10, k * 3)
    g.fillStyle = '#5ec8ff'
    g.fillRect(r.x * k + r.w * k - m / 2, r.y * k + r.h * k - m / 2, m, m)
    g.restore()
  }
}
