// DaProd Image — processo principale: finestra, protocollo daprod:// per le immagini, IPC verso l'interfaccia.
import { execFile } from 'node:child_process'
import { app, BrowserWindow, clipboard, ClipboardItem, dialog, ipcMain, Menu, nativeImage, net, protocol, shell, type IpcMainInvokeEvent } from 'electron'
import { appendFileSync, copyFileSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, normalize } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import type { Download, Famiglia, FiltroGalleria, GruppoLora, Impostazioni, InfoLora, Richiesta } from '@shared/tipi'
import { vaBeneCon } from '@shared/loraBase'
import { DATI, ENTRATA, MINIATURE, RADICE, TEMP, assicura } from './percorsi'
import { impostazioni, salvaImpostazioni } from './impostazioni'
import { annullaSetup, cercaModelliEsistenti, controlloSistema, installa, motoreInstallato, scaricaVoce, statoModelli, type OpzioniSetup } from './installa/installatore'
import { avviaMotore, fermaMotore, infoMotore, logMotore, riavviaMotore, suCambioMotore, suLogMotore } from './motore/processo'
import { connetti, dimenticaNodi, liberaMemoria, nodiDisponibili, scollega } from './motore/cliente'
import { accodaRichiesta, annullaLavoro, elencoLavori, scriviTesto, suCambioLavori, svuotaCoda, togliFiniti } from './motore/lavori'
import { elenco, elimina, importa, importaFoto, opera, preferita, ricaricaGalleria, salvaOra, suCambioGalleria } from './galleria'
import { ESTENSIONI_FOTO, SOLO_WIC, pngConWic } from './converti'
import { seguiRisorse } from './risorse'
import { aggiornaLora, elencoLora, eliminaLora, importaLora, scaricaLora } from './lora'
import { leggiMetadati } from './png'
import { caricaAlbum, creaPdf, elencoAlbum, eliminaAlbum, preparaFoto, salvaAlbum, salvaEsportata, salvaFotoAlbum } from './album'
import { avviaIdle, fileInutilizzati } from './idle'
import { avviaAggiornamenti, controllaAggiornamenti, installaAggiornamento, statoAggiornamento, suAggiornamento } from './aggiornamenti'

// corsEnabled: le <img crossOrigin> (canvas) e la mask-image della zona leggono da qui con il CORS
protocol.registerSchemesAsPrivileged([{ scheme: 'daprod', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }])

// una sola copia dell'app alla volta: due copie lancerebbero due motori sulla scheda (VRAM doppia) e scriverebbero la stessa galleria
const unica = app.requestSingleInstanceLock()
if (!unica) app.quit()
else
  app.on('second-instance', () => {
    if (!finestra) return
    if (finestra.isMinimized()) finestra.restore()
    finestra.focus()
  })

// un errore che nessuno ha gestito non deve aprire il riquadro «A JavaScript error occurred»: si scrive nel registro e si va avanti
const registraErrore = (e: unknown): void => {
  try {
    appendFileSync(join(DATI, 'errori.log'), `${new Date().toISOString()} ${(e as Error)?.stack || String(e)}\n`)
  } catch {
    /* niente */
  }
}
process.on('uncaughtException', registraErrore)
process.on('unhandledRejection', registraErrore)

/** toglie dalle cartelle temporanee i file più vecchi di qualche giorno (fogli, maschere, copie delle foto): senza, crescono per sempre */
function pulisciVecchi(cartella: string, giorni: number, salta: string[] = []): void {
  const limite = Date.now() - giorni * 86_400_000
  let voci: string[] = []
  try {
    voci = readdirSync(cartella)
  } catch {
    return
  }
  for (const n of voci) {
    if (salta.includes(n)) continue
    const p = join(cartella, n)
    try {
      if (statSync(p).mtimeMs < limite) rmSync(p, { recursive: true, force: true })
    } catch {
      /* in uso: la prossima volta */
    }
  }
}

let finestra: BrowserWindow | null = null
/** true quando si sta già chiudendo (il motore è fermo o si sta fermando) */
let chiusura = false
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
    // la barra del titolo è sempre chiara, anche col tema scuro di Windows
    titleBarOverlay: { color: '#ffffff', symbolColor: '#1b1530', height: 38 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  finestra.once('ready-to-show', () => finestra?.show())
  // tasto destro nei campi di testo (prompt, note, nomi): Electron non lo fa da solo
  finestra.webContents.on('context-menu', (_e, p) => {
    if (!p.isEditable && !p.selectionText) return
    const voci: Electron.MenuItemConstructorOptions[] = p.isEditable
      ? [
          { label: 'Annulla', role: 'undo', enabled: p.editFlags.canUndo },
          { label: 'Ripeti', role: 'redo', enabled: p.editFlags.canRedo },
          { type: 'separator' },
          { label: 'Taglia', role: 'cut', enabled: p.editFlags.canCut },
          { label: 'Copia', role: 'copy', enabled: p.editFlags.canCopy },
          { label: 'Incolla', role: 'paste', enabled: p.editFlags.canPaste },
          { type: 'separator' },
          { label: 'Seleziona tutto', role: 'selectAll', enabled: p.editFlags.canSelectAll }
        ]
      : [{ label: 'Copia', role: 'copy' }]
    Menu.buildFromTemplate(voci).popup()
  })
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
    const motore = ['cartellaModelli', 'anteprimaLive', 'riservaVram', 'argomentiExtra', 'porta', 'memoria', 'veloce'] as const
    if (motore.some((k) => k in m && JSON.stringify(m[k]) !== JSON.stringify(prima[k])) && infoMotore().stato === 'pronto') {
      // le impostazioni del motore valgono al riavvio: se sta lavorando, si aspetta la fine del lavoro (non lo si uccide a metà)
      const riavviaQuandoLibero = (): void => {
        if (elencoLavori().some((l) => l.stato === 'in corso')) {
          setTimeout(riavviaQuandoLibero, 1500)
          return
        }
        scollega()
        void riavviaMotore().then(() => connetti()).catch(() => undefined)
      }
      riavviaQuandoLibero()
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
      for (const n of ['UnetLoaderGGUF', 'TextEncodeQwenImage21', 'QwenImage21Cache', 'DifferentialDiffusion', 'DaProdRiempiZona', 'DaProdAccordaColori'])
        if (!nodi[n]) throw new Error(`al motore manca il nodo ${n}`)
    })
    return ok
  })
  gestisci('setup:annulla', () => annullaSetup())

  // modelli
  gestisci('modelli:stato', () => statoModelli())
  // BiRefNet (togli sfondo) e SAM 2 (estrai fedele): presenti o da scaricare (si scaricano da soli al primo uso)
  gestisci('modelli:segmentatori', () => statoModelli().filter((v) => v.ruolo === 'sfondo' || v.ruolo === 'segmentatore'))
  gestisci('modelli:file', () => {
    const c = impostazioni().cartellaModelli
    const leggi = (sotto: string, ext: RegExp): string[] => {
      try {
        return readdirSync(join(c, sotto)).filter((f) => ext.test(f) && !f.endsWith('.part'))
      } catch {
        return []
      }
    }
    const tutti = [...leggi('diffusion_models', /\.(gguf|safetensors)$/i), ...leggi('unet', /\.(gguf|safetensors)$/i)]
    const enc = leggi('text_encoders', /\.(safetensors|gguf)$/i)
    const vae = leggi('vae', /\.safetensors$/i)
    // i file di Klein sono altri: nelle scelte di Qwen non devono comparire. I file di FLUX.2 Klein 4B/9B (tolto nella 1.2.1) e il
    // Qwen3 4B di solo testo che serviva a lui non sono di FLUX 3 Klein: restano fuori da tutte le liste.
    const eFlux2 = (n: string): boolean => /klein.*[-_](4b|9b)|[-_](4b|9b).*klein|^qwen_3_4b\./i.test(n)
    const isKlein = (n: string): boolean => /klein/i.test(n) && !eFlux2(n)
    const isKleinTe = (n: string): boolean => (/(qwen3|qwen_3).*4b/i.test(n) && !eFlux2(n)) || isKlein(n)
    const isKleinVae = (n: string): boolean => isKlein(n) || /flux.?[23]/i.test(n)
    return {
      diffusione: tutti.filter((n) => !isKlein(n) && !eFlux2(n)),
      encoder: enc.filter((n) => !isKleinTe(n) && !eFlux2(n)),
      vae: vae.filter((n) => !isKleinVae(n)),
      upscaler: leggi('upscale_models', /\.(pth|safetensors)$/i),
      klein: tutti.filter(isKlein),
      kleinTe: enc.filter(isKleinTe),
      kleinVae: vae.filter(isKleinVae)
    }
  })
  gestisci('modelli:inutilizzati', () => fileInutilizzati())
  gestisci('modelli:elimina', async (percorso: string) => {
    // solo dentro la cartella dei modelli, e nel cestino (si può recuperare)
    const n = normalize(percorso).toLowerCase()
    if (!n.startsWith(normalize(impostazioni().cartellaModelli).toLowerCase())) throw new Error('questo file non è nella cartella dei modelli')
    await shell.trashItem(percorso)
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
  gestisci('galleria:elimina', (ids: string[], definitivo?: boolean) => elimina(ids, !!definitivo))
  gestisci('galleria:mostra', (id: string) => {
    const o = opera(id)
    if (o) shell.showItemInFolder(o.file)
  })
  gestisci('galleria:apriCartella', () => shell.openPath(impostazioni().cartellaGalleria))
  gestisci('galleria:copia', async (ids: string | string[]) => {
    const lista = (Array.isArray(ids) ? ids : [ids]).map((id) => opera(id)).filter((o): o is NonNullable<typeof o> => !!o)
    if (!lista.length) return
    if (lista.length === 1) {
      // una sola: l'immagine negli appunti (gli appunti di Electron 44 vogliono un ClipboardItem, come quelli del web)
      const png = nativeImage.createFromPath(lista[0].file).toPNG()
      await clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }) })])
      return
    }
    // più foto: i file negli appunti, come in Esplora risorse (si incollano in una cartella, in una chat, in un'email)
    await new Promise<void>((ok, ko) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', '$p = @($env:DAPROD_FILE_JSON | ConvertFrom-Json); Set-Clipboard -LiteralPath $p'],
        { env: { ...process.env, DAPROD_FILE_JSON: JSON.stringify(lista.map((o) => o.file)) }, windowsHide: true },
        (e) => (e ? ko(e) : ok())
      )
    })
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
  gestisci('galleria:importaFoto', (png: string, nome: string) => importaFoto(png, nome))
  gestisci('galleria:meta', (percorso: string) => {
    try {
      return leggiMetadati(readFileSync(percorso))
    } catch {
      return null
    }
  })

  // LoRA
  gestisci('lora:elenco', () => elencoLora())
  // i LoRA che si possono usare con questo modello: compatibili ('si') e da provare ('?'), non quelli di un altro modello
  gestisci('lora:compatibili', (famiglia: Famiglia) => elencoLora().filter((l) => vaBeneCon(l, famiglia) !== 'no'))
  gestisci('lora:aggiorna', (file: string, m: Partial<InfoLora>) => aggiornaLora(file, m))
  gestisci('lora:importa', (percorsi: string[], gruppo?: GruppoLora) => importaLora(percorsi, gruppo))
  gestisci('lora:elimina', (file: string) => eliminaLora(file))
  gestisci('lora:apriCartella', () => {
    const c = join(impostazioni().cartellaModelli, 'loras')
    assicura(c)
    return shell.openPath(c)
  })
  gestisci('lora:scarica', async (link: string, gruppo?: GruppoLora) => {
    const d = nuovoDownload('LoRA da ' + (() => {
      try {
        return new URL(link).hostname
      } catch {
        return 'link'
      }
    })())
    try {
      const file = await scaricaLora(link, d.avanz, d.ctrl.signal, gruppo)
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
      filters: [{ name: 'Immagini', extensions: ESTENSIONI_FOTO }]
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
  // copia dei file scelti/trascinati dentro TEMP (il protocollo daprod:// legge solo le cartelle dell'app);
  // i formati che l'interfaccia non sa aprire (HEIC, RAW, TIFF, JXL…) diventano subito PNG con WIC
  gestisci('file:portaDentro', async (percorsi: string[]) => {
    assicura(TEMP)
    const fuori: string[] = []
    for (const p of percorsi) {
      if (SOLO_WIC.test(p)) {
        fuori.push((await pngConWic(p)).percorso)
        continue
      }
      if (permesso(p)) {
        fuori.push(p)
        continue
      }
      const dest = join(TEMP, `${randomUUID().slice(0, 8)}-${basename(p).replace(/[^\w.-]+/g, '_')}`)
      copyFileSync(p, dest)
      fuori.push(dest)
    }
    return fuori
  })
  // l'interfaccia non è riuscita ad aprirla: ci prova WIC
  gestisci('file:inPng', (p: string, latoMax?: number) => pngConWic(p, latoMax || 0))
  gestisci('file:info', (p: string) => {
    try {
      const st = statSync(p)
      const sz = nativeImage.createFromPath(p).getSize()
      return { byte: st.size, larghezza: sz.width, altezza: sz.height, nome: basename(p), estensione: extname(p) }
    } catch {
      return null
    }
  })
  // album
  gestisci('album:elenco', () => elencoAlbum())
  gestisci('album:carica', (id: string) => caricaAlbum(id))
  gestisci('album:salva', (a: { id: string }) => salvaAlbum(a))
  gestisci('album:elimina', (id: string) => eliminaAlbum(id))
  gestisci('album:prepara', (p: string) => preparaFoto(p))
  gestisci('album:salvaFoto', (id: string, foto: string, grande: string, mini: string) => salvaFotoAlbum(id, foto, grande, mini))
  gestisci('album:esportata', (cartella: string, nome: string, dataUrl: string) => salvaEsportata(cartella, nome, dataUrl))
  gestisci('album:mostra', (p: string) => shell.showItemInFolder(p))
  gestisci('album:pdf', (dest: string, pagine: Parameters<typeof creaPdf>[1]) => creaPdf(dest, pagine))
  gestisci('app:apriLink', (url: string) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
  })
  gestisci('app:versione', () => app.getVersion())
  // aggiornamenti dell'app (release di GitHub)
  gestisci('aggiornamento:stato', () => statoAggiornamento())
  gestisci('aggiornamento:controlla', () => controllaAggiornamenti())
  gestisci('aggiornamento:installa', async () => {
    // prima si ferma il motore (se no il setup trova i file occupati), poi si installa e si riapre
    chiusura = true
    scollega()
    await fermaMotore()
    salvaOra()
    installaAggiornamento()
  })
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
  if (!unica) return
  // prima di avviare il motore (la sua cache delle foto caricate è ancora vuota)
  pulisciVecchi(TEMP, 3, ['comfy', 'wic-png.ps1'])
  pulisciVecchi(join(ENTRATA, 'daprod'), 3)
  app.setAppUserModelId('it.daprod.image')
  protocol.handle('daprod', async (req) => {
    const u = new URL(req.url)
    const p = decodeURIComponent(u.pathname.slice(1))
    if (!permesso(p)) return new Response('vietato', { status: 403 })
    // l'intestazione CORS serve al canvas dell'interfaccia: senza, le foto lette da qui lo "sporcano" e non si
    // possono più convertire in PNG (era il motivo per cui solo i PNG funzionavano in Modifica)
    const r = await net.fetch(pathToFileURL(p).toString())
    const h = new Headers(r.headers)
    h.set('Access-Control-Allow-Origin', '*')
    return new Response(r.body, { status: r.status, headers: h })
  })
  registraIpc()
  suCambioMotore((i) => invia('motore', i))
  suLogMotore((r) => invia('motoreLog', r))
  suCambioLavori((l, uno) => (uno ? invia('lavoro', uno) : invia('lavori', l)))
  suCambioGalleria(() => invia('galleria'))
  suAggiornamento((s) => invia('aggiornamento', s))
  creaFinestra()
  seguiRisorse((r) => invia('risorse', r), () => !!finestra && !finestra.isDestroyed() && finestra.isVisible() && !finestra.isMinimized())
  if (motoreInstallato() && impostazioni().installato) void avviaEMotore().catch(() => undefined)
  avviaAggiornamenti()
  // quando l'app è ferma scarica da sola i file consigliati che mancano
  avviaIdle({
    libera: () => elencoLavori().every((l) => l.stato !== 'in coda' && l.stato !== 'in corso') && downloads.size === 0,
    pronta: () => motoreInstallato() && impostazioni().installato && infoMotore().stato === 'pronto',
    scarica: async (id) => {
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
      return d.info.stato === 'fatto'
    }
  })
})

app.on('before-quit', (e) => {
  salvaOra()
  annullaSetup()
  if (chiusura) return
  if (infoMotore().stato === 'spento' || infoMotore().stato === 'non installato') return
  e.preventDefault()
  chiusura = true
  scollega()
  void fermaMotore().finally(() => app.quit())
})
app.on('window-all-closed', () => app.quit())
