// Controlli base: cursore, interruttore, contatore, segmenti.
import { useState, type JSX, type ReactNode } from 'react'

export function Cursore(p: {
  etichetta: ReactNode
  valore: number
  min: number
  max: number
  passo?: number
  formato?: (v: number) => string
  cambia: (v: number) => void
  titolo?: string
}): JSX.Element {
  const perc = ((p.valore - p.min) / (p.max - p.min)) * 100
  return (
    <div className="cursore" title={p.titolo}>
      <label>{p.etichetta}</label>
      <output>{p.formato ? p.formato(p.valore) : p.valore}</output>
      <input
        type="range"
        min={p.min}
        max={p.max}
        step={p.passo ?? 1}
        value={p.valore}
        style={{ ['--p' as string]: `${perc}%` }}
        onChange={(e) => p.cambia(Number(e.target.value))}
      />
    </div>
  )
}

export function Interruttore(p: { acceso: boolean; cambia: (v: boolean) => void; children: ReactNode; sotto?: ReactNode; titolo?: string }): JSX.Element {
  return (
    <label className="interruttore" title={p.titolo}>
      <input type="checkbox" checked={p.acceso} onChange={(e) => p.cambia(e.target.checked)} />
      <span className="pista" />
      <span className="et">
        {p.children}
        {p.sotto && <small>{p.sotto}</small>}
      </span>
    </label>
  )
}

export function Contatore(p: { valore: number; min: number; max: number; cambia: (v: number) => void }): JSX.Element {
  return (
    <div className="contatore">
      <button onClick={() => p.cambia(Math.max(p.min, p.valore - 1))}>−</button>
      <span>{p.valore}</span>
      <button onClick={() => p.cambia(Math.min(p.max, p.valore + 1))}>+</button>
    </div>
  )
}

export function Segmenti<T extends string | number>(p: {
  valore: T
  voci: { id: T; nome: ReactNode; sotto?: ReactNode; titolo?: string }[]
  cambia: (v: T) => void
}): JSX.Element {
  return (
    <div className="segmenti">
      {p.voci.map((v) => (
        <button key={String(v.id)} className={v.id === p.valore ? 'su' : ''} onClick={() => p.cambia(v.id)} title={v.titolo}>
          {v.nome}
          {v.sotto && <small>{v.sotto}</small>}
        </button>
      ))}
    </div>
  )
}

/** una sezione di una colonna con il titolo che la chiude/apre; ricorda com'era rimasta */
export function SezioneChiudibile(p: { id: string; titolo: ReactNode; destra?: ReactNode; aperta?: boolean; children: ReactNode }): JSX.Element {
  const chiave = `dpi-sez-${p.id}`
  const [su, setSu] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(chiave)
      return v === null ? p.aperta !== false : v === '1'
    } catch {
      return p.aperta !== false
    }
  })
  const alterna = (): void => {
    setSu(!su)
    try {
      localStorage.setItem(chiave, su ? '0' : '1')
    } catch {
      /* niente */
    }
  }
  return (
    <div className="sezione">
      <h3 className="chiudibile" onClick={alterna} style={{ cursor: 'pointer', marginBottom: su ? undefined : 0 }}>
        {su ? '▾' : '▸'} {p.titolo}
        {p.destra !== undefined && <span className="dx">{p.destra}</span>}
      </h3>
      {su && p.children}
    </div>
  )
}
