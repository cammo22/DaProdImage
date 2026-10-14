// La data di scatto di una foto: dall'EXIF dei JPEG e dai RAW basati su TIFF (CR2, NEF, ARW, DNG, ORF, RW2, PEF…).
// Se non c'è (PNG, HEIC, WEBP…) si usa la data del file. Serve a mettere le foto dell'album nell'ordine in cui sono state fatte.
import { closeSync, openSync, readSync, statSync } from 'node:fs'

const LETTI_MAX = 3 << 20

/** "2024:06:14 18:32:05" → millisecondi (ora locale) */
function daTesto(t: string): number | undefined {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(t)
  if (!m || m[1] === '0000') return undefined
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]))
  const ms = d.getTime()
  return Number.isFinite(ms) ? ms : undefined
}

/** cerca la data in un blocco TIFF che comincia a `inizio` dentro `b` */
export function dataDaTiff(b: Buffer, inizio: number): number | undefined {
  if (b.length < inizio + 8) return undefined
  const ordine = b.toString('latin1', inizio, inizio + 2)
  const le = ordine === 'II'
  if (!le && ordine !== 'MM') return undefined
  const u16 = (o: number): number => (le ? b.readUInt16LE(inizio + o) : b.readUInt16BE(inizio + o))
  const u32 = (o: number): number => (le ? b.readUInt32LE(inizio + o) : b.readUInt32BE(inizio + o))
  if (u16(2) !== 42) return undefined
  let originale: number | undefined
  let modifica: number | undefined
  const leggiIfd = (off: number, profondita: number): void => {
    if (off <= 0 || inizio + off + 2 > b.length || profondita > 3) return
    const n = u16(off)
    for (let i = 0; i < n && i < 400; i++) {
      const e = off + 2 + i * 12
      if (inizio + e + 12 > b.length) return
      const tag = u16(e)
      const tipo = u16(e + 2)
      const conta = u32(e + 4)
      if ((tag === 0x9003 || tag === 0x9004 || tag === 0x0132) && tipo === 2 && conta >= 19) {
        const dove = conta > 4 ? u32(e + 8) : e + 8
        if (inizio + dove + 19 <= b.length) {
          const v = daTesto(b.toString('latin1', inizio + dove, inizio + dove + 19))
          if (tag === 0x0132) modifica ??= v
          else originale ??= v
        }
      } else if (tag === 0x8769 || tag === 0x8825) {
        if (tag === 0x8769) leggiIfd(u32(e + 8), profondita + 1)
      }
    }
  }
  leggiIfd(u32(4), 0)
  return originale ?? modifica
}

/** la data di scatto (o quella del file) in millisecondi */
export function dataFoto(percorso: string): number {
  let mtime = Date.now()
  try {
    mtime = statSync(percorso).mtimeMs
    const fd = openSync(percorso, 'r')
    try {
      const b = Buffer.alloc(Math.min(LETTI_MAX, statSync(percorso).size))
      const n = readSync(fd, b, 0, b.length, 0)
      const buf = b.subarray(0, n)
      // JPEG: i segmenti APP1 "Exif"
      if (buf[0] === 0xff && buf[1] === 0xd8) {
        let p = 2
        while (p + 4 < buf.length && buf[p] === 0xff) {
          const marcatore = buf[p + 1]
          const lung = buf.readUInt16BE(p + 2)
          if (marcatore === 0xe1 && buf.toString('latin1', p + 4, p + 10) === 'Exif\0\0') {
            const d = dataDaTiff(buf, p + 10)
            if (d) return d
          }
          if (marcatore === 0xda) break
          p += 2 + lung
        }
      } else if ((buf[0] === 0x49 && buf[1] === 0x49) || (buf[0] === 0x4d && buf[1] === 0x4d)) {
        const d = dataDaTiff(buf, 0)
        if (d) return d
      }
    } finally {
      closeSync(fd)
    }
  } catch {
    /* si usa la data del file */
  }
  return mtime
}
