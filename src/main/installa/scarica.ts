// Scarica file grandi: riprende da dove si era fermato (.part + Range), segue i redirect,
// calcola lo sha256 mentre scrive e lo controlla alla fine.
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'
import { assicura } from '../percorsi'

export interface OpzioniScarica {
  url: string
  destinazione: string
  sha256?: string
  intestazioni?: Record<string, string>
  segnale?: AbortSignal
  /** ricevuti, totali, byte al secondo */
  avanzamento?: (ricevuti: number, totali: number, velocita: number) => void
  /** chiamato quando comincia la verifica finale */
  verifica?: () => void
}

async function hashFile(percorso: string, hash: ReturnType<typeof createHash>): Promise<void> {
  await new Promise<void>((ok, ko) => {
    createReadStream(percorso, { highWaterMark: 4 << 20 })
      .on('data', (c) => hash.update(c))
      .on('end', () => ok())
      .on('error', ko)
  })
}

export async function sha256File(percorso: string): Promise<string> {
  const h = createHash('sha256')
  await hashFile(percorso, h)
  return h.digest('hex')
}

export async function scarica(o: OpzioniScarica): Promise<void> {
  assicura(dirname(o.destinazione))
  const parte = o.destinazione + '.part'
  let gia = existsSync(parte) ? statSync(parte).size : 0
  const hash = createHash('sha256')

  const intestazioni: Record<string, string> = { 'User-Agent': 'DaProdImage/0.1', ...(o.intestazioni || {}) }
  if (gia > 0) intestazioni.Range = `bytes=${gia}-`
  const r = await fetch(o.url, { headers: intestazioni, redirect: 'follow', signal: o.segnale })
  if (r.status === 416) {
    // il .part è già completo
  } else if (!r.ok) {
    throw new Error(`download non riuscito (${r.status} ${r.statusText}) da ${new URL(o.url).host}`)
  }
  if (r.status === 200 && gia > 0) {
    // il server non riprende: si ricomincia
    gia = 0
  }
  const lunghezza = Number(r.headers.get('content-length') || 0)
  const totali = r.status === 206 ? gia + lunghezza : r.status === 416 ? gia : lunghezza
  if (gia > 0 && r.status !== 200) await hashFile(parte, hash)

  if (r.status !== 416 && r.body) {
    const scrivi = createWriteStream(parte, { flags: gia > 0 && r.status === 206 ? 'a' : 'w' })
    let ricevuti = gia
    let ultimo = Date.now()
    let byteFinestra = 0
    let velocita = 0
    const lettore = r.body.getReader()
    try {
      for (;;) {
        const { done, value } = await lettore.read()
        if (done) break
        hash.update(value)
        ricevuti += value.length
        byteFinestra += value.length
        if (!scrivi.write(value)) await new Promise<void>((ok) => scrivi.once('drain', () => ok()))
        const ora = Date.now()
        if (ora - ultimo >= 400) {
          const v = (byteFinestra * 1000) / (ora - ultimo)
          velocita = velocita ? velocita * 0.7 + v * 0.3 : v
          byteFinestra = 0
          ultimo = ora
          o.avanzamento?.(ricevuti, totali, velocita)
        }
      }
    } finally {
      await new Promise<void>((ok) => scrivi.end(() => ok()))
    }
    o.avanzamento?.(ricevuti, totali, velocita)
    if (totali && ricevuti < totali) throw new Error('download interrotto: riprova, riparte da dove si era fermato')
  }

  if (o.sha256) {
    o.verifica?.()
    const fatto = hash.digest('hex')
    if (fatto !== o.sha256) {
      unlinkSync(parte)
      throw new Error('il file scaricato è rovinato (sha256 diverso): lo riscarico da capo se riprovi')
    }
  }
  if (existsSync(o.destinazione)) unlinkSync(o.destinazione)
  renameSync(parte, o.destinazione)
}
