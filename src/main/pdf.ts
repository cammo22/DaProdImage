// Un PDF fatto di sole immagini JPEG, una per pagina, a grandezza vera (in mm): quello che serve per mandare l'album in stampa.
// Niente librerie: le immagini JPEG entrano così come sono (DCTDecode).
import { readFileSync, writeFileSync } from 'node:fs'

export interface PaginaPdf {
  jpeg: string
  /** pixel dell'immagine */
  larghezza: number
  altezza: number
  /** grandezza della pagina in mm */
  mmL: number
  mmA: number
}

const PT = 72 / 25.4

export function scriviPdf(destinazione: string, pagine: PaginaPdf[]): void {
  const parti: Buffer[] = []
  const offset: number[] = []
  let lunghezza = 0
  const scrivi = (b: Buffer | string): void => {
    const x = typeof b === 'string' ? Buffer.from(b, 'latin1') : b
    parti.push(x)
    lunghezza += x.length
  }
  const oggetto = (n: number, corpo: Buffer | string, flusso?: Buffer): void => {
    offset[n] = lunghezza
    scrivi(`${n} 0 obj\n`)
    scrivi(corpo)
    if (flusso) {
      scrivi('\nstream\n')
      scrivi(flusso)
      scrivi('\nendstream')
    }
    scrivi('\nendobj\n')
  }
  scrivi('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  // oggetti: 1 catalogo, 2 pagine, poi per ogni pagina: pagina, contenuto, immagine
  const idPagina = (i: number): number => 3 + i * 3
  oggetto(1, '<< /Type /Catalog /Pages 2 0 R >>')
  oggetto(2, `<< /Type /Pages /Kids [${pagine.map((_, i) => `${idPagina(i)} 0 R`).join(' ')}] /Count ${pagine.length} >>`)
  pagine.forEach((p, i) => {
    const w = +(p.mmL * PT).toFixed(2)
    const h = +(p.mmA * PT).toFixed(2)
    const id = idPagina(i)
    oggetto(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`)
    const contenuto = Buffer.from(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`, 'latin1')
    oggetto(id + 1, `<< /Length ${contenuto.length} >>`, contenuto)
    const jpg = readFileSync(p.jpeg)
    oggetto(id + 2, `<< /Type /XObject /Subtype /Image /Width ${p.larghezza} /Height ${p.altezza} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>`, jpg)
  })
  const totale = 3 + pagine.length * 3
  const xref = lunghezza
  scrivi(`xref\n0 ${totale}\n0000000000 65535 f \n`)
  for (let n = 1; n < totale; n++) scrivi(`${String(offset[n]).padStart(10, '0')} 00000 n \n`)
  scrivi(`trailer\n<< /Size ${totale} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  writeFileSync(destinazione, Buffer.concat(parti))
}
