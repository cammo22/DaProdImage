// La coda dei lavori: avanzamento, tempo che manca, annulla.
import { useEffect, useMemo, useState, type JSX } from 'react'
import { usaStato } from '../stato'
import { VistaZoom } from './VistaZoom'
import { apriInModifica, fotoDaOpera } from '../azioni'
import { api, urlFile } from '../api'
import { I } from './Icone'
import { durata, ETICHETTE_MODALITA } from '../util'
import type { Lavoro, Opera } from '@shared/tipi'

export function percentuale(l: Lavoro): number | null {
  if (l.stato === 'fatto') return 100
  if (l.stato !== 'in corso') return 0
  if (l.fase === 'Disegno' && l.passiTotali) return Math.round((l.passo / l.passiTotali) * 100)
  return null
}

export function RigaLavoro({ l }: { l: Lavoro }): JSX.Element {
  const p = percentuale(l)
  const mostra = l.anteprima || (l.risultati[0] ? null : null)
  const titolo = l.richiesta.etichetta || l.richiesta.prompt || (ETICHETTE_MODALITA[l.richiesta.modalita] ?? l.richiesta.modalita)
  return (
    <div className={`lavoro ${l.stato === 'in corso' ? 'in-corso' : l.stato}`}>
      <div className="anteprima">
        {mostra ? <img src={mostra} alt="" /> : l.richiesta.immagini[0] ? <img src={urlFile(l.richiesta.immagini[0])} alt="" style={{ opacity: 0.5 }} /> : <I.crea />}
      </div>
      <div className="testo">
        <div className="p" title={titolo}>
          <span className="oro" style={{ fontWeight: 700 }}>{(ETICHETTE_MODALITA[l.richiesta.modalita] ?? l.richiesta.modalita)}</span> · {titolo}
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

const ORDINE: Record<string, number> = { 'in corso': 0, 'in coda': 1, errore: 2, fatto: 3, annullato: 4 }

/** il menu della coda: una tessera per ogni foto che si sta facendo (anteprima dal vivo), quelle che aspettano e quelle finite */
export function Coda(): JSX.Element | null {
  const { lavori, codaAperta } = usaStato()
  const [opere, setOpere] = useState<Record<string, Opera>>({})
  const [aperto, setAperto] = useState<string | null>(null)
  const [vedi, setVedi] = useState<'tutte' | 'attive'>('tutte')

  // le foto finite: si prende la miniatura dalla galleria
  useEffect(() => {
    const ids = lavori.map((l) => l.risultati[0]).filter((x): x is string => !!x && !opere[x])
    if (!ids.length) return
    void Promise.all(ids.map((id) => api.galleria.opera(id))).then((l) => {
      setOpere((o) => {
        const n = { ...o }
        l.forEach((x) => x && (n[x.id] = x))
        return n
      })
    })
  }, [lavori])

  const lista = useMemo(() => {
    const ordinati = [...lavori].reverse().sort((a, b) => ORDINE[a.stato] - ORDINE[b.stato])
    // quelle che aspettano nell'ordine in cui partiranno
    const attesa = lavori.filter((l) => l.stato === 'in coda')
    return [...ordinati.filter((l) => l.stato === 'in corso'), ...attesa, ...ordinati.filter((l) => l.stato !== 'in corso' && l.stato !== 'in coda')]
  }, [lavori])

  if (!codaAperta) return null
  const attivi = lavori.filter((l) => l.stato === 'in coda' || l.stato === 'in corso')
  const mostrate = vedi === 'attive' ? lista.filter((l) => l.stato === 'in coda' || l.stato === 'in corso') : lista
  const grande = lavori.find((l) => l.id === aperto)

  return (
    <>
      <div className="coda coda-menu pannello">
        <header>
          <b>CODA</b>
          <span className="tenue piccolo">{attivi.length ? `${attivi.length} da fare` : 'vuota'} · {lavori.length} in tutto</span>
          <span className="flex1" />
          <div className="mini-segmenti">
            <button className={vedi === 'tutte' ? 'su' : ''} onClick={() => setVedi('tutte')}>Tutte</button>
            <button className={vedi === 'attive' ? 'su' : ''} onClick={() => setVedi('attive')}>Da fare</button>
          </div>
          <button className="btn piccolo fantasma" onClick={() => api.lavori.pulisci()} title="Togli i finiti">Pulisci</button>
          {attivi.length > 0 && <button className="btn piccolo fantasma pericolo" onClick={() => api.lavori.svuota()}>Ferma tutto</button>}
          <button className="btn piccolo fantasma icona" onClick={() => usaStato.setState({ codaAperta: false })}>
            <I.x />
          </button>
        </header>
        <div className="lista">
          {mostrate.length === 0 && <div className="spento piccolo" style={{ padding: 12 }}>Niente in coda. Puoi accodare più lavori: partono uno dopo l'altro.</div>}
          <div className="tessere-coda">
            {mostrate.map((l) => (
              <TesseraLavoro key={l.id} l={l} opera={l.risultati[0] ? opere[l.risultati[0]] : undefined} apri={() => setAperto(l.id)} />
            ))}
          </div>
        </div>
      </div>
      {grande && <Grande l={grande} opera={grande.risultati[0] ? opere[grande.risultati[0]] : undefined} chiudi={() => setAperto(null)} />}
    </>
  )
}

function TesseraLavoro({ l, opera, apri }: { l: Lavoro; opera?: Opera; apri: () => void }): JSX.Element {
  const p = percentuale(l)
  const titolo = l.richiesta.etichetta || l.richiesta.prompt || (ETICHETTE_MODALITA[l.richiesta.modalita] ?? l.richiesta.modalita)
  const attivo = l.stato === 'in coda' || l.stato === 'in corso'
  const src = opera ? urlFile(opera.miniatura || opera.file) : l.anteprima || (l.richiesta.immagini[0] ? urlFile(l.richiesta.immagini[0]) : '')
  return (
    <div role="button" tabIndex={0} className={`tessera-coda ${l.stato === 'in corso' ? 'in-corso' : l.stato === 'in coda' ? 'aspetta' : l.stato}`} onClick={apri} onKeyDown={(e) => e.key === 'Enter' && apri()} title={titolo}>
      <div className="img">
        {src ? <img src={src} alt="" style={!opera && !l.anteprima ? { opacity: 0.45 } : undefined} /> : <I.crea />}
        <span className="stato">
          {l.stato === 'in corso' ? (p !== null ? `${p}%` : l.fase) : l.stato === 'in coda' ? 'in coda' : l.stato === 'fatto' ? '✓' : l.stato === 'errore' ? 'errore' : 'annullato'}
        </span>
        {attivo && (
          <button
            className="x"
            title="Annulla questa"
            onClick={(e) => {
              e.stopPropagation()
              void api.lavori.annulla(l.id)
            }}
          >
            <I.x />
          </button>
        )}
        {l.stato === 'in corso' && <div className="barra-progresso"><i style={{ width: `${p ?? 30}%` }} /></div>}
      </div>
      <div className="did">
        <span className="t">{titolo}</span>
        <span className="f">
          {l.stato === 'errore' ? l.errore?.split('\n')[0] : l.stato === 'in corso' ? (l.fase === 'Disegno' && l.passiTotali ? `passo ${l.passo}/${l.passiTotali}${l.stima ? ` · ~${durata(l.stima)}` : ''}` : l.fase) : l.stato === 'fatto' && l.fine && l.inizio ? durata((l.fine - l.inizio) / 1000) : (ETICHETTE_MODALITA[l.richiesta.modalita] ?? l.richiesta.modalita)}
        </span>
      </div>
    </div>
  )
}

/** la foto in grande: dal vivo se sta nascendo, il risultato se è finita */
function Grande({ l, opera, chiudi }: { l: Lavoro; opera?: Opera; chiudi: () => void }): JSX.Element {
  useEffect(() => {
    const t = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') chiudi()
    }
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  }, [])
  const src = opera ? urlFile(opera.file) : l.anteprima || (l.richiesta.immagini[0] ? urlFile(l.richiesta.immagini[0]) : '')
  const titolo = l.richiesta.etichetta || l.richiesta.prompt || (ETICHETTE_MODALITA[l.richiesta.modalita] ?? l.richiesta.modalita)
  return (
    <div className="visore coda-grande" style={{ gridTemplateColumns: '1fr 320px' }} onClick={(e) => e.target === e.currentTarget && chiudi()}>
      <div className="immagine" onClick={(e) => e.target === e.currentTarget && chiudi()}>
        {src ? <VistaZoom src={src} onFuori={chiudi} /> : <div className="spento" style={{ padding: 40 }}>Non c'è ancora niente da vedere: parte fra poco.</div>}
      </div>
      <div className="info">
        <div className="riga spazia sezione">
          <b className="oro" style={{ fontFamily: 'var(--titolo)', letterSpacing: 1.5, fontSize: 13 }}>{(ETICHETTE_MODALITA[l.richiesta.modalita] ?? l.richiesta.modalita).toUpperCase()}</b>
          <button className="btn fantasma piccolo icona" onClick={chiudi} title="Chiudi (Esc)"><I.x /></button>
        </div>
        <div className="scorri">
          <div className="sezione col">
            <div style={{ userSelect: 'text' }}>{titolo}</div>
            {l.promptInglese && <div className="piccolo spento" style={{ userSelect: 'text' }}>→ {l.promptInglese}</div>}
            <RigaLavoro l={l} />
            {opera && (
              <div className="riga a-capo">
                <button className="btn" onClick={() => { apriInModifica(fotoDaOpera(opera)); chiudi(); usaStato.setState({ codaAperta: false }) }}><I.modifica /> Modifica</button>
                <button className="btn" onClick={() => api.galleria.mostra(opera.id)}><I.cartella /> Mostra</button>
              </div>
            )}
            <dl className="dati">
              <dt>Stato</dt><dd>{l.stato}</dd>
              {opera && <><dt>Dimensioni</dt><dd>{opera.larghezza} × {opera.altezza}</dd><dt>Seed</dt><dd>{opera.seed}</dd></>}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
