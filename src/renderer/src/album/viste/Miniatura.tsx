// Una miniatura di uno spread: si ridisegna solo se cambia qualcosa che si vede (non a ogni ritocco dell'album).
import { useEffect, useMemo, useRef, type JSX } from 'react'
import { disegnaSpread } from '../disegna'
import { spreadDi, type Album, type Spread } from '../tipi'

/** tutto quello che cambia l'aspetto di uno spread, in una stringa */
export const chiaveAspetto = (a: Album, sp: Spread, conElementi = true): string =>
  JSON.stringify([
    a.formato, a.pagina, a.doppie, a.margine, a.spazio, a.angoli, a.sfondo, a.bordoFoto, a.coloreBordo, a.ombra, a.taglioMax, a.abbondanza, a.evitaPiega, a.font,
    a.foto.map((f) => [f.id, f.w, f.h, f.preferita ? 1 : 0]),
    conElementi ? sp : { ...sp, elementi: undefined, testo: undefined }
  ])

export function Miniatura(p: { album: Album; spread: Spread; larg: number; senzaElementi?: boolean; className?: string }): JSX.Element {
  const c = useRef<HTMLCanvasElement>(null)
  const ultimo = useRef(p)
  ultimo.current = p
  const s = spreadDi(p.album)
  const scala = p.larg / (s.w + 2 * p.album.abbondanza)
  const chiave = useMemo(() => chiaveAspetto(p.album, p.spread, !p.senzaElementi), [p.album, p.spread, p.senzaElementi])
  useEffect(() => {
    const el = c.current
    if (!el) return
    let vivo = true
    const t = document.createElement('canvas')
    const { album, spread } = ultimo.current
    void disegnaSpread(t, album, spread, { px: scala * 2, grande: false }).then(() => {
      if (!vivo) return
      el.width = t.width
      el.height = t.height
      el.getContext('2d')!.drawImage(t, 0, 0)
    })
    return () => {
      vivo = false
    }
  }, [chiave, scala])
  return <canvas ref={c} className={p.className} style={{ width: p.larg, height: (s.h + 2 * p.album.abbondanza) * scala }} />
}
