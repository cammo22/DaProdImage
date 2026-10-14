// Lo spread in grande: foto e elementi si prendono col mouse. Trascina una foto per spostare l'inquadratura, la rotella la
// ingrandisce; un testo o una forma si trascina, e il quadratino azzurro in basso a destra li allarga.
import { useEffect, useRef, useState, type JSX } from 'react'
import { usaAlbum } from '../stato'
import { adatta, disegnaSpread, geometria, mappaFoto, rettElemento } from '../disegna'
import { spreadDi, type Album, type Spread } from '../tipi'

type Presa =
  | { t: 'foto'; x: number; y: number; fx: number; fy: number; cella: number }
  | { t: 'sposta'; id: string; dx: number; dy: number }
  | { t: 'allarga'; id: string; x0: number; y0: number }

export function Palco(p: { spread: Spread | undefined; album: Album; cella: number | null; elemento: string | null; guide: boolean; vuoto: JSX.Element; testoDoppio: () => void }): JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [dim, setDim] = useState({ w: 0, h: 0 })
  const token = useRef(0)
  const presa = useRef<Presa | null>(null)
  const { album, spread } = p

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setDim({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setDim({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const s = spreadDi(album)
  const tw = s.w + 2 * album.abbondanza
  const th = s.h + 2 * album.abbondanza
  const scala = Math.max(0.1, Math.min((dim.w - 48) / tw, (dim.h - 36) / th))
  const dpr = window.devicePixelRatio || 1

  useEffect(() => {
    const c = canvas.current
    if (!c || !spread || dim.w < 50) return
    const mio = ++token.current
    void (async () => {
      const t = document.createElement('canvas')
      await disegnaSpread(t, album, spread, { px: scala * dpr, grande: false, guide: p.guide, selezione: p.cella ?? undefined, elemento: p.elemento ?? undefined })
      if (mio !== token.current) return
      c.width = t.width
      c.height = t.height
      c.getContext('2d')!.drawImage(t, 0, 0)
    })()
  }, [album, spread, scala, dpr, p.guide, p.cella, p.elemento, dim.w])

  /** dove sta il mouse, in mm sulla tela */
  const mm = (e: { clientX: number; clientY: number }): { mx: number; my: number } => {
    const r = canvas.current!.getBoundingClientRect()
    return { mx: ((e.clientX - r.left) / r.width) * tw, my: ((e.clientY - r.top) / r.height) * th }
  }

  const giu = (e: React.PointerEvent): void => {
    if (!spread || !canvas.current) return
    const { mx, my } = mm(e)
    const geo = geometria(album, spread, mappaFoto(album))
    // prima gli elementi (quello più in alto)
    const els = spread.elementi || []
    const manig = Math.max(2.5, 12 / scala)
    for (let i = els.length - 1; i >= 0; i--) {
      const r = rettElemento(els[i], geo)
      const sulla = els[i].id === p.elemento && Math.abs(mx - (r.x + r.w)) < manig && Math.abs(my - (r.y + r.h)) < manig
      const dentro = mx >= r.x - 1 && mx <= r.x + r.w + 1 && my >= r.y - 1.5 && my <= r.y + r.h + 1.5
      if (sulla || dentro) {
        usaAlbum.getState().scegliElemento(els[i].id)
        presa.current = sulla ? { t: 'allarga', id: els[i].id, x0: r.x, y0: r.y } : { t: 'sposta', id: els[i].id, dx: mx - (geo.b + els[i].x * geo.w), dy: my - (geo.b + els[i].y * geo.h) }
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        usaAlbum.getState().mod(() => undefined)
        return
      }
    }
    // poi le foto (la più in alto)
    let i = -1
    let zMax = -Infinity
    geo.celle.forEach((k, j) => {
      if (j < spread.piazze.length && mx >= k.x && mx <= k.x + k.w && my >= k.y && my <= k.y + k.h && (k.z ?? 0) >= zMax) {
        i = j
        zMax = k.z ?? 0
      }
    })
    if (i < 0) {
      usaAlbum.setState({ cella: null, elemento: null })
      return
    }
    usaAlbum.setState({ cella: i, elemento: null })
    const pz = spread.piazze[i]
    presa.current = { t: 'foto', x: e.clientX, y: e.clientY, fx: pz.fx, fy: pz.fy, cella: i }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    // un solo passo di "annulla" per tutto il trascinamento
    usaAlbum.getState().mod(() => undefined)
  }

  const muovi = (e: React.PointerEvent): void => {
    const t = presa.current
    if (!t || !spread) return
    const foto = mappaFoto(album)
    const geo = geometria(album, spread, foto)
    const idx = usaAlbum.getState().corrente
    if (t.t === 'foto') {
      const cl = geo.celle[t.cella]
      const pz = spread.piazze[t.cella]
      const f = foto.get(pz.foto)
      if (!cl || !f) return
      const bordo = cl.vivo ? 0 : cl.cornice ?? album.bordoFoto
      const pos = adatta({ w: cl.w - 2 * bordo, h: cl.h - 2 * bordo }, f.w, f.h, pz.fx, pz.fy, pz.zoom, cl.vivo || (spread.stile === 'pieno' && spread.piazze.length === 1) ? 0.95 : album.taglioMax)
      const mmPerPx = tw / (canvas.current!.getBoundingClientRect().width || 1)
      const dx = (e.clientX - t.x) * mmPerPx
      const dy = (e.clientY - t.y) * mmPerPx
      const ecc = { x: pos.w - (cl.w - 2 * bordo), y: pos.h - (cl.h - 2 * bordo) }
      usaAlbum.getState().mod((a) => {
        const q = a.spreads[idx].piazze[t.cella]
        if (ecc.x > 0.5) q.fx = Math.max(0, Math.min(1, t.fx - dx / ecc.x))
        if (ecc.y > 0.5) q.fy = Math.max(0, Math.min(1, t.fy - dy / ecc.y))
      }, true)
      return
    }
    const { mx, my } = mm(e)
    if (t.t === 'sposta') {
      let x = (mx - t.dx - geo.b) / geo.w
      let y = (my - t.dy - geo.b) / geo.h
      // si attacca al centro dello spread (e alla piega) quando ci si avvicina
      if (Math.abs(x - 0.5) < 0.012) x = 0.5
      if (Math.abs(y - 0.5) < 0.012) y = 0.5
      usaAlbum.getState().mod((a) => {
        const el = a.spreads[idx].elementi?.find((q) => q.id === t.id)
        if (el) {
          el.x = Math.max(0, Math.min(1, x))
          el.y = Math.max(0, Math.min(1, y))
        }
      }, true)
    } else {
      usaAlbum.getState().mod((a) => {
        const el = a.spreads[idx].elementi?.find((q) => q.id === t.id)
        if (!el) return
        const w = Math.max(4, mx - t.x0)
        el.w = Math.min(1, w / geo.w)
        el.x = (t.x0 + w / 2 - geo.b) / geo.w
        if (el.tipo === 'forma' && el.forma !== 'linea') {
          const h = Math.max(3, my - t.y0)
          el.h = Math.min(1, h / geo.h)
          el.y = (t.y0 + h / 2 - geo.b) / geo.h
        }
      }, true)
    }
  }
  const su = (): void => {
    presa.current = null
  }

  const ruota = (e: React.WheelEvent): void => {
    if (p.cella === null || !spread?.piazze[p.cella]) return
    const c = p.cella
    usaAlbum.getState().mod((a) => {
      const q = a.spreads[usaAlbum.getState().corrente].piazze[c]
      q.zoom = Math.max(1, Math.min(3, +(q.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)).toFixed(3)))
    }, true)
  }

  const rilascia = (e: React.DragEvent): void => {
    const id = e.dataTransfer.getData('application/x-foto-album')
    if (!id || !spread) return
    e.preventDefault()
    e.stopPropagation()
    const { mx, my } = mm(e)
    const geo = geometria(album, spread, mappaFoto(album))
    const i = geo.celle.findIndex((k, j) => j < spread.piazze.length && mx >= k.x && mx <= k.x + k.w && my >= k.y && my <= k.y + k.h)
    usaAlbum.getState().metti(id, i >= 0 ? i : undefined)
  }

  return (
    <div className="stage-album" ref={box}>
      {spread ? (
        <canvas
          ref={canvas}
          style={{ width: tw * scala, height: th * scala }}
          onPointerDown={giu}
          onPointerMove={muovi}
          onPointerUp={su}
          onPointerCancel={su}
          onDoubleClick={() => p.elemento && p.testoDoppio()}
          onWheel={ruota}
          onDragOver={(e) => e.dataTransfer.types.includes('application/x-foto-album') && e.preventDefault()}
          onDrop={rilascia}
        />
      ) : (
        p.vuoto
      )}
    </div>
  )
}
