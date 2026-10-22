// I pezzi base della GUI v2 «Orbita»: la tessera (icona grande + una parola), la griglia, la fascetta Uncensored e i pulsanti di misura.
// Regola d'oro: una tessera ha un'icona e una parola; il nome lungo sta nel tooltip (`titolo`). Niente chip di testo sotto le tessere.
import type { CSSProperties, JSX, ReactNode } from 'react'
import { I } from './Icone'

export interface PropsTessera {
  /** un'icona SVG (di `I`), o un emoji/carattere */
  icona: ReactNode
  nome: string
  su?: boolean
  onClick?: () => void
  /** il nome lungo e la spiegazione: compare al passaggio del mouse */
  titolo?: string
  disabilitata?: boolean
  /** il puntino ambra: file da scaricare */
  daScaricare?: boolean
  /** la pallina luminosa con il numero di scelte attive */
  pallina?: number
  /** tessera larga: icona a sinistra, nome e sottotitolo */
  sotto?: string
  /** tessera con anteprima: un gradiente di fondo (il fallback delle immagini che non ci sono ancora) */
  fondo?: string
  uncensored?: boolean
  id?: string
}

export function Tessera(p: PropsTessera): JSX.Element {
  const larga = p.sotto !== undefined
  const classe = ['tessera-o', larga ? 'larga' : '', p.fondo ? 'anteprima' : '', p.su ? 'su' : '', p.daScaricare ? 'da-scaricare' : '', p.uncensored ? 'fiamma' : '', p.disabilitata ? 'spenta' : ''].filter(Boolean).join(' ')
  return (
    <button type="button" className={classe} onClick={p.disabilitata ? undefined : p.onClick} title={p.titolo || p.nome} aria-pressed={p.su} aria-label={p.nome} data-id={p.id}>
      {p.fondo && <span className="fondo" style={{ background: p.fondo }} />}
      <span className="ic">{p.icona}</span>
      {larga ? (
        <span className="testi">
          <span className="nome">{p.nome} {p.uncensored && <Fascetta />}</span>
          <small>{p.sotto}</small>
        </span>
      ) : (
        <span className="nome">{p.nome}</span>
      )}
      {!!p.pallina && <span className="pallina">{p.pallina}</span>}
    </button>
  )
}

/** una griglia di tessere con N colonne */
export function Tessere(p: { colonne?: 2 | 3 | 4 | 5 | 6; children: ReactNode; stile?: CSSProperties }): JSX.Element {
  const c = p.colonne ?? 4
  return (
    <div className={`tessere ${c === 2 ? 'col2' : c === 3 ? 'col3' : c === 5 ? 'col5' : c === 6 ? 'col6' : ''}`} style={p.stile}>
      {p.children}
    </div>
  )
}

/** la fascetta arancio dei modelli senza filtri di rifiuto: riservata a questo scopo */
export function Fascetta(): JSX.Element {
  return (
    <span className="fascetta-uc" title="Scelto da te: nessun filtro di rifiuto">
      <I.fiamma /> Uncensored
    </span>
  )
}

/** un pulsante di misura/quantità: un valore grande e (sotto) i pixel o la nota */
export function PulsanteS(p: { nome: ReactNode; sotto?: ReactNode; su?: boolean; onClick: () => void; titolo?: string }): JSX.Element {
  return (
    <button type="button" className={`pulsante-s ${p.su ? 'su' : ''}`} onClick={p.onClick} title={p.titolo}>
      {p.nome}
      {p.sotto !== undefined && <small>{p.sotto}</small>}
    </button>
  )
}

/** tre pianeti di grandezza crescente: per l'intensità, la fantasia */
export function Pianeti<T extends string | number>(p: { valore: T; voci: { id: T; nome: string; titolo?: string }[]; cambia: (v: T) => void }): JSX.Element {
  return (
    <div>
      <div className="pianeti" role="radiogroup">
        {p.voci.map((v) => (
          <button key={String(v.id)} type="button" role="radio" aria-checked={v.id === p.valore} className={v.id === p.valore ? 'su' : ''} onClick={() => p.cambia(v.id)} title={v.titolo || v.nome}>
            {v.nome.slice(0, 1)}
          </button>
        ))}
      </div>
      <div className="pianeti-et">{p.voci.map((v) => <span key={String(v.id)} style={{ width: 50, textAlign: 'center' }}>{v.nome}</span>)}</div>
    </div>
  )
}

/** l'emoji o il carattere in una tessera: stesso spazio di un'icona */
export const E = (s: string): JSX.Element => <span aria-hidden>{s}</span>
