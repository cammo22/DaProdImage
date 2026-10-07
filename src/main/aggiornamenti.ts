// Aggiornamenti dell'app: electron-updater legge latest.yml dall'ultima release di GitHub
// (cammo22/DaProdImage), scarica il setup nuovo (solo i pezzi cambiati, grazie al blockmap)
// e lo installa quando si riavvia. Il motore e i modelli stanno fuori dall'app e restano dove sono.
import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { StatoAggiornamento } from '@shared/tipi'

let stato: StatoAggiornamento = { stato: app.isPackaged ? 'nessuno' : 'sviluppo', attuale: app.getVersion() }
const ascoltatori = new Set<(s: StatoAggiornamento) => void>()

export const statoAggiornamento = (): StatoAggiornamento => stato
export const suAggiornamento = (f: (s: StatoAggiornamento) => void): (() => void) => {
  ascoltatori.add(f)
  return () => ascoltatori.delete(f)
}
function cambia(n: Partial<StatoAggiornamento>): void {
  stato = { ...stato, ...n }
  for (const f of ascoltatori) f(stato)
}

/** le note di GitHub arrivano in HTML (o come lista per versione): diventano testo semplice */
function note(n: unknown): string {
  const testo = Array.isArray(n) ? n.map((x: { note?: string }) => x.note || '').join('\n') : String(n || '')
  return testo
    .replace(/<\/(p|li|h\d)>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

let avviato = false
export function avviaAggiornamenti(): void {
  if (!app.isPackaged || avviato) return
  avviato = true
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => cambia({ stato: 'controllo', errore: undefined }))
  autoUpdater.on('update-not-available', () => cambia({ stato: 'aggiornato', ultimoControllo: Date.now() }))
  autoUpdater.on('update-available', (i) => cambia({ stato: 'scarico', versione: i.version, note: note(i.releaseNotes), percentuale: 0, ultimoControllo: Date.now() }))
  autoUpdater.on('download-progress', (p) => cambia({ stato: 'scarico', percentuale: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (i) => cambia({ stato: 'pronto', versione: i.version, note: note(i.releaseNotes) || stato.note, percentuale: 100 }))
  autoUpdater.on('error', (e) => cambia({ stato: 'errore', errore: (e?.message || String(e)).split('\n')[0] }))
  // primo controllo poco dopo l'avvio, poi ogni 6 ore
  setTimeout(() => void controllaAggiornamenti(), 8000)
  setInterval(() => void controllaAggiornamenti(), 6 * 3600_000)
}

export async function controllaAggiornamenti(): Promise<StatoAggiornamento> {
  if (!app.isPackaged) return stato
  if (stato.stato === 'scarico' || stato.stato === 'pronto') return stato
  try {
    await autoUpdater.checkForUpdates()
  } catch (e) {
    cambia({ stato: 'errore', errore: (e as Error).message.split('\n')[0] })
  }
  return stato
}

/** chiude (dopo aver fermato il motore) e installa la versione scaricata, poi riapre l'app */
export function installaAggiornamento(): void {
  if (stato.stato !== 'pronto') return
  autoUpdater.quitAndInstall(true, true)
}
