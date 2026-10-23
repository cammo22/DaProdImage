// I pezzi grafici dei controlli di Modifica (catalogo in controlli.ts): cursori con le icone agli estremi, griglie a icona,
// campioni colore, il quadrante 3×3 e le righe di testo. Il valore sta nell'id dell'idea attiva: qui non c'è stato proprio.
import { useEffect, useState, type JSX } from 'react'
import { Tessera, Tessere } from './Tessere'
import { conControllo, controlliDi, leggiMulti, scriviMulti, valoreDa, type Controllo, type Parte } from '../controlli'
import type { Rapida } from '../rapide'

type Props = { categoria: string; idee: Rapida[]; setIdee: (i: Rapida[]) => void }

export function ControlliCategoria({ categoria, idee, setIdee }: Props): JSX.Element | null {
  const lista = controlliDi(categoria)
  if (!lista.length) return null
  const metti = (c: Controllo, valore: string): void => setIdee(conControllo(idee, c, valore) as Rapida[])
  return (
    <div className="controlli-cat">
      {lista.map((c) => (
        <div key={c.id} className="ctl" data-controllo={c.id}>
          <div className="ctl-testa" title={c.tooltip}><span aria-hidden>{c.icona}</span> <b>{c.nome}</b></div>
          {c.tipo === 'cursore' ? <Cursore c={c} valore={Number(valoreDa(c, idee))} cambia={(v) => metti(c, String(v))} /> : <Multi c={c} valore={leggiMulti(valoreDa(c, idee))} cambia={(v) => metti(c, scriviMulti(v))} />}
        </div>
      ))}
    </div>
  )
}

function Cursore(p: { c: Extract<Controllo, { tipo: 'cursore' }>; valore: number; cambia: (v: number) => void }): JSX.Element {
  const { c } = p
  const et = c.etichette?.[p.valore - c.min] ?? (p.valore === c.neutro ? '—' : p.valore > 0 && c.min < 0 ? `+${p.valore}` : String(p.valore))
  return (
    <div className="ctl-cursore">
      <span className="estremo" aria-hidden>{c.estremi[0]}</span>
      <input type="range" min={c.min} max={c.max} step={1} value={p.valore} aria-label={c.nome} onChange={(e) => p.cambia(Number(e.target.value))} onDoubleClick={() => p.cambia(c.neutro)} />
      <span className="estremo" aria-hidden>{c.estremi[1]}</span>
      <span className={`valore ${p.valore === c.neutro ? 'spento' : 'oro'}`}>{c.etichette ? c.etichette[p.valore - c.min] : et}</span>
    </div>
  )
}

function Multi(props: { c: Extract<Controllo, { tipo: 'multi' }>; valore: Record<string, string>; cambia: (v: Record<string, string>) => void }): JSX.Element {
  // Una scelta incompleta (colore prima del capo, posizione prima del testo) non è ancora un'idea,
  // ma non deve sparire. La bozza vive qui; solo le istruzioni complete entrano nel lavoro.
  const esterno = scriviMulti(props.valore)
  const [bozza, setBozza] = useState(props.valore)
  useEffect(() => { setBozza(leggiMulti(esterno)) }, [esterno])
  const p = { ...props, valore: bozza, cambia: (v: Record<string, string>): void => { setBozza(v); props.cambia(v) } }
  const imposta = (parte: string, v: string): void => p.cambia({ ...p.valore, [parte]: p.valore[parte] === v ? '' : v })
  return (
    <div className="col" style={{ gap: 6 }}>
      {p.c.parti.map((x: Parte) => {
        if (x.tipo === 'testo') {
          return <input key={x.id} type="text" value={p.valore[x.id] ?? ''} placeholder={x.esempio} aria-label={x.nome} onChange={(e) => p.cambia({ ...p.valore, [x.id]: e.target.value })} />
        }
        if (x.tipo === 'colori') {
          return (
            <div key={x.id} className="campioni" role="group" aria-label={x.nome}>
              {x.opzioni.map((o) => <button key={o.id} type="button" className={`campione ${p.valore[x.id] === o.id ? 'su' : ''}`} style={{ background: o.icona }} title={o.nome} aria-label={o.nome} aria-pressed={p.valore[x.id] === o.id} onClick={() => imposta(x.id, o.id)} />)}
            </div>
          )
        }
        if (x.tipo === 'quadrante') {
          // 3×3: le direzioni/posizioni stanno attorno; se sono 8 il centro è il soggetto
          const celle = x.opzioni.length === 8 ? [...x.opzioni.slice(0, 4), null, ...x.opzioni.slice(4)] : x.opzioni
          return (
            <div key={x.id} className="quadrante" role="group" aria-label={x.nome}>
              {celle.map((o, i) => o
                ? <button key={o.id} type="button" className={`cella ${p.valore[x.id] === o.id ? 'su' : ''}`} title={o.nome} aria-label={o.nome} aria-pressed={p.valore[x.id] === o.id} onClick={() => imposta(x.id, o.id)}>{o.icona}</button>
                : <span key={`c${i}`} className="cella soggetto" aria-hidden>●</span>)}
            </div>
          )
        }
        return (
          <Tessere key={x.id} colonne={x.opzioni.length <= 2 ? 2 : x.opzioni.length <= 4 ? 4 : 5}>
            {x.opzioni.map((o) => <Tessera key={o.id} id={`ctl-${p.c.id}-${o.id}`} icona={<span aria-hidden>{o.icona}</span>} nome={o.nome} su={p.valore[x.id] === o.id} titolo={`${o.nome} · un clic la accende, un altro la spegne`} onClick={() => imposta(x.id, o.id)} />)}
          </Tessere>
        )
      })}
    </div>
  )
}
