// L'API del processo principale, con i tipi giusti.
import type {
  ControlloSistema, Download, FiltroGalleria, Impostazioni, InfoLora, InfoMotore, Lavoro, Opera, PassoSetup, Richiesta, Risorse, StatoAggiornamento, StatoVoce
} from '@shared/tipi'

type Via = () => void

export interface RiassuntoAlbum {
  id: string
  nome: string
  aggiornato: number
  spread: number
  foto: number
  copertina?: string
}
export interface FileInutile {
  percorso: string
  nome: string
  cartella: string
  byte: number
  motivo: string
}
export interface PaginaPdf {
  jpeg: string
  larghezza: number
  altezza: number
  mmL: number
  mmA: number
}
export interface FileModelli {
  diffusione: string[]
  encoder: string[]
  vae: string[]
  upscaler: string[]
  /** i file di FLUX 3 Klein (modelli, text encoder, VAE) */
  klein: string[]
  kleinTe: string[]
  kleinVae: string[]
  /** i file di FLUX.2 Klein 4B (modello, text encoder, VAE condiviso) */
  klein4b: string[]
  klein4bTe: string[]
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
  modelli: {
    stato(): Promise<StatoVoce[]>; file(): Promise<FileModelli>; scarica(id: string): Promise<Download>; annulla(id: string): Promise<void>
    inutilizzati(): Promise<FileInutile[]>; elimina(percorso: string): Promise<void>
  }
  motore: {
    info(): Promise<InfoMotore>; avvia(): Promise<void>; riavvia(): Promise<void>; ferma(): Promise<void>
    log(): Promise<string[]>; libera(): Promise<void>; apriComfy(): Promise<void>
  }
  lavori: { accoda(q: Richiesta): Promise<string[]>; annulla(id: string): Promise<void>; svuota(): Promise<void>; pulisci(): Promise<void>; elenco(): Promise<Lavoro[]> }
  testo: { scrivi(q: Richiesta): Promise<string> }
  galleria: {
    elenco(f: FiltroGalleria): Promise<Opera[]>; opera(id: string): Promise<Opera | undefined>; preferita(id: string, si: boolean): Promise<void>
    elimina(ids: string[], definitivo?: boolean): Promise<void>; mostra(id: string): Promise<void>; apriCartella(): Promise<void>; copia(ids: string | string[]): Promise<void>
    esporta(id: string): Promise<void>; importa(p: string[]): Promise<{ importate: Opera[]; altre: string[] }>; meta(p: string): Promise<Partial<Opera> | null>
    importaFoto(png: string, nome: string): Promise<Opera>
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
    inPng(p: string, latoMax?: number): Promise<{ percorso: string; larghezza: number; altezza: number }>
    percorso(f: File): string
  }
  album: {
    elenco(): Promise<RiassuntoAlbum[]>
    carica(id: string): Promise<unknown>
    salva(a: { id: string }): Promise<void>
    elimina(id: string): Promise<void>
    prepara(p: string): Promise<{ percorso: string; nome: string; data: number }>
    salvaFoto(id: string, foto: string, grande: string, mini: string): Promise<{ grande: string; mini: string }>
    esportata(cartella: string, nome: string, dataUrl: string): Promise<string>
    pdf(dest: string, pagine: PaginaPdf[]): Promise<string>
    mostra(p: string): Promise<void>
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
    risorse(f: (r: Risorse) => void): Via
  }
}

export const api = (window as unknown as { daprod: Api }).daprod

/** un file su disco come URL per <img> (passa dal protocollo daprod://, solo cartelle dell'app) */
export const urlFile = (p: string | undefined, v?: number | string): string =>
  p ? `daprod://f/${encodeURIComponent(p)}${v !== undefined ? `?v=${v}` : ''}` : ''
