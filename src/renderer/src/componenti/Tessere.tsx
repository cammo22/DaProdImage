// I pezzi base della GUI v2 «Orbita»: la tessera (icona grande + una parola), la griglia, la fascetta Uncensored e i pulsanti di misura.
// Regola d'oro: una tessera ha un'icona e una parola; il nome lungo sta nel tooltip (`titolo`). Niente chip di testo sotto le tessere.
import { useState, type CSSProperties, type JSX, type ReactNode } from 'react'
import { urlAsset } from '../asset'
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
  /** l'immagine di resources/gui («gruppo/id», vedi anteprime.ts): al posto dell'icona, o a tutta tessera con `pieno`. Se il file manca o non si carica resta l'icona di prima */
  asset?: string
  /** l'immagine riempie la tessera (anteprime degli stili) invece di fare da icona */
  pieno?: boolean
}

/** l'immagine di un asset, o niente se il file non c'è o non si carica (il chiamante ripiega sull'icona) */
export function ImgAsset(p: { chiave: string | undefined; className?: string; stile?: CSSProperties; ripiego?: ReactNode }): JSX.Element | null {
  const url = urlAsset(p.chiave)
  const [rotto, setRotto] = useState<string | null>(null)
  if (!url || rotto === url) return <>{p.ripiego ?? null}</>
  return <img src={url} alt="" aria-hidden draggable={false} className={p.className} style={p.stile} onError={() => setRotto(url)} />
}

export function Tessera(p: PropsTessera): JSX.Element {
  const larga = p.sotto !== undefined
  const url = urlAsset(p.asset)
  const [rotto, setRotto] = useState<string | null>(null)
  const img = url && rotto !== url ? url : undefined
  const pieno = !!img && !!p.pieno && !larga
  const classe = ['tessera-o', larga ? 'larga' : '', p.fondo || pieno ? 'anteprima' : '', pieno ? 'foto' : '', img && !pieno ? 'con-img' : '', p.su ? 'su' : '', p.daScaricare ? 'da-scaricare' : '', p.uncensored ? 'fiamma' : '', p.disabilitata ? 'spenta' : ''].filter(Boolean).join(' ')
  const immagine = img ? <img src={img} alt="" aria-hidden draggable={false} className={pieno ? 'pieno' : 'ic-img'} onError={() => setRotto(img)} /> : null
  return (
    <button type="button" className={classe} disabled={p.disabilitata} onClick={p.onClick} title={p.titolo || p.nome} aria-pressed={p.su} aria-label={p.nome} data-id={p.id}>
      {p.fondo && <span className="fondo" style={{ background: p.fondo }} />}
      {pieno && immagine}
      {!pieno && <span className="ic">{immagine || p.icona}</span>}
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
          <button key={String(v.id)} type="button" role="radio" aria-label={v.nome} aria-checked={v.id === p.valore} className={v.id === p.valore ? 'su' : ''} onClick={() => p.cambia(v.id)} title={v.titolo || v.nome}>
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
