// L'esportazione: ogni spread (o ogni pagina) a 150/200/300 dpi, in JPEG o in un PDF a grandezza vera, pronto per la stampa.
import { api, type PaginaPdf } from '../api'
import { disegnaSpread } from './disegna'
import { spreadDi, type Album } from './tipi'

export interface OpzioniEsporta {
  cartella: string
  nome: string
  formato: 'jpeg' | 'pdf'
  /** due pagine affiancate (come sono nell'editor) o una pagina per file */
  pagine: 'doppie' | 'singole'
  dpi: number
  /** con l'abbondanza (il vivo) attorno, come la vuole il laboratorio */
  abbondanza: boolean
  qualita: number
}

const LATO_MAX_PX = 15000

function ritaglia(c: HTMLCanvasElement, x: number, y: number, w: number, h: number): HTMLCanvasElement {
  const o = document.createElement('canvas')
  o.width = Math.max(1, Math.round(w))
  o.height = Math.max(1, Math.round(h))
  o.getContext('2d')!.drawImage(c, Math.round(x), Math.round(y), o.width, o.height, 0, 0, o.width, o.height)
  return o
}

const comeJpeg = (c: HTMLCanvasElement, q: number): string => c.toDataURL('image/jpeg', q)

/** i file esportati (percorsi). `fermo.si` = true ferma tutto. */
export async function esporta(a: Album, o: OpzioniEsporta, avanza: (fatto: number, totale: number, testo: string) => void, fermo: { si: boolean }): Promise<string[]> {
  const s = spreadDi(a)
  const b = a.abbondanza
  // se la tela viene più grande di quello che un canvas regge, si abbassa la risoluzione
  const dpi = Math.min(o.dpi, Math.floor(((LATO_MAX_PX / (s.w + 2 * b)) * 25.4)))
  const px = dpi / 25.4
  const totale = a.spreads.length
  const usciti: string[] = []
  const pdf: PaginaPdf[] = []
  const nn = (i: number, n: number): string => String(i + 1).padStart(String(n).length > 1 ? 2 : 2, '0')
  let numPagina = 0
  for (let i = 0; i < totale; i++) {
    if (fermo.si) break
    avanza(i, totale, `Spread ${i + 1} di ${totale}`)
    const c = document.createElement('canvas')
    await disegnaSpread(c, a, a.spreads[i], { px, grande: true })
    const pezzi: HTMLCanvasElement[] = []
    const taglioB = o.abbondanza ? 0 : b * px
    if (o.pagine === 'doppie' || !a.doppie) {
      pezzi.push(o.abbondanza ? c : ritaglia(c, taglioB, taglioB, c.width - 2 * taglioB, c.height - 2 * taglioB))
    } else {
      const meta = (s.w / 2) * px
      const bleed = o.abbondanza ? b * px : 0
      const y0 = o.abbondanza ? 0 : b * px
      const h = o.abbondanza ? c.height : c.height - 2 * b * px
      // ogni pagina col suo vivo attorno (dal lato della piega continua l'altra pagina: va tagliato via)
      pezzi.push(ritaglia(c, o.abbondanza ? 0 : b * px, y0, meta + 2 * bleed, h))
      pezzi.push(ritaglia(c, b * px + meta - bleed, y0, meta + 2 * bleed, h))
    }
    for (const p of pezzi) {
      numPagina++
      const url = comeJpeg(p, o.qualita)
      const mmL = p.width / px
      const mmA = p.height / px
      if (o.formato === 'jpeg') {
        const nome = `${o.nome}-${o.pagine === 'doppie' || !a.doppie ? `spread-${nn(i, totale)}` : `pagina-${String(numPagina).padStart(2, '0')}`}.jpg`
        usciti.push(await api.album.esportata(o.cartella, nome, url))
      } else {
        const f = await api.file.salvaTemp(url, `album-${a.id.slice(0, 6)}-${numPagina}`)
        pdf.push({ jpeg: f, larghezza: p.width, altezza: p.height, mmL, mmA })
      }
    }
    // si dà il tempo all'interfaccia di respirare
    await new Promise((r) => setTimeout(r, 0))
  }
  if (!fermo.si && o.formato === 'pdf' && pdf.length) {
    avanza(totale, totale, 'Scrivo il PDF…')
    const dest = `${o.cartella}\\${o.nome}.pdf`
    usciti.push(await api.album.pdf(dest, pdf))
  }
  avanza(fermo.si ? usciti.length : totale, totale, fermo.si ? 'Fermato' : 'Fatto')
  return usciti
}
