// Prima e dopo: le due immagini una sull'altra, si trascina la linea.
import { useRef, useState, type JSX } from 'react'

export function PrimaDopo({ prima, dopo, stile }: { prima: string; dopo: string; stile?: React.CSSProperties }): JSX.Element {
  const [x, setX] = useState(50)
  const rif = useRef<HTMLDivElement>(null)
  const muovi = (e: React.PointerEvent): void => {
    const r = rif.current!.getBoundingClientRect()
    setX(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)))
  }
  return (
    <div
      className="confronto"
      ref={rif}
      style={stile}
      onPointerDown={(e) => {
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        muovi(e)
      }}
      onPointerMove={(e) => e.buttons && muovi(e)}
    >
      <img src={prima} alt="prima" draggable={false} style={stile} />
      <div className="dopo" style={{ clipPath: `inset(0 0 0 ${x}%)` }}>
        <img src={dopo} alt="dopo" draggable={false} />
      </div>
      <div className="linea" style={{ left: `calc(${x}% - 1px)` }} />
      <span className="et" style={{ left: 10 }}>PRIMA</span>
      <span className="et" style={{ right: 10 }}>DOPO</span>
    </div>
  )
}
