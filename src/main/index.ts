// DaProd Image — processo principale: finestra, protocollo daprod:// per le immagini, IPC verso l'interfaccia.
import { app, BrowserWindow, clipboard, ClipboardItem, dialog, ipcMain, nativeImage, net, protocol, shell, type IpcMainInvokeEvent } from 'electron'
import { copyFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, normalize } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import type { Download, FiltroGalleria, Impostazioni, InfoLora, Richiesta } from '@shared/tipi'
import { DATI, ENTRATA, MINIATURE, RADICE, TEMP, assicura } from './percorsi'
import { impostazioni, salvaImpostazioni } from './impostazioni'
import { annullaSetup, cercaModelliEsistenti, controlloSistema, installa, motoreInstallato, scaricaVoce, statoModelli, type OpzioniSetup } from './installa/installatore'
import { avviaMotore, fermaMotore, infoMotore, logMotore, riavviaMotore, suCambioMotore, suLogMotore } from './motore/processo'
import { connetti, dimenticaNodi, liberaMemoria, nodiDisponibili, scollega } from './motore/cliente'
import { accodaRichiesta, annullaLavoro, elencoLavori, scriviTesto, suCambioLavori, svuotaCoda, togliFiniti } from './motore/lavori'
import { elenco, elimina, importa, opera, preferita, ricaricaGalleria, salvaOra, suCambioGalleria } from './galleria'
import { aggiornaLora, elencoLora, eliminaLora, importaLora, scaricaLora } from './lora'
import { leggiMetadati } from './png'

protocol.registerSchemesAsPrivileged([{ scheme: 'daprod', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }])

let finestra: BrowserWindow | null = null
const invia = (canale: string, ...dati: unknown[]): void => {
  if (finestra && !finestra.isDestroyed()) finestra.webContents.send(canale, ...dati)
}

/** il protocollo serve solo file dentro le cartelle dell'app */
function permesso(p: string): boolean {
  const imp = impostazioni()
  const n = normalize(p).toLowerCase()
  return [imp.cartellaGalleria, imp.cartellaModelli, RADICE, DATI, MINIATURE, TEMP, ENTRATA].some((r) => n.startsWith(normalize(r).toLowerCase()))
}

function creaFinestra(): void {
  finestra = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#0f0a1a',
    show: false,
    title: 'DaProd Image',
    // nell'app installata l'icona è quella dell'exe; in sviluppo si prende quella di build/
    ...(existsSync(join(app.getAppPath(), 'build', 'icon.png')) ? { icon: join(app.getAppPath(), 'build', 'icon.png') } : {}),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0f0a1a', symbolColor: '#e9e0ff', height: 38 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  finestra.once('ready-to-show', () => finestra?.show())
  finestra.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env.ELECTRON_RENDERER_URL) void finestra.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void finestra.loadFile(join(__dirname, '../renderer/index.html'))
}

const gestisci = <A extends unknown[], R>(canale: string, f: (...a: A) => R | Promise<R>): void => {
  ipcMain.handle(canale, (_e: IpcMainInvokeEvent, ...a: unknown[]) => f(...(a as A)))
}

// download in corso (modelli e LoRA), annullabili
const downloads = new Map<string, { info: Download; ctrl: AbortController }>()
function nuovoDownload(nome: string): { info: Download; ctrl: AbortController; avanz: (r: number, t: number, v: number) => void } {
  const info: Download = { id: randomUUID(), nome, ricevuti: 0, totali: 0, velocita: 0, stato: 'in corso' }
  const ctrl = new AbortController()
  downloads.set(info.id, { info, ctrl })
  let ultimo = 0
  const avanz = (r: number, t: number, v: number): void => {
    Object.assign(info, { ricevuti: r, totali: t, velocita: v })
    const ora = Date.now()
    if (ora - ultimo > 300) {
      ultimo = ora
      invia('download', info)
    }
  }
  invia('download', info)
  return { info, ctrl, avanz }
}

async function avviaEMotore(): Promise<void> {
  await avviaMotore()
  await connetti()
  dimenticaNodi()
}

function registraIpc(): void {
  // impostazioni
  gestisci('impostazioni:leggi', () => impostazioni())
  gestisci('impostazioni:salva', async (m: Partial<Impostazioni>) => {
    const prima = impostazioni()
    const nuove = salvaImpostazioni(m)
    const motore = ['cartellaModelli', 'anteprimaLive', 'riservaVram', 'argomentiExtra', 'porta'] as const
    if (motore.some((k) => k in m && JSON.stringify(m[k]) !== JSON.stringify(prima[k])) && infoMotore().stato === 'pronto') {
      void riavviaMotore().then(() => connetti())
    }
    if ('cartellaGalleria' in m && m.cartellaGalleria !== prima.cartellaGalleria) ricaricaGalleria()
    return nuove
  })

  // installazione
  gestisci('sistema:controllo', (cartella: string) => controlloSistema(cartella))
  gestisci('setup:cerca', () => cercaModelliEsistenti())
  gestisci('setup:stato', () => ({ installato: motoreInstallato() && impostazioni().installato, motore: motoreInstallato(), modelli: statoModelli() }))
  gestisci('setup:avvia', async (opz: OpzioniSetup) => {
    const ok = await installa(opz, (passi, riga) => invia('setup', passi, riga), async () => {
      await avviaEMotore()
      const nodi = await nodiDisponibili()
      for (const n of ['UnetLoaderGGUF', 'TextEncodeQwenImage21', 'QwenImage21Cache', 'DifferentialDiffusion'])
        if (!nodi[n]) throw new Error(`al motore manca il nodo ${n}`)
    })
    return ok
  })
  gestisci('setup:annulla', () => annullaSetup())

  // modelli
  gestisci('modelli:stato', () => statoModelli())
  gestisci('modelli:file', () => {
    const c = impostazioni().cartellaModelli
    const leggi = (sotto: string, ext: RegExp): string[] => {
      try {
        return readdirSync(join(c, sotto)).filter((f) => ext.test(f) && !f.endsWith('.part'))
      } catch {
        return []
      }
    }
    return {
      diffusione: [...leggi('diffusion_models', /\.(gguf|safetensors)$/i), ...leggi('unet', /\.(gguf|safetensors)$/i)],
      encoder: leggi('text_encoders', /\.(safetensors|gguf)$/i),
      vae: leggi('vae', /\.safetensors$/i),
      upscaler: leggi('upscale_models', /\.(pth|safetensors)$/i)
    }
  })
  gestisci('modelli:scarica', async (id: string) => {
    const v = statoModelli().find((x) => x.id === id)
    const d = nuovoDownload(v?.nome || id)
    try {
      await scaricaVoce(id, d.avanz, d.ctrl.signal)
      d.info.stato = 'fatto'
    } catch (e) {
      d.info.stato = d.ctrl.signal.aborted ? 'annullato' : 'errore'
      d.info.errore = (e as Error).message
    }
    invia('download', d.info)
    downloads.delete(d.info.id)
    return d.info
  })
  gestisci('download:annulla', (id: string) => downloads.get(id)?.ctrl.abort())

  // motore
  gestisci('motore:info', () => infoMotore())
  gestisci('motore:avvia', () => avviaEMotore())
  gestisci('motore:riavvia', async () => {
    scollega()
    await riavviaMotore()
    await connetti()
  })
  gestisci('motore:ferma', async () => {
    scollega()
    await fermaMotore()
  })
  gestisci('motore:log', () => logMotore())
  gestisci('motore:libera', () => liberaMemoria())
  gestisci('motore:apriComfy', () => shell.openExternal(`http://127.0.0.1:${infoMotore().porta}`))

  // lavori
  gestisci('lavori:accoda', (q: Richiesta) => accodaRichiesta(q).map((l) => l.id))
  gestisci('lavori:annulla', (id: string) => annullaLavoro(id))
  gestisci('lavori:svuota', () => svuotaCoda())
  gestisci('lavori:pulisci', () => togliFiniti())
  gestisci('lavori:elenco', () => elencoLavori())
  gestisci('testo:scrivi', (q: Richiesta) => scriviTesto(q))

  // galleria
  gestisci('galleria:elenco', (f: FiltroGalleria) => elenco(f))
  gestisci('galleria:opera', (id: string) => opera(id))
  gestisci('galleria:preferita', (id: string, si: boolean) => preferita(id, si))
  gestisci('galleria:elimina', (ids: string[]) => elimina(ids))
  gestisci('galleria:mostra', (id: string) => {
    const o = opera(id)
    if (o) shell.showItemInFolder(o.file)
  })
  gestisci('galleria:apriCartella', () => shell.openPath(impostazioni().cartellaGalleria))
  gestisci('galleria:copia', async (id: string) => {
    const o = opera(id)
    if (!o) return
    // gli appunti di Electron 44 vogliono un ClipboardItem (come quelli del web)
    const png = nativeImage.createFromPath(o.file).toPNG()
    await clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }) })])
  })
  gestisci('galleria:esporta', async (id: string) => {
    const o = opera(id)
    if (!o || !finestra) return
    const r = await dialog.showSaveDialog(finestra, { defaultPath: basename(o.file), filters: [{ name: 'PNG', extensions: ['png'] }, { name: 'JPEG', extensions: ['jpg'] }] })
    if (r.canceled || !r.filePath) return
    if (/\.jpe?g$/i.test(r.filePath)) writeFileSync(r.filePath, nativeImage.createFromPath(o.file).toJPEG(95))
    else copyFileSync(o.file, r.filePath)
  })
  gestisci('galleria:importa', (percorsi: string[]) => importa(percorsi))
  gestisci('galleria:meta', (percorso: string) => {
    try {
      return leggiMetadati(readFileSync(percorso))
    } catch {
      return null
    }
  })

  // LoRA
  gestisci('lora:elenco', () => elencoLora())
  gestisci('lora:aggiorna', (file: string, m: Partial<InfoLora>) => aggiornaLora(file, m))
  gestisci('lora:importa', (percorsi: string[]) => importaLora(percorsi))
  gestisci('lora:elimina', (file: string) => eliminaLora(file))
  gestisci('lora:apriCartella', () => {
    const c = join(impostazioni().cartellaModelli, 'loras')
    assicura(c)
    return shell.openPath(c)
  })
  gestisci('lora:scarica', async (link: string) => {
    const d = nuovoDownload('LoRA da ' + (() => {
      try {
        return new URL(link).hostname
      } catch {
        return 'link'
      }
    })())
    try {
      const file = await scaricaLora(link, d.avanz, d.ctrl.signal)
      d.info.stato = 'fatto'
      d.info.nome = file
    } catch (e) {
      d.info.stato = d.ctrl.signal.aborted ? 'annullato' : 'errore'
      d.info.errore = (e as Error).message
    }
    invia('download', d.info)
    downloads.delete(d.info.id)
    return d.info
  })

  // file
  gestisci('file:scegliImmagini', async (multiple: boolean) => {
    if (!finestra) return []
    const r = await dialog.showOpenDialog(finestra, {
      properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: [{ name: 'Immagini', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'avif'] }]
    })
    return r.canceled ? [] : r.filePaths
  })
  gestisci('file:scegli', async (nome: string, estensioni: string[]) => {
    if (!finestra) return null
    const r = await dialog.showOpenDialog(finestra, { properties: ['openFile'], filters: [{ name: nome, extensions: estensioni }] })
    return r.canceled ? null : r.filePaths[0]
  })
  gestisci('file:scegliCartella', async (attuale?: string) => {
    if (!finestra) return null
    const r = await dialog.showOpenDialog(finestra, { defaultPath: attuale, properties: ['openDirectory', 'createDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })
  gestisci('file:salvaTemp', (dataUrl: string, nome?: string) => {
    assicura(TEMP)
    const m = dataUrl.match(/^data:image\/(\w+);base64,(.*)$/)
    if (!m) throw new Error('immagine non valida')
    const p = join(TEMP, `${nome || randomUUID()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`)
    writeFileSync(p, Buffer.from(m[2], 'base64'))
    return p
  })
  // copia dei file scelti/trascinati dentro TEMP (il protocollo daprod:// legge solo le cartelle dell'app)
  gestisci('file:portaDentro', (percorsi: string[]) => {
    assicura(TEMP)
    return percorsi.map((p) => {
      if (permesso(p)) return p
      const dest = join(TEMP, `${randomUUID().slice(0, 8)}-${basename(p).replace(/[^\w.-]+/g, '_')}`)
      copyFileSync(p, dest)
      return dest
    })
  })
  gestisci('file:info', (p: string) => {
    try {
      const st = statSync(p)
      const sz = nativeImage.createFromPath(p).getSize()
      return { byte: st.size, larghezza: sz.width, altezza: sz.height, nome: basename(p), estensione: extname(p) }
    } catch {
      return null
    }
  })
  gestisci('app:apriLink', (url: string) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
  })
  gestisci('app:versione', () => app.getVersion())
  gestisci('app:apriCartella', (quale: 'modelli' | 'dati' | 'log') => {
    const c = quale === 'modelli' ? impostazioni().cartellaModelli : quale === 'log' ? join(RADICE, 'log') : RADICE
    assicura(c)
    return shell.openPath(c)
  })

  ipcMain.on('trascina', (e, percorso: string) => {
    try {
      const icona = nativeImage.createFromPath(percorso).resize({ width: 96 })
      e.sender.startDrag({ file: percorso, icon: icona })
    } catch {
      /* niente */
    }
  })
}

app.whenReady().then(() => {
  app.setAppUserModelId('it.daprod.image')
  protocol.handle('daprod', (req) => {
    const u = new URL(req.url)
    const p = decodeURIComponent(u.pathname.slice(1))
    if (!permesso(p)) return new Response('vietato', { status: 403 })
    return net.fetch(pathToFileURL(p).toString())
  })
  registraIpc()
  suCambioMotore((i) => invia('motore', i))
  suLogMotore((r) => invia('motoreLog', r))
  suCambioLavori((l, uno) => (uno ? invia('lavoro', uno) : invia('lavori', l)))
  suCambioGalleria(() => invia('galleria'))
  creaFinestra()
  if (motoreInstallato() && impostazioni().installato) void avviaEMotore().catch(() => undefined)
})

let chiusura = false
app.on('before-quit', (e) => {
  salvaOra()
  if (chiusura) return
  if (infoMotore().stato === 'spento' || infoMotore().stato === 'non installato') return
  e.preventDefault()
  chiusura = true
  scollega()
  void fermaMotore().finally(() => app.quit())
})
app.on('window-all-closed', () => app.quit())
