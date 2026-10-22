// Laboratorio Uncensored: gate esplicito e catalogo solo da metadati approvati.
import { useState, type JSX } from 'react'
import type { Download, Impostazioni, StatoVoce } from '@shared/tipi'
import { Interruttore } from './Controlli'
import { byte } from '../util'
import { api } from '../api'

export type VoceLaboratorio = StatoVoce & { uncensored?: boolean; licenza?: string; licenzaUrl?: string; ruolo?: string; avviso?: string }
export const VERSIONE_DISCLAIMER = 1
export const DISCLAIMER = 'Questi componenti possono produrre contenuti sensibili o inesatti. Usali solo per scopi leciti, con i diritti e il consenso necessari. Non sono ammessi contenuti sessuali che coinvolgono minori, immagini intime non consensuali, deepfake ingannevoli o altri usi illegali. Uncensored non significa senza regole: valgono le leggi e le licenze di ogni modello, anche i divieti di uso commerciale. Sei responsabile di ciò che crei e pubblichi.'

export function LaboratorioUncensored(p: { imp: Impostazioni; catalogo: VoceLaboratorio[]; download: Record<string, Download>; salva: (m: Partial<Impostazioni>) => Promise<void>; scarica: (v: StatoVoce) => Promise<void> }): JSX.Element {
  const [disclaimer, setDisclaimer] = useState(false)
  const [consensi, setConsensi] = useState([false, false, false])
  const [occupato, setOccupato] = useState(false)
  const [errore, setErrore] = useState('')
  const acceso = p.imp.uncensored?.abilitato === true && p.imp.uncensored.versioneDisclaimer === VERSIONE_DISCLAIMER && !!p.imp.uncensored.accettatoIl
  const salva = async (abilitato: boolean): Promise<void> => {
    setOccupato(true)
    setErrore('')
    try {
      await p.salva({ uncensored: abilitato ? { abilitato: true, accettatoIl: Date.now(), versioneDisclaimer: VERSIONE_DISCLAIMER } : { ...p.imp.uncensored, abilitato: false } })
      setDisclaimer(false)
    } catch (e) { setErrore((e as Error).message) }
    finally { setOccupato(false) }
  }
  return <section className="gruppo" aria-label="Laboratorio Uncensored">
    <h2>LABORATORIO UNCENSORED</h2>
    <div className="pannello col" style={{ padding: 16 }}>
      <Interruttore acceso={acceso} cambia={(v) => { if (occupato) return; if (v) { setConsensi([false, false, false]); setDisclaimer(true) } else void salva(false) }}>Modelli uncensored</Interruttore>
      <p className="piccolo tenue">Spenti di serie. Nessun download e nessun cambio del modello automatico. Le licenze e il consenso delle persone restano necessari.</p>
      {errore && <div role="alert">{errore}</div>}
      {disclaimer && <div role="dialog" aria-modal="true" aria-labelledby="titolo-disclaimer" className="pannello col" style={{ padding: 16 }}>
        <h3 id="titolo-disclaimer">Prima di continuare</h3><p>{DISCLAIMER}</p>
        {['Ho almeno 18 anni', 'Userò questi modelli solo per scopi leciti e nel rispetto delle licenze', 'Capisco che chi crea i contenuti ne è responsabile'].map((t, i) => <label key={t} className="riga"><input type="checkbox" checked={consensi[i]} onChange={(e) => setConsensi(consensi.map((v, j) => j === i ? e.target.checked : v))} />{t}</label>)}
        <div className="riga"><button className="btn" disabled={occupato} onClick={() => setDisclaimer(false)}>Annulla</button><button className="btn primario" disabled={occupato || !consensi.every(Boolean)} onClick={() => void salva(true)}>Attiva</button></div>
      </div>}
      {acceso && <>
        {!p.catalogo.some((v) => v.uncensored) && <p className="tenue">Nessun componente Uncensored approvato disponibile nel catalogo di questa versione.</p>}
        {p.catalogo.filter((v) => v.uncensored).map((v) => {
          const d = p.download[v.nome]
          const inCorso = d && (d.stato === 'in corso' || d.stato === 'verifica')
          return <div className="modello" key={v.id}>
            <div><b>{v.nome}</b> <span className="distintivo" style={{ color: '#ffb370' }}>Uncensored</span><div className="piccolo tenue">{v.ruolo || v.tipo} · {byte(v.byte)} · {v.licenza || 'Licenza da verificare'}</div></div>
            <div className="riga">{v.licenzaUrl && <button className="btn piccolo" onClick={() => void api.app.apriLink(v.licenzaUrl!)}>Licenza</button>}{v.presente ? <span className="distintivo si">Presente</span> : <button className="btn piccolo" disabled={!!inCorso || !v.licenza} onClick={() => {
              if (v.avviso && !confirm(v.avviso)) return
              if (/research|non.commercial|by.nc/i.test(v.licenza || '') && !confirm('Questo modello limita l’uso commerciale. Leggi la licenza prima di scaricare. Confermi di rispettarla?')) return
              void p.scarica(v)
            }}>{inCorso ? `${d.totali ? Math.round(d.ricevuti / d.totali * 100) : 0}%` : 'Scarica'}</button>}</div>
            <small>{v.avviso || v.descrizione}</small>
          </div>
        })}
        <p className="piccolo tenue">FLUX / Klein 3 Uncensored: non disponibile. Non distribuiamo varianti che aggirano protezioni vietate dalla licenza Kommunity.</p>
      </>}
    </div>
  </section>
}
