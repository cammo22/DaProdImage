// L'impaginazione automatica: mette le foto nell'ordine (per data, nome o come le hai scelte), le divide in spread (da `min`
// a `max` foto ciascuno, rompendo dove c'è una pausa lunga fra uno scatto e l'altro), dà una pagina intera alle preferite,
// fa la copertina. Poi ogni spread prende il suo layout (vedi layout.ts).
import type { Album, FotoAlbum, Piazza, Spread, Stile } from './tipi'

/** un generatore di numeri casuali che si può ripetere (stesso seme = stesso album) */
export function casuale(seme: number): () => number {
  let a = seme >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const piazza = (foto: string): Piazza => ({ foto, fx: 0.5, fy: 0.5, zoom: 1 })

export function ordina(foto: FotoAlbum[], come: Album['ordine']): FotoAlbum[] {
  if (come === 'scelta') return [...foto]
  if (come === 'nome') return [...foto].sort((a, b) => a.nome.localeCompare(b.nome, 'it', { numeric: true }))
  return [...foto].sort((a, b) => a.data - b.data || a.nome.localeCompare(b.nome, 'it', { numeric: true }))
}

interface OpzioniAuto {
  min: number
  max: number
  preferiteGrandi: boolean
  copertina: boolean
  /** minuti di pausa che fanno cominciare un nuovo spread (0 = spento) */
  momento: number
  ordine: Album['ordine']
  stileAuto: Album['stileAuto']
  seme: number
}

/** divide le foto in gruppi, uno per spread */
export function raggruppa(foto: FotoAlbum[], o: OpzioniAuto): { ids: string[]; pieno: boolean; copertina?: boolean }[] {
  const rnd = casuale(o.seme)
  const lista = ordina(foto, o.ordine)
  const min = Math.max(1, Math.min(o.min, o.max))
  const max = Math.max(min, o.max)
  const gruppi: { ids: string[]; pieno: boolean; copertina?: boolean }[] = []
  if (o.copertina && lista.length > 2) {
    const i = Math.max(0, lista.findIndex((f) => f.preferita))
    gruppi.push({ ids: [lista[i].id], pieno: true, copertina: true })
    lista.splice(i, 1)
  }
  let i = 0
  while (i < lista.length) {
    const f = lista[i]
    if (o.preferiteGrandi && f.preferita) {
      gruppi.push({ ids: [f.id], pieno: true })
      i++
      continue
    }
    const voglio = min + Math.floor(rnd() * (max - min + 1))
    const g: FotoAlbum[] = []
    while (i < lista.length && g.length < voglio) {
      const x = lista[i]
      if (o.preferiteGrandi && x.preferita && g.length) break
      if (o.momento > 0 && g.length >= min && x.data - g[g.length - 1].data > o.momento * 60000) break
      g.push(x)
      i++
    }
    gruppi.push({ ids: g.map((x) => x.id), pieno: false })
  }
  // un gruppo troppo piccolo (non una preferita a pagina intera) si unisce al precedente, se ci sta
  for (let k = gruppi.length - 1; k > 0; k--) {
    const g = gruppi[k]
    const prima = gruppi[k - 1]
    if (!g.pieno && g.ids.length < min && !prima.pieno && prima.ids.length + g.ids.length <= max + 1) {
      prima.ids.push(...g.ids)
      gruppi.splice(k, 1)
    }
  }
  return gruppi
}

/** gli spread dell'album da capo (le foto non si toccano) */
export function costruisciSpread(a: Album, seme = Date.now()): Spread[] {
  const rnd = casuale(seme ^ 0x9e3779b9)
  const gruppi = raggruppa(a.foto, { ...a, seme })
  return gruppi.map((g, n): Spread => {
    let stile: Stile = 'classico'
    if (g.pieno || g.ids.length === 1) stile = 'pieno'
    else if (a.stileAuto === 'dinamico') stile = 'dinamico'
    else if (a.stileAuto === 'misto') stile = n % 2 === 1 || rnd() > 0.6 ? 'dinamico' : 'classico'
    return {
      id: crypto.randomUUID(),
      piazze: g.ids.map(piazza),
      layout: 0,
      stile,
      ...(g.copertina ? { testo: a.nome, posTesto: 'basso' as const } : {})
    }
  })
}
