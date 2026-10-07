// La tela della pagina Modifica: la foto, e sopra la maschera che si disegna (pennello, gomma,
// rettangolo, lazo). Rotella = zoom, spazio o tasto centrale = sposta. La maschera ha la
// grandezza vera della foto, così combacia al pixel con quello che riceve il motore.
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type JSX, type Ref } from 'react'
import type { Bordi, Riquadro } from '@shared/tipi'

export type Strumento = 'pennello' | 'gomma' | 'rettangolo' | 'lazo' | 'mano'

export interface ComandiTela {
  esporta(): { dataUrl: string; riquadro: Riquadro } | null
  pulisci(): void
  inverti(): void
  tutta(): void
  annulla(): void
  ripeti(): void
  adatta(): void
  haMaschera(): boolean
}

interface Props {
  url: string
  larghezza: number
  altezza: number
  strumento: Strumento
  dimensione: number
  disegna: boolean
  bordi?: Bordi
  cambiaMaschera?: (c: boolean) => void
  cambiaDimensione?: (d: number) => void
  ref?: Ref<ComandiTela>
}

const COLORE = '#ff3df2'

export function TelaMaschera(p: Props): JSX.Element {
  const contenitore = useRef<HTMLDivElement>(null)
  const tela = useRef<HTMLCanvasElement>(null)
  const [vista, setVista] = useState({ s: 1, x: 0, y: 0 })
  const vistaRif = useRef(vista)
  vistaRif.current = vista
  const [cursore, setCursore] = useState<{ x: number; y: number } | null>(null)
  const [rett, setRett] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const [lazo, setLazo] = useState<{ x: number; y: number }[]>([])
  const [spazio, setSpazio] = useState(false)
  const [trascina, setTrascina] = useState(false)
  const storia = useRef<ImageData[]>([])
  const futuro = useRef<ImageData[]>([])
  const ultimo = useRef<{ x: number; y: number } | null>(null)
  const azione = useRef<'disegno' | 'sposta' | 'rett' | 'lazo' | null>(null)
  const inizioSposta = useRef({ cx: 0, cy: 0, x: 0, y: 0 })
  const gommaTemp = useRef(false)

  const ctx = (): CanvasRenderingContext2D => tela.current!.getContext('2d', { willReadFrequently: true })!

  const adatta = useCallback(() => {
    const c = contenitore.current
    if (!c) return
    const b = p.bordi || { sinistra: 0, sopra: 0, destra: 0, sotto: 0 }
    const W = p.larghezza + b.sinistra + b.destra
    const H = p.altezza + b.sopra + b.sotto
    const r = c.getBoundingClientRect()
    const s = Math.min((r.width - 40) / W, (r.height - 40) / H, 4)
    setVista({ s, x: (r.width - W * s) / 2 + b.sinistra * s, y: (r.height - H * s) / 2 + b.sopra * s })
  }, [p.larghezza, p.altezza, p.bordi])

  // foto nuova: maschera vuota della sua grandezza
  useEffect(() => {
    const t = tela.current
    if (!t) return
    t.width = p.larghezza
    t.height = p.altezza
    storia.current = []
    futuro.current = []
    p.cambiaMaschera?.(false)
    adatta()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.url, p.larghezza, p.altezza])

  useEffect(() => {
    adatta()
  }, [adatta])

  useEffect(() => {
    const ro = new ResizeObserver(() => adatta())
    if (contenitore.current) ro.observe(contenitore.current)
    return () => ro.disconnect()
  }, [adatta])

  useEffect(() => {
    const giu = (e: KeyboardEvent): void => {
      if (e.code === 'Space' && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLInputElement)) {
        setSpazio(true)
        e.preventDefault()
      }
    }
    const su = (e: KeyboardEvent): void => {
      if (e.code === 'Space') setSpazio(false)
    }
    window.addEventListener('keydown', giu)
    window.addEventListener('keyup', su)
    return () => {
      window.removeEventListener('keydown', giu)
      window.removeEventListener('keyup', su)
    }
  }, [])

  const salvaStoria = (): void => {
    const t = tela.current!
    storia.current.push(ctx().getImageData(0, 0, t.width, t.height))
    if (storia.current.length > 15) storia.current.shift()
    futuro.current = []
  }

  /** c'è qualcosa di disegnato? (guardando una copia piccola, è veloce) */
  const misura = (): Riquadro | null => {
    const t = tela.current!
    const s = Math.min(1, 768 / Math.max(t.width, t.height))
    const w = Math.max(1, Math.round(t.width * s))
    const h = Math.max(1, Math.round(t.height * s))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const cc = c.getContext('2d', { willReadFrequently: true })!
    cc.drawImage(t, 0, 0, w, h)
    const d = cc.getImageData(0, 0, w, h).data
    let x0 = w
    let y0 = h
    let x1 = -1
    let y1 = -1
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (d[(y * w + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
    if (x1 < 0) return null
    const k = 1 / s
    const X = Math.max(0, Math.floor((x0 - 1) * k))
    const Y = Math.max(0, Math.floor((y0 - 1) * k))
    return { x: X, y: Y, w: Math.min(t.width, Math.ceil((x1 + 2) * k)) - X, h: Math.min(t.height, Math.ceil((y1 + 2) * k)) - Y }
  }
  const avvisaCambio = (): void => p.cambiaMaschera?.(!!misura())

  useImperativeHandle(p.ref, () => ({
    esporta: () => {
      const t = tela.current!
      const riquadro = misura()
      if (!riquadro) return null
      const bianco = document.createElement('canvas')
      bianco.width = t.width
      bianco.height = t.height
      const b = bianco.getContext('2d')!
      b.drawImage(t, 0, 0)
      b.globalCompositeOperation = 'source-in'
      b.fillStyle = '#fff'
      b.fillRect(0, 0, t.width, t.height)
      const out = document.createElement('canvas')
      out.width = t.width
      out.height = t.height
      const o = out.getContext('2d')!
      o.fillStyle = '#000'
      o.fillRect(0, 0, t.width, t.height)
      o.drawImage(bianco, 0, 0)
      return { dataUrl: out.toDataURL('image/png'), riquadro }
    },
    pulisci: () => {
      salvaStoria()
      ctx().clearRect(0, 0, tela.current!.width, tela.current!.height)
      avvisaCambio()
    },
    inverti: () => {
      salvaStoria()
      const t = tela.current!
      const c = ctx()
      const copia = document.createElement('canvas')
      copia.width = t.width
      copia.height = t.height
      copia.getContext('2d')!.drawImage(t, 0, 0)
      c.clearRect(0, 0, t.width, t.height)
      c.fillStyle = COLORE
      c.fillRect(0, 0, t.width, t.height)
      c.globalCompositeOperation = 'destination-out'
      c.drawImage(copia, 0, 0)
      c.globalCompositeOperation = 'source-over'
      avvisaCambio()
    },
    tutta: () => {
      salvaStoria()
      const c = ctx()
      c.fillStyle = COLORE
      c.fillRect(0, 0, tela.current!.width, tela.current!.height)
      avvisaCambio()
    },
    annulla: () => {
      const s = storia.current.pop()
      if (!s) return
      const t = tela.current!
      futuro.current.push(ctx().getImageData(0, 0, t.width, t.height))
      ctx().putImageData(s, 0, 0)
      avvisaCambio()
    },
    ripeti: () => {
      const f = futuro.current.pop()
      if (!f) return
      const t = tela.current!
      storia.current.push(ctx().getImageData(0, 0, t.width, t.height))
      ctx().putImageData(f, 0, 0)
      avvisaCambio()
    },
    adatta,
    haMaschera: () => !!misura()
  }))

  const inFoto = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const r = contenitore.current!.getBoundingClientRect()
    const v = vistaRif.current
    return { x: (e.clientX - r.left - v.x) / v.s, y: (e.clientY - r.top - v.y) / v.s }
  }

  const tratto = (a: { x: number; y: number }, b: { x: number; y: number }, gomma: boolean): void => {
    const c = ctx()
    c.globalCompositeOperation = gomma ? 'destination-out' : 'source-over'
    c.strokeStyle = COLORE
    c.fillStyle = COLORE
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.lineWidth = p.dimensione
    c.beginPath()
    c.moveTo(a.x, a.y)
    c.lineTo(b.x, b.y)
    c.stroke()
    c.beginPath()
    c.arc(b.x, b.y, p.dimensione / 2, 0, Math.PI * 2)
    c.fill()
    c.globalCompositeOperation = 'source-over'
  }

  const strumento: Strumento = spazio ? 'mano' : p.strumento

  const giu = (e: React.PointerEvent): void => {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const pt = inFoto(e)
    if (e.button === 1 || strumento === 'mano' || !p.disegna) {
      azione.current = 'sposta'
      setTrascina(true)
      inizioSposta.current = { cx: e.clientX, cy: e.clientY, x: vista.x, y: vista.y }
      return
    }
    if (e.button !== 0 && e.button !== 2) return
    gommaTemp.current = e.button === 2 || e.altKey
    salvaStoria()
    if (strumento === 'pennello' || strumento === 'gomma') {
      azione.current = 'disegno'
      ultimo.current = pt
      tratto(pt, pt, strumento === 'gomma' || gommaTemp.current)
    } else if (strumento === 'rettangolo') {
      azione.current = 'rett'
      setRett({ x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y })
    } else if (strumento === 'lazo') {
      azione.current = 'lazo'
      setLazo([pt])
    }
  }

  const muovi = (e: React.PointerEvent): void => {
    const pt = inFoto(e)
    setCursore(pt)
    if (!azione.current) return
    if (azione.current === 'sposta') {
      const i = inizioSposta.current
      setVista((v) => ({ ...v, x: i.x + e.clientX - i.cx, y: i.y + e.clientY - i.cy }))
    } else if (azione.current === 'disegno' && ultimo.current) {
      tratto(ultimo.current, pt, strumento === 'gomma' || gommaTemp.current)
      ultimo.current = pt
    } else if (azione.current === 'rett') {
      setRett((r) => (r ? { ...r, x1: pt.x, y1: pt.y } : r))
    } else if (azione.current === 'lazo') {
      setLazo((l) => {
        const u = l[l.length - 1]
        return u && Math.hypot(u.x - pt.x, u.y - pt.y) * vistaRif.current.s < 3 ? l : [...l, pt]
      })
    }
  }

  const su = (): void => {
    const c = ctx()
    const gomma = gommaTemp.current
    c.globalCompositeOperation = gomma ? 'destination-out' : 'source-over'
    c.fillStyle = COLORE
    if (azione.current === 'rett' && rett) {
      c.fillRect(Math.min(rett.x0, rett.x1), Math.min(rett.y0, rett.y1), Math.abs(rett.x1 - rett.x0), Math.abs(rett.y1 - rett.y0))
      setRett(null)
    } else if (azione.current === 'lazo' && lazo.length > 2) {
      c.beginPath()
      c.moveTo(lazo[0].x, lazo[0].y)
      for (const q of lazo.slice(1)) c.lineTo(q.x, q.y)
      c.closePath()
      c.fill()
    }
    c.globalCompositeOperation = 'source-over'
    setLazo([])
    if (azione.current && azione.current !== 'sposta') avvisaCambio()
    azione.current = null
    ultimo.current = null
    setTrascina(false)
  }

  const rotella = (e: React.WheelEvent): void => {
    if (e.shiftKey && p.cambiaDimensione && p.disegna) {
      p.cambiaDimensione(Math.max(2, Math.round(p.dimensione * (e.deltaY < 0 ? 1.12 : 0.89))))
      return
    }
    const r = contenitore.current!.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    setVista((v) => {
      const s = Math.max(0.05, Math.min(16, v.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
      return { s, x: mx - ((mx - v.x) * s) / v.s, y: my - ((my - v.y) * s) / v.s }
    })
  }

  const b = p.bordi
  const classi = ['tela', strumento === 'mano' || !p.disegna ? 'mano' : '', trascina ? 'trascina' : ''].join(' ')
  return (
    <div
      className={classi}
      ref={contenitore}
      onPointerDown={giu}
      onPointerMove={muovi}
      onPointerUp={su}
      onPointerLeave={() => setCursore(null)}
      onWheel={rotella}
      onContextMenu={(e) => e.preventDefault()}
    >
      {b && (b.sinistra || b.sopra || b.destra || b.sotto) ? (
        <div
          className="cornice-espandi"
          style={{
            left: vista.x - b.sinistra * vista.s,
            top: vista.y - b.sopra * vista.s,
            width: (p.larghezza + b.sinistra + b.destra) * vista.s,
            height: (p.altezza + b.sopra + b.sotto) * vista.s
          }}
        />
      ) : null}
      <div className="strato" style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.s})`, width: p.larghezza, height: p.altezza }}>
        <img src={p.url} width={p.larghezza} height={p.altezza} draggable={false} alt="" />
        <canvas ref={tela} className="maschera" style={{ width: p.larghezza, height: p.altezza, display: p.disegna ? 'block' : 'none' }} />
      </div>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {rett && (
          <rect
            x={vista.x + Math.min(rett.x0, rett.x1) * vista.s}
            y={vista.y + Math.min(rett.y0, rett.y1) * vista.s}
            width={Math.abs(rett.x1 - rett.x0) * vista.s}
            height={Math.abs(rett.y1 - rett.y0) * vista.s}
            fill="rgba(255,61,242,.3)"
            stroke="#ff3df2"
            strokeDasharray="6 4"
          />
        )}
        {lazo.length > 1 && (
          <polygon points={lazo.map((q) => `${vista.x + q.x * vista.s},${vista.y + q.y * vista.s}`).join(' ')} fill="rgba(255,61,242,.25)" stroke="#ff3df2" strokeWidth={1.5} strokeDasharray="5 4" />
        )}
      </svg>
      {cursore && p.disegna && (strumento === 'pennello' || strumento === 'gomma') && (
        <div className="pennello" style={{ left: vista.x + cursore.x * vista.s, top: vista.y + cursore.y * vista.s, width: p.dimensione * vista.s, height: p.dimensione * vista.s }} />
      )}
      {p.disegna && (
        <div className="aiuto-tela">
          Tasto destro o Alt = cancella · Rotella = zoom · Spazio = sposta · Shift+rotella = grandezza pennello
        </div>
      )}
    </div>
  )
}
