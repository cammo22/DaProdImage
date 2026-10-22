// Lo stato dell'interfaccia (zustand). Le scelte di Crea/Modifica e i LoRA attivi restano fra un avvio e l'altro.
import { create } from 'zustand'
import { FAMIGLIE, type BoxRegione, type Download, type Famiglia, type Impostazioni, type InfoLora, type InfoMotore, type Lavoro, type LoraAttiva, type Opera, type Bordi, type Risorse, type StatoAggiornamento } from '@shared/tipi'
import { senzaTurbo } from '@shared/modelli'
import { api } from './api'
import type { Misura } from './componenti/Misura'

// 'laboratorio' è sparito dalla rotaia (T7): T9 ha spostato le sue ricette nella scheda 'ricette' di Modifica.
// I LoRA stanno dentro Opzioni (`SchedaOpzioni`).
/** 'crea', 'modifica' e 'box' sono i tre modi dello Studio (con Ricette = modifica + modo 'ricette'); 'lora' ha la pagina sua */
export type Pagina = 'crea' | 'modifica' | 'box' | 'album' | 'galleria' | 'lora' | 'impostazioni'
export type SchedaOpzioni = 'generali' | 'lora'
export type Qualita = 'bozza' | 'alta' | 'massima'
/** Scrivi = tutta la foto, o solo la zona se ne hai disegnata una (si decide al momento dell'invio) */
export type ModoModifica = 'scrivi' | 'espandi' | 'ricette' | 'estrai'

export const PASSI_QUALITA: Record<Qualita, number> = { bozza: 20, alta: 40, massima: 50 }

/** il modello che disegna adesso (Qwen, Klein veloce, Klein Base) */
export const famigliaCorrente = (): Famiglia => usaStato.getState().imp?.famiglia || 'qwen'
/** i passi per una qualità col modello scelto (il Turbo di Qwen non c'è più) */
export const passiDi = (q: Qualita, f: Famiglia = famigliaCorrente()): number => FAMIGLIE[f].passi[q]

export interface FotoBase {
  percorso: string
  larghezza: number
  altezza: number
  operaId?: string
  prompt?: string
}

export interface StatoCrea {
  prompt: string
  formato: string
  /** risoluzione: il lato corto in pixel (256p … 2048, il massimo nativo) */
  ris: number
  /** megapixel a cui lavora il modello (0 = come la misura finale); più alti della misura = disegna grande e poi riduce */
  mpLavoro: number
  /** 1, 2 o 4 immagini */
  quante: number
  seed: number
  casuale: boolean
  trasparente: boolean
  /** foto di riferimento (<image1>…): persone, vestiti, oggetti, stili. Non si salvano fra un avvio e l'altro */
  riferimenti: FotoBase[]
  /** il preset scelto a sinistra ('' = libero) e i suoi campi */
  preset: string
  stile: string
  campi: Record<string, string>
  /** le dimensioni precise (se scelte): il modello lavora ai megapixel, poi si porta a questa misura */
  misura: Misura
  /** GUI v2: lo stile nuovo (id di `stili.ts`, '' = nessuno) e quanto forte: 0 leggero · 1 pieno · 2 estremo */
  stileId: string
  intensita: 0 | 1 | 2
  /** GUI v2: lo sfondo (`trasparente` qui sotto resta il flag che il motore già conosce e va sempre d'accordo con questo), la tinta unita e come si guarda la trasparenza */
  sfondo: 'scena' | 'trasparente' | 'tinta'
  tinta: string
  anteSfondo: 'scacchi' | 'bianco' | 'nero' | 'colore'
}

/** L'Editor box: i riquadri disegnati sulla tela di Crea (stesso formato, stessa misura) e la scena generale */
export interface StatoBox {
  scena: string
  regioni: BoxRegione[]
  selezionata: string | null
}

export interface StatoModifica {
  base: FotoBase | null
  /** le versioni di questa foto (la prima è l'originale) */
  versioni: FotoBase[]
  riferimenti: FotoBase[]
  /** modo Esempio: la foto che mostra com'è il risultato che vuoi */
  esempio: FotoBase | null
  modo: ModoModifica
  prompt: string
  mp: number
  qualita: Qualita
  quante: number
  forza: number
  contesto: number
  ritaglia: boolean
  segnaZona: boolean
  /** riempie la zona coi colori attorno prima di ridisegnarla (per rimuovere) */
  riempi: boolean
  sfuma: number
  allarga: number
  bordi: Bordi
  trasparente: boolean
  /** le dimensioni dell'immagine che esce: auto, come l'originale, o una misura scelta */
  misura: Misura
  /** Fusion: le proporzioni della foto nuova ('prima' = come la prima foto) */
  formatoFusion: string
  /** modo Esempio: il piano scritto dal modello guardando l'esempio e le tue foto (si può correggere); `chiave` dice per quali foto e note vale */
  pianoEsempio: { chiave: string; testo: string; ritagli?: (string | null)[] } | null
  /** le azioni rapide sono idee che si sommano: quanta fantasia ha il modello nel mescolarle, e il piano che ne esce */
  fantasia: 'fedele' | 'normale' | 'tanta'
  pianoIdee: { chiave: string; testo: string } | null
}

export interface Avviso {
  id: number
  testo: string
  tipo: 'info' | 'ok' | 'errore'
}

interface Stato {
  pagina: Pagina
  /** la scheda aperta in Opzioni */
  schedaOpzioni: SchedaOpzioni
  imp: Impostazioni | null
  motore: InfoMotore
  lavori: Lavoro[]
  lore: InfoLora[]
  loraAttive: LoraAttiva[]
  crea: StatoCrea
  modifica: StatoModifica
  /** l'Editor box (modo Box dello Studio) */
  box: StatoBox
  codaAperta: boolean
  avvisi: Avviso[]
  /** l'opera aperta nel visore (galleria) */
  visore: Opera | null
  /** aggiornamenti dell'app */
  agg: StatoAggiornamento
  /** RAM, VRAM e GPU (dalla barra in alto) */
  risorse: Risorse | null
  /** un download di un modello in corso (anche quelli da soli, quando l'app è ferma) */
  scarico: Download | null
  /** il selettore di foto aperto (galleria o PC): chi lo apre aspetta la scelta */
  selettore: { multi: boolean; ok: (f: FotoBase[]) => void } | null
  vai(p: Pagina): void
  /** apre Opzioni su una scheda (i LoRA) */
  vaiOpzioni(scheda: SchedaOpzioni): void
  setImp(i: Impostazioni): void
  setCrea(m: Partial<StatoCrea>): void
  setModifica(m: Partial<StatoModifica>): void
  setBox(m: Partial<StatoBox>): void
  setLoraAttive(l: LoraAttiva[]): void
  toggleLora(file: string, forza?: number): void
  avvisa(testo: string, tipo?: Avviso['tipo']): void
  apriVisore(o: Opera | null): void
}

const leggiLocale = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k)
    const j = v ? JSON.parse(v) : null
    // un valore rovinato (non un oggetto) non deve rompere l'avvio
    return j && typeof j === 'object' && !Array.isArray(j) ? { ...d, ...j } : d
  } catch {
    return d
  }
}
const leggiLista = <T,>(k: string): T[] => {
  try {
    const j = JSON.parse(localStorage.getItem(k) || '[]')
    return Array.isArray(j) ? j : []
  } catch {
    return []
  }
}

const CREA0: StatoCrea = {
  prompt: '', formato: '1:1', ris: 1024, mpLavoro: 0, quante: 1, seed: 0, casuale: true, trasparente: false,
  riferimenti: [], preset: '', stile: '', campi: {}, misura: { tipo: 'auto' },
  stileId: '', intensita: 1, sfondo: 'scena', tinta: '#ffffff', anteSfondo: 'scacchi'
}
const BOX0: StatoBox = { scena: '', regioni: [], selezionata: null }
const MOD0: StatoModifica = {
  base: null, versioni: [], riferimenti: [], esempio: null, modo: 'scrivi', prompt: '', mp: 1, qualita: 'alta', quante: 1, forza: 1, contesto: 0.6,
  ritaglia: true, segnaZona: false, riempi: false, sfuma: 10, allarga: 8, bordi: { sinistra: 0, sopra: 0, destra: 0, sotto: 0 }, trasparente: false, misura: { tipo: 'auto' }, formatoFusion: 'prima',
  pianoEsempio: null, fantasia: 'normale', pianoIdee: null
}

/** le scelte salvate dalla 0.1 avevano i megapixel al posto della risoluzione; fino alla 1.0 c'era la qualità «turbo» (ora «alta») */
function daVecchio(c: StatoCrea & { mp?: number; qualita?: unknown; negativo?: unknown; cfg?: unknown; sampler?: unknown; scheduler?: unknown }): StatoCrea {
  // qualità, negativo, CFG, sampler e scheduler non ci sono più in Crea (dalla 1.1 contano solo i valori del modello): si buttano
  const { mp, qualita: _q, negativo: _n, cfg: _c, sampler: _s, scheduler: _sc, ...pulito } = c
  // appena si salva, il campo mp sparisce: la conversione avviene una volta sola
  return mp ? { ...pulito, ris: mp >= 4 ? 2048 : mp >= 2 ? 1440 : 1024 } : pulito
}

/** «Tutta la foto» e «Solo una zona» sono diventate Scrivi; «Fusion» ed «Esempio» sono ricette (Unisci foto, Come l'esempio): si apre il catalogo; la qualità «turbo» della 1.0 ora è «alta» */
const daVecchioMod = (v: StatoModifica): StatoModifica => {
  const m = { ...v, qualita: senzaTurbo(v.qualita) }
  const vecchio = m.modo as string
  if (vecchio === 'tutta' || vecchio === 'zona') return { ...m, modo: 'scrivi' }
  return vecchio === 'nuova' || vecchio === 'fusion' || vecchio === 'esempio' ? { ...m, modo: 'ricette' } : vecchio === 'personaggio' ? { ...m, modo: 'estrai' } : m
}

let idAvviso = 0

export const usaStato = create<Stato>((set, get) => ({
  pagina: 'crea',
  schedaOpzioni: 'generali',
  imp: null,
  motore: { stato: 'spento', porta: 0 },
  lavori: [],
  lore: [],
  loraAttive: leggiLista<LoraAttiva>('dpi-lora'),
  crea: { ...daVecchio(leggiLocale('dpi-crea', CREA0)), riferimenti: [] },
  modifica: daVecchioMod({ ...leggiLocale('dpi-modifica', MOD0), base: null, versioni: [], riferimenti: [], esempio: null }),
  box: { ...BOX0, ...leggiLocale<Partial<StatoBox>>('dpi-box', {}), selezionata: null },
  codaAperta: false,
  avvisi: [],
  visore: null,
  agg: { stato: 'nessuno', attuale: '' },
  risorse: null,
  scarico: null,
  selettore: null,
  vai: (pagina) => set({ pagina }),
  vaiOpzioni: (schedaOpzioni) => (schedaOpzioni === 'lora' ? set({ pagina: 'lora' }) : set({ pagina: 'impostazioni', schedaOpzioni })),
  setImp: (imp) => set({ imp }),
  setCrea: (m) => {
    const crea = { ...get().crea, ...m }
    set({ crea })
    try {
      const { riferimenti: _r, ...resto } = crea
      localStorage.setItem('dpi-crea', JSON.stringify(resto))
    } catch {
      /* niente */
    }
  },
  setModifica: (m) => {
    const modifica = { ...get().modifica, ...m }
    set({ modifica })
    try {
      const { base: _b, versioni: _v, riferimenti: _r, esempio: _e, ...resto } = modifica
      localStorage.setItem('dpi-modifica', JSON.stringify(resto))
    } catch {
      /* niente */
    }
  },
  setBox: (m) => {
    const box = { ...get().box, ...m }
    set({ box })
    try {
      const { selezionata: _s, ...resto } = box
      localStorage.setItem('dpi-box', JSON.stringify(resto))
    } catch {
      /* niente */
    }
  },
  setLoraAttive: (loraAttive) => {
    set({ loraAttive })
    try {
      localStorage.setItem('dpi-lora', JSON.stringify(loraAttive))
    } catch {
      /* niente */
    }
  },
  toggleLora: (file, forza) => {
    const att = get().loraAttive
    const c = att.find((l) => l.file === file)
    if (c) get().setLoraAttive(att.filter((l) => l.file !== file))
    else get().setLoraAttive([...att, { file, forza: forza ?? get().lore.find((l) => l.file === file)?.forza ?? 1 }])
  },
  avvisa: (testo, tipo = 'info') => {
    const id = ++idAvviso
    set({ avvisi: [...get().avvisi, { id, testo, tipo }] })
    setTimeout(() => set({ avvisi: get().avvisi.filter((a) => a.id !== id) }), tipo === 'errore' ? 9000 : 4500)
  },
  apriVisore: (visore) => set({ visore })
}))

/** apre il selettore (galleria o PC) e aspetta: le foto scelte, o niente se si chiude */
export const scegliFoto = (multi = false): Promise<FotoBase[]> =>
  new Promise((ok) => {
    usaStato.setState({
      selettore: {
        multi,
        ok: (f) => {
          usaStato.setState({ selettore: null })
          ok(f)
        }
      }
    })
  })

/** chi vuole sapere quando un lavoro cambia stato (i workflow del Laboratorio) */
export const ascoltatoriLavoro: ((uno: Lavoro, prima: Lavoro | null) => void)[] = []

/** i lavori partiti da Modifica: quando finiscono, il risultato diventa una nuova versione della foto */
export const attesiModifica = new Set<string>()

async function nuovaVersione(l: Lavoro): Promise<void> {
  for (const id of l.risultati) {
    const o = await api.galleria.opera(id)
    if (!o) continue
    const f: FotoBase = { percorso: o.file, larghezza: o.larghezza, altezza: o.altezza, operaId: o.id, prompt: o.prompt }
    const m = usaStato.getState().modifica
    usaStato.getState().setModifica({ versioni: [...m.versioni, f], base: f })
  }
}

/** collega lo stato agli eventi del processo principale (una volta sola) */
export async function collegaEventi(): Promise<void> {
  const s = usaStato.getState()
  s.setImp(await api.impostazioni.leggi())
  usaStato.setState({ motore: await api.motore.info(), lavori: await api.lavori.elenco(), lore: await api.lora.elenco() })
  usaStato.setState({ agg: await api.aggiornamento.stato() })
  api.su.aggiornamento((agg) => usaStato.setState({ agg }))
  api.su.risorse((risorse) => usaStato.setState({ risorse }))
  api.su.download((d) => usaStato.setState({ scarico: d.stato === 'in corso' || d.stato === 'verifica' ? { ...d } : null }))
  api.su.motore((motore) => usaStato.setState({ motore }))
  api.su.lavori((lavori) => usaStato.setState({ lavori: [...lavori] }))
  api.su.lavoro((uno) => {
    const lavori = usaStato.getState().lavori.slice()
    const i = lavori.findIndex((l) => l.id === uno.id)
    const prima = i >= 0 ? lavori[i] : null
    if (i >= 0) lavori[i] = uno
    else lavori.push(uno)
    usaStato.setState({ lavori })
    if (!prima || prima.stato !== uno.stato) {
      for (const f of ascoltatoriLavoro) f(uno, prima)
      if (uno.stato === 'errore') usaStato.getState().avvisa(uno.errore || 'Errore', 'errore')
      if (uno.stato === 'fatto' && attesiModifica.has(uno.id)) {
        attesiModifica.delete(uno.id)
        void nuovaVersione(uno)
      }
    }
  })
}

export const ricaricaLore = async (): Promise<void> => {
  const lore = await api.lora.elenco()
  const att = usaStato.getState().loraAttive.filter((a) => lore.some((l) => l.file === a.file))
  usaStato.setState({ lore })
  usaStato.getState().setLoraAttive(att)
}

export const ricaricaImp = async (): Promise<void> => {
  usaStato.getState().setImp(await api.impostazioni.leggi())
}
