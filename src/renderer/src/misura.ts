// La misura dell'immagine che esce da Crea: UNA funzione sola, usata sia dal pulsante che costruisce la richiesta sia dal HUD
// («la cifra che vedi è quella che esce»). Il modello disegna a `lav` e il motore porta il risultato a `finale`.
import { dimMp } from './componenti/Misura'
import { FORMATI, dimensioniRis } from './util'
import type { StatoCrea } from './stato'

export type StatoMisura = 'nativa' | 'ingrandita' | 'ridotta'

export interface MisuraCrea {
  /** la foto che esce, in pixel */
  finale: { w: number; h: number }
  /** la misura a cui disegna il modello */
  lav: { w: number; h: number }
  /** la misura chiesta dal formato e dalla risoluzione, prima del limite del modello (4,2 MP, 2688 px) */
  voluta: { w: number; h: number }
  /** nativa = disegna proprio alla misura finale · ingrandita = disegna più piccolo e poi ingrandisce · ridotta = disegna più grande o il limite l'ha abbassata */
  stato: StatoMisura
  /** di quanto ingrandisce (>1) o riduce (<1) dal disegno alla misura finale */
  fattore: number
  /** la frase per il HUD */
  nota: string
  mp: number
  rapporto: string
}

const m16 = (x: number): number => Math.max(256, Math.round(x / 16) * 16)
const mcd = (a: number, b: number): number => (b ? mcd(b, a % b) : a)
/** il rapporto più vicino fra quelli noti, se no w:h ridotto */
export const rapportoDi = (w: number, h: number): string => {
  const noto = FORMATI.find((f) => Math.abs(f.w / f.h - w / h) < 0.012)
  if (noto) return noto.id
  const d = mcd(Math.round(w), Math.round(h))
  const a = Math.round(w) / d
  const b = Math.round(h) / d
  return a > 40 || b > 40 ? (w / h).toFixed(2).replace('.', ',') + ':1' : `${a}:${b}`
}

export function misuraCrea(crea: Pick<StatoCrea, 'formato' | 'ris' | 'misura' | 'mpLavoro'>): MisuraCrea {
  const dim = dimensioniRis(crea.formato, crea.ris)
  const f = FORMATI.find((x) => x.id === crea.formato) || FORMATI[0]
  const ar = f.w / f.h
  const corto = crea.ris
  const voluta = { w: Math.round(ar >= 1 ? corto * ar : corto), h: Math.round(ar >= 1 ? corto : corto / ar) }
  const mis = crea.misura?.tipo === 'custom' ? crea.misura : null
  const finale = mis ? { w: mis.w, h: mis.h } : dim
  const mpLav = crea.mpLavoro ? Math.min(crea.mpLavoro, 4.19) : 0
  const lav = mpLav
    ? dimMp(mpLav, finale.w, finale.h)
    : mis
      ? { w: m16(Math.sqrt(dim.w * dim.h * (mis.w / mis.h))), h: m16(Math.sqrt((dim.w * dim.h) / (mis.w / mis.h))) }
      : dim
  const fattore = Math.sqrt((finale.w * finale.h) / (lav.w * lav.h))
  const limitato = !mis && dim.w * dim.h < voluta.w * voluta.h * 0.97
  let stato: StatoMisura = 'nativa'
  let nota = `Nativa: il modello disegna proprio a ${finale.w}×${finale.h}`
  if (Math.abs(finale.w - lav.w) > 1 || Math.abs(finale.h - lav.h) > 1) {
    if (fattore > 1.01) {
      stato = 'ingrandita'
      nota = `Disegna a ${lav.w}×${lav.h} → ingrandisce ×${fattore.toFixed(2).replace('.', ',')}`
    } else {
      stato = 'ridotta'
      nota = `Disegna a ${lav.w}×${lav.h} → riduce a ${finale.w}×${finale.h}`
    }
  } else if (limitato) {
    stato = 'ridotta'
    nota = `Limite del modello: scende a ${finale.w}×${finale.h}`
  }
  return { finale, lav, voluta, stato, fattore, nota, mp: (finale.w * finale.h) / 1048576, rapporto: rapportoDi(finale.w, finale.h) }
}
