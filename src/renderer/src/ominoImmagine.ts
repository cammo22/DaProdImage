// L'omino come immagine (un manichino grigio) salvata in temp: la si dà al modello come foto di riferimento.
import { api } from './api'
import { disegnaManichino, type Posa } from './omino'

export async function immagineOmino(p: Posa, w: number, h: number): Promise<string> {
  const c = document.createElement('canvas')
  c.width = Math.max(64, Math.round(w))
  c.height = Math.max(64, Math.round(h))
  disegnaManichino(c.getContext('2d')!, p, c.width, c.height)
  return api.file.salvaTemp(c.toDataURL('image/png'))
}
