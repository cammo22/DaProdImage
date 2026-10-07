// Il ponte fra l'interfaccia e il processo principale: solo queste funzioni, niente Node nel renderer.
import { contextBridge, ipcRenderer, webUtils } from 'electron'

const chiama = (canale: string) => (...a: unknown[]) => ipcRenderer.invoke(canale, ...a)
const ascolta = (canale: string) => (f: (...a: unknown[]) => void) => {
  const h = (_e: unknown, ...a: unknown[]): void => f(...a)
  ipcRenderer.on(canale, h)
  return () => ipcRenderer.removeListener(canale, h)
}

const api = {
  impostazioni: { leggi: chiama('impostazioni:leggi'), salva: chiama('impostazioni:salva') },
  sistema: { controllo: chiama('sistema:controllo') },
  setup: { cerca: chiama('setup:cerca'), stato: chiama('setup:stato'), avvia: chiama('setup:avvia'), annulla: chiama('setup:annulla') },
  modelli: { stato: chiama('modelli:stato'), file: chiama('modelli:file'), scarica: chiama('modelli:scarica'), annulla: chiama('download:annulla') },
  motore: {
    info: chiama('motore:info'), avvia: chiama('motore:avvia'), riavvia: chiama('motore:riavvia'), ferma: chiama('motore:ferma'),
    log: chiama('motore:log'), libera: chiama('motore:libera'), apriComfy: chiama('motore:apriComfy')
  },
  lavori: { accoda: chiama('lavori:accoda'), annulla: chiama('lavori:annulla'), svuota: chiama('lavori:svuota'), pulisci: chiama('lavori:pulisci'), elenco: chiama('lavori:elenco') },
  testo: { scrivi: chiama('testo:scrivi') },
  galleria: {
    elenco: chiama('galleria:elenco'), opera: chiama('galleria:opera'), preferita: chiama('galleria:preferita'), elimina: chiama('galleria:elimina'),
    mostra: chiama('galleria:mostra'), apriCartella: chiama('galleria:apriCartella'), copia: chiama('galleria:copia'), esporta: chiama('galleria:esporta'),
    importa: chiama('galleria:importa'), meta: chiama('galleria:meta')
  },
  lora: { elenco: chiama('lora:elenco'), aggiorna: chiama('lora:aggiorna'), importa: chiama('lora:importa'), elimina: chiama('lora:elimina'), scarica: chiama('lora:scarica'), apriCartella: chiama('lora:apriCartella') },
  file: {
    scegliImmagini: chiama('file:scegliImmagini'), scegli: chiama('file:scegli'), scegliCartella: chiama('file:scegliCartella'),
    salvaTemp: chiama('file:salvaTemp'), info: chiama('file:info'), portaDentro: chiama('file:portaDentro'),
    /** il percorso vero di un file trascinato nella finestra */
    percorso: (f: File) => webUtils.getPathForFile(f)
  },
  app: { apriLink: chiama('app:apriLink'), versione: chiama('app:versione'), apriCartella: chiama('app:apriCartella') },
  aggiornamento: { stato: chiama('aggiornamento:stato'), controlla: chiama('aggiornamento:controlla'), installa: chiama('aggiornamento:installa') },
  trascina: (percorso: string) => ipcRenderer.send('trascina', percorso),
  su: {
    motore: ascolta('motore'), motoreLog: ascolta('motoreLog'), lavori: ascolta('lavori'), lavoro: ascolta('lavoro'),
    setup: ascolta('setup'), galleria: ascolta('galleria'), download: ascolta('download'), aggiornamento: ascolta('aggiornamento')
  }
}

contextBridge.exposeInMainWorld('daprod', api)
export type ApiGrezza = typeof api
