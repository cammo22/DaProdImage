// Le tre viste del Laboratorio: il catalogo delle ricette, la griglia dei risultati di un'esecuzione e il risultato in grande.
import { useEffect, type JSX } from 'react'
import { usaStato } from '../stato'
import { api, urlFile } from '../api'
import { I } from './Icone'
import { ImgAsset } from './Tessere'
import { chiaveRicetta } from '../anteprime'
import { PrimaDopo } from './PrimaDopo'
import { VistaZoom } from './VistaZoom'
import { percentuale } from './Coda'
import { durata } from '../util'
import { apriInModifica, fotoDaOpera } from '../azioni'
import { CATEGORIE_WF, fermaRun, workflowDa, type Run, type Workflow } from '../workflow'
import type { Opera } from '@shared/tipi'

export const icona = (nome: string): JSX.Element => {
  const Ic = (I as Record<string, () => JSX.Element>)[nome] || I.crea
  return <Ic />
}

export function Catalogo(p: { cerca: string; scelto: string | null; scegli: (id: string) => void; elenco: Workflow[] }): JSX.Element {
  const q = p.cerca.trim().toLowerCase()
  return (
    <div className="catalogo-wf">
      {CATEGORIE_WF.map((c) => {
        const voci = p.elenco.filter((w) => w.categoria === c.id && (!q || (w.nome + ' ' + w.descrizione).toLowerCase().includes(q)))
        if (!voci.length) return null
        return (
          <section key={c.id}>
            <h2><span className="ic-wf">{icona(c.icona)}</span> {c.nome} <small>{c.testo}</small></h2>
            <div className="carte-wf">
              {voci.map((w) => (
                <button key={w.id} className={`carta-wf ${p.scelto === w.id || (w.id === 'r-mix' && (p.scelto === 'unisci' || p.scelto === 'esempio')) ? 'su' : ''}`} onClick={() => p.scegli(w.id)}>
                  <ImgAsset chiave={chiaveRicetta(w.id)} className="locandina-wf" />
                  <div className="riga spazia">
                    <span className="ic-wf grande">{icona(w.icona)}</span>
                    <span className="riga" style={{ gap: 6 }}>{w.utente && <span className="distintivo">mia</span>}<span className={`distintivo ${w.modo === 'catena' ? 'forse' : 'si'}`}>{w.modo === 'catena' ? <><I.catena /> catena</> : w.modo === 'speciale' ? <><I.crea /> foto nuova</> : <><I.serie /> serie</>}</span></span>
                  </div>
                  <b>{w.nome}</b>
                  <span>{w.descrizione}</span>
                  <small>{w.modo === 'speciale' ? 'serve qualche foto' : w.foto ? 'serve una foto' : w.rif === 'serve' ? 'serve un logo o disegno' : 'solo testo'}</small>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export function Risultati(p: {
  run: Run
  opere: Record<string, Opera>
  lavori: ReturnType<typeof usaStato.getState>['lavori']
  apri: (i: number) => void
  faiFoglio: () => Promise<void>
  foglio: boolean
  rifai: () => void
}): JSX.Element {
  const { run, opere, lavori } = p
  const fatti = run.passi.filter((x) => x.stato === 'fatto').length
  const attivo = run.passi.some((x) => x.stato === 'attesa' || x.stato === 'in coda') && !run.fermata
  return (
    <div className="risultati-wf">
      <div className="testa-risultati">
        <div className="col" style={{ gap: 2 }}>
          <b style={{ fontSize: 18 }}>{run.nome}</b>
          <span className="piccolo tenue">{fatti} di {run.passi.length} fatte{attivo ? ' · in lavorazione' : ''}</span>
        </div>
        <div className="barra-progresso" style={{ flex: 1, maxWidth: 360 }}><i style={{ width: `${(fatti / run.passi.length) * 100}%` }} /></div>
        <span className="flex1" />
        {attivo && <button className="btn piccolo pericolo" onClick={() => void fermaRun(run.id)}><I.stop /> Ferma</button>}
        <button className="btn piccolo" onClick={p.rifai} title="Rifà tutta la serie con altri seed"><I.ricicla /> Rifai</button>
        <button className="btn piccolo primario" disabled={fatti < 1 || p.foglio} onClick={() => void p.faiFoglio()} title="Tutte le immagini in un foglio solo, da condividere (entra in Galleria)"><I.serie /> {p.foglio ? 'Compongo…' : 'Crea il foglio'}</button>
        <button className="btn piccolo" onClick={() => api.galleria.apriCartella()}><I.cartella /></button>
      </div>
      <div className="griglia-wf">
        {run.base && (
          <div className="scheda-wf originale">
            <img src={urlFile(run.base.percorso)} alt="" />
            <span className="et">ORIGINALE</span>
          </div>
        )}
        {run.passi.map((x, i) => {
          const l = lavori.find((v) => v.id === x.lavoroId)
          const o = x.operaId ? opere[x.operaId] : undefined
          const pc = l ? percentuale(l) : null
          return (
            <div key={i} role="button" className={`scheda-wf ${x.stato === 'in coda' ? 'incoda' : x.stato}`} onClick={() => x.stato === 'fatto' && o && p.apri(i)}>
              {o ? <img src={urlFile(o.miniatura || o.file)} alt="" /> : l?.anteprima ? <img src={l.anteprima} alt="" /> : <div className="attesa-wf" />}
              <span className="et">{x.etichetta}</span>
              {x.stato === 'fatto' && <span className="ok-wf">✓</span>}
              {l?.stato === 'in corso' && <span className="stato-wf">{pc !== null ? `${pc}%` : l.fase}</span>}
              {x.stato === 'in coda' && l?.stato !== 'in corso' && <span className="stato-wf">in coda</span>}
              {x.stato === 'in coda' && x.lavoroId && (
                <button className="x-wf" title="Salta questa" onClick={(e) => { e.stopPropagation(); void api.lavori.annulla(x.lavoroId!) }}><I.x /></button>
              )}
              {x.stato === 'attesa' && <span className="stato-wf">dopo</span>}
              {x.stato === 'annullato' && <span className="stato-wf">annullato</span>}
              {x.stato === 'errore' && <span className="stato-wf errore" title={x.errore}>errore</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** un risultato in grande: prima/dopo con la linea (o zoom, se non c'era una foto), con i passi avanti e indietro */
export function Dettaglio(p: { run: Run; opere: Record<string, Opera>; i: number; cambia: (i: number) => void; chiudi: () => void }): JSX.Element | null {
  const { run } = p
  const fatti = run.passi.map((x, i) => ({ x, i })).filter(({ x }) => x.stato === 'fatto' && x.operaId && p.opere[x.operaId])
  const pos = fatti.findIndex((f) => f.i === p.i)
  const x = run.passi[p.i]
  const o = x?.operaId ? p.opere[x.operaId] : undefined
  const vai = (d: number): void => {
    const n = fatti[pos + d]
    if (n) p.cambia(n.i)
  }
  useEffect(() => {
    const t = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') p.chiudi()
      else if (e.key === 'ArrowLeft') vai(-1)
      else if (e.key === 'ArrowRight') vai(1)
    }
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  })
  if (!o) return null
  // in una catena il "prima" è il passo precedente, in una serie la foto di partenza
  const wf = workflowDa(run.wfId)
  const prima = wf?.modo === 'catena' && p.i > 0 ? p.opere[run.passi[p.i - 1].operaId || ''] : undefined
  const primaUrl = prima ? urlFile(prima.file) : run.base ? urlFile(run.base.percorso) : null
  return (
    <div className="visore" style={{ gridTemplateColumns: '1fr 320px' }} onClick={(e) => e.target === e.currentTarget && p.chiudi()}>
      <div className="immagine" onClick={(e) => e.target === e.currentTarget && p.chiudi()} style={{ padding: 24 }}>
        {primaUrl ? <PrimaDopo prima={primaUrl} dopo={urlFile(o.file)} stile={{ maxHeight: 'calc(100vh - 110px)' }} /> : <VistaZoom src={urlFile(o.file)} onFuori={p.chiudi} />}
        {pos > 0 && <button className="freccia sx" onClick={() => vai(-1)}>‹</button>}
        {pos < fatti.length - 1 && <button className="freccia dx" onClick={() => vai(1)}>›</button>}
      </div>
      <div className="info">
        <div className="riga spazia sezione">
          <b className="oro" style={{ fontFamily: 'var(--titolo)', letterSpacing: 1.5, fontSize: 13 }}>{x.etichetta.toUpperCase()}</b>
          <button className="btn fantasma piccolo icona" onClick={p.chiudi} title="Chiudi (Esc)"><I.x /></button>
        </div>
        <div className="scorri">
          <div className="sezione col">
            <div className="piccolo tenue">{run.nome} · {pos + 1} di {fatti.length}</div>
            {o.promptInglese && <div className="piccolo spento" style={{ userSelect: 'text' }}>{o.promptInglese}</div>}
            <div className="riga a-capo">
              <button className="btn" onClick={() => { apriInModifica(fotoDaOpera(o)); p.chiudi() }}><I.modifica /> Modifica</button>
              <button className="btn" onClick={() => api.galleria.copia(o.id)}><I.copia /> Copia</button>
              <button className="btn" onClick={() => api.galleria.mostra(o.id)}><I.cartella /> Mostra</button>
            </div>
            <dl className="dati">
              <dt>Dimensioni</dt><dd>{o.larghezza} × {o.altezza}</dd>
              <dt>Seed</dt><dd>{o.seed}</dd>
              <dt>Tempo</dt><dd>{durata(o.durata)}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
