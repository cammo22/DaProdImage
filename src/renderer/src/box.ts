// L'Editor box: i riquadri disegnati sulla tela, ognuno col suo testo. Qui la parte senza interfaccia: colori, disposizioni pronte,
// geometria (sposta/ridimensiona nei limiti 0–1) e la descrizione a parole che si aggiunge al prompt finché il motore non ha
// l'adattatore dei riquadri (Klein 3 / Qwen): così funziona già con qualunque modello, e il motore riceve comunque `box` per fare meglio.
import type { BoxRegione } from '@shared/tipi'

export const COLORI_BOX = ['#8a5cff', '#3fe0ff', '#ff3df2', '#ffd54a', '#3ee08f', '#ff7a6b', '#4c8dff', '#b6f23f']
export const MAX_BOX = 8
export type Rect = BoxRegione['rect']

export const TIPI_BOX: { id: BoxRegione['tipo']; nome: string; titolo: string; guida: string }[] = [
  { id: 'persona', nome: 'Persona', titolo: 'Una persona o un personaggio', guida: 'a person' },
  { id: 'oggetto', nome: 'Oggetto', titolo: 'Un oggetto, un animale, una cosa', guida: 'an object' },
  { id: 'testo', nome: 'Testo', titolo: 'Una scritta: il testo va fra virgolette e resta identico', guida: 'text' },
  { id: 'sfondo', nome: 'Sfondo', titolo: 'L\'ambiente dietro: occupa tutto il riquadro', guida: 'background' }
]

export const RIGIDITA: { id: BoxRegione['rigidita']; nome: string; titolo: string }[] = [
  { id: 'guida', nome: 'Suggerita', titolo: 'Il riquadro è una guida per la composizione: il modello può uscire un po\' dai bordi' },
  { id: 'decisa', nome: 'Decisa', titolo: 'Il modello resta dentro il riquadro' },
  { id: 'blocca', nome: 'Blocca', titolo: 'Solo lì dentro: maschera e compositing (serve il motore v2)' }
]

/** le disposizioni pronte: (x0, y0, x1, y1) e il tipo di ogni riquadro */
export const DISPOSIZIONI: { id: string; nome: string; box: { rect: Rect; tipo: BoxRegione['tipo'] }[] }[] = [
  { id: 'uno', nome: 'Uno grande', box: [{ rect: [0.08, 0.08, 0.92, 0.92], tipo: 'oggetto' }] },
  { id: 'due', nome: 'Due affiancati', box: [{ rect: [0.04, 0.12, 0.48, 0.88], tipo: 'persona' }, { rect: [0.52, 0.12, 0.96, 0.88], tipo: 'persona' }] },
  { id: 'tre', nome: 'Tre colonne', box: [{ rect: [0.03, 0.1, 0.32, 0.9], tipo: 'oggetto' }, { rect: [0.355, 0.1, 0.645, 0.9], tipo: 'oggetto' }, { rect: [0.68, 0.1, 0.97, 0.9], tipo: 'oggetto' }] },
  { id: 'due-uno', nome: 'Due sopra, uno sotto', box: [{ rect: [0.04, 0.04, 0.48, 0.48], tipo: 'oggetto' }, { rect: [0.52, 0.04, 0.96, 0.48], tipo: 'oggetto' }, { rect: [0.04, 0.53, 0.96, 0.96], tipo: 'sfondo' }] },
  { id: 'terzi', nome: 'Terzi', box: [{ rect: [0.04, 0.06, 0.64, 0.94], tipo: 'persona' }, { rect: [0.69, 0.06, 0.96, 0.46], tipo: 'oggetto' }, { rect: [0.69, 0.54, 0.96, 0.94], tipo: 'oggetto' }] },
  { id: 'griglia', nome: 'Griglia 2×2', box: [{ rect: [0.04, 0.04, 0.48, 0.48], tipo: 'oggetto' }, { rect: [0.52, 0.04, 0.96, 0.48], tipo: 'oggetto' }, { rect: [0.04, 0.52, 0.48, 0.96], tipo: 'oggetto' }, { rect: [0.52, 0.52, 0.96, 0.96], tipo: 'oggetto' }] },
  { id: 'primo-piano', nome: 'Primo piano + sfondo', box: [{ rect: [0, 0, 1, 1], tipo: 'sfondo' }, { rect: [0.24, 0.16, 0.76, 0.96], tipo: 'persona' }] },
  { id: 'titolo', nome: 'Titolo + immagine', box: [{ rect: [0.08, 0.04, 0.92, 0.2], tipo: 'testo' }, { rect: [0.08, 0.25, 0.92, 0.96], tipo: 'oggetto' }] },
  { id: 'polaroid', nome: 'Polaroid', box: [{ rect: [0.12, 0.08, 0.88, 0.76], tipo: 'oggetto' }, { rect: [0.12, 0.8, 0.88, 0.94], tipo: 'testo' }] }
]

const limita = (n: number, a = 0, b = 1): number => Math.max(a, Math.min(b, n))
export const MINIMO = 0.04

export const idBox = (): string => 'b' + Math.random().toString(36).slice(2, 8)

/** un rettangolo da due punti (qualunque ordine), dentro la tela */
export function rettDaPunti(ax: number, ay: number, bx: number, by: number): Rect {
  return [limita(Math.min(ax, bx)), limita(Math.min(ay, by)), limita(Math.max(ax, bx)), limita(Math.max(ay, by))]
}

export function nuovaRegione(rect: Rect, regioni: BoxRegione[], tipo: BoxRegione['tipo'] = 'oggetto'): BoxRegione {
  const ordine = regioni.reduce((m, r) => Math.max(m, r.ordine), 0) + 1
  return { id: idBox(), rect, tipo, prompt: '', rigidita: 'decisa', ordine }
}

/** il colore di un riquadro dal suo posto nell'elenco: stabile finché non si cancella quello prima */
export const coloreBox = (i: number): string => COLORI_BOX[i % COLORI_BOX.length]

export type Maniglia = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'corpo'

/** sposta o ridimensiona un rettangolo: `dx` e `dy` in frazioni della tela */
export function trasforma(r: Rect, m: Maniglia, dx: number, dy: number): Rect {
  let [x0, y0, x1, y1] = r
  if (m === 'corpo') {
    const w = x1 - x0
    const h = y1 - y0
    x0 = limita(x0 + dx, 0, 1 - w)
    y0 = limita(y0 + dy, 0, 1 - h)
    return [x0, y0, x0 + w, y0 + h]
  }
  if (m.includes('w')) x0 = limita(x0 + dx, 0, x1 - MINIMO)
  if (m.includes('e')) x1 = limita(x1 + dx, x0 + MINIMO, 1)
  if (m.includes('n')) y0 = limita(y0 + dy, 0, y1 - MINIMO)
  if (m.includes('s')) y1 = limita(y1 + dy, y0 + MINIMO, 1)
  return [x0, y0, x1, y1]
}

const COL = ['left', 'center', 'right']
const RIGA = ['top', 'middle', 'bottom']
/** dove sta il riquadro, a parole (in inglese: va dentro il prompt) */
export function posizioneParole(r: Rect): string {
  const cx = (r[0] + r[2]) / 2
  const cy = (r[1] + r[3]) / 2
  const w = r[2] - r[0]
  const h = r[3] - r[1]
  if (w > 0.85 && h > 0.85) return 'the whole frame'
  const c = COL[cx < 0.36 ? 0 : cx > 0.64 ? 2 : 1]
  const g = RIGA[cy < 0.36 ? 0 : cy > 0.64 ? 2 : 1]
  if (c === 'center' && g === 'middle') return 'the center'
  if (w > 0.85) return `the ${g} of the frame, spanning the full width`
  if (h > 0.85) return `the ${c} side of the frame, spanning the full height`
  return g === 'middle' ? `the ${c} side` : c === 'center' ? `the ${g} center` : `the ${g}-${c}`
}

const percentuale = (n: number): number => Math.round(n * 100)

/** la descrizione del riquadro a parole. `tag` è l'<imageN> della foto di riferimento, se c'è */
export function fraseBox(r: BoxRegione, tag?: string): string {
  const w = r.rect[2] - r.rect[0]
  const h = r.rect[3] - r.rect[1]
  const dove = posizioneParole(r.rect)
  const testo = r.prompt.trim().replace(/[.;\s]+$/, '')
  const rif = tag ? ` (use ${tag} for how it looks)` : ''
  const misura = `about ${percentuale(w)}% of the width and ${percentuale(h)}% of the height`
  if (r.tipo === 'sfondo') return `Background${dove === 'the whole frame' ? '' : ` (${dove})`}: ${testo || 'a fitting environment'}${rif}.`
  if (r.tipo === 'testo') return `In ${dove}, the text ${/["“«]/.test(testo) ? testo : `"${testo}"`} written in crisp, perfectly legible lettering${rif}.`
  const cosa = r.tipo === 'persona' ? 'a person' : 'an object'
  return `In ${dove} (${misura}): ${testo || cosa}${rif}.`
}

export interface BoxPronti {
  prompt: string
  /** le foto di riferimento, nell'ordine dei riquadri: <image1>, <image2>… */
  immagini: string[]
  /** i riquadri che partono (gli occhi spenti restano fuori), con l'ordine rimesso a posto */
  regioni: BoxRegione[]
}

/** dal disegno al prompt: scena + un periodo per ogni riquadro (dal fondo al davanti) */
export function promptDaBox(scena: string, tutti: BoxRegione[], nascosti: ReadonlySet<string>): BoxPronti {
  const regioni = tutti
    .filter((r) => !nascosti.has(r.id))
    .sort((a, b) => a.ordine - b.ordine)
    .map((r, i) => ({ ...r, ordine: i + 1 }))
  const immagini: string[] = []
  const frasi = regioni.map((r) => {
    let tag: string | undefined
    if (r.rif) {
      immagini.push(r.rif)
      tag = `<image${immagini.length}>`
    }
    return fraseBox(r, tag)
  })
  const testa = scena.trim() ? `${scena.trim().replace(/[.;\s]+$/, '')}. ` : ''
  const corpo = frasi.length ? `The image is composed of ${frasi.length} part${frasi.length > 1 ? 's' : ''}, placed exactly as described. ${frasi.join(' ')}` : ''
  return { prompt: (testa + corpo).trim(), immagini, regioni }
}
