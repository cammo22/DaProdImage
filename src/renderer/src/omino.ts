// L'omino: uno scheletro che si muove come un manichino (ossa di lunghezza fissa, si ruotano le articolazioni), con le mani
// (aperta, chiusa, dita una per una). Serve a dare una posa al personaggio: l'omino si disegna come un manichino grigio (la guida
// di posa che il modello di modifica sa leggere) e si descrive anche a parole. Qui sta solo la parte pura, senza interfaccia.

export type Giunto =
  | 'bacino' | 'collo' | 'testa'
  | 'spSx' | 'gomSx' | 'polSx' | 'spDx' | 'gomDx' | 'polDx'
  | 'ancaSx' | 'ginSx' | 'cavSx' | 'ancaDx' | 'ginDx' | 'cavDx'

/** "Dx" e "Sx" sono la destra e la sinistra della PERSONA: guardandola di fronte la sua destra sta a sinistra dello schermo */
export const GIUNTI: Giunto[] = ['bacino', 'collo', 'testa', 'spSx', 'gomSx', 'polSx', 'spDx', 'gomDx', 'polDx', 'ancaSx', 'ginSx', 'cavSx', 'ancaDx', 'ginDx', 'cavDx']

export const GENITORE: Record<Giunto, Giunto | null> = {
  bacino: null, collo: 'bacino', testa: 'collo',
  spSx: 'collo', gomSx: 'spSx', polSx: 'gomSx', spDx: 'collo', gomDx: 'spDx', polDx: 'gomDx',
  ancaSx: 'bacino', ginSx: 'ancaSx', cavSx: 'ginSx', ancaDx: 'bacino', ginDx: 'ancaDx', cavDx: 'ginDx'
}

export type Punto = [number, number]

/** una mano: quanto è piegato ogni dito (0 = teso, 1 = chiuso; nell'ordine pollice, indice, medio, anulare, mignolo), quanto sono aperte e l'angolo del polso */
export interface Mano {
  dita: number[]
  aperte: number
  /** gradi di piegamento del polso rispetto all'avambraccio */
  polso: number
}

/** dove guarda la testa (gradi): `gira` + = faccia verso destra dello SCHERMO, `su` + = mento alzato, `inclina` + = orecchio verso la spalla destra dello schermo */
export interface Viso {
  gira: number
  su: number
  inclina: number
}
export const VISO0: Viso = { gira: 0, su: 0, inclina: 0 }

export interface Posa {
  /** posizioni nel riquadro 280 × 300 */
  p: Record<Giunto, Punto>
  mani: { sx: Mano; dx: Mano }
  /** la direzione della testa (se manca, guarda dritto) */
  viso?: Viso
}

export const visoDi = (p: Posa): Viso => p.viso ?? VISO0

export const LARGO = 280
export const ALTO = 300

export const NOMI_DITA = ['Pollice', 'Indice', 'Medio', 'Anulare', 'Mignolo']

// le misure delle ossa (riquadro 280 × 300): si ricavano dalla posa di riposo
const TORACE = 82
const COLLO_TESTA = 32
const SPALLA = 23
const BRACCIO = 40
const AVAMBRACCIO = 38
const ANCA = 12
const COSCIA = 54
const GAMBA = 52

const dir = (gradi: number): Punto => [Math.sin((gradi * Math.PI) / 180), Math.cos((gradi * Math.PI) / 180)]
const somma = (a: Punto, d: Punto, l: number): Punto => [a[0] + d[0] * l, a[1] + d[1] * l]

/** gli angoli sono in gradi: 0 = giù, 90 = verso destra dello schermo, 180 = su, -90 = verso sinistra */
export interface Angoli {
  /** inclinazione del busto (gradi dalla verticale, positivo = verso destra dello schermo) */
  busto?: number
  testa?: number
  /** braccio sinistro della persona (a destra dello schermo): [spalla → gomito, gomito → polso] */
  braccioSx: [number, number]
  braccioDx: [number, number]
  gambaSx: [number, number]
  gambaDx: [number, number]
}

/** la posa da una lista di angoli: il manichino si costruisce a partire dal bacino */
export function daAngoli(a: Angoli, bacino: Punto = [LARGO / 2, 168], mani?: { sx?: Mano; dx?: Mano }): Posa {
  const su = (a.busto ?? 0)
  const colloP = somma(bacino, dir(180 - su), TORACE)
  const testaP = somma(colloP, dir(180 - su - (a.testa ?? 0)), COLLO_TESTA)
  // le spalle stanno di lato al collo, ruotate col busto
  const latoD = dir(90 - su)
  const spSx = somma(somma(colloP, latoD, SPALLA), dir(180 - su), -3)
  const spDx = somma(somma(colloP, latoD, -SPALLA), dir(180 - su), -3)
  const gomSx = somma(spSx, dir(a.braccioSx[0]), BRACCIO)
  const gomDx = somma(spDx, dir(a.braccioDx[0]), BRACCIO)
  const polSx = somma(gomSx, dir(a.braccioSx[1]), AVAMBRACCIO)
  const polDx = somma(gomDx, dir(a.braccioDx[1]), AVAMBRACCIO)
  const ancaSx = somma(bacino, dir(90), ANCA)
  const ancaDx = somma(bacino, dir(90), -ANCA)
  const ginSx = somma(ancaSx, dir(a.gambaSx[0]), COSCIA)
  const ginDx = somma(ancaDx, dir(a.gambaDx[0]), COSCIA)
  return {
    p: { bacino, collo: colloP, testa: testaP, spSx, gomSx, polSx, spDx, gomDx, polDx, ancaSx, ginSx, cavSx: somma(ginSx, dir(a.gambaSx[1]), GAMBA), ancaDx, ginDx, cavDx: somma(ginDx, dir(a.gambaDx[1]), GAMBA) },
    mani: { sx: mani?.sx ?? manoRilassata(), dx: mani?.dx ?? manoRilassata() }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// le mani
// ---------------------------------------------------------------------------------------------------------------
export const manoAperta = (): Mano => ({ dita: [0, 0, 0, 0, 0], aperte: 0.7, polso: 0 })
export const manoChiusa = (): Mano => ({ dita: [0.9, 1, 1, 1, 1], aperte: 0, polso: 0 })
export const manoRilassata = (): Mano => ({ dita: [0.25, 0.35, 0.4, 0.45, 0.5], aperte: 0.15, polso: 0 })
export const manoIndice = (): Mano => ({ dita: [0.7, 0, 1, 1, 1], aperte: 0.2, polso: 0 })
export const manoPace = (): Mano => ({ dita: [0.9, 0, 0, 1, 1], aperte: 0.6, polso: 0 })
export const manoPollice = (): Mano => ({ dita: [0, 1, 1, 1, 1], aperte: 0.2, polso: 0 })

export const MANI_PRONTE: { id: string; nome: string; mano: () => Mano }[] = [
  { id: 'aperta', nome: 'Aperta', mano: manoAperta },
  { id: 'chiusa', nome: 'Pugno', mano: manoChiusa },
  { id: 'rilassata', nome: 'Rilassata', mano: manoRilassata },
  { id: 'indice', nome: 'Indice', mano: manoIndice },
  { id: 'pace', nome: 'Pace', mano: manoPace },
  { id: 'pollice', nome: 'Pollice su', mano: manoPollice }
]

const LUNGHEZZE_DITA = [[6, 5, 4], [7, 5, 4], [7.5, 5.5, 4.2], [7, 5, 4], [5.5, 4, 3.5]]
const ANGOLI_BASE = [48, 9, 0, -8, -17]
const POSTO_PALMO = [7, 4.5, 1.5, -1.5, -4.5]
const DISTANZA_PALMO = [4, 11, 11.5, 11, 10]

const norma = (v: Punto): Punto => {
  const l = Math.hypot(v[0], v[1]) || 1
  return [v[0] / l, v[1] / l]
}
const ruota = (v: Punto, gradi: number): Punto => {
  const c = Math.cos((gradi * Math.PI) / 180)
  const s = Math.sin((gradi * Math.PI) / 180)
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]
}

export interface DitoGeo {
  /** base (nocca) e le tre articolazioni successive, in coordinate del riquadro */
  punti: [Punto, Punto, Punto, Punto]
}

/** dove stanno le dita di una mano: seguono l'avambraccio (più l'angolo del polso) */
export function geometriaMano(p: Posa, lato: 'sx' | 'dx'): { polso: Punto; dita: DitoGeo[] } {
  const gom = lato === 'sx' ? p.p.gomSx : p.p.gomDx
  const pol = lato === 'sx' ? p.p.polSx : p.p.polDx
  const m = p.mani[lato]
  const u = ruota(norma([pol[0] - gom[0], pol[1] - gom[1]]), lato === 'sx' ? m.polso : -m.polso)
  // il pollice sta dalla parte del corpo (la mano con il braccio lungo il fianco guarda il corpo)
  const f = lato === 'sx' ? 1 : -1
  const w: Punto = [-u[1] * f, u[0] * f]
  const dita: DitoGeo[] = []
  for (let i = 0; i < 5; i++) {
    const c = Math.max(0, Math.min(1, m.dita[i] ?? 0))
    const base = somma(somma(pol, u, DISTANZA_PALMO[i]), w, POSTO_PALMO[i])
    // ventaglio delle dita: aperte = più divaricate
    let d = norma(somma([u[0], u[1]], w, Math.tan(((ANGOLI_BASE[i] * (0.35 + 1.3 * m.aperte)) * Math.PI) / 180)))
    const pts: Punto[] = [base]
    let cur = base
    for (let k = 0; k < 3; k++) {
      // piegandosi il dito si accorcia (visto di fronte) e si ripiega verso il palmo
      d = norma(somma(d, w, -Math.tan((c * 52 * Math.PI) / 180) * 0.55 * (k === 0 ? 0 : 1)))
      cur = somma(cur, d, LUNGHEZZE_DITA[i][k] * (1 - 0.55 * c))
      pts.push(cur)
    }
    dita.push({ punti: pts as DitoGeo['punti'] })
  }
  return { polso: pol, dita }
}

// ---------------------------------------------------------------------------------------------------------------
// le pose pronte
// ---------------------------------------------------------------------------------------------------------------
const ATTENTI: Angoli = { braccioSx: [8, 4], braccioDx: [-8, -4], gambaSx: [5, 2], gambaDx: [-5, -2] }

export const POSE_PRONTE: { id: string; nome: string; posa: () => Posa }[] = [
  { id: 'attenti', nome: 'In piedi', posa: () => daAngoli(ATTENTI) },
  { id: 't', nome: 'T-pose', posa: () => daAngoli({ ...ATTENTI, braccioSx: [90, 90], braccioDx: [-90, -90] }, undefined, { sx: manoAperta(), dx: manoAperta() }) },
  { id: 'a', nome: 'A-pose', posa: () => daAngoli({ ...ATTENTI, braccioSx: [42, 40], braccioDx: [-42, -40], gambaSx: [8, 6], gambaDx: [-8, -6] }) },
  { id: 'su', nome: 'Braccia in alto', posa: () => daAngoli({ ...ATTENTI, braccioSx: [152, 168], braccioDx: [-152, -168], gambaSx: [12, 6], gambaDx: [-12, -6] }, undefined, { sx: manoAperta(), dx: manoAperta() }) },
  { id: 'saluta', nome: 'Saluta', posa: () => daAngoli({ ...ATTENTI, braccioDx: [-112, -168] }, undefined, { dx: manoAperta() }) },
  { id: 'fianchi', nome: 'Mani sui fianchi', posa: () => daAngoli({ ...ATTENTI, braccioSx: [38, -38], braccioDx: [-38, 38], gambaSx: [9, 3], gambaDx: [-9, -3] }) },
  { id: 'incrociate', nome: 'Braccia incrociate', posa: () => daAngoli({ ...ATTENTI, braccioSx: [18, -105], braccioDx: [-18, 105] }, undefined, { sx: manoChiusa(), dx: manoChiusa() }) },
  { id: 'pugno', nome: 'Pugno in alto', posa: () => daAngoli({ ...ATTENTI, braccioDx: [-100, -172] }, undefined, { dx: manoChiusa() }) },
  { id: 'indica', nome: 'Indica', posa: () => daAngoli({ ...ATTENTI, braccioSx: [96, 100] }, undefined, { sx: manoIndice() }) },
  { id: 'corsa', nome: 'Corsa', posa: () => daAngoli({ busto: 8, braccioSx: [52, -50], braccioDx: [-70, -150], gambaSx: [30, 6], gambaDx: [-40, 20] }, undefined, { sx: manoChiusa(), dx: manoChiusa() }) },
  { id: 'salto', nome: 'Salto', posa: () => daAngoli({ braccioSx: [140, 155], braccioDx: [-140, -155], gambaSx: [28, 12], gambaDx: [-28, -12] }, [LARGO / 2, 150], { sx: manoAperta(), dx: manoAperta() }) },
  { id: 'ginocchio', nome: 'Ginocchio alzato', posa: () => daAngoli({ ...ATTENTI, braccioSx: [20, 30], braccioDx: [-60, -30], gambaSx: [4, 2], gambaDx: [-62, 8] }) }
]

export const posaDi = (id: string): Posa => (POSE_PRONTE.find((x) => x.id === id) || POSE_PRONTE[0]).posa()

/** la posa riflessa: destra e sinistra si scambiano */
export function specchia(p: Posa, asse = LARGO / 2): Posa {
  const scambio = (g: Giunto): Giunto => (g.endsWith('Sx') ? ((g.slice(0, -2) + 'Dx') as Giunto) : g.endsWith('Dx') ? ((g.slice(0, -2) + 'Sx') as Giunto) : g)
  const np = {} as Record<Giunto, Punto>
  for (const g of GIUNTI) np[scambio(g)] = [2 * asse - p.p[g][0], p.p[g][1]]
  const v = visoDi(p)
  return { p: np, mani: { sx: { ...p.mani.dx, dita: [...p.mani.dx.dita] }, dx: { ...p.mani.sx, dita: [...p.mani.sx.dita] } }, viso: { gira: -v.gira, su: v.su, inclina: -v.inclina } }
}

// ---------------------------------------------------------------------------------------------------------------
// il movimento: si trascina un'articolazione, l'osso ruota attorno alla sua origine e si porta dietro tutto quello che c'è dopo
// ---------------------------------------------------------------------------------------------------------------
export function discendenti(g: Giunto): Giunto[] {
  return GIUNTI.filter((x) => {
    let c: Giunto | null = x
    while (c) {
      if (c === g) return true
      c = GENITORE[c]
    }
    return false
  })
}

const dentro = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v))

/** porta l'articolazione `g` verso `a`: il bacino si sposta (e porta tutto), le altre ruotano attorno al genitore con l'osso della stessa lunghezza */
export function trascina(p: Posa, g: Giunto, a: Punto): Posa {
  const np: Posa = { p: { ...p.p }, mani: p.mani, viso: p.viso }
  if (g === 'bacino') {
    const dx = dentro(a[0], 20, LARGO - 20) - p.p.bacino[0]
    const dy = dentro(a[1], 40, ALTO - 20) - p.p.bacino[1]
    for (const x of GIUNTI) np.p[x] = [p.p[x][0] + dx, p.p[x][1] + dy]
    return np
  }
  const gen = GENITORE[g]!
  const O = p.p[gen]
  const cur: Punto = [p.p[g][0] - O[0], p.p[g][1] - O[1]]
  const dest: Punto = [a[0] - O[0], a[1] - O[1]]
  if (Math.hypot(dest[0], dest[1]) < 1) return p
  const delta = ((Math.atan2(dest[1], dest[0]) - Math.atan2(cur[1], cur[0])) * 180) / Math.PI
  for (const x of discendenti(g)) {
    const r = ruota([p.p[x][0] - O[0], p.p[x][1] - O[1]], delta)
    np.p[x] = [O[0] + r[0], O[1] + r[1]]
  }
  return np
}

/** i punti della posa si tengono nel riquadro */
export const dentroRiquadro = (p: Posa): Posa => {
  const np: Posa = { p: { ...p.p }, mani: p.mani, viso: p.viso }
  for (const g of GIUNTI) np.p[g] = [dentro(p.p[g][0], 4, LARGO - 4), dentro(p.p[g][1], 4, ALTO - 4)]
  return np
}

// ---------------------------------------------------------------------------------------------------------------
// salvare e leggere
// ---------------------------------------------------------------------------------------------------------------
export const posaInTesto = (p: Posa): string => JSON.stringify({ p: Object.fromEntries(GIUNTI.map((g) => [g, p.p[g].map((v) => +v.toFixed(1))])), mani: p.mani, viso: p.viso })

export function leggiPosa(s: string | undefined): Posa | null {
  if (!s) return null
  try {
    const j = JSON.parse(s) as { p?: Record<string, number[]>; mani?: { sx?: Partial<Mano>; dx?: Partial<Mano> }; viso?: Partial<Viso> }
    if (!j.p) return null
    const pp = {} as Record<Giunto, Punto>
    for (const g of GIUNTI) {
      const v = j.p[g]
      if (!Array.isArray(v) || v.length !== 2 || !v.every((x) => Number.isFinite(x))) return null
      pp[g] = [v[0], v[1]]
    }
    const mano = (m: Partial<Mano> | undefined): Mano => ({
      dita: Array.isArray(m?.dita) && m!.dita!.length === 5 ? m!.dita!.map((x) => dentro(Number(x) || 0, 0, 1)) : manoRilassata().dita,
      aperte: dentro(Number(m?.aperte) || 0, 0, 1),
      polso: dentro(Number(m?.polso) || 0, -90, 90)
    })
    const viso: Viso = { gira: dentro(Number(j.viso?.gira) || 0, -90, 90), su: dentro(Number(j.viso?.su) || 0, -50, 50), inclina: dentro(Number(j.viso?.inclina) || 0, -45, 45) }
    return { p: pp, mani: { sx: mano(j.mani?.sx), dx: mano(j.mani?.dx) }, viso }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------------------------------------------
// la posa a parole (per il prompt: l'immagine dà la forma, le parole tolgono i dubbi)
// ---------------------------------------------------------------------------------------------------------------
const dist = (a: Punto, b: Punto): number => Math.hypot(a[0] - b[0], a[1] - b[1])

function braccio(p: Posa, lato: 'sx' | 'dx'): string {
  const S = lato === 'sx' ? p.p.spSx : p.p.spDx
  const E = lato === 'sx' ? p.p.gomSx : p.p.gomDx
  const W = lato === 'sx' ? p.p.polSx : p.p.polDx
  const lungo = dist(S, E) + dist(E, W)
  const v: Punto = [W[0] - S[0], W[1] - S[1]]
  const fuori = lato === 'sx' ? v[0] : -v[0]
  const ang = (Math.atan2(fuori, v[1]) * 180) / Math.PI
  const piegato = dist(S, W) / lungo < 0.78
  const anca = lato === 'sx' ? p.p.ancaSx : p.p.ancaDx
  const gomitoFuori = lato === 'sx' ? E[0] - anca[0] : anca[0] - E[0]
  if (dist(W, anca) < 32 && gomitoFuori > 26) return 'bent with the hand resting on the hip and the elbow out'
  let t: string
  if (ang < -25) t = 'bent across the chest'
  else if (ang < 28) t = 'hanging down along the body'
  else if (ang < 65) t = 'angled down and away from the body'
  else if (ang < 118) t = 'stretched out horizontally to the side'
  else if (ang < 158) t = 'raised diagonally up and out'
  else t = 'raised straight up above the head'
  if (piegato && ang >= -25) t += ', with the elbow clearly bent'
  return t
}

function gamba(p: Posa, lato: 'sx' | 'dx'): string {
  const H = lato === 'sx' ? p.p.ancaSx : p.p.ancaDx
  const K = lato === 'sx' ? p.p.ginSx : p.p.ginDx
  const A = lato === 'sx' ? p.p.cavSx : p.p.cavDx
  const lungo = dist(H, K) + dist(K, A)
  if (K[1] < H[1] + 0.55 * dist(H, K)) return 'raised, with the knee high'
  if (dist(H, A) / lungo < 0.86) return 'bent at the knee'
  const fuori = lato === 'sx' ? A[0] - H[0] : H[0] - A[0]
  return fuori > 22 ? 'straight and spread to the side' : 'straight'
}

function mano(m: Mano): string {
  const [po, i, me, an, mi] = m.dita
  const medio = (po + i + me + an + mi) / 5
  if (i < 0.3 && me < 0.3 && an > 0.65 && mi > 0.65) return 'a peace sign'
  if (i < 0.3 && me > 0.65 && an > 0.65 && mi > 0.65) return 'the index finger pointing'
  if (po < 0.3 && i > 0.65 && me > 0.65 && an > 0.65 && mi > 0.65) return 'a thumbs up'
  if (medio < 0.25) return m.aperte > 0.5 ? 'an open hand with spread fingers' : 'an open hand'
  if (medio > 0.8) return 'a closed fist'
  return 'a relaxed, slightly curled hand'
}

/** dove guarda la testa, in inglese ("left" e "right" sono della persona: guardandola di fronte, la sua sinistra sta a destra dello schermo) */
export function descriviViso(v: Viso): string {
  const a = Math.abs(v.gira)
  const lato = v.gira > 0 ? 'left' : 'right'
  let t: string
  if (a < 12) t = 'The head faces the camera'
  else if (a < 35) t = `The head is turned slightly to the person's ${lato}`
  else if (a < 65) t = `The head is turned about halfway to the person's ${lato}, a three-quarter view of the face`
  else t = `The head is turned in full profile, looking to the person's ${lato}`
  if (v.su > 12) t += ', chin raised and looking up'
  else if (v.su < -12) t += ', chin lowered and looking down'
  if (Math.abs(v.inclina) > 10) t += `, tilted toward the person's ${v.inclina > 0 ? 'left' : 'right'} shoulder`
  return t + '.'
}

/** la posa in inglese: "right" e "left" sono quelli della persona */
export function descriviPosa(p: Posa): string {
  const busto = (Math.atan2(p.p.collo[0] - p.p.bacino[0], p.p.bacino[1] - p.p.collo[1]) * 180) / Math.PI
  const parti = [
    `The person's right arm is ${braccio(p, 'dx')}; the left arm is ${braccio(p, 'sx')}.`,
    `The right leg is ${gamba(p, 'dx')}; the left leg is ${gamba(p, 'sx')}.`,
    `The right hand is ${mano(p.mani.dx)}; the left hand is ${mano(p.mani.sx)}.`,
    descriviViso(visoDi(p))
  ]
  if (Math.abs(busto) > 14) parti.push(`The body leans to the person's ${busto > 0 ? 'left' : 'right'}.`)
  return parti.join(' ')
}

// ---------------------------------------------------------------------------------------------------------------
// il disegno: un manichino grigio pieno (come quello di legno degli artisti) su fondo chiaro. Niente linee né puntini da copiare:
// al modello basta la forma, e non ha nulla di "scheletro" da lasciare nella foto.
// ---------------------------------------------------------------------------------------------------------------
const FONDO = '#ececf0'
const SCURO = '#6c6c76'
const CHIARO = '#a4a4b0'
const OMBRA = '#4d4d57'

type Ctx = CanvasRenderingContext2D

/** un osso: due cerchi (raggi ra e rb) uniti da un trapezio; sopra una striscia più chiara fa il rilievo */
function osso(g: Ctx, a: Punto, b: Punto, ra: number, rb: number, rilievo = true): void {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l = Math.hypot(dx, dy) || 1
  const nx = -dy / l
  const ny = dx / l
  const disegna = (fa: number, fb: number, off: number, colore: string): void => {
    const ox = nx * off
    const oy = ny * off
    g.fillStyle = colore
    g.beginPath()
    g.moveTo(a[0] + ox + nx * ra * fa, a[1] + oy + ny * ra * fa)
    g.lineTo(b[0] + ox + nx * rb * fb, b[1] + oy + ny * rb * fb)
    g.lineTo(b[0] + ox - nx * rb * fb, b[1] + oy - ny * rb * fb)
    g.lineTo(a[0] + ox - nx * ra * fa, a[1] + oy - ny * ra * fa)
    g.closePath()
    g.fill()
    g.beginPath()
    g.arc(a[0] + ox, a[1] + oy, ra * fa, 0, Math.PI * 2)
    g.arc(b[0] + ox, b[1] + oy, rb * fb, 0, Math.PI * 2)
    g.fill()
  }
  disegna(1, 1, 0, SCURO)
  if (rilievo) disegna(0.42, 0.42, -Math.min(ra, rb) * 0.22, CHIARO)
}

/** disegna il manichino su un canvas di `W × H` px (fondo chiaro, il manichino al centro, il più grande possibile) */
export function disegnaManichino(g: Ctx, p: Posa, W: number, H: number): void {
  g.fillStyle = FONDO
  g.fillRect(0, 0, W, H)
  const s = Math.min(W / LARGO, H / ALTO)
  g.save()
  g.translate((W - LARGO * s) / 2, (H - ALTO * s) / 2)
  g.scale(s, s)
  g.lineJoin = 'round'
  g.lineCap = 'round'
  const q = p.p
  // gambe e piedi (il piede guarda in basso e un po' in fuori)
  const gambe: [Giunto, Giunto, Giunto, number][] = [['ancaSx', 'ginSx', 'cavSx', 1], ['ancaDx', 'ginDx', 'cavDx', -1]]
  for (const [a, k, c, f] of gambe) {
    osso(g, q[a], q[k], 8.2, 6.2)
    osso(g, q[k], q[c], 6.2, 4.2)
    osso(g, q[c], [q[c][0] + f * 7, q[c][1] + 6], 4.4, 3.4, false)
  }
  // busto: trapezio dalle spalle ai fianchi, poi bacino
  g.fillStyle = SCURO
  g.strokeStyle = SCURO
  g.lineWidth = 8
  g.beginPath()
  g.moveTo(...q.spDx)
  g.lineTo(...q.spSx)
  g.lineTo(...q.ancaSx)
  g.lineTo(...q.ancaDx)
  g.closePath()
  g.fill()
  g.stroke()
  osso(g, q.ancaDx, q.ancaSx, 7, 7, false)
  osso(g, q.collo, q.bacino, 13, 10, false)
  osso(g, q.spDx, q.spSx, 6, 6, false)
  // collo
  osso(g, q.collo, q.testa, 5.2, 4.6, false)
  // braccia
  for (const [s1, e1, w1] of [['spSx', 'gomSx', 'polSx'], ['spDx', 'gomDx', 'polDx']] as [Giunto, Giunto, Giunto][]) {
    osso(g, q[s1], q[e1], 5.4, 4.4)
    osso(g, q[e1], q[w1], 4.4, 3.4)
  }
  // mani: il palmo è il poligono polso → nocche, le dita sono ossicini sottili
  for (const lato of ['sx', 'dx'] as const) {
    const geo = geometriaMano(p, lato)
    g.fillStyle = SCURO
    g.strokeStyle = SCURO
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(...geo.polso)
    for (const d of geo.dita) g.lineTo(...d.punti[0])
    g.closePath()
    g.fill()
    g.stroke()
    for (const d of geo.dita) for (let k = 0; k < 3; k++) osso(g, d.punti[k], d.punti[k + 1], 1.7 - k * 0.12, 1.5 - k * 0.12, false)
  }
  // testa: un ovale con le linee del viso (meridiano e fronte), che mostrano dove guarda
  const v = visoDi(p)
  const t = q.testa
  const su = norma([t[0] - q.collo[0], t[1] - q.collo[1]])
  g.save()
  g.translate(t[0], t[1])
  g.rotate(Math.atan2(su[0], -su[1]) + (v.inclina * Math.PI) / 180)
  const RX = 12
  const RY = 14.5
  g.fillStyle = SCURO
  g.beginPath()
  g.ellipse(0, 0, RX, RY, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = CHIARO
  g.globalAlpha = 0.55
  g.beginPath()
  g.ellipse(-RX * 0.28, -RY * 0.3, RX * 0.45, RY * 0.5, 0, 0, Math.PI * 2)
  g.fill()
  g.globalAlpha = 1
  const gi = (v.gira * Math.PI) / 180
  const sl = (v.su * Math.PI) / 180
  g.strokeStyle = OMBRA
  g.lineWidth = 1
  // meridiano (la riga verticale del viso) e linea degli occhi
  const cx = Math.sin(gi) * RX * 0.9
  const cy = -Math.sin(sl) * RY * 0.7
  g.beginPath()
  g.ellipse(0, 0, Math.max(0.6, Math.abs(Math.cos(gi)) * RX), RY, 0, Math.PI / 2 - 0.0, (3 * Math.PI) / 2, false)
  g.stroke()
  g.beginPath()
  g.ellipse(0, cy * 0.5, RX, Math.max(0.8, Math.abs(Math.cos(sl)) * RY * 0.22), 0, 0, Math.PI, Math.cos(gi) < 0)
  g.stroke()
  // il naso: un cuneo dalla parte in cui guarda la faccia
  g.fillStyle = OMBRA
  g.beginPath()
  g.ellipse(cx, cy * 0.5 + 3, 2.3, 3, 0, 0, Math.PI * 2)
  g.fill()
  g.restore()
  g.restore()
}

/** l'istruzione per il modello: il manichino è solo una guida per la posa, mai da lasciare nel risultato.
 *  `mappa` e `chi` sono i pezzi di testo che la indicano (es. `<image1>` e "the same character from <image2>") */
export function istruzionePosa(p: Posa, mappa: string, chi: string): string {
  return (
    `${mappa} shows a plain gray posing mannequin on a light background: it is only a pose reference, like an artist's wooden manikin, never part of the result. ` +
    `Generate ${chi} in exactly that pose: copy the position of the body, every arm, leg, hand and finger, and the direction of the head. ` +
    'Replace the mannequin completely: the result is a natural image of the real person, with real skin, face, hair and clothes. It must not contain any mannequin, gray doll body, skeleton, stick figure, colored line or dot, and the reference image must not appear in it. ' +
    descriviPosa(p)
  )
}
