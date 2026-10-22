// Il ponte fra l'interfaccia e il processo principale: solo queste funzioni, niente Node nel renderer.
import { contextBridge, ipcRenderer, webUtils } from 'electron'

/** gli errori di Electron arrivano come «Error invoking remote method 'x': Error: ENOSPC…»: si toglie la parte tecnica e si dice in italiano */
function messaggioUtente(e: unknown): string {
  const t = String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']*': (Error: )?/, '')
  if (/ENOSPC/.test(t)) return 'Non c\'è più spazio sul disco.'
  if (/ENOENT/.test(t)) return 'Non trovo il file o la cartella: è stato spostato o cancellato?'
  if (/EPERM|EBUSY|EACCES/.test(t)) return 'Il file è in uso o protetto: riprova fra un attimo.'
  if (/fetch failed|ECONNREFUSED|ECONNRESET|ETIMEDOUT|UND_ERR|ENOTFOUND|network/i.test(t)) return 'Non riesco a collegarmi (rete assente, o il motore è spento o bloccato).'
  if (/AbortError|aborted/i.test(t)) return 'annullato'
  return t
}
const chiama = (canale: string) => async (...a: unknown[]) => {
  try {
    return await ipcRenderer.invoke(canale, ...a)
  } catch (e) {
    throw new Error(messaggioUtente(e))
  }
}
const ascolta = (canale: string) => (f: (...a: unknown[]) => void) => {
  const h = (_e: unknown, ...a: unknown[]): void => f(...a)
  ipcRenderer.on(canale, h)
  return () => ipcRenderer.removeListener(canale, h)
}

const api = {
  impostazioni: { leggi: chiama('impostazioni:leggi'), salva: chiama('impostazioni:salva') },
  sistema: { controllo: chiama('sistema:controllo') },
  setup: { cerca: chiama('setup:cerca'), stato: chiama('setup:stato'), avvia: chiama('setup:avvia'), annulla: chiama('setup:annulla') },
  modelli: { stato: chiama('modelli:stato'), file: chiama('modelli:file'), scarica: chiama('modelli:scarica'), annulla: chiama('download:annulla'), segmentatori: chiama('modelli:segmentatori'), inutilizzati: chiama('modelli:inutilizzati'), elimina: chiama('modelli:elimina') },
  motore: {
    info: chiama('motore:info'), avvia: chiama('motore:avvia'), riavvia: chiama('motore:riavvia'), ferma: chiama('motore:ferma'),
    log: chiama('motore:log'), libera: chiama('motore:libera'), apriComfy: chiama('motore:apriComfy')
  },
  lavori: { accoda: chiama('lavori:accoda'), annulla: chiama('lavori:annulla'), svuota: chiama('lavori:svuota'), pulisci: chiama('lavori:pulisci'), elenco: chiama('lavori:elenco') },
  testo: { scrivi: chiama('testo:scrivi') },
  galleria: {
    elenco: chiama('galleria:elenco'), opera: chiama('galleria:opera'), preferita: chiama('galleria:preferita'), elimina: chiama('galleria:elimina'),
    mostra: chiama('galleria:mostra'), apriCartella: chiama('galleria:apriCartella'), copia: chiama('galleria:copia'), esporta: chiama('galleria:esporta'),
    importa: chiama('galleria:importa'), meta: chiama('galleria:meta'), importaFoto: chiama('galleria:importaFoto')
  },
  lora: { elenco: chiama('lora:elenco'), compatibili: chiama('lora:compatibili'), aggiorna: chiama('lora:aggiorna'), importa: chiama('lora:importa'), elimina: chiama('lora:elimina'), scarica: chiama('lora:scarica'), apriCartella: chiama('lora:apriCartella') },
  file: {
    scegliImmagini: chiama('file:scegliImmagini'), scegli: chiama('file:scegli'), scegliCartella: chiama('file:scegliCartella'),
    salvaTemp: chiama('file:salvaTemp'), info: chiama('file:info'), portaDentro: chiama('file:portaDentro'), inPng: chiama('file:inPng'),
    /** il percorso vero di un file trascinato nella finestra */
    percorso: (f: File) => webUtils.getPathForFile(f)
  },
  album: {
    elenco: chiama('album:elenco'), carica: chiama('album:carica'), salva: chiama('album:salva'), elimina: chiama('album:elimina'),
    prepara: chiama('album:prepara'), salvaFoto: chiama('album:salvaFoto'), esportata: chiama('album:esportata'), pdf: chiama('album:pdf'), mostra: chiama('album:mostra')
  },
  app: { apriLink: chiama('app:apriLink'), versione: chiama('app:versione'), apriCartella: chiama('app:apriCartella') },
  aggiornamento: { stato: chiama('aggiornamento:stato'), controlla: chiama('aggiornamento:controlla'), installa: chiama('aggiornamento:installa') },
  trascina: (percorso: string) => ipcRenderer.send('trascina', percorso),
  su: {
    motore: ascolta('motore'), motoreLog: ascolta('motoreLog'), lavori: ascolta('lavori'), lavoro: ascolta('lavoro'),
    setup: ascolta('setup'), galleria: ascolta('galleria'), download: ascolta('download'), aggiornamento: ascolta('aggiornamento'),
    risorse: ascolta('risorse')
  }
}

contextBridge.exposeInMainWorld('daprod', api)
export type ApiGrezza = typeof api
