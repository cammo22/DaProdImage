// Tipi condivisi fra il processo principale (Electron) e l'interfaccia.
import { MODELLI, type IdModello } from './modelli'
export type { IdModello } from './modelli'

/** Cosa fa un lavoro. */
export type Modalita =
  | 'crea' // testo → immagine
  | 'modifica' // modifica di tutta l'immagine (con eventuali riferimenti)
  | 'zona' // modifica solo della zona segnata (maschera)
  | 'espandi' // allarga la foto oltre i bordi
  | 'rifinisci' // ingrandisce e ridisegna i dettagli (bozza → alta qualità)
  | 'varia' // variazioni che tengono la composizione
  | 'ingrandisci' // ingrandimento col modello di upscaling, senza ridisegnare
  | 'descrivi' // il modello di testo scrive (migliora prompt, descrive una foto, traduce)
  | 'traduci' // il prompt dall'italiano all'inglese con il traduttore dedicato (sul processore, senza Qwen)
  | 'importa' // (solo in galleria) una foto portata dentro da fuori
  | 'sfondo' // toglie lo sfondo: PNG con trasparenza (BiRefNet), i pixel del soggetto restano quelli originali
  | 'segmenta' // estrae da una foto la cosa indicata (riquadro o punti): SAM2 → PNG con trasparenza, pixel originali

export interface LoraAttiva {
  file: string
  /** −2…2 (0 = ignorato); l'ordine della lista è l'ordine in cui si applicano */
  forza: number
}

/** Un riquadro dell'Editor box: coordinate 0–1 sulla tela/foto (origine in alto a sinistra), [x0, y0, x1, y1]. */
export type Box01 = [number, number, number, number]

/** Una regione dell'Editor box, col suo prompt (regional prompting) */
export interface Regione {
  id: string
  box: Box01
  prompt: string
}

/** Un riquadro dell'Editor box della GUI v2: dove sta nella tela finale (frazioni 0–1) e cosa ci deve essere.
 *  Il motore lo trasforma in `Regione` (`adattaRichiesta`): la conversione al formato di Klein 3 o alle parole di Qwen la fa solo lui. */
export interface BoxRegione {
  id: string
  /** x0, y0, x1, y1 normalizzati 0–1 sulla tela finale */
  rect: [number, number, number, number]
  tipo: 'persona' | 'oggetto' | 'testo' | 'sfondo'
  prompt: string
  /** foto di riferimento di questo box (→ <imageN>): il motore non la usa ancora */
  rif?: string
  /** guida = composizione suggerita · decisa = il modello resta lì dentro · blocca = maschera e compositing (per ora vale come decisa) */
  rigidita: 'guida' | 'decisa' | 'blocca'
  ordine: number
  /** l'occhio spento nell'editor: il riquadro resta ma non parte */
  nascosta?: boolean
}

/** Lo sfondo di una creazione: la scena, trasparente (PNG con alfa) o una tinta unita (#rrggbb). */
export type SfondoRichiesto = 'scena' | 'trasparente' | { tinta: string }

/** Estrai fedele: cosa ritagliare con SAM2 (tutto in coordinate 0–1 sulla foto) */
export interface OpzioniSegmenta {
  box?: Box01
  punti?: { x: number; y: number; positivo: boolean }[]
  /** true = il PNG è ritagliato attorno alla cosa (+ un margine); false = ha la misura della foto, con il resto trasparente */
  ritaglia?: boolean
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

/** il modello che disegna: Qwen-Image 2.1, FLUX 3 Klein (veloce, distillato) o FLUX 3 Klein Base (50 passi con CFG) */
export type Famiglia = 'qwen' | 'klein' | 'klein-base'

/** quello che distingue i modelli: passi per qualità, CFG e cosa sanno fare. Nomi e passi «alti» vengono da `modelli.ts`
 *  (la mappa unica); «turbo» resta solo per le qualità salvate prima della 1.1 e vale come «alta» (`senzaTurbo`). */
const famiglia = (id: IdModello, bozza: number, massima: number): { nome: string; corto: string; sotto: string; passi: { turbo: number; bozza: number; alta: number; massima: number }; cfg: number | null; lora: boolean } => {
  const m = MODELLI[id]
  return { nome: m.nome, corto: m.corto, sotto: m.sotto, passi: { turbo: m.passi, bozza, alta: m.passi, massima }, cfg: m.cfg, lora: m.lora }
}
export const FAMIGLIE: Record<Famiglia, ReturnType<typeof famiglia>> = {
  qwen: famiglia('qwen-base', 20, 50),
  klein: famiglia('klein', 8, 24),
  'klein-base': famiglia('klein-base', 25, 64)
}

/** Quello che l'interfaccia chiede: il principale lo trasforma nel grafo di ComfyUI. */
export interface Richiesta {
  modalita: Modalita
  /** il modello che disegna (se manca: quello scelto nelle impostazioni) */
  famiglia?: Famiglia
  /** Klein: il prompt è una richiesta breve scritta dall'utente (non un'istruzione già costruita dall'app): il Qwen3-VL la espande in una didascalia dettagliata */
  potenzia?: boolean
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
  /** misura esatta dell'immagine che esce (px): il motore ci porta il risultato alla fine; se mancano, esce com'è */
  uscita?: { w: number; h: number }
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
  /** Editor box (regional prompting): più riquadri, ognuno col suo prompt; `prompt` resta la descrizione di tutta la scena. Per 'crea' e 'modifica'. */
  regioni?: Regione[]
  /** GUI v2, Editor box: i riquadri con il loro testo (→ `regioni`) e la scena generale (→ `prompt`, se ci sono riquadri validi) */
  box?: BoxRegione[]
  promptScena?: string
  /** GUI v2: lo sfondo richiesto ('trasparente' = come `trasparente`; { tinta } = una riga in più nel prompt) */
  sfondo?: SfondoRichiesto
  /** 'segmenta': cosa estrarre */
  segmenta?: OpzioniSegmenta
  /** Turbo: LoRA di distillazione a 8 passi (CFG 1), circa 5 volte più veloce */
  turbo?: boolean
  trasparente?: boolean
  /** quante immagini fare (seed diversi) */
  quante: number
  /** descrivi: istruzione di sistema e lunghezza massima */
  sistema?: string
  maxToken?: number
  /** descrivi: quanto è creativo (0.7 di solito; bassa per tradurre) */
  temperatura?: number
  /** descrivi: scrive col Qwen3-VL 4B di Klein (caricato come `krea2`) invece che con l'encoder di Qwen; lo mette da sé `esegui` quando la famiglia è Klein (`false` = no) */
  encoderKlein?: boolean
  /** descrivi: penalità di presenza (l'upsampler di Klein usa 1,5 per le didascalie da zero) */
  presenza?: number
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
  /** il prompt come l'ha ricevuto il modello (tradotto in inglese, se serviva) */
  promptInglese?: string
  /** dove va l'anteprima, in pixel della foto di partenza (la zona ritagliata; per Espandi esce dai bordi) */
  areaAnteprima?: Riquadro
  /** secondi per passo misurati in questo lavoro (per accorgersi se la scheda sta andando in RAM) */
  secondiPasso?: number
  /** megapixel su cui lavora il campionatore */
  megapixel?: number
  /** quando scrive l'LLM: token al secondo (media mobile) */
  tokSec?: number
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
  /** il prompt tradotto in inglese che ha visto il modello (se era in un'altra lingua) */
  promptInglese?: string
}

export interface FiltroGalleria {
  testo?: string
  modalita?: 'tutte' | 'create' | 'modificate' | 'preferite'
}

/** i due scaffali dei LoRA: quelli per Qwen-Image 2.1 e quelli per FLUX 3 Klein (Klein veloce e Klein Base hanno gli stessi) */
export type GruppoLora = 'qwen' | 'flux'

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
  /** per quali modelli è fatto (da `analizza`: dai nomi dei tensori); vuoto = non si capisce */
  famiglie?: Famiglia[]
  /** lo scaffale scelto da chi l'ha caricato, per i LoRA di cui i nomi dei tensori non dicono il modello (non conta se `famiglie` è piena) */
  gruppo?: GruppoLora
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
  /** la famiglia che disegna adesso (va sempre d'accordo con `modelloScelto`: `allineaScelta` in `modelli.ts`) */
  famiglia: Famiglia
  /** il modello scelto nell'interfaccia (qwen-base / klein / klein-base); `modello` invece è il file del denoiser di Qwen */
  modelloScelto: IdModello
  /** i file di FLUX 3 Klein (vuoto = li trova da solo nelle cartelle dei modelli) */
  kleinModello: string
  kleinBase: string
  kleinEncoder: string
  kleinVae: string
  /** quando l'app è ferma scarica da sola i file consigliati che mancano (LoRA Turbo, traduttore…) */
  scaricaInIdle: boolean
  /** ingrandisce con l'ingranditore NVIDIA RTX (se c'è); se no con quello a modello (4x-UltraSharp) */
  upscalerRtx: boolean
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
  /** i prompt in italiano (o in altre lingue) si traducono in inglese prima di disegnare */
  traduci: boolean
  /** chi traduce: 'dedicato' = un modello di sola traduzione (Opus-MT, sul processore); 'llm' = lo stesso Qwen3-VL */
  traduttore: 'dedicato' | 'llm'
  /** una cosa alla volta in VRAM: quando passa dal modello immagine all'LLM (o viceversa) scarica quello che non serve */
  unaCosaAllaVolta: boolean
  /** Klein: espande i prompt brevi in didascalie dettagliate col Qwen3-VL (come l'upsampler ufficiale; +circa mezzo minuto per immagine) */
  potenziaKlein: boolean
  /** i lavori di testo (migliora prompt, descrivi foto, Idee, Estrai, traduzione LLM…) scrivono col Qwen3-VL 4B (veloce, tutto in VRAM) anche con Qwen.
   *  Spento di serie: con Qwen scrive il suo encoder 8B. Con Klein il 4B scrive sempre. */
  testoCon4B: boolean
  /** secondi senza lavori dopo i quali i modelli escono dalla VRAM (0 = mai) */
  scaricaDopo: number
  /** interruttore «Modelli uncensored» (Opzioni): spento di serie. Con lui spento le voci `uncensored` del catalogo non si scaricano */
  uncensored: boolean
  /** ha letto e accettato l'avviso sui modelli uncensored (serve anche questo per scaricarli) */
  uncensoredAccettato: boolean
  /** i lavori di testo con Klein (migliora prompt, descrivi foto, Idee…) scrivono col Qwen3-VL 4B uncensored (voce `llm-huihui-4b`), se è scaricato; serve `uncensored` acceso */
  testoUncensored: boolean
}

/** RAM, VRAM e GPU per la barra in alto (byte; uso e temperatura in % e °C) */
export interface Risorse {
  ramTotale: number
  ramLibera: number
  vramTotale?: number
  vramUsata?: number
  gpu?: string
  gpuUso?: number
  gpuTemp?: number
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
  tipo: 'diffusione' | 'encoder' | 'vae' | 'lora' | 'upscaler' | 'anteprima' | 'traduttore' | 'klein' | 'klein-te' | 'klein-vae' | 'sfondo' | 'segmentatore' | 'llm'
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
  /** un LoRA da prendere da una pagina (Hugging Face / Civitai) invece che da un file preciso: `url` non serve */
  link?: string
  /** per i LoRA: a cosa servono, in una riga ("Prova vestito", "Camera") */
  uso?: string
  /** quantizzazione offerta (solo Q4, Q6 e Q8) */
  quant?: 'Q4' | 'Q6' | 'Q8'
  /** per le voci di terzi: il repo Hugging Face e le espressioni (in ordine) per trovare il file giusto; `file` e `url` si scoprono scaricando */
  repo?: string
  cerca?: string[]
  /** altri file dello stesso repo da scaricare accanto (espressioni sul nome): config e tokenizer del traduttore */
  accanto?: string[]
  /** per gli encoder GGUF: come trovare l'mmproj (e dove, se sta in un altro repo) */
  cercaMmproj?: string[]
  mmprojRepo?: string
  /** per il denoiser: è già il Turbo (distillato a 8 passi), non serve il LoRA Turbo8 */
  turbo?: boolean
  /** come raggruppare le voci nell'elenco (encoder: AtomicChat / mradermacher) */
  famiglia?: string
  /** non so ancora il nome vero del file: lo trovo al primo download */
  daCercare?: boolean
  /** il componente è «uncensored» (senza il rifiuto addestrato nei pesi): si scarica solo con l'interruttore acceso e l'avviso accettato */
  uncensored?: boolean
  /** sigla della licenza dei pesi (es. 'Apache-2.0', 'Qwen Research', 'FLUX Kommunity', 'MIT') e dove si legge */
  licenza?: string
  licenzaUrl?: string
  /** a cosa serve nella pipeline: la UI lo mostra accanto al nome */
  ruolo?: 'denoiser' | 'encoder' | 'llm' | 'vae' | 'lora' | 'segmentatore' | 'sfondo'
  /** una riga di avvertenza da mostrare prima del download (limiti d'uso, compatibilità) */
  avviso?: string
  /** il repo e la revisione fissata (per riprodurre il download); senza revisione si usa `main` */
  revisione?: string
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

/** il modello di diffusione è il Turbo ufficiale (già distillato a 8 passi)? */
export const modelloTurbo = (file: string): boolean => /turbo/i.test(file)
