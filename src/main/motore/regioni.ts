// Regional prompting per l'Editor box: dai riquadri disegnati (ognuno col suo prompt) al testo che capisce il modello.
// File puro (niente Electron né import oltre ai tipi): lo prova `node test/regioni.mjs`.
//
// - FLUX 3 Klein (e Klein Base) sa leggere i riquadri: il suo prompt è «didascalia <id> … [righe JSON]», con le righe
//   {"id", "bbox": [y_min, x_min, y_max, x_max], "desc"} su una tela 0–1000 (origine in alto a sinistra) e la didascalia che cita ogni <id>
//   (formato di black-forest-labs/flux-3-image-klein, src/flux3/bbox.py). Per le modifiche una riga è {"id", "from": "target", "src_bbox": null, "tgt_bbox", "desc"}.
//   I riquadri sono una guida morbida: l'elemento può uscire un po' dal rettangolo, e non protegge i pixel fuori (per quello c'è la zona con la maschera).
// - Qwen-Image 2.1 e FLUX.2 Klein 4B non hanno i riquadri: la posizione si dice a parole («at the top left, a small …»).
import type { Box01, Regione } from '../../shared/tipi'

export interface RegionePronta {
  /** id per il modello: obj_1, obj_2… (lettere, cifre e _; il nome scelto dall'interfaccia non conta) */
  id: string
  /** [x0, y0, x1, y1] in 0–1, dentro la tela, con almeno 2 % per lato */
  box: Box01
  prompt: string
}

const MIN = 0.02
const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : NaN)

/** toglie le regioni vuote o senza un riquadro valido, porta i riquadri dentro la tela e dà gli id obj_1… (al massimo 16) */
export function regioniPronte(regioni: Regione[] | undefined): RegionePronta[] {
  const fuori: RegionePronta[] = []
  for (const r of regioni || []) {
    const p = (r.prompt || '').trim().replace(/\s+/g, ' ')
    if (!p || !Array.isArray(r.box) || r.box.length !== 4) continue
    let [x0, y0, x1, y1] = r.box.map(num)
    if ([x0, y0, x1, y1].some(Number.isNaN)) continue
    if (x1 < x0) [x0, x1] = [x1, x0]
    if (y1 < y0) [y0, y1] = [y1, y0]
    x0 = Math.max(0, Math.min(1, x0))
    x1 = Math.max(0, Math.min(1, x1))
    y0 = Math.max(0, Math.min(1, y0))
    y1 = Math.max(0, Math.min(1, y1))
    if (x1 - x0 < MIN || y1 - y0 < MIN) continue
    fuori.push({ id: `obj_${fuori.length + 1}`, box: [x0, y0, x1, y1], prompt: p })
    if (fuori.length >= 16) break
  }
  return fuori
}

/** [x0, y0, x1, y1] 0–1  →  [y_min, x_min, y_max, x_max] 0–1000 (come lo vuole Klein) */
export const bboxKlein = (b: Box01): [number, number, number, number] => [Math.round(b[1] * 1000), Math.round(b[0] * 1000), Math.round(b[3] * 1000), Math.round(b[2] * 1000)]

const maiuscola = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
const senzaPunto = (s: string): string => s.trim().replace(/[.\s]+$/, '')

/** il prompt di Klein con i riquadri: didascalia che cita ogni <id>, poi le righe JSON. `modifica`: i riquadri dicono dove va quello che si aggiunge/cambia. */
export function promptKleinConBox(scena: string, regioni: RegionePronta[], modifica = false): string {
  if (!regioni.length) return scena
  const righe = regioni.map((r) =>
    modifica ? { id: r.id, from: 'target', src_bbox: null, tgt_bbox: bboxKlein(r.box), desc: maiuscola(r.prompt) } : { id: r.id, bbox: bboxKlein(r.box), desc: maiuscola(r.prompt) }
  )
  const testi = regioni.map((r) => `${maiuscola(senzaPunto(r.prompt))} <${r.id}>.`)
  const didascalia = [scena.trim() ? maiuscola(senzaPunto(scena)) + '.' : '', ...testi].filter(Boolean).join(' ')
  return `${didascalia} ${JSON.stringify(righe)}`
}

/** dov'è un riquadro, a parole (per i modelli che non leggono i riquadri) */
export function dove(b: Box01): string {
  const cx = (b[0] + b[2]) / 2
  const cy = (b[1] + b[3]) / 2
  const o = cx < 0.34 ? 'left' : cx > 0.66 ? 'right' : ''
  const v = cy < 0.34 ? 'top' : cy > 0.66 ? 'bottom' : ''
  const area = (b[2] - b[0]) * (b[3] - b[1])
  const grande = area > 0.4 ? 'filling most of the frame, ' : area > 0.16 ? 'large, ' : area < 0.04 ? 'small, ' : ''
  const posto = o || v ? `at the ${[v, o].filter(Boolean).join(' ')} of the frame` : 'in the center of the frame'
  return grande + posto
}

/** il prompt per Qwen-Image 2.1 e FLUX.2 Klein 4B: la posizione di ogni elemento a parole */
export function promptConPosizioni(scena: string, regioni: RegionePronta[], modifica = false): string {
  if (!regioni.length) return scena
  const testi = regioni.map((r) => (modifica ? `${maiuscola(senzaPunto(r.prompt))} — ${dove(r.box)}.` : `${maiuscola(dove(r.box))}: ${senzaPunto(r.prompt)}.`))
  const apertura = scena.trim() ? maiuscola(senzaPunto(scena)) + '. ' : ''
  return `${apertura}${modifica ? 'Apply these changes, each one in its place:' : 'Compose the image with these elements, each in its place:'} ${testi.join(' ')}`
}
