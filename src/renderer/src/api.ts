// L'API del processo principale, con i tipi giusti.
import type {
  ControlloSistema, Download, FiltroGalleria, Impostazioni, InfoLora, InfoMotore, Lavoro, Opera, PassoSetup, Richiesta, StatoAggiornamento, StatoVoce
} from '@shared/tipi'

type Via = () => void
export interface FileModelli {
  diffusione: string[]
  encoder: string[]
  vae: string[]
  upscaler: string[]
}
export interface ModelloTrovato {
  percorso: string
  byte: number
  id?: string
}
export interface OpzioniSetup {
  cartellaModelli: string
  modello: string
  fileEsistente?: string
  extra: string[]
  /** aggiornamento del motore: tiene il modello che c'è, non ne scarica uno nuovo */
  mantieniModello?: boolean
}

export interface Api {
  impostazioni: { leggi(): Promise<Impostazioni>; salva(m: Partial<Impostazioni>): Promise<Impostazioni> }
  sistema: { controllo(cartella: string): Promise<ControlloSistema> }
  setup: {
    cerca(): Promise<ModelloTrovato[]>
    stato(): Promise<{ installato: boolean; motore: boolean; modelli: StatoVoce[] }>
    avvia(o: OpzioniSetup): Promise<boolean>
    annulla(): Promise<void>
  }
  modelli: { stato(): Promise<StatoVoce[]>; file(): Promise<FileModelli>; scarica(id: string): Promise<Download>; annulla(id: string): Promise<void> }
  motore: {
    info(): Promise<InfoMotore>; avvia(): Promise<void>; riavvia(): Promise<void>; ferma(): Promise<void>
    log(): Promise<string[]>; libera(): Promise<void>; apriComfy(): Promise<void>
  }
  lavori: { accoda(q: Richiesta): Promise<string[]>; annulla(id: string): Promise<void>; svuota(): Promise<void>; pulisci(): Promise<void>; elenco(): Promise<Lavoro[]> }
  testo: { scrivi(q: Richiesta): Promise<string> }
  galleria: {
    elenco(f: FiltroGalleria): Promise<Opera[]>; opera(id: string): Promise<Opera | undefined>; preferita(id: string, si: boolean): Promise<void>
    elimina(ids: string[]): Promise<void>; mostra(id: string): Promise<void>; apriCartella(): Promise<void>; copia(id: string): Promise<void>
    esporta(id: string): Promise<void>; importa(p: string[]): Promise<Opera[]>; meta(p: string): Promise<Partial<Opera> | null>
  }
  lora: {
    elenco(): Promise<InfoLora[]>; aggiorna(file: string, m: Partial<InfoLora>): Promise<void>; importa(p: string[]): Promise<string[]>
    elimina(file: string): Promise<void>; scarica(link: string): Promise<Download>; apriCartella(): Promise<void>
  }
  file: {
    scegliImmagini(multiple: boolean): Promise<string[]>; scegli(nome: string, est: string[]): Promise<string | null>
    scegliCartella(attuale?: string): Promise<string | null>; salvaTemp(dataUrl: string, nome?: string): Promise<string>
    info(p: string): Promise<{ byte: number; larghezza: number; altezza: number; nome: string; estensione: string } | null>
    portaDentro(p: string[]): Promise<string[]>
    percorso(f: File): string
  }
  app: { apriLink(u: string): Promise<void>; versione(): Promise<string>; apriCartella(q: 'modelli' | 'dati' | 'log'): Promise<void> }
  aggiornamento: { stato(): Promise<StatoAggiornamento>; controlla(): Promise<StatoAggiornamento>; installa(): Promise<void> }
  trascina(p: string): void
  su: {
    motore(f: (i: InfoMotore) => void): Via
    motoreLog(f: (r: string) => void): Via
    lavori(f: (l: Lavoro[]) => void): Via
    lavoro(f: (l: Lavoro) => void): Via
    setup(f: (passi: PassoSetup[], riga?: string) => void): Via
    galleria(f: () => void): Via
    download(f: (d: Download) => void): Via
    aggiornamento(f: (s: StatoAggiornamento) => void): Via
  }
}

export const api = (window as unknown as { daprod: Api }).daprod

/** un file su disco come URL per <img> (passa dal protocollo daprod://, solo cartelle dell'app) */
export const urlFile = (p: string | undefined, v?: number | string): string =>
  p ? `daprod://f/${encodeURIComponent(p)}${v !== undefined ? `?v=${v}` : ''}` : ''
