// La coda dei lavori: avanzamento, tempo che manca, annulla.
import type { JSX } from 'react'
import { usaStato } from '../stato'
import { api, urlFile } from '../api'
import { I } from './Icone'
import { durata, ETICHETTE_MODALITA } from '../util'
import type { Lavoro } from '@shared/tipi'

export function percentuale(l: Lavoro): number | null {
  if (l.stato === 'fatto') return 100
  if (l.stato !== 'in corso') return 0
  if (l.fase === 'Disegno' && l.passiTotali) return Math.round((l.passo / l.passiTotali) * 100)
  return null
}

export function RigaLavoro({ l }: { l: Lavoro }): JSX.Element {
  const p = percentuale(l)
  const mostra = l.anteprima || (l.risultati[0] ? null : null)
  const titolo = l.richiesta.etichetta || l.richiesta.prompt || ETICHETTE_MODALITA[l.richiesta.modalita]
  return (
    <div className={`lavoro ${l.stato === 'in corso' ? 'in-corso' : l.stato}`}>
      <div className="anteprima">
        {mostra ? <img src={mostra} alt="" /> : l.richiesta.immagini[0] ? <img src={urlFile(l.richiesta.immagini[0])} alt="" style={{ opacity: 0.5 }} /> : <I.crea />}
      </div>
      <div className="testo">
        <div className="p" title={titolo}>
          <span className="oro" style={{ fontWeight: 700 }}>{ETICHETTE_MODALITA[l.richiesta.modalita]}</span> · {titolo}
        </div>
        {l.stato === 'in corso' && (
          <div className={`barra-progresso ${p === null ? 'indeterminata' : ''}`}>
            <i style={{ width: `${p ?? 30}%` }} />
          </div>
        )}
        <div className="f">
          <span>{l.stato === 'errore' ? l.errore?.split('\n')[0] : l.fase}</span>
          {l.stato === 'in corso' && l.fase === 'Disegno' && <span>{l.passo}/{l.passiTotali}</span>}
          {l.stato === 'in corso' && l.stima ? <span>~{durata(l.stima)}</span> : null}
          {l.stato === 'fatto' && l.fine && l.inizio && <span>{durata((l.fine - l.inizio) / 1000)}</span>}
        </div>
      </div>
      {(l.stato === 'in coda' || l.stato === 'in corso') && (
        <button className="btn fantasma piccolo icona" title="Annulla" onClick={() => api.lavori.annulla(l.id)}>
          <I.x />
        </button>
      )}
    </div>
  )
}

export function Coda(): JSX.Element | null {
  const { lavori, codaAperta } = usaStato()
  if (!codaAperta) return null
  const attivi = lavori.filter((l) => l.stato === 'in coda' || l.stato === 'in corso')
  const lista = [...lavori].reverse()
  return (
    <div className="coda pannello">
      <header>
        <b>CODA</b>
        <span className="tenue piccolo">{attivi.length ? `${attivi.length} da fare` : 'vuota'}</span>
        <span className="flex1" />
        <button className="btn piccolo fantasma" onClick={() => api.lavori.pulisci()} title="Togli i finiti">Pulisci</button>
        {attivi.length > 0 && <button className="btn piccolo fantasma pericolo" onClick={() => api.lavori.svuota()}>Ferma tutto</button>}
        <button className="btn piccolo fantasma icona" onClick={() => usaStato.setState({ codaAperta: false })}>
          <I.x />
        </button>
      </header>
      <div className="lista">
        {lista.length === 0 && <div className="spento piccolo" style={{ padding: 12 }}>Niente in coda. Puoi accodare più lavori: partono uno dopo l'altro.</div>}
        {lista.map((l) => (
          <RigaLavoro key={l.id} l={l} />
        ))}
      </div>
    </div>
  )
}
