// Tipi condivisi fra il processo principale (Electron) e l'interfaccia.

/** Cosa fa un lavoro. */
export type Modalita =
  | 'crea' // testo → immagine
  | 'modifica' // modifica di tutta l'immagine (con eventuali riferimenti)
  | 'zona' // modifica solo della zona segnata (maschera)
  | 'espandi' // allarga la foto oltre i bordi
  | 'rifinisci' // ingrandisce e ridisegna i dettagli (bozza → alta qualità)
  | 'varia' // variazioni che tengono la composizione
  | 'ingrandisci' // ingrandimento col modello di upscaling, senza ridisegnare
  | 'descrivi' // il modello di testo scrive (migliora prompt, descrive una foto)

export interface LoraAttiva {
  file: string
  forza: number
}

export interface Bordi {
  sinistra: number
  sopra: number
  destra: number
  sotto: number
}

export interface Riquadro {
  x: number
  y: number
  w: number
  h: number
}

/** Quello che l'interfaccia chiede: il principale lo trasforma nel grafo di ComfyUI. */
export interface Richiesta {
  modalita: Modalita
  prompt: string
  negativo: string
  seed: number // -1 = casuale
  passi: number
  cfg: number
  sampler: string
  scheduler: string
  /** crea: dimensioni esatte (multipli di 32) */
  larghezza: number
  altezza: number
  /** modifica/zona/espandi/rifinisci: area di lavoro in megapixel */
  megapixel: number
  /** percorsi su disco: [0] è la foto da modificare, le altre sono riferimenti */
  immagini: string[]
  /** zona: maschera PNG (bianco = zona) grande come immagini[0] */
  maschera?: string
  /** zona: riquadro della maschera nella foto originale (lo calcola l'interfaccia) */
  riquadro?: Riquadro
  /** zona: quanto contesto prendere attorno alla zona (0 = solo la zona, 1 = una zona in più per lato) */
  contesto?: number
  /** zona: ritaglia e lavora più grande (molto più dettaglio sulle zone piccole) */
  ritaglia?: boolean
  /** zona: dà al modello anche la zona segnata in rosso */
  segnaZona?: boolean
  /** zona: prima di ridisegnare riempie la zona coi colori attorno (per "rimuovi": il modello non vede più l'oggetto) */
  riempi?: boolean
  /** zona/varia/rifinisci: quanto ridisegnare (denoise 0..1) */
  forza?: number
  /** zona: allarga la maschera (px) e sfuma il bordo (px) */
  allarga?: number
  sfuma?: number
  /** espandi: quanti px aggiungere per lato */
  bordi?: Bordi
  /** rifinisci/ingrandisci: di quanto ingrandire */
  fattore?: number
  lora: LoraAttiva[]
  /** Turbo: LoRA di distillazione a 8 passi (CFG 1), circa 5 volte più veloce */
  turbo?: boolean
  trasparente?: boolean
  /** quante immagini fare (seed diversi) */
  quante: number
  /** descrivi: istruzione di sistema e lunghezza massima */
  sistema?: string
  maxToken?: number
  /** per la galleria: da quale opera nasce */
  origine?: string
  /** etichetta corta per la coda (es. "Rimuovi sfondo") */
  etichetta?: string
}

export type StatoLavoro = 'in coda' | 'in corso' | 'fatto' | 'errore' | 'annullato'

export interface Lavoro {
  id: string
  richiesta: Richiesta
  stato: StatoLavoro
  /** quale immagine della serie (1..quante) */
  indice: number
  fase: string
  passo: number
  passiTotali: number
  creato: number
  inizio?: number
  fine?: number
  /** secondi stimati alla fine */
  stima?: number
  anteprima?: string
  /** dove va l'anteprima, in pixel della foto di partenza (la zona ritagliata; per Espandi esce dai bordi) */
  areaAnteprima?: Riquadro
  /** secondi per passo misurati in questo lavoro (per accorgersi se la scheda sta andando in RAM) */
  secondiPasso?: number
  /** megapixel su cui lavora il campionatore */
  megapixel?: number
  risultati: string[]
  testo?: string
  errore?: string
}

export interface Opera {
  id: string
  file: string
  miniatura: string
  larghezza: number
  altezza: number
  creata: number
  durata: number
  modalita: Modalita
  prompt: string
  negativo: string
  seed: number
  passi: number
  cfg: number
  sampler: string
  scheduler: string
  lora: LoraAttiva[]
  modello: string
  forza?: number
  trasparente?: boolean
  preferita: boolean
  origine?: string
  etichetta?: string
}

export interface FiltroGalleria {
  testo?: string
  modalita?: 'tutte' | 'create' | 'modificate' | 'preferite'
}

export interface InfoLora {
  file: string
  nome: string
  dimensione: number
  parole: string
  forza: number
  anteprima?: string
  fonte?: string
  note?: string
  /** 'si' = Qwen-Image 2.1, 'no' = un altro modello, '?' = non si capisce */
  compatibile: 'si' | 'no' | '?'
  base?: string
  aggiunta: number
}

export interface Predefiniti {
  passi: number
  cfg: number
  sampler: string
  scheduler: string
  megapixel: number
}

export interface Impostazioni {
  cartellaModelli: string
  cartellaGalleria: string
  modello: string
  encoder: string
  vae: string
  upscaler: string
  porta: number
  cacheKV: 'auto' | 'gpu' | 'cpu' | 'off'
  cacheTipo: 'default' | 'int8' | 'int4'
  encoderSuCpu: boolean
  anteprimaLive: boolean
  riservaVram: number
  argomentiExtra: string
  predefiniti: Predefiniti
  installato: boolean
  tokenCivitai: string
  tokenHF: string
  /** secondi per passo misurati, per megapixel (chiave = mp arrotondati a 0.25) */
  tempi: Record<string, number>
  /** il LoRA Turbo (8 passi) dentro models/loras */
  loraTurbo: string
  /** profilo della memoria: auto = dalla VRAM della scheda; bassa = 6 GB; normale = 8-12 GB; alta = 16 GB e più */
  memoria: 'auto' | 'bassa' | 'normale' | 'alta'
  /** VRAM vista l'ultima volta (MB), per decidere il profilo prima che parta il motore */
  vramMB: number
  /** --fast di ComfyUI (accumulo fp16 sulle RTX): più veloce, qualità quasi uguale */
  veloce: boolean
}

export type StatoMotore = 'spento' | 'avvio' | 'pronto' | 'errore' | 'non installato'

export interface InfoMotore {
  stato: StatoMotore
  messaggio?: string
  porta: number
  vramTotale?: number
  vramLibera?: number
  gpu?: string
  versione?: string
}

/** Un file di modello che si può scaricare. */
export interface VoceCatalogo {
  id: string
  tipo: 'diffusione' | 'encoder' | 'vae' | 'lora' | 'upscaler'
  nome: string
  descrizione: string
  file: string
  cartella: string
  url: string
  byte: number
  sha256?: string
  consigliato?: boolean
  necessario?: boolean
  /** la dimensione è indicativa (file di terzi senza sha256 noto): basta che ci sia */
  circa?: boolean
}

export interface StatoVoce extends VoceCatalogo {
  presente: boolean
}

export interface PassoSetup {
  id: string
  titolo: string
  stato: 'attesa' | 'in corso' | 'fatto' | 'errore' | 'saltato'
  dettaglio?: string
  avanzamento?: number // 0..1
}

export interface ControlloSistema {
  gpu?: string
  vramMB?: number
  driver?: string
  ramGB: number
  liberoGB: number
  cartella: string
  ok: boolean
  avvisi: string[]
}

export interface StatoAggiornamento {
  stato: 'nessuno' | 'sviluppo' | 'controllo' | 'aggiornato' | 'scarico' | 'pronto' | 'errore'
  attuale: string
  versione?: string
  note?: string
  percentuale?: number
  errore?: string
  ultimoControllo?: number
}

export interface Download {
  id: string
  nome: string
  ricevuti: number
  totali: number
  velocita: number
  stato: 'in corso' | 'fatto' | 'errore' | 'annullato' | 'verifica'
  errore?: string
}
