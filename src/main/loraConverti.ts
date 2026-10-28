// Porta un LoRA di FLUX 3 Klein dal formato Diffusers/SimpleTuner a quello di ComfyUI (vedi `shared/loraConverti.ts`).
// Si riscrive solo l'intestazione del .safetensors: i pesi restano com'erano (si copiano a blocchi, nessun torch).
// Niente Electron: lo prova `node test/lora-converti.mjs`.
import { closeSync, openSync, readSync, renameSync, statSync, unlinkSync, writeSync } from 'node:fs'
import { chiaveComfy, rangoEAlpha } from '@shared/loraConverti'

interface Tensore {
  dtype: string
  shape: number[]
  data_offsets: [number, number]
}
type Intestazione = Record<string, Tensore | Record<string, string>>

function leggiIntestazione(fd: number): { h: Intestazione; inizioDati: number } {
  const b8 = Buffer.alloc(8)
  readSync(fd, b8, 0, 8, 0)
  const n = Number(b8.readBigUInt64LE(0))
  if (n <= 0 || n > 100_000_000) throw new Error('intestazione del LoRA non valida')
  const b = Buffer.alloc(n)
  readSync(fd, b, 0, n, 8)
  return { h: JSON.parse(b.toString('utf8')) as Intestazione, inizioDati: 8 + n }
}

/** Converte `da` in un file nuovo `a` (si scrive in un file accanto e poi lo si rinomina: un LoRA a metà non resta mai in giro).
 *  Ritorna quanti tensori sono stati rinominati e quanti lasciati fuori (quelli che non si sanno portare, di solito nessuno). */
export function convertiLoraKlein(da: string, a: string): { rinominati: number; scartati: number } {
  const fd = openSync(da, 'r')
  const tmp = a + '.converto'
  let out: number | undefined
  try {
    const { h, inizioDati } = leggiIntestazione(fd)
    const meta = (h.__metadata__ || {}) as Record<string, string>
    const ra = rangoEAlpha(meta)
    const nuovo: Intestazione = {}
    let rinominati = 0
    let scartati = 0
    const moduli = new Set<string>()
    for (const [k, v] of Object.entries(h)) {
      if (k === '__metadata__') continue
      const nk = chiaveComfy(k)
      if (!nk) {
        scartati++
        continue
      }
      nuovo[nk] = v as Tensore
      rinominati++
      if (nk.endsWith('.lora_A.weight')) moduli.add(nk.slice(0, -'.lora_A.weight'.length))
    }
    if (!rinominati) throw new Error('nessun tensore riconosciuto: non è un LoRA di FLUX 3 Klein')
    // dopo l'ultimo peso (se lo scale non è 1) si aggiunge un tensore `alpha` per modulo, come fa AI Toolkit
    let fine = Math.max(...Object.values(nuovo).map((t) => (t as Tensore).data_offsets[1]))
    const alphaBytes: Buffer[] = []
    if (ra && Math.abs(ra.alpha - ra.r) > 1e-6) {
      for (const m of moduli) {
        const buf = Buffer.alloc(4)
        buf.writeFloatLE(ra.alpha, 0)
        nuovo[`${m}.alpha`] = { dtype: 'F32', shape: [], data_offsets: [fine, fine + 4] }
        alphaBytes.push(buf)
        fine += 4
      }
    }
    nuovo.__metadata__ = { ...meta, ss_base_model_version: 'flux3', converted_from: 'diffusers', format: 'pt' }
    let testo = JSON.stringify(nuovo)
    testo += ' '.repeat((8 - (Buffer.byteLength(testo) % 8)) % 8)
    const intest = Buffer.from(testo, 'utf8')
    const len = Buffer.alloc(8)
    len.writeBigUInt64LE(BigInt(intest.length), 0)
    out = openSync(tmp, 'w')
    writeSync(out, len)
    writeSync(out, intest)
    // i pesi originali, a blocchi da 32 MB (dall'inizio dei dati fino all'ultimo byte usato)
    const totale = Math.max(...Object.values(h).filter((t): t is Tensore => !!(t as Tensore).data_offsets).map((t) => t.data_offsets[1]))
    const blocco = Buffer.alloc(32 * 1024 * 1024)
    for (let pos = 0; pos < totale; ) {
      const n = Math.min(blocco.length, totale - pos)
      const letti = readSync(fd, blocco, 0, n, inizioDati + pos)
      if (letti <= 0) throw new Error('il file del LoRA è più corto di quello che dice la sua intestazione')
      writeSync(out, blocco, 0, letti)
      pos += letti
    }
    for (const b of alphaBytes) writeSync(out, b)
    closeSync(out)
    out = undefined
    renameSync(tmp, a)
    return { rinominati, scartati }
  } catch (e) {
    try {
      if (out !== undefined) closeSync(out)
      out = undefined
      unlinkSync(tmp)
    } catch {
      /* niente */
    }
    throw e
  } finally {
    closeSync(fd)
    if (out !== undefined) closeSync(out)
  }
}

/** Converte il file sul posto: l'originale resta accanto come `.diffusers.bak` (la scansione dei LoRA non lo vede). */
export function convertiSulPosto(percorso: string): { rinominati: number; scartati: number } {
  const nuovo = percorso + '.nuovo'
  const r = convertiLoraKlein(percorso, nuovo)
  unlinkSyncSafe(percorso + '.diffusers.bak')
  renameSync(percorso, percorso + '.diffusers.bak')
  renameSync(nuovo, percorso)
  return r
}

function unlinkSyncSafe(p: string): void {
  try {
    if (statSync(p)) unlinkSync(p)
  } catch {
    /* non c'è */
  }
}
