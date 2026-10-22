// Il prompt che parte da Crea: quello scritto (o composto dal genere) + lo stile scelto + lo sfondo.
// Lo stile e lo sfondo non si scrivono nella casella: si aggiungono qui, al momento di mandare, e si vedono come icone sopra il pulsante.
import type { SfondoRichiesto } from '@shared/tipi'
import { fraseStileCrea, stileDa } from './stili'
import type { StatoCrea } from './stato'

const NOMI_TINTA: [string, string][] = [['#ffffff', 'pure white'], ['#f2f2f2', 'light gray'], ['#000000', 'solid black'], ['#e63946', 'red'], ['#f4a261', 'orange'], ['#ffd54a', 'yellow'], ['#2a9d8f', 'teal'], ['#3fe0ff', 'cyan'], ['#8a5cff', 'violet'], ['#ff3df2', 'magenta']]
export const nomeTinta = (hex: string): string => NOMI_TINTA.find(([h]) => h.toLowerCase() === hex.toLowerCase())?.[1] || `${hex} colored`

/** quello che si dice del fondo (in inglese) */
export function fraseSfondo(crea: Pick<StatoCrea, 'sfondo' | 'tinta'>, qwen: boolean): string {
  if (crea.sfondo === 'tinta') return `isolated on a plain flat ${nomeTinta(crea.tinta)} background, no scenery, nothing else in the frame`
  // Qwen disegna già il canale alfa (il motore avvolge il prompt); Klein ha bisogno di un fondo pulito da togliere dopo
  if (crea.sfondo === 'trasparente' && !qwen) return 'isolated subject on a plain pure white background, no scenery, no shadows on the background, nothing else in the frame'
  return ''
}

export function sfondoRichiesto(crea: Pick<StatoCrea, 'sfondo' | 'tinta'>): SfondoRichiesto {
  return crea.sfondo === 'trasparente' ? 'trasparente' : crea.sfondo === 'tinta' ? { tinta: crea.tinta } : 'scena'
}

export function promptCrea(crea: Pick<StatoCrea, 'prompt' | 'stileId' | 'intensita' | 'sfondo' | 'tinta'>, qwen: boolean): string {
  const parti = [crea.prompt.trim().replace(/[.,;\s]+$/, '')]
  const s = stileDa(crea.stileId)
  if (s) parti.push(fraseStileCrea(s, crea.intensita))
  const f = fraseSfondo(crea, qwen)
  if (f) parti.push(f)
  return parti.filter(Boolean).join(', ')
}
