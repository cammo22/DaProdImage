// Una foto che si guarda bene: si adatta alla finestra (anche ingrandendo le piccole), rotella = zoom dove
// c'è il puntatore, trascina = sposta, doppio clic = 100% / adatta. I tasti in basso fanno lo stesso.
import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react'
import { I } from './Icone'

interface Vista {
  s: number
  x: number
  y: number
}

export function VistaZoom(p: { src: string; scacchi?: boolean; children?: ReactNode; margine?: number }): JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const [dim, setDim] = useState({ w: 0, h: 0 })
  const [nat, setNat] = useState({ w: 0, h: 0 })
  // null = adattata alla finestra (si ricalcola da sola quando la finestra cambia)
  const [vista, setVista] = useState<Vista | null>(null)
  const trascina = useRef<{ cx: number; cy: number; x: number; y: number } | null>(null)
  const margine = p.margine ?? 24

  useEffect(() => {
    setVista(null)
  }, [p.src])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setDim({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setDim({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const adattata = (): Vista => {
    if (!nat.w || !dim.w) return { s: 1, x: 0, y: 0 }
    const s = Math.max(0.01, Math.min((dim.w - margine * 2) / nat.w, (dim.h - margine * 2) / nat.h))
    return { s, x: (dim.w - nat.w * s) / 2, y: (dim.h - nat.h * s) / 2 }
  }
  const v = vista || adattata()
  const fit = adattata().s

  const zoomA = (s: number, cx = dim.w / 2, cy = dim.h / 2): void => {
    const n = Math.max(fit * 0.25, Math.min(16, s))
    setVista({ s: n, x: cx - ((cx - v.x) * n) / v.s, y: cy - ((cy - v.y) * n) / v.s })
  }

  // la rotella va presa a mano (passive: false) per poter fermare lo scorrimento della pagina
  useEffect(() => {
    const el = box.current
    if (!el) return
    const rotella = (e: WheelEvent): void => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomA(v.s * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', rotella, { passive: false })
    return () => el.removeEventListener('wheel', rotella)
  })

  return (
    <div
      className={`vista-zoom ${vista ? 'zoomata' : ''}`}
      ref={box}
      onPointerDown={(e) => {
        if (e.button !== 0 && e.button !== 1) return
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        trascina.current = { cx: e.clientX, cy: e.clientY, x: v.x, y: v.y }
      }}
      onPointerMove={(e) => {
        const t = trascina.current
        if (!t) return
        if (Math.abs(e.clientX - t.cx) + Math.abs(e.clientY - t.cy) < 3 && !vista) return
        setVista({ s: v.s, x: t.x + e.clientX - t.cx, y: t.y + e.clientY - t.cy })
      }}
      onPointerUp={() => (trascina.current = null)}
      onDoubleClick={(e) => {
        const r = box.current!.getBoundingClientRect()
        if (vista && Math.abs(v.s - 1) < 0.01) setVista(null)
        else zoomA(1, e.clientX - r.left, e.clientY - r.top)
      }}
    >
      <img
        src={p.src}
        alt=""
        draggable={false}
        className={p.scacchi ? 'scacchi' : ''}
        onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        style={{ width: nat.w || undefined, height: nat.h || undefined, transform: `translate(${v.x}px, ${v.y}px) scale(${v.s})`, opacity: nat.w ? 1 : 0 }}
      />
      {p.children}
      <div className="comandi-zoom" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <button onClick={() => zoomA(v.s / 1.4)} title="Rimpicciolisci (rotella giù)">−</button>
        <span title="Doppio clic sulla foto: 100% / adatta">{Math.round(v.s * 100)}%</span>
        <button onClick={() => zoomA(v.s * 1.4)} title="Ingrandisci (rotella su)">+</button>
        <button onClick={() => setVista(null)} title="Adatta alla finestra" className={vista ? '' : 'su'}><I.adatta /></button>
      </div>
    </div>
  )
}
