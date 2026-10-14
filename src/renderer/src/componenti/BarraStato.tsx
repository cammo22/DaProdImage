// La barra in basso: sempre lì, dice cosa sta facendo il motore (fase, passi, barra, tempo che manca, prompt in
// inglese), quanti lavori aspettano, e quando non fa niente l'ultimo risultato. Così le foto restano libere.
import { useMemo, type JSX } from 'react'
import { usaStato } from '../stato'
import { api } from '../api'
import { I } from './Icone'
import { percentuale } from './Coda'
import { durata, troppoLenta } from '../util'

export function BarraStato(): JSX.Element {
  const { lavori, motore, vai, codaAperta } = usaStato()
  const corrente = lavori.find((l) => l.stato === 'in corso')
  const inCoda = lavori.filter((l) => l.stato === 'in coda').length
  const ultimo = useMemo(() => [...lavori].reverse().find((l) => l.stato === 'fatto' || l.stato === 'errore'), [lavori])

  if (corrente) {
    const p = percentuale(corrente)
    const q = corrente.richiesta
    const lenta = troppoLenta(corrente.secondiPasso, corrente.megapixel || 1)
    const titolo = q.etichetta || q.prompt || q.modalita
    return (
      <div className="barra-stato attiva">
        <div className="bs-sinistra">
          <span className="bs-giro" />
          <div className="col" style={{ gap: 0 }}>
            <b>{corrente.fase}</b>
            <span className="piccolo tenue">
              {corrente.fase === 'Disegno' && corrente.passiTotali ? `passo ${corrente.passo}/${corrente.passiTotali}` : corrente.indice > 1 ? `immagine ${corrente.indice}` : 'in corso'}
            </span>
          </div>
        </div>
        <div className="bs-centro">
          <div className={`barra-progresso ${p === null ? 'indeterminata' : ''}`}>
            <i style={{ width: `${p ?? 30}%` }} />
          </div>
          <div className="bs-testi">
            <span className="titolo" title={q.prompt}>{titolo}</span>
            {corrente.promptInglese && <span className="inglese" title={corrente.promptInglese}>→ {corrente.promptInglese}</span>}
          </div>
        </div>
        <div className="bs-destra">
          {lenta && (
            <button className="chip lento" onClick={() => vai('impostazioni')} title={`${corrente.secondiPasso} s per passo: molto più del normale. Di solito la VRAM è piena e Windows usa la RAM (Opzioni → Prestazioni).`}>
              <I.tempo /> lento
            </button>
          )}
          <span className="bs-tempo">{p !== null && <b>{p}%</b>}{corrente.stima ? <span> · ~{durata(corrente.stima)}</span> : null}</span>
          {inCoda > 0 && (
            <button className={`chip ${codaAperta ? 'su' : ''}`} onClick={() => usaStato.setState({ codaAperta: !codaAperta })} title="Altri lavori in attesa">+{inCoda} in coda</button>
          )}
          <button className="btn piccolo" onClick={() => api.lavori.annulla(corrente.id)} title="Ferma questo lavoro"><I.x /> Annulla</button>
        </div>
      </div>
    )
  }

  const motoreTesto = { pronto: 'Motore pronto', avvio: 'Avvio del motore…', errore: 'Motore fermo', spento: 'Motore spento', 'non installato': 'Motore da installare' }[motore.stato]
  return (
    <div className="barra-stato">
      <div className="bs-sinistra">
        <span className={`bs-punto ${motore.stato}`} />
        <div className="col" style={{ gap: 0 }}>
          <b>{inCoda > 0 ? `${inCoda} in coda` : 'Pronto'}</b>
          <span className="piccolo tenue">{motoreTesto}</span>
        </div>
      </div>
      <div className="bs-centro">
        {ultimo ? (
          <div className="bs-testi">
            <span className={`titolo ${ultimo.stato === 'errore' ? 'errore' : 'ok'}`} title={ultimo.errore || ultimo.richiesta.prompt}>
              {ultimo.stato === 'errore' ? `✗ ${(ultimo.errore || 'Errore').split('\n')[0]}` : `✓ ${ultimo.richiesta.etichetta || ultimo.richiesta.prompt || 'Fatto'}`}
            </span>
            {ultimo.stato === 'fatto' && ultimo.inizio && ultimo.fine && <span className="inglese">{durata((ultimo.fine - ultimo.inizio) / 1000)}{ultimo.promptInglese ? ` · → ${ultimo.promptInglese}` : ''}</span>}
          </div>
        ) : (
          <div className="bs-testi"><span className="inglese">Qui sotto compare tutto quello che fa il motore: fasi, passi, tempo che manca e il prompt tradotto in inglese.</span></div>
        )}
      </div>
      <div className="bs-destra">
        <button className="btn piccolo fantasma" onClick={() => usaStato.setState({ codaAperta: !codaAperta })} title="La coda dei lavori"><I.coda /> Coda</button>
      </div>
    </div>
  )
}
