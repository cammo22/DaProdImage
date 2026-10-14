// Il menu del tasto destro: una lista di voci vicino al mouse. Si chiude con un clic fuori, Esc o la rotella.
import { useEffect, useLayoutEffect, useRef, useState, type JSX, type ReactNode } from 'react'

export interface VoceMenu {
  nome: ReactNode
  /** la scorciatoia, solo scritta */
  tasto?: string
  pericolo?: boolean
  disabilitata?: boolean
  /** una riga di separazione prima di questa voce */
  sopra?: boolean
  azione: () => void
}

export function MenuContestuale(p: { x: number; y: number; voci: VoceMenu[]; chiudi: () => void }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: p.x, y: p.y })

  // dentro la finestra, anche vicino ai bordi
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ x: Math.max(6, Math.min(p.x, window.innerWidth - r.width - 6)), y: Math.max(6, Math.min(p.y, window.innerHeight - r.height - 6)) })
  }, [p.x, p.y])

  useEffect(() => {
    const fuori = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) p.chiudi()
    }
    const tasto = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') p.chiudi()
    }
    window.addEventListener('mousedown', fuori)
    window.addEventListener('keydown', tasto)
    window.addEventListener('wheel', p.chiudi, { passive: true })
    window.addEventListener('blur', p.chiudi)
    return () => {
      window.removeEventListener('mousedown', fuori)
      window.removeEventListener('keydown', tasto)
      window.removeEventListener('wheel', p.chiudi)
      window.removeEventListener('blur', p.chiudi)
    }
  }, [p.chiudi])

  return (
    <div className="menu-contestuale" ref={ref} style={{ left: pos.x, top: pos.y }} onContextMenu={(e) => e.preventDefault()}>
      {p.voci.map((v, i) => (
        <div key={i}>
          {v.sopra && <div className="sep-menu" />}
          <button className={`voce-menu ${v.pericolo ? 'pericolo' : ''}`} disabled={v.disabilitata} onClick={() => { p.chiudi(); v.azione() }}>
            <span>{v.nome}</span>
            {v.tasto && <kbd>{v.tasto}</kbd>}
          </button>
        </div>
      ))}
    </div>
  )
}
