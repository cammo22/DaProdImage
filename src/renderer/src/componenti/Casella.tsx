// La casella di testo dei prompt: si allarga da sola quanto il testo (niente barra di scorrimento) e ha il cestino per cancellare tutto.
import { useLayoutEffect, useRef, type JSX, type Ref } from 'react'
import { I } from './Icone'

export function Casella(p: {
  valore: string
  cambia: (v: string) => void
  placeholder?: string
  /** altezza minima in px */
  minimo?: number
  disabled?: boolean
  /** senza cestino (per i testi corti) */
  senzaCestino?: boolean
  inputRef?: Ref<HTMLTextAreaElement>
}): JSX.Element {
  const el = useRef<HTMLTextAreaElement | null>(null)
  const minimo = p.minimo ?? 96

  const adatta = (): void => {
    const t = el.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = `${Math.max(minimo, t.scrollHeight + 2)}px`
  }
  // a ogni cambio di testo, e quando la colonna si allarga o si stringe (il testo va a capo in un altro punto)
  useLayoutEffect(adatta, [p.valore, minimo])
  useLayoutEffect(() => {
    const t = el.current
    if (!t || typeof ResizeObserver === 'undefined') return
    let larg = t.clientWidth
    const o = new ResizeObserver(() => {
      if (t.clientWidth !== larg) {
        larg = t.clientWidth
        adatta()
      }
    })
    o.observe(t)
    return () => o.disconnect()
  }, [])

  const aggancia = (t: HTMLTextAreaElement | null): void => {
    el.current = t
    const r = p.inputRef
    if (typeof r === 'function') r(t)
    else if (r) (r as { current: HTMLTextAreaElement | null }).current = t
  }

  return (
    <div className="casella">
      <textarea ref={aggancia} value={p.valore} placeholder={p.placeholder} disabled={p.disabled} onChange={(e) => p.cambia(e.target.value)} style={{ minHeight: minimo }} />
      {p.valore && !p.disabled && !p.senzaCestino && (
        <button type="button" className="casella-x" title="Cancella tutto il testo" onClick={() => { p.cambia(''); el.current?.focus() }}>
          <I.cestino />
        </button>
      )}
    </div>
  )
}
