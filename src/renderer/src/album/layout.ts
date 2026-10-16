// L'impaginazione di uno spread: date le proporzioni delle foto (nell'ordine) e il rettangolo da riempire, trova i
// modi migliori di dividerlo in celle (tagli orizzontali e verticali, come un tagliere), senza tagliare troppo le foto.
// È pura: niente DOM, niente immagini, si prova da sola.

export interface Rett {
  x: number
  y: number
  w: number
  h: number
}

export interface OpzioniLayout {
  /** spazio fra le foto (stessa unità del rettangolo) */
  spazio: number
  /** 'dinamico': una foto (la "regina") più grande delle altre; 'classico': celle equilibrate */
  stile: 'classico' | 'dinamico'
  /** niente foto a cavallo del centro (due pagine affiancate): il primo taglio è verticale a metà */
  piega: boolean
  /** quale foto è la regina (per 'dinamico') */
  regina: number
  /** quanto si può tagliare una foto: oltre, nella cella resta vuoto, e il layout viene penalizzato */
  taglioMax: number
}

type Albero = { foto: number } | { dir: 'H' | 'V'; a: Albero; b: Albero; nat: number; da: number }

const foglia = (i: number): Albero => ({ foto: i })
const eFoglia = (t: Albero): t is { foto: number } => 'foto' in t

// tutti gli alberi di tagli sulle foto da i a j (nell'ordine): 2^(n-1) × Catalan(n-1), 55 mila con 8 foto
function alberi(i: number, j: number, ars: number[], memo: Map<string, Albero[]>): Albero[] {
  const k0 = `${i}-${j}`
  const m = memo.get(k0)
  if (m) return m
  let out: Albero[] = []
  if (i === j) out = [foglia(i)]
  else {
    for (let k = i; k < j; k++) {
      const A = alberi(i, k, ars, memo)
      const B = alberi(k + 1, j, ars, memo)
      for (const a of A)
        for (const b of B) {
          const na = natura(a, ars)
          const nb = natura(b, ars)
          // fianco a fianco: stessa altezza, larghezze che si sommano; uno sopra l'altro: stessa larghezza
          out.push({ dir: 'H', a, b, nat: na + nb, da: na / (na + nb) })
          out.push({ dir: 'V', a, b, nat: 1 / (1 / na + 1 / nb), da: 1 / na / (1 / na + 1 / nb) })
        }
    }
  }
  memo.set(k0, out)
  return out
}

function natura(t: Albero, ars: number[]): number {
  return eFoglia(t) ? ars[t.foto] : t.nat
}

const contiene = (t: Albero, i: number): boolean => (eFoglia(t) ? t.foto === i : contiene(t.a, i) || contiene(t.b, i))

export interface Cella extends Rett {
  /** quale foto (posizione nell'ordine) */
  foto: number
  /** cornice attorno alla foto (mm), se il modello la vuole */
  cornice?: number
  /** a tutta pagina: niente bordo né ombra */
  vivo?: boolean
  /** l'ordine di disegno (più alto = sopra) */
  z?: number
}

/** quanto si taglia di una foto di proporzioni `a` in una cella `c` (0 = niente, 1 = tutto) */
const taglio = (c: number, a: number): number => 1 - Math.min(c / a, a / c)

function misura(t: Albero, r: Rett, o: OpzioniLayout, ars: number[], radice: boolean, celle: Cella[]): void {
  if (eFoglia(t)) {
    celle.push({ ...r, foto: t.foto })
    return
  }
  const g = o.spazio
  // quanta parte va ad A: quella "naturale" (niente tagli alle foto); per la regina un po' di più
  let f = t.da
  if (radice && o.piega && t.dir === 'H') f = 0.5
  else if (o.stile === 'dinamico' && o.regina >= 0) {
    const inA = contiene(t.a, o.regina)
    const inB = contiene(t.b, o.regina)
    const b = 1.3
    if (inA && !inB) f = (f * b) / (f * b + (1 - f))
    else if (inB && !inA) f = f / (f + (1 - f) * b)
  }
  if (t.dir === 'H') {
    const wa = (r.w - g) * f
    misura(t.a, { x: r.x, y: r.y, w: wa, h: r.h }, o, ars, false, celle)
    misura(t.b, { x: r.x + wa + g, y: r.y, w: r.w - g - wa, h: r.h }, o, ars, false, celle)
  } else {
    const ha = (r.h - g) * f
    misura(t.a, { x: r.x, y: r.y, w: r.w, h: ha }, o, ars, false, celle)
    misura(t.b, { x: r.x, y: r.y + ha + g, w: r.w, h: r.h - g - ha }, o, ars, false, celle)
  }
}

/** il costo di un'impaginazione: foto tagliate (di più se la cella è grande) e, nello stile classico, celle troppo diverse */
function costo(celle: Cella[], ars: number[], o: OpzioniLayout): number {
  const tot = celle.reduce((s, c) => s + c.w * c.h, 0)
  let c = 0
  for (const x of celle) {
    const t = taglio(x.w / x.h, ars[x.foto])
    const quota = ((x.w * x.h) / tot) * celle.length
    c += t * t * quota
    // oltre il taglio massimo la foto non riempie la cella: lo spazio vuoto pesa molto
    c += 5 * Math.max(0, t - o.taglioMax) * quota
  }
  // niente foto minuscole: sotto un po' meno della metà della "fetta giusta" si paga caro
  const minimo = 0.45 / celle.length
  for (const x of celle) {
    const q = (x.w * x.h) / tot
    if (q < minimo) c += 6 * ((minimo - q) / minimo)
  }
  if (o.stile === 'classico' && celle.length > 1) {
    const media = tot / celle.length
    const v = celle.reduce((s, x) => s + Math.pow((x.w * x.h) / media - 1, 2), 0) / celle.length
    c += 0.12 * v
  } else if (o.stile === 'dinamico' && o.regina >= 0 && celle.length > 2) {
    const q = celle.find((x) => x.foto === o.regina)
    if (q) c -= 0.08 * ((q.w * q.h) / tot)
  }
  return c
}

const cache = new Map<string, Cella[][]>()

/** i modi migliori di impaginare queste foto nel rettangolo, dal migliore in poi (senza ripetizioni) */
export function candidati(ars: number[], r: Rett, o: OpzioniLayout, quanti = 16): Cella[][] {
  const n = ars.length
  if (n === 0) return []
  if (n === 1) return [[{ ...r, foto: 0 }]]
  const chiave = [ars.map((a) => a.toFixed(3)).join(','), r.w.toFixed(1), r.h.toFixed(1), o.spazio, o.stile, o.piega, o.regina, o.taglioMax].join('|')
  const gia = cache.get(chiave)
  if (gia) return gia
  // oltre 8 foto gli alberi sono centinaia di migliaia (più di un secondo di attesa a ogni modifica): si usa una griglia ordinata
  if (n > 8) {
    const colonne = Math.max(1, Math.round(Math.sqrt((n * r.w) / r.h)))
    const righe = Math.ceil(n / colonne)
    const celle: Cella[] = []
    for (let i = 0; i < n; i++) {
      const riga = Math.floor(i / colonne)
      const dentro = Math.min(colonne, n - riga * colonne)
      const w = r.w / dentro
      celle.push({ x: r.x + (i - riga * colonne) * w, y: r.y + (riga * r.h) / righe, w, h: r.h / righe, foto: i })
    }
    const g = [celle]
    cache.set(chiave, g)
    return g
  }
  const tutti = alberi(0, n - 1, ars, new Map())
  const trovati: { c: number; celle: Cella[]; firma: string }[] = []
  for (const t of tutti) {
    if (o.piega && n > 1 && (eFoglia(t) || t.dir !== 'H')) continue
    const celle: Cella[] = []
    misura(t, r, o, ars, true, celle)
    const c = costo(celle, ars, o)
    trovati.push({ c, celle, firma: '' })
  }
  // se la piega non lascia scelta (pochissime foto), si ricade sul caso libero
  if (!trovati.length) return candidati(ars, r, { ...o, piega: false }, quanti)
  trovati.sort((a, b) => a.c - b.c)
  const out: Cella[][] = []
  const viste = new Set<string>()
  for (const t of trovati) {
    // due impaginazioni uguali (a meno di un pixel) sono la stessa
    const firma = [...t.celle].sort((a, b) => a.foto - b.foto).map((c) => [c.x, c.y, c.w, c.h].map((v) => Math.round(v / Math.max(1, r.w / 60))).join(',')).join(';')
    if (viste.has(firma)) continue
    viste.add(firma)
    out.push(t.celle.sort((a, b) => a.foto - b.foto))
    if (out.length >= quanti) break
  }
  cache.set(chiave, out)
  if (cache.size > 300) cache.delete(cache.keys().next().value as string)
  return out
}

/** l'impaginazione numero `indice` (si torna all'inizio quando finiscono) */
export function layoutDi(ars: number[], r: Rett, o: OpzioniLayout, indice: number): Cella[] {
  const c = candidati(ars, r, o)
  if (!c.length) return []
  return c[((indice % c.length) + c.length) % c.length]
}

/** la foto "regina" di uno spread: la preferita, se c'è, o la più grande (in pixel) */
export function reginaDi(ars: number[], pesi: number[], preferite: boolean[]): number {
  const p = preferite.findIndex(Boolean)
  if (p >= 0) return p
  let best = 0
  pesi.forEach((v, i) => {
    if (v > pesi[best]) best = i
  })
  return ars.length ? best : -1
}
