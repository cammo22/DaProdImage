// Gli stili nuovi come scaffali di tessere + l'intensità a tre pianeti. Si usano in Crea (si aggiungono al prompt) e in Modifica (trasformano la foto).
import type { JSX } from 'react'
import { INTENSITA, SCAFFALI, STILI, type Intensita } from '../stili'
import { Pianeti, Tessera } from './Tessere'

export function ScaffaliStili(p: { valore: string; scegli: (id: string) => void }): JSX.Element {
  return (
    <div>
      {SCAFFALI.map((sc) => (
        <div key={sc.id}>
          <div className="titolo-scaffale">{sc.nome}</div>
          <div className="scaffale">
            {STILI.filter((s) => s.scaffale === sc.id).map((s) => (
              <Tessera key={s.id} id={`stile-${s.id}`} icona={<span aria-hidden>{s.icona}</span>} nome={s.nome} fondo={s.fondo} titolo={`${s.nome}: ${s.frammento}`} su={p.valore === s.id} onClick={() => p.scegli(p.valore === s.id ? '' : s.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function IntensitaStile(p: { valore: Intensita; cambia: (i: Intensita) => void }): JSX.Element {
  return (
    <div style={{ marginTop: 6 }}>
      <Pianeti valore={p.valore} cambia={p.cambia} voci={INTENSITA.map((i) => ({ id: i.id, nome: i.nome, titolo: i.titolo }))} />
    </div>
  )
}
