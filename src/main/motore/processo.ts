// Il processo di ComfyUI: lo avvia, guarda quando è pronto, tiene le ultime righe del log, lo chiude.
import { spawn, execFile, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import type { InfoMotore } from '@shared/tipi'
import { COMFY, ENTRATA, LOG, PYTHON, TEMP, USCITA, UTENTE_COMFY, assicura } from '../percorsi'
import { impostazioni } from '../impostazioni'
import { motoreInstallato } from '../installa/installatore'

let proc: ChildProcess | null = null
let info: InfoMotore = { stato: 'spento', porta: 0 }
const righe: string[] = []
const ascoltatori = new Set<(i: InfoMotore) => void>()
const ascoltatoriLog = new Set<(r: string) => void>()
let avvioInCorso: Promise<void> | null = null

export const infoMotore = (): InfoMotore => info
export const logMotore = (): string[] => righe.slice()
export const indirizzo = (): string => `127.0.0.1:${info.porta}`

export function suCambioMotore(f: (i: InfoMotore) => void): () => void {
  ascoltatori.add(f)
  return () => ascoltatori.delete(f)
}
export function suLogMotore(f: (r: string) => void): () => void {
  ascoltatoriLog.add(f)
  return () => ascoltatoriLog.delete(f)
}

function cambia(nuovo: Partial<InfoMotore>): void {
  info = { ...info, ...nuovo }
  for (const f of ascoltatori) f(info)
}

function aggiungiRiga(r: string): void {
  // via i colori ANSI
  const pulita = r.replace(/\x1b\[[0-9;]*m/g, '')
  righe.push(pulita)
  if (righe.length > 800) righe.splice(0, righe.length - 800)
  try {
    appendFileSync(join(LOG, 'motore.log'), pulita + '\n')
  } catch {
    /* niente */
  }
  for (const f of ascoltatoriLog) f(pulita)
}

function portaLibera(p: number): Promise<boolean> {
  return new Promise((ok) => {
    const s = createServer()
    s.once('error', () => ok(false))
    s.once('listening', () => s.close(() => ok(true)))
    s.listen(p, '127.0.0.1')
  })
}

async function trovaPorta(da: number): Promise<number> {
  for (let p = da; p < da + 40; p++) if (await portaLibera(p)) return p
  throw new Error('nessuna porta libera per il motore')
}

const attendi = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export async function aggiornaVram(): Promise<void> {
  if (info.stato !== 'pronto') return
  try {
    const r = await fetch(`http://${indirizzo()}/system_stats`)
    const j = (await r.json()) as { system: { comfyui_version: string }; devices: { name: string; vram_total: number; vram_free: number }[] }
    const d = j.devices[0]
    cambia({
      vramTotale: d?.vram_total,
      vramLibera: d?.vram_free,
      gpu: d?.name.replace(/^cuda:\d+\s*/, '').replace(/\s*:\s*cudaMallocAsync/, ''),
      versione: j.system.comfyui_version
    })
  } catch {
    /* niente */
  }
}

export function avviaMotore(): Promise<void> {
  if (info.stato === 'pronto' && proc) return Promise.resolve()
  if (avvioInCorso) return avvioInCorso
  avvioInCorso = (async () => {
    if (!motoreInstallato()) {
      cambia({ stato: 'non installato', messaggio: 'Il motore non è ancora installato.' })
      throw new Error('motore non installato')
    }
    const imp = impostazioni()
    assicura(ENTRATA, USCITA, UTENTE_COMFY, LOG, join(TEMP, 'comfy'), imp.cartellaModelli)
    const porta = await trovaPorta(imp.porta)
    cambia({ stato: 'avvio', porta, messaggio: 'Avvio il motore…' })
    const args = [
      '-s', join(COMFY, 'main.py'),
      '--listen', '127.0.0.1', '--port', String(porta),
      '--disable-auto-launch',
      '--models-directory', imp.cartellaModelli,
      '--output-directory', USCITA,
      '--input-directory', ENTRATA,
      '--user-directory', UTENTE_COMFY,
      '--temp-directory', join(TEMP, 'comfy'),
      '--preview-method', imp.anteprimaLive ? 'auto' : 'none',
      '--preview-size', '640'
    ]
    if (imp.riservaVram > 0) args.push('--reserve-vram', String(imp.riservaVram))
    if (imp.argomentiExtra.trim()) args.push(...imp.argomentiExtra.trim().split(/\s+/))
    aggiungiRiga('> python ' + args.join(' '))
    const p = spawn(PYTHON, args, {
      cwd: COMFY,
      windowsHide: true,
      env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
    })
    proc = p
    let coda = ''
    const leggi = (b: Buffer): void => {
      coda += b.toString('utf8')
      const rr = coda.split(/\r?\n/)
      coda = rr.pop() || ''
      for (const r of rr) if (r.trim()) aggiungiRiga(r)
    }
    p.stdout?.on('data', leggi)
    p.stderr?.on('data', leggi)
    let uscito = false
    p.on('exit', (c) => {
      uscito = true
      if (proc === p) {
        proc = null
        const ultime = righe.slice(-6).join('\n')
        cambia({ stato: info.stato === 'spento' ? 'spento' : 'errore', messaggio: c ? `Il motore si è fermato (codice ${c}).\n${ultime}` : 'Motore spento.' })
      }
    })
    // pronto quando risponde
    const inizio = Date.now()
    for (;;) {
      if (uscito) throw new Error('il motore si è chiuso all\'avvio: guarda il log del motore')
      if (Date.now() - inizio > 240_000) throw new Error('il motore non risponde dopo 4 minuti')
      try {
        const r = await fetch(`http://127.0.0.1:${porta}/system_stats`)
        if (r.ok) break
      } catch {
        /* ancora no */
      }
      await attendi(600)
    }
    cambia({ stato: 'pronto', messaggio: 'Motore pronto.' })
    await aggiornaVram()
  })()
  return avvioInCorso
    .catch((e) => {
      if (info.stato !== 'non installato') cambia({ stato: 'errore', messaggio: (e as Error).message })
      throw e
    })
    .finally(() => {
      avvioInCorso = null
    })
}

export async function fermaMotore(): Promise<void> {
  const p = proc
  cambia({ stato: 'spento', messaggio: 'Motore spento.' })
  proc = null
  if (!p?.pid) return
  // su Windows si chiude tutto l'albero dei processi
  await new Promise<void>((ok) => execFile('taskkill', ['/PID', String(p.pid), '/T', '/F'], { windowsHide: true }, () => ok()))
}

export async function riavviaMotore(): Promise<void> {
  await fermaMotore()
  await attendi(800)
  await avviaMotore()
}
