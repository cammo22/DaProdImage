// Il processo di ComfyUI: lo avvia, guarda quando è pronto, tiene le ultime righe del log, lo chiude.
import { spawn, execFile, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { appendFileSync, existsSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { InfoMotore } from '@shared/tipi'
import { COMFY, ENTRATA, LOG, MOTORE, PYTHON, TEMP, USCITA, UTENTE_COMFY, assicura } from '../percorsi'
import { impostazioni, profiloMemoria, salvaImpostazioni } from '../impostazioni'
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

// il numero del processo del motore si scrive su disco: se l'app viene chiusa a forza (Task Manager, crash, installer) il motore resta vivo
// con la scheda occupata; al prossimo avvio lo si riconosce e lo si chiude, invece di lanciarne un secondo
const FILE_PID = join(MOTORE, 'motore.pid')
function chiudiOrfano(): Promise<void> {
  return new Promise((ok) => {
    let pid = 0
    try {
      pid = Number(readFileSync(FILE_PID, 'utf8').trim()) || 0
    } catch {
      /* nessun motore precedente */
    }
    rmSync(FILE_PID, { force: true })
    if (!pid) return ok()
    execFile('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { windowsHide: true }, (_e, out) => {
      if (!/python/i.test(String(out))) return ok()
      aggiungiRiga(`> un motore rimasto acceso da prima (pid ${pid}): lo chiudo`)
      execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => ok())
    })
  })
}

/** il registro del motore non cresce per sempre: oltre 5 MB si archivia (e si tiene solo l'ultimo) */
function ruotaLog(): void {
  const f = join(LOG, 'motore.log')
  try {
    if (existsSync(f) && statSync(f).size > 5 * 1024 * 1024) {
      rmSync(join(LOG, 'motore.old.log'), { force: true })
      renameSync(f, join(LOG, 'motore.old.log'))
    }
  } catch {
    /* niente */
  }
}
export async function aggiornaVram(): Promise<void> {
  if (info.stato !== 'pronto') return
  try {
    const r = await fetch(`http://${indirizzo()}/system_stats`, { signal: AbortSignal.timeout(5000) })
    const j = (await r.json()) as { system: { comfyui_version: string }; devices: { name: string; vram_total: number; vram_free: number }[] }
    const d = j.devices[0]
    // la VRAM della scheda si ricorda: serve a scegliere il profilo di memoria prima del prossimo avvio
    const mb = d?.vram_total ? Math.round(d.vram_total / 1048576) : 0
    if (mb && Math.abs(mb - impostazioni().vramMB) > 64) salvaImpostazioni({ vramMB: mb })
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
    ruotaLog()
    await chiudiOrfano()
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
      // taesd: con il decoder TAEQI 2.1 in models/vae_approx l'anteprima è nitida a ogni passo ("auto" userebbe
      // sempre l'approssimazione lineare, a 1/16 della risoluzione); se il file manca il motore torna da solo a quella
      '--preview-method', imp.anteprimaLive ? 'taesd' : 'none',
      '--preview-size', '1024'
    ]
    // 6 GB: un margine fisso perché il motore scarichi lui i pezzi in RAM, invece di lasciare che il driver
    // di Windows "allarghi" la VRAM nella RAM condivisa (lì tutto va 5-10 volte più piano)
    const riserva = imp.riservaVram > 0 ? imp.riservaVram : profiloMemoria() === 'bassa' ? 0.6 : 0
    if (riserva > 0) args.push('--reserve-vram', String(riserva))
    if (imp.veloce && !/--fast\b/.test(imp.argomentiExtra)) args.push('--fast', 'fp16_accumulation')
    if (imp.argomentiExtra.trim()) args.push(...imp.argomentiExtra.trim().split(/\s+/))
    aggiungiRiga('> python ' + args.join(' '))
    // un altro Python installato dall'utente non deve influenzare quello del motore
    const ambiente = { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } as NodeJS.ProcessEnv
    delete ambiente.PYTHONPATH
    delete ambiente.PYTHONHOME
    const p = spawn(PYTHON, args, { cwd: COMFY, windowsHide: true, env: ambiente })
    proc = p
    if (p.pid) {
      try {
        writeFileSync(FILE_PID, String(p.pid))
      } catch {
        /* niente */
      }
    }
    let erroreAvvio = ''
    // se python.exe manca o l'antivirus lo ha messo in quarantena, spawn dà un errore: senza questo si aspetterebbero 4 minuti per niente
    p.on('error', (e) => {
      erroreAvvio = e.message
    })
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
      rmSync(FILE_PID, { force: true })
      if (proc === p) {
        proc = null
        const ultime = righe.slice(-6).join('\n')
        cambia({ stato: info.stato === 'spento' ? 'spento' : 'errore', messaggio: c ? `Il motore si è fermato (codice ${c}).\n${ultime}` : 'Motore spento.' })
      }
    })
    // pronto quando risponde
    const inizio = Date.now()
    for (;;) {
      if (erroreAvvio) throw new Error(`Non riesco ad avviare il motore (Python non parte): ${erroreAvvio}`)
      // fermato apposta mentre partiva (Opzioni, chiusura dell'app): non è un errore
      if (proc !== p && !uscito) throw new Error('annullato')
      if (uscito) throw new Error('il motore si è chiuso all\'avvio: guarda il log del motore')
      if (Date.now() - inizio > 600_000) {
        await fermaMotore()
        throw new Error('il motore non risponde dopo 10 minuti: l\'ho fermato, riprova (il primo avvio dopo un aggiornamento può essere lento)')
      }
      try {
        const r = await fetch(`http://127.0.0.1:${porta}/system_stats`, { signal: AbortSignal.timeout(4000) })
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
      // se l'arresto l'ha voluto l'utente lo stato resta «spento»
      if (info.stato !== 'non installato' && info.stato !== 'spento') cambia({ stato: 'errore', messaggio: (e as Error).message })
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
  // se il motore stava ancora partendo, si aspetta che quel tentativo finisca prima di ripartire
  await avvioInCorso?.catch(() => undefined)
  await attendi(800)
  await avviaMotore()
}
