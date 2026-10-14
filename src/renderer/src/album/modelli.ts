// La libreria dei modelli di impaginazione: celle disegnate a mano (a tutta pagina, con inserti, strisce, una grande e tante
// piccole…), per ogni numero di foto, per l'album aperto (due pagine) e per la pagina singola. Le coordinate sono frazioni
// dell'area dello spread (dentro i margini); `vivo` le fa partire dal bordo del foglio, abbondanza compresa.
// A differenza dei tagli automatici di layout.ts, qui le foto si abbinano alle celle per orientamento (verticali nelle celle
// alte, orizzontali in quelle larghe, la preferita nella più grande).
import type { Cella, Rett } from './layout'

export interface Slot {
  x: number
  y: number
  w: number
  h: number
  /** cornice attorno alla foto (mm) */
  cornice?: number
  vivo?: boolean
  z?: number
}

export interface Modello {
  id: string
  nome: string
  n: number
  /** per quale foglio è disegnato */
  per: 'doppia' | 'singola' | 'tutti'
  slot: Slot[]
}

const S = (x: number, y: number, w: number, h: number, extra: Partial<Slot> = {}): Slot => ({ x, y, w, h, ...extra })

/** k celle in una griglia dentro un rettangolo (frazioni dell'area); `ar` = proporzioni (larghezza/altezza) dell'area intera */
function griglia(k: number, r: Rett, ar: number, extra: Partial<Slot> = {}): Slot[] {
  if (k <= 0) return []
  // le colonne che danno celle vicine al 4:3 (le foto sono più spesso orizzontali… ma non troppo)
  let best = 1
  let bestD = Infinity
  for (let c = 1; c <= k; c++) {
    const righe = Math.ceil(k / c)
    const a = (r.w * ar) / c / (r.h / righe)
    const d = Math.abs(Math.log(a / 1.25)) + (c * righe - k) * 0.12
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  const righe = Math.ceil(k / best)
  const out: Slot[] = []
  for (let j = 0; j < righe; j++) {
    const quante = j === righe - 1 ? k - best * (righe - 1) : best
    for (let i = 0; i < quante; i++) out.push(S(r.x + (r.w * i) / quante, r.y + (r.h * j) / righe, r.w / quante, r.h / righe, extra))
  }
  return out
}

const specchiaX = (s: Slot[]): Slot[] => s.map((x) => ({ ...x, x: 1 - x.x - x.w }))
const specchiaY = (s: Slot[]): Slot[] => s.map((x) => ({ ...x, y: 1 - x.y - x.h }))

const lista: Modello[] = []
const aggiungi = (id: string, nome: string, per: Modello['per'], slot: Slot[]): void => {
  lista.push({ id, nome, n: slot.length, per, slot })
}

// proporzioni tipiche dell'area: due pagine affiancate (un po' più di 2:1) e pagina singola (quasi quadrata)
const AR_D = 2.05
const AR_S = 0.95

// ---------------------------------------------------------------------------------------------------------------
// una foto
// ---------------------------------------------------------------------------------------------------------------
aggiungi('1-vivo', 'Tutto il foglio', 'tutti', [S(0, 0, 1, 1, { vivo: true })])
aggiungi('1-margine', 'Con il margine', 'tutti', [S(0, 0, 1, 1)])
aggiungi('1-cornice', 'Incorniciata', 'tutti', [S(0.07, 0.08, 0.86, 0.84, { cornice: 5 })])
aggiungi('1-sx', 'Solo a sinistra', 'doppia', [S(0, 0, 0.5, 1, { vivo: true })])
aggiungi('1-dx', 'Solo a destra', 'doppia', [S(0.5, 0, 0.5, 1, { vivo: true })])
aggiungi('1-centro', 'Piccola al centro', 'tutti', [S(0.22, 0.18, 0.56, 0.64, { cornice: 4 })])

// ---------------------------------------------------------------------------------------------------------------
// foglio aperto (due pagine, la piega è a 0,5)
// ---------------------------------------------------------------------------------------------------------------
aggiungi('2d-affiancate', 'Una per pagina', 'doppia', [S(0, 0, 0.5, 1), S(0.5, 0, 0.5, 1)])
aggiungi('2d-vivo+una', 'Una a vivo e una incorniciata', 'doppia', [S(0, 0, 0.5, 1, { vivo: true }), S(0.58, 0.16, 0.34, 0.68, { cornice: 4 })])
aggiungi('2d-vivo+una-b', 'Una incorniciata e una a vivo', 'doppia', specchiaX([S(0, 0, 0.5, 1, { vivo: true }), S(0.58, 0.16, 0.34, 0.68, { cornice: 4 })]))
aggiungi('2d-alte', 'Due alte al centro', 'doppia', [S(0.08, 0.02, 0.34, 0.96), S(0.58, 0.02, 0.34, 0.96)])
aggiungi('2d-inserto', 'Tutto il foglio con un inserto', 'doppia', [S(0, 0, 1, 1, { vivo: true }), S(0.62, 0.56, 0.31, 0.36, { cornice: 4, z: 2 })])

for (let n = 3; n <= 8; n++) {
  // una pagina intera + le altre nell'altra pagina
  const resto = n - 1
  const destra = griglia(resto, { x: 0.5, y: 0, w: 0.5, h: 1 }, AR_D)
  aggiungi(`${n}d-eroe-sx`, 'Una grande a sinistra', 'doppia', [S(0, 0, 0.5, 1), ...destra])
  aggiungi(`${n}d-eroe-sx-vivo`, 'Una grande a sinistra, a vivo', 'doppia', [S(0, 0, 0.5, 1, { vivo: true }), ...destra])
  aggiungi(`${n}d-eroe-dx`, 'Una grande a destra', 'doppia', specchiaX([S(0, 0, 0.5, 1), ...destra]))
  aggiungi(`${n}d-eroe-dx-vivo`, 'Una grande a destra, a vivo', 'doppia', specchiaX([S(0, 0, 0.5, 1, { vivo: true }), ...destra]))
  // le stesse in ogni pagina
  const a = Math.ceil(n / 2)
  const sx = griglia(a, { x: 0, y: 0, w: 0.5, h: 1 }, AR_D)
  const dx = griglia(n - a, { x: 0.5, y: 0, w: 0.5, h: 1 }, AR_D)
  aggiungi(`${n}d-pagine`, 'Pagine uguali', 'doppia', [...sx, ...dx])
  if (n - a !== a) aggiungi(`${n}d-pagine-b`, 'Pagine uguali (al contrario)', 'doppia', specchiaX([...sx, ...dx]))
  // una sola griglia su tutto il foglio, se le colonne cadono a metà (cioè pari)
  for (const c of [2, 4, 6]) {
    if (n % c === 0 && n / c >= 1 && n / c <= 4 && c <= n) {
      const righe = n / c
      const g: Slot[] = []
      for (let j = 0; j < righe; j++) for (let i = 0; i < c; i++) g.push(S(i / c, j / righe, 1 / c, 1 / righe))
      aggiungi(`${n}d-griglia-${c}`, c >= 4 && righe === 1 ? 'Strisce' : `Griglia ${c}×${righe}`, 'doppia', g)
    }
  }
  // tutto il foglio a vivo e le altre come inserti con la cornice
  if (n <= 4) {
    const ins: Slot[] = []
    for (let i = 0; i < resto; i++) {
      const w = resto === 1 ? 0.3 : resto === 2 ? 0.22 : 0.18
      ins.push(S(0.05 + i * (w + 0.015), 0.64, w, 0.3, { cornice: 3, z: 2 }))
    }
    aggiungi(`${n}d-inserti`, 'Tutto il foglio con gli inserti', 'doppia', [S(0, 0, 1, 1, { vivo: true }), ...ins])
  }
}
// due grandi e le altre piccole al centro
aggiungi('4d-due+due', 'Due grandi e due piccole', 'doppia', [S(0, 0, 0.5, 0.64), S(0.5, 0, 0.5, 0.64), S(0.12, 0.66, 0.36, 0.34), S(0.52, 0.66, 0.36, 0.34)])
aggiungi('5d-mosaico', 'Mosaico', 'doppia', [S(0, 0, 0.5, 0.6), S(0, 0.6, 0.25, 0.4), S(0.25, 0.6, 0.25, 0.4), S(0.5, 0, 0.25, 1), S(0.75, 0, 0.25, 1)])
aggiungi('3d-strisce', 'Una grande e due strisce', 'doppia', [S(0, 0, 0.5, 1), S(0.5, 0, 0.25, 1), S(0.75, 0, 0.25, 1)])
aggiungi('3d-panorama', 'Panorama e due sotto', 'doppia', [S(0, 0, 1, 0.62, { vivo: false }), S(0.04, 0.64, 0.44, 0.36), S(0.52, 0.64, 0.44, 0.36)])

// ---------------------------------------------------------------------------------------------------------------
// pagina singola (quasi quadrata)
// ---------------------------------------------------------------------------------------------------------------
aggiungi('2s-pila', 'Una sopra l\'altra', 'singola', [S(0, 0, 1, 0.5), S(0, 0.5, 1, 0.5)])
aggiungi('2s-colonne', 'Una accanto all\'altra', 'singola', [S(0, 0, 0.5, 1), S(0.5, 0, 0.5, 1)])
aggiungi('2s-grande', 'Una grande e una piccola', 'singola', [S(0, 0, 1, 0.66), S(0, 0.66, 1, 0.34)])
aggiungi('2s-grande-b', 'Una piccola e una grande', 'singola', [S(0, 0, 1, 0.34), S(0, 0.34, 1, 0.66)])
aggiungi('2s-inserto', 'Tutto il foglio con un inserto', 'singola', [S(0, 0, 1, 1, { vivo: true }), S(0.5, 0.62, 0.42, 0.32, { cornice: 4, z: 2 })])
for (let n = 3; n <= 8; n++) {
  const resto = n - 1
  aggiungi(`${n}s-griglia`, 'Griglia', 'singola', griglia(n, { x: 0, y: 0, w: 1, h: 1 }, AR_S))
  if (n >= 5) {
    // due grandi in alto e le altre in una griglia sotto
    const due = [S(0, 0, 0.5, 0.42), S(0.5, 0, 0.5, 0.42), ...griglia(n - 2, { x: 0, y: 0.42, w: 1, h: 0.58 }, AR_S)]
    aggiungi(`${n}s-due-su`, 'Due grandi e tante piccole', 'singola', due)
    aggiungi(`${n}s-due-giu`, 'Tante piccole e due grandi', 'singola', specchiaY(due))
  }
  if (n <= 8) {
    const h = n <= 4 ? 0.6 : n <= 6 ? 0.5 : 0.42
    const eroe = [S(0, 0, 1, h), ...griglia(resto, { x: 0, y: h, w: 1, h: 1 - h }, AR_S)]
    aggiungi(`${n}s-eroe-su`, 'Una grande sopra', 'singola', eroe)
    aggiungi(`${n}s-eroe-giu`, 'Una grande sotto', 'singola', specchiaY(eroe))
  }
  if (n <= 5) {
    const w = 0.58
    const col = griglia(resto, { x: w, y: 0, w: 1 - w, h: 1 }, AR_S)
    aggiungi(`${n}s-eroe-sx`, 'Una grande a sinistra', 'singola', [S(0, 0, w, 1), ...col])
    aggiungi(`${n}s-eroe-dx`, 'Una grande a destra', 'singola', specchiaX([S(0, 0, w, 1), ...col]))
  }
  if (n >= 4 && n <= 6) {
    const ins: Slot[] = []
    for (let i = 0; i < resto; i++) ins.push(S(0.04 + (i * 0.92) / resto, 0.7, 0.92 / resto - 0.015, 0.26, { cornice: 3, z: 2 }))
    aggiungi(`${n}s-inserti`, 'Tutto il foglio con gli inserti', 'singola', [S(0, 0, 1, 1, { vivo: true }), ...ins])
  }
}
aggiungi('3s-colonna', 'Tre in colonna', 'singola', [S(0, 0, 1, 1 / 3), S(0, 1 / 3, 1, 1 / 3), S(0, 2 / 3, 1, 1 / 3)])
aggiungi('4s-fila', 'Quattro in colonna', 'singola', [0, 1, 2, 3].map((i) => S(0, i / 4, 1, 1 / 4)))

export const MODELLI: Modello[] = lista

export const modelloPer = (id: string | undefined): Modello | undefined => (id ? MODELLI.find((m) => m.id === id) : undefined)

/** i modelli adatti a questo numero di foto e a questo foglio */
export function modelliPer(n: number, doppia: boolean): Modello[] {
  return MODELLI.filter((m) => m.n === n && (m.per === 'tutti' || m.per === (doppia ? 'doppia' : 'singola')))
}

/** le celle del modello sul foglio: `area` = dentro i margini, `tela` = tutto il foglio con l'abbondanza (mm) */
export function celleModello(m: Modello, area: Rett, tela: Rett, spazio: number): Cella[] {
  const g = spazio / 2
  const eps = 0.001
  return m.slot.map((s, j): Cella => {
    const ref = s.vivo ? tela : area
    let x = ref.x + s.x * ref.w
    let y = ref.y + s.y * ref.h
    let w = s.w * ref.w
    let h = s.h * ref.h
    // lo spazio fra le foto si toglie solo dai lati che toccano un'altra foto, non dal bordo del foglio
    if (s.x > eps) {
      x += g
      w -= g
    }
    if (s.x + s.w < 1 - eps) w -= g
    if (s.y > eps) {
      y += g
      h -= g
    }
    if (s.y + s.h < 1 - eps) h -= g
    return { x, y, w, h, foto: j, cornice: s.cornice, vivo: s.vivo, z: s.z ?? 0 }
  })
}

const taglio = (c: number, a: number): number => 1 - Math.min(c / a, a / c)

/** abbina le foto alle celle (orientamento simile, la preferita nella cella più grande, l'ordine il più possibile conservato):
 *  `perm[cella] = indice della foto`. È un problema di assegnazione: con le maschere di bit si risolve subito (fino a 8). */
export function abbina(ars: number[], preferita: boolean[], celle: Cella[], taglioMax: number): { perm: number[]; costo: number } {
  const n = celle.length
  const tot = celle.reduce((s, c) => s + c.w * c.h, 0) || 1
  const c: number[][] = celle.map((cl, j) =>
    ars.map((a, i) => {
      const t = taglio(cl.w / cl.h, a)
      const quota = (cl.w * cl.h) / tot
      return (t * t + 5 * Math.max(0, t - taglioMax)) * quota * n + 0.004 * Math.abs(i - j) - (preferita[i] ? 0.2 * quota : 0)
    })
  )
  const N = 1 << n
  const dp = new Float64Array(N).fill(Infinity)
  const da = new Int8Array(N).fill(-1)
  dp[0] = 0
  for (let mask = 0; mask < N; mask++) {
    if (!isFinite(dp[mask])) continue
    // popcount = la cella da riempire adesso
    let j = 0
    for (let b = mask; b; b &= b - 1) j++
    if (j >= n) continue
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) continue
      const m2 = mask | (1 << i)
      const v = dp[mask] + c[j][i]
      if (v < dp[m2]) {
        dp[m2] = v
        da[m2] = i
      }
    }
  }
  const perm = new Array<number>(n).fill(0)
  let mask = N - 1
  for (let j = n - 1; j >= 0; j--) {
    const i = da[mask]
    perm[j] = i
    mask &= ~(1 << i)
  }
  return { perm, costo: dp[N - 1] }
}
