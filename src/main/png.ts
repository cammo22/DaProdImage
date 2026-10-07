// Le impostazioni di ogni immagine viaggiano dentro il PNG (chunk iTXt "daprod", UTF-8):
// trascini una foto fatta con DaProd Image e ritrovi prompt, seed, LoRA.
import { crc32 } from 'node:zlib'

const FIRMA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function chunk(tipo: string, dati: Buffer): Buffer {
  const lung = Buffer.alloc(4)
  lung.writeUInt32BE(dati.length)
  const td = Buffer.concat([Buffer.from(tipo, 'latin1'), dati])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td) >>> 0)
  return Buffer.concat([lung, td, crc])
}

/** aggiunge (o sostituisce) il chunk daprod prima di IEND */
export function scriviMetadati(png: Buffer, meta: unknown): Buffer {
  if (!png.subarray(0, 8).equals(FIRMA)) return png
  const testo = Buffer.from(JSON.stringify(meta), 'utf8')
  // keyword \0 compressione(0) metodo(0) lingua \0 parola tradotta \0 testo
  const dati = Buffer.concat([Buffer.from('daprod', 'latin1'), Buffer.from([0, 0, 0, 0, 0]), testo])
  const pezzi: Buffer[] = [FIRMA]
  let o = 8
  while (o + 8 <= png.length) {
    const lung = png.readUInt32BE(o)
    const tipo = png.toString('latin1', o + 4, o + 8)
    const intero = png.subarray(o, o + 12 + lung)
    o += 12 + lung
    if (tipo === 'iTXt' && intero.toString('latin1', 8, 15) === 'daprod\0') continue
    if (tipo === 'IEND') pezzi.push(chunk('iTXt', dati))
    pezzi.push(intero)
    if (tipo === 'IEND') break
  }
  return Buffer.concat(pezzi)
}

export function leggiMetadati(png: Buffer): Record<string, unknown> | null {
  if (!png.subarray(0, 8).equals(FIRMA)) return null
  let o = 8
  while (o + 8 <= png.length) {
    const lung = png.readUInt32BE(o)
    const tipo = png.toString('latin1', o + 4, o + 8)
    if (tipo === 'iTXt' && png.toString('latin1', o + 8, o + 15) === 'daprod\0') {
      const dati = png.subarray(o + 8, o + 8 + lung)
      // salta keyword\0, 2 byte, lingua\0, parola\0
      let i = 7 + 2
      while (i < dati.length && dati[i] !== 0) i++
      i++
      while (i < dati.length && dati[i] !== 0) i++
      i++
      try {
        return JSON.parse(dati.subarray(i).toString('utf8'))
      } catch {
        return null
      }
    }
    if (tipo === 'IEND') break
    o += 12 + lung
  }
  return null
}

/** larghezza e altezza da IHDR */
export function dimensioniPng(png: Buffer): { larghezza: number; altezza: number } | null {
  if (!png.subarray(0, 8).equals(FIRMA)) return null
  return { larghezza: png.readUInt32BE(16), altezza: png.readUInt32BE(20) }
}
