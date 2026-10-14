// Il disegno di uno spread su un canvas: sfondo, foto nelle celle (con il taglio che dici tu), angoli, testo.
// Lo stesso codice serve per lo schermo (miniature leggere) e per l'esportazione (foto grandi, 300 dpi).
import { layoutDi, reginaDi, type Cella, type Rett } from './layout'
import { spreadDi, type Album, type FotoAlbum, type Spread } from './tipi'
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
  if (pieno && piazze.length === 1) {
    // a tutta pagina: arriva fino al vivo (abbondanza compresa)
    celle = [{ x: 0, y: 0, w: tw, h: th, foto: 0 }]
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

export interface OpzioniDisegno {
  /** pixel per millimetro */
  px: number
  /** foto grandi (stampa) o miniature (schermo) */
  grande: boolean
  guide?: boolean
  selezione?: number
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
  for (let i = 0; i < geo.celle.length && i < piazze.length; i++) {
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
    const pieno = sp.stile === 'pieno' && piazze.length === 1
    // a tutta pagina la foto riempie sempre (si taglia quel che serve)
    const pos = adatta(cella, f.w, f.h, p.fx, p.fy, p.zoom, pieno ? 0.95 : a.taglioMax)
    // la parte della cella che la foto copre davvero (se non la riempie del tutto resta lo sfondo)
    const x0 = Math.max(0, pos.x)
    const y0 = Math.max(0, pos.y)
    const x1 = Math.min(cella.w, pos.x + pos.w)
    const y1 = Math.min(cella.h, pos.y + pos.h)
    g.save()
    rettondo(g, (cella.x + x0) * k, (cella.y + y0) * k, (x1 - x0) * k, (y1 - y0) * k, pieno ? 0 : a.angoli * k)
    g.clip()
    g.drawImage(im, (cella.x + pos.x) * k, (cella.y + pos.y) * k, pos.w * k, pos.h * k)
    g.restore()
  }
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
}
