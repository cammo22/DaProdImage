// Lo stato dell'interfaccia (zustand). Le scelte di Crea/Modifica e i LoRA attivi restano fra un avvio e l'altro.
import { create } from 'zustand'
import type { Impostazioni, InfoLora, InfoMotore, Lavoro, LoraAttiva, Opera, Bordi, StatoAggiornamento } from '@shared/tipi'
import { api } from './api'

export type Pagina = 'crea' | 'modifica' | 'galleria' | 'lora' | 'impostazioni'
export type Qualita = 'turbo' | 'bozza' | 'alta' | 'massima'
export type ModoModifica = 'tutta' | 'zona' | 'espandi'

export const PASSI_QUALITA: Record<Qualita, number> = { turbo: 8, bozza: 20, alta: 40, massima: 50 }

export interface FotoBase {
  percorso: string
  larghezza: number
  altezza: number
  operaId?: string
  prompt?: string
}

export interface StatoCrea {
  prompt: string
  negativo: string
  formato: string
  /** risoluzione: il lato corto in pixel (256p … 2048, il massimo nativo) */
  ris: number
  qualita: Qualita
  quante: number
  seed: number
  casuale: boolean
  trasparente: boolean
  cfg: number
  sampler: string
  scheduler: string
  /** il preset scelto a sinistra ('' = libero) e i suoi campi */
  preset: string
  stile: string
  campi: Record<string, string>
}

export interface StatoModifica {
  base: FotoBase | null
  /** le versioni di questa foto (la prima è l'originale) */
  versioni: FotoBase[]
  riferimenti: FotoBase[]
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
}

export interface Avviso {
  id: number
  testo: string
  tipo: 'info' | 'ok' | 'errore'
}

interface Stato {
  pagina: Pagina
  imp: Impostazioni | null
  motore: InfoMotore
  lavori: Lavoro[]
  lore: InfoLora[]
  loraAttive: LoraAttiva[]
  crea: StatoCrea
  modifica: StatoModifica
  codaAperta: boolean
  avvisi: Avviso[]
  /** l'opera aperta nel visore (galleria) */
  visore: Opera | null
  /** aggiornamenti dell'app */
  agg: StatoAggiornamento
  vai(p: Pagina): void
  setImp(i: Impostazioni): void
  setCrea(m: Partial<StatoCrea>): void
  setModifica(m: Partial<StatoModifica>): void
  setLoraAttive(l: LoraAttiva[]): void
  toggleLora(file: string, forza?: number): void
  avvisa(testo: string, tipo?: Avviso['tipo']): void
  apriVisore(o: Opera | null): void
}

const leggiLocale = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k)
    return v ? { ...d, ...JSON.parse(v) } : d
  } catch {
    return d
  }
}
const leggiLista = <T,>(k: string): T[] => {
  try {
    return JSON.parse(localStorage.getItem(k) || '[]')
  } catch {
    return []
  }
}

const CREA0: StatoCrea = {
  prompt: '', negativo: '', formato: '1:1', ris: 1024, qualita: 'alta', quante: 1, seed: 0, casuale: true, trasparente: false,
  cfg: 1, sampler: 'euler', scheduler: 'simple', preset: '', stile: '', campi: {}
}
const MOD0: StatoModifica = {
  base: null, versioni: [], riferimenti: [], modo: 'tutta', prompt: '', mp: 1, qualita: 'alta', quante: 1, forza: 1, contesto: 0.6,
  ritaglia: true, segnaZona: false, riempi: false, sfuma: 10, allarga: 8, bordi: { sinistra: 0, sopra: 0, destra: 0, sotto: 0 }, trasparente: false
}

/** le scelte salvate dalla 0.1 avevano i megapixel al posto della risoluzione */
function daVecchio(c: StatoCrea & { mp?: number }): StatoCrea {
  const { mp, ...resto } = c
  // appena si salva, il campo mp sparisce: la conversione avviene una volta sola
  return mp ? { ...resto, ris: mp >= 4 ? 2048 : mp >= 2 ? 1440 : 1024 } : resto
}

let idAvviso = 0

export const usaStato = create<Stato>((set, get) => ({
  pagina: 'crea',
  imp: null,
  motore: { stato: 'spento', porta: 0 },
  lavori: [],
  lore: [],
  loraAttive: leggiLista<LoraAttiva>('dpi-lora'),
  crea: daVecchio(leggiLocale('dpi-crea', CREA0)),
  modifica: { ...leggiLocale('dpi-modifica', MOD0), base: null, versioni: [], riferimenti: [] },
  codaAperta: false,
  avvisi: [],
  visore: null,
  agg: { stato: 'nessuno', attuale: '' },
  vai: (pagina) => set({ pagina }),
  setImp: (imp) => set({ imp }),
  setCrea: (m) => {
    const crea = { ...get().crea, ...m }
    set({ crea })
    try {
      localStorage.setItem('dpi-crea', JSON.stringify(crea))
    } catch {
      /* niente */
    }
  },
  setModifica: (m) => {
    const modifica = { ...get().modifica, ...m }
    set({ modifica })
    try {
      const { base: _b, versioni: _v, riferimenti: _r, ...resto } = modifica
      localStorage.setItem('dpi-modifica', JSON.stringify(resto))
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
