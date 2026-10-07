// L'installazione del motore, passo per passo. Ogni passo si salta se è già fatto (stato.json),
// così se qualcosa va storto si riprova e si riparte da lì.
//   Python 3.13 (con uv) → ComfyUI (zip al commit fissato) → nodi GGUF (la nostra copia corretta)
//   → venv con PyTorch CUDA e i pacchetti → modelli → prova del motore.
import { spawn, execFile } from 'node:child_process'
import { cpSync, existsSync, linkSync, readFileSync, readdirSync, renameSync, rmSync, statSync, statfsSync, writeFileSync, createReadStream, createWriteStream } from 'node:fs'
import { totalmem } from 'node:os'
import { basename, join, parse } from 'node:path'
import { app } from 'electron'
import type { ControlloSistema, PassoSetup, StatoVoce } from '@shared/tipi'
import { CATALOGO, voce } from './catalogo'
import { scarica } from './scarica'
import { COMFY, MOTORE, NODI, PYTHON, RADICE, TEMP, UV, UV_CACHE, UV_PYTHON, VENV, VERSIONI, LOG, assicura } from '../percorsi'
import { impostazioni, salvaImpostazioni } from '../impostazioni'

interface Versioni {
  motore: number
  python: string
  comfyui: { commit: string; versione: string }
  torch: { indice: string; pacchetti: string[] }
  extra: string[]
}

const FILE_STATO = join(MOTORE, 'stato.json')

type Notifica = (passi: PassoSetup[], log?: string) => void

export interface OpzioniSetup {
  cartellaModelli: string
  modello: string // id del catalogo
  fileEsistente?: string // un .gguf che l'utente ha già
  extra: string[] // id del catalogo da scaricare in più (LoRA consigliati…)
  /** aggiornamento del motore: il modello resta quello delle impostazioni, niente download */
  mantieniModello?: boolean
}

export function versioni(): Versioni {
  return JSON.parse(readFileSync(VERSIONI, 'utf8'))
}

function leggiStato(): Record<string, string | number | boolean> {
  try {
    return JSON.parse(readFileSync(FILE_STATO, 'utf8'))
  } catch {
    return {}
  }
}

function scriviStato(s: Record<string, string | number | boolean>): void {
  assicura(MOTORE)
  writeFileSync(FILE_STATO, JSON.stringify(s, null, 2))
}

/** il motore è installato e alla versione giusta? */
export function motoreInstallato(): boolean {
  const s = leggiStato()
  const v = versioni()
  return s.pacchetti === true && s.comfyui === v.comfyui.commit && s.nodi === v.motore && existsSync(PYTHON) && existsSync(join(COMFY, 'main.py'))
}

export async function controlloSistema(cartella: string): Promise<ControlloSistema> {
  const avvisi: string[] = []
  let ok = true
  const out: ControlloSistema = { ramGB: Math.round(totalmem() / 1e9), liberoGB: 0, cartella, ok, avvisi }
  try {
    const r = await new Promise<string>((res, rej) =>
      execFile('nvidia-smi', ['--query-gpu=name,memory.total,driver_version', '--format=csv,noheader,nounits'], { windowsHide: true }, (e, so) => (e ? rej(e) : res(so)))
    )
    const [nome, vram, driver] = r.trim().split('\n')[0].split(',').map((x) => x.trim())
    out.gpu = nome
    out.vramMB = Number(vram)
    out.driver = driver
    if (out.vramMB < 7500) avvisi.push(`La scheda ha ${Math.round(out.vramMB / 1024)} GB di VRAM: con meno di 8 GB va, ma più lento.`)
  } catch {
    ok = false
    avvisi.push('Non trovo una scheda NVIDIA (nvidia-smi non risponde). Serve una GPU NVIDIA con i driver aggiornati.')
  }
  try {
    assicura(cartella)
    const fs = statfsSync(cartella)
    out.liberoGB = Math.round((fs.bavail * fs.bsize) / 1e9)
    if (out.liberoGB < 30) {
      ok = false
      avvisi.push(`Sul disco ci sono ${out.liberoGB} GB liberi: ne servono almeno 30 (motore ~8 GB, modelli ~15 GB).`)
    }
  } catch {
    avvisi.push('Non riesco a leggere lo spazio libero sul disco.')
  }
  if (out.ramGB < 24) avvisi.push(`Hai ${out.ramGB} GB di RAM: il text encoder ne vuole ~10, con meno di 24 GB può rallentare.`)
  out.ok = ok
  return out
}

/** stato dei file del catalogo nella cartella modelli */
export function statoModelli(cartella = impostazioni().cartellaModelli): StatoVoce[] {
  return CATALOGO.map((v) => {
    const p = join(cartella, v.cartella, v.file)
    let presente = false
    try {
      presente = statSync(p).size === v.byte
    } catch {
      /* manca */
    }
    return { ...v, presente }
  })
}

/** cerca un Qwen-Image 2.1 .gguf già scaricato nelle cartelle solite */
export function cercaModelliEsistenti(): { percorso: string; byte: number; id?: string }[] {
  const dove = ['downloads', 'desktop', 'documents'].map((k) => {
    try {
      return app.getPath(k as 'downloads')
    } catch {
      return ''
    }
  })
  const trovati: { percorso: string; byte: number; id?: string }[] = []
  const guarda = (cartella: string, profondita: number): void => {
    let voci: string[] = []
    try {
      voci = readdirSync(cartella)
    } catch {
      return
    }
    for (const n of voci) {
      const p = join(cartella, n)
      if (/qwen.?image.?2[._]1.*\.gguf$/i.test(n)) {
        try {
          const byte = statSync(p).size
          const id = CATALOGO.find((c) => c.tipo === 'diffusione' && c.byte === byte)?.id
          trovati.push({ percorso: p, byte, id })
        } catch {
          /* niente */
        }
      } else if (profondita > 0 && !n.startsWith('.')) {
        try {
          if (statSync(p).isDirectory()) guarda(p, profondita - 1)
        } catch {
          /* niente */
        }
      }
    }
  }
  for (const d of dove) if (d) guarda(d, 1)
  return trovati
}

/** porta un file nella cartella modelli: collegamento (stesso disco, istantaneo) o copia */
async function importaFile(origine: string, destinazione: string, avanz: (f: number) => void): Promise<void> {
  assicura(parse(destinazione).dir)
  if (existsSync(destinazione)) return
  try {
    linkSync(origine, destinazione)
    return
  } catch {
    /* disco diverso: si copia */
  }
  const totale = statSync(origine).size
  let fatti = 0
  await new Promise<void>((ok, ko) => {
    const r = createReadStream(origine, { highWaterMark: 8 << 20 })
    const w = createWriteStream(destinazione + '.part')
    r.on('data', (c) => {
      fatti += c.length
      avanz(fatti / totale)
    })
    r.on('error', ko)
    w.on('error', ko)
    w.on('finish', () => ok())
    r.pipe(w)
  })
  renameSync(destinazione + '.part', destinazione)
}

function ambienteUv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    UV_PYTHON_INSTALL_DIR: UV_PYTHON,
    UV_CACHE_DIR: UV_CACHE,
    UV_NO_PROGRESS: '1',
    UV_PYTHON_PREFERENCE: 'only-managed',
    PYTHONUTF8: '1'
  }
}

/** lancia un comando e passa le righe al log; rifiuta se l'uscita non è 0 */
function esegui(cmd: string, args: string[], riga: (s: string) => void, cwd = MOTORE): Promise<void> {
  return new Promise((ok, ko) => {
    const p = spawn(cmd, args, { cwd, env: ambienteUv(), windowsHide: true })
    let coda = ''
    const leggi = (b: Buffer): void => {
      coda += b.toString('utf8')
      const righe = coda.split(/\r?\n|\r/)
      coda = righe.pop() || ''
      for (const r of righe) if (r.trim()) riga(r)
    }
    p.stdout.on('data', leggi)
    p.stderr.on('data', leggi)
    p.on('error', ko)
    p.on('close', (c) => {
      if (coda.trim()) riga(coda)
      if (c === 0) ok()
      else ko(new Error(`${basename(cmd)} è uscito con codice ${c}`))
    })
  })
}

let inCorso: AbortController | null = null

export function annullaSetup(): void {
  inCorso?.abort()
}

export async function installa(opz: OpzioniSetup, notifica: Notifica, provaMotore: () => Promise<void>): Promise<boolean> {
  inCorso = new AbortController()
  const segnale = inCorso.signal
  const v = versioni()
  const stato = leggiStato()
  assicura(RADICE, MOTORE, TEMP, LOG, opz.cartellaModelli)
  const fileLog = join(LOG, 'installazione.log')
  const passi: PassoSetup[] = [
    { id: 'python', titolo: 'Python ' + v.python, stato: 'attesa' },
    { id: 'comfyui', titolo: `Motore ComfyUI ${v.comfyui.versione}`, stato: 'attesa' },
    { id: 'nodi', titolo: 'Nodi GGUF per Qwen-Image 2.1', stato: 'attesa' },
    { id: 'pacchetti', titolo: 'PyTorch CUDA e pacchetti', stato: 'attesa' },
    { id: 'modelli', titolo: 'Modelli', stato: 'attesa' },
    { id: 'prova', titolo: 'Prova del motore', stato: 'attesa' }
  ]
  const p = (id: string): PassoSetup => passi.find((x) => x.id === id)!
  const log = (s: string): void => {
    try {
      writeFileSync(fileLog, s + '\n', { flag: 'a' })
    } catch {
      /* niente */
    }
    notifica(passi, s)
  }
  const inizia = (id: string, dettaglio = ''): void => {
    Object.assign(p(id), { stato: 'in corso', dettaglio, avanzamento: undefined })
    notifica(passi)
  }
  const finisci = (id: string, dettaglio = 'fatto', saltato = false): void => {
    Object.assign(p(id), { stato: saltato ? 'saltato' : 'fatto', dettaglio, avanzamento: 1 })
    notifica(passi)
  }
  const riga = (id: string) => (s: string): void => {
    p(id).dettaglio = s.slice(0, 160)
    log(s)
  }

  salvaImpostazioni({ cartellaModelli: opz.cartellaModelli })
  let attuale = 'python'
  try {
    if (!existsSync(UV)) throw new Error('manca uv.exe fra le risorse dell\'app (reinstalla DaProd Image)')

    // 1. Python
    attuale = 'python'
    if (stato.python === v.python && existsSync(UV_PYTHON)) finisci('python', 'già pronto', true)
    else {
      inizia('python', 'scarico Python…')
      await esegui(UV, ['python', 'install', v.python], riga('python'))
      scriviStato({ ...leggiStato(), python: v.python })
      finisci('python')
    }
    if (segnale.aborted) throw new Error('annullato')

    // 2. ComfyUI al commit fissato
    attuale = 'comfyui'
    if (leggiStato().comfyui === v.comfyui.commit && existsSync(join(COMFY, 'main.py'))) finisci('comfyui', 'già pronto', true)
    else {
      inizia('comfyui', 'scarico ComfyUI…')
      const zip = join(TEMP, `comfyui-${v.comfyui.commit.slice(0, 7)}.zip`)
      await scarica({
        url: `https://codeload.github.com/comfyanonymous/ComfyUI/zip/${v.comfyui.commit}`,
        destinazione: zip,
        segnale,
        avanzamento: (r) => {
          p('comfyui').dettaglio = `scarico ComfyUI… ${(r / 1e6).toFixed(1)} MB`
          notifica(passi)
        }
      })
      p('comfyui').dettaglio = 'estraggo…'
      notifica(passi)
      const estratto = join(MOTORE, `ComfyUI-${v.comfyui.commit}`)
      rmSync(estratto, { recursive: true, force: true })
      // il tar.exe di Windows (bsdtar) apre gli zip; un altro tar nel PATH (es. quello di Git) no
      await esegui(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', zip, '-C', MOTORE], riga('comfyui'))
      rmSync(COMFY, { recursive: true, force: true })
      renameSync(estratto, COMFY)
      rmSync(zip, { force: true })
      scriviStato({ ...leggiStato(), comfyui: v.comfyui.commit, nodi: 0 })
      finisci('comfyui')
    }
    if (segnale.aborted) throw new Error('annullato')

    // 3. i nostri nodi (ComfyUI-GGUF con la correzione)
    attuale = 'nodi'
    inizia('nodi', 'copio i nodi…')
    for (const n of readdirSync(NODI)) {
      const dest = join(COMFY, 'custom_nodes', n)
      rmSync(dest, { recursive: true, force: true })
      cpSync(join(NODI, n), dest, { recursive: true })
    }
    scriviStato({ ...leggiStato(), nodi: v.motore })
    finisci('nodi')

    // 4. venv + PyTorch CUDA + pacchetti
    attuale = 'pacchetti'
    if (leggiStato().pacchetti === true && leggiStato().requisiti === v.comfyui.commit && existsSync(PYTHON)) finisci('pacchetti', 'già pronti', true)
    else {
      inizia('pacchetti', 'preparo l\'ambiente Python…')
      if (!existsSync(PYTHON)) await esegui(UV, ['venv', VENV, '--python', v.python], riga('pacchetti'))
      p('pacchetti').dettaglio = 'scarico PyTorch con CUDA (circa 3 GB, la parte più lunga)…'
      notifica(passi)
      await esegui(UV, ['pip', 'install', '--python', PYTHON, ...v.torch.pacchetti, '--index-url', v.torch.indice], riga('pacchetti'))
      p('pacchetti').dettaglio = 'installo i pacchetti di ComfyUI…'
      notifica(passi)
      await esegui(UV, ['pip', 'install', '--python', PYTHON, '-r', join(COMFY, 'requirements.txt'), ...v.extra], riga('pacchetti'))
      // controllo: torch vede la scheda?
      let cuda = ''
      await esegui(PYTHON, ['-c', 'import torch;print("CUDA", torch.cuda.is_available(), torch.version.cuda)'], (s) => {
        cuda = s
        log(s)
      })
      if (!/CUDA True/.test(cuda)) throw new Error('PyTorch non vede la scheda NVIDIA (' + cuda + '): aggiorna i driver NVIDIA e riprova')
      scriviStato({ ...leggiStato(), pacchetti: true, requisiti: v.comfyui.commit })
      finisci('pacchetti', cuda)
    }
    if (segnale.aborted) throw new Error('annullato')

    // 5. modelli
    attuale = 'modelli'
    inizia('modelli', 'controllo i modelli…')
    const scelto = voce(opz.modello) || voce('q4km')!
    const imp = impostazioni()
    const servono = [scelto, voce('te-int8')!, voce('vae-fix')!, voce('ultrasharp')!, ...opz.extra.map((id) => voce(id)).filter((x) => !!x)]
    // se l'utente ha già il modello, lo si porta dentro (collegamento o copia)
    if (opz.mantieniModello) {
      servono.splice(servono.indexOf(scelto), 1)
    } else if (opz.fileEsistente && existsSync(opz.fileEsistente)) {
      const dest = join(opz.cartellaModelli, 'diffusion_models', basename(opz.fileEsistente))
      p('modelli').dettaglio = 'porto dentro ' + basename(opz.fileEsistente) + '…'
      notifica(passi)
      await importaFile(opz.fileEsistente, dest, (f) => {
        p('modelli').avanzamento = f
        p('modelli').dettaglio = `copio ${basename(opz.fileEsistente!)}… ${Math.round(f * 100)}%`
        notifica(passi)
      })
      salvaImpostazioni({ modello: basename(opz.fileEsistente) })
      servono.splice(servono.indexOf(scelto), 1)
    } else {
      salvaImpostazioni({ modello: scelto.file })
    }
    salvaImpostazioni({ encoder: imp.encoder || 'qwen3vl_8b_int8_convrot.safetensors' })
    const presenti = statoModelli(opz.cartellaModelli)
    const daScaricare = servono.filter((s) => !presenti.find((x) => x.id === s.id)?.presente)
    const totale = daScaricare.reduce((a, s) => a + s.byte, 0)
    let fatto = 0
    for (const s of daScaricare) {
      const dest = join(opz.cartellaModelli, s.cartella, s.file)
      const intestazioni: Record<string, string> = {}
      if (imp.tokenHF && s.url.includes('huggingface.co')) intestazioni.Authorization = 'Bearer ' + imp.tokenHF
      await scarica({
        url: s.url,
        destinazione: dest,
        sha256: s.sha256,
        intestazioni,
        segnale,
        avanzamento: (r, t, vel) => {
          const parz = fatto + r
          p('modelli').avanzamento = totale ? parz / totale : undefined
          p('modelli').dettaglio = `${s.nome}: ${(r / 1e9).toFixed(2)} / ${((t || s.byte) / 1e9).toFixed(2)} GB · ${(vel / 1e6).toFixed(1)} MB/s`
          notifica(passi)
        },
        verifica: () => {
          p('modelli').dettaglio = `${s.nome}: controllo che sia integro…`
          notifica(passi)
        }
      })
      fatto += s.byte
      log('scaricato ' + s.file)
    }
    finisci('modelli', daScaricare.length ? `${daScaricare.length} file scaricati` : 'tutti presenti')

    // 6. prova
    attuale = 'prova'
    inizia('prova', 'avvio il motore…')
    await provaMotore()
    finisci('prova', 'il motore risponde e conosce Qwen-Image 2.1')
    salvaImpostazioni({ installato: true })
    return true
  } catch (e) {
    const msg = segnale.aborted ? 'annullato' : (e as Error).message
    Object.assign(p(attuale), { stato: 'errore', dettaglio: msg })
    log('ERRORE: ' + msg)
    notifica(passi)
    return false
  } finally {
    inCorso = null
  }
}

/** scarica un file del catalogo da solo (dalle impostazioni o dalla pagina LoRA) */
export async function scaricaVoce(id: string, avanz: (r: number, t: number, v: number) => void, segnale?: AbortSignal): Promise<string> {
  const s = voce(id)
  if (!s) throw new Error('voce sconosciuta')
  const imp = impostazioni()
  const dest = join(imp.cartellaModelli, s.cartella, s.file)
  const intestazioni: Record<string, string> = {}
  if (imp.tokenHF && s.url.includes('huggingface.co')) intestazioni.Authorization = 'Bearer ' + imp.tokenHF
  await scarica({ url: s.url, destinazione: dest, sha256: s.sha256, intestazioni, segnale, avanzamento: avanz })
  return dest
}
