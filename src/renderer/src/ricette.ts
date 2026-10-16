// Le ricette del Laboratorio che fai tu: nuove, copie modificate di quelle che ci sono, e i preset (i valori dei campi e i passi
// segnati, con un nome). Stanno in localStorage: sono piccole, e restano fra un avvio e l'altro.
import { create } from 'zustand'
import type { Ingresso } from './workflow'

export interface PassoUtente {
  etichetta: string
  prompt: string
  /** fa un passo per ogni riga di questo campo (il testo della riga prende il posto di {riga}) */
  perRiga?: string
  crea?: { formato: string; ris?: number }
  trasparente?: boolean
  lora?: string[]
}

export interface RicettaUtente {
  id: string
  nome: string
  categoria: string
  descrizione: string
  modo: 'serie' | 'catena'
  /** serve la foto da cambiare? se no, disegna da zero */
  foto: boolean
  rif: 'no' | 'si' | 'serve' | 'ognuno'
  rifNome?: string
  ingressi: Ingresso[]
  passi: PassoUtente[]
  /** da quale ricetta fatta in casa viene (per saperlo) */
  da?: string
}

export interface PresetRicetta {
  id: string
  ricetta: string
  nome: string
  valori: Record<string, string>
  /** i passi segnati (per etichetta) */
  fai: string[]
}

interface StatoRicette {
  utente: RicettaUtente[]
  nascoste: string[]
  preset: PresetRicetta[]
  salva(r: RicettaUtente): void
  elimina(id: string): void
  nascondi(id: string): void
  mostraTutte(): void
  salvaPreset(p: Omit<PresetRicetta, 'id'>): void
  eliminaPreset(id: string): void
}

const leggi = <T,>(k: string): T[] => {
  try {
    const j = JSON.parse(localStorage.getItem(k) || '[]')
    return Array.isArray(j) ? j : []
  } catch {
    return []
  }
}
const scrivi = (k: string, v: unknown): void => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* niente */
  }
}

export const usaRicette = create<StatoRicette>((set, get) => ({
  utente: leggi<RicettaUtente>('dpi-ricette'),
  nascoste: leggi<string>('dpi-ricette-nascoste'),
  preset: leggi<PresetRicetta>('dpi-preset-ricette'),
  salva(r) {
    const l = get().utente.some((x) => x.id === r.id) ? get().utente.map((x) => (x.id === r.id ? r : x)) : [...get().utente, r]
    set({ utente: l })
    scrivi('dpi-ricette', l)
  },
  elimina(id) {
    const l = get().utente.filter((x) => x.id !== id)
    const p = get().preset.filter((x) => x.ricetta !== id)
    set({ utente: l, preset: p })
    scrivi('dpi-ricette', l)
    scrivi('dpi-preset-ricette', p)
  },
  nascondi(id) {
    const l = [...new Set([...get().nascoste, id])]
    set({ nascoste: l })
    scrivi('dpi-ricette-nascoste', l)
  },
  mostraTutte() {
    set({ nascoste: [] })
    scrivi('dpi-ricette-nascoste', [])
  },
  salvaPreset(p) {
    // lo stesso nome sulla stessa ricetta si aggiorna
    const l = [...get().preset.filter((x) => !(x.ricetta === p.ricetta && x.nome === p.nome)), { ...p, id: crypto.randomUUID() }]
    set({ preset: l })
    scrivi('dpi-preset-ricette', l)
  },
  eliminaPreset(id) {
    const l = get().preset.filter((x) => x.id !== id)
    set({ preset: l })
    scrivi('dpi-preset-ricette', l)
  }
}))
