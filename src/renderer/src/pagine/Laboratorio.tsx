// Laboratorio: workflow già pronti, per tutto. Scegli una ricetta, dai la foto (o il testo), premi Avvia:
// il motore fa tutti i passi uno dopo l'altro e qui trovi la griglia dei risultati, con il prima/dopo e il foglio unico.
import { useEffect, useMemo, useState, type JSX } from 'react'
import { usaStato, scegliFoto, type FotoBase, type Qualita } from '../stato'
import { api, urlFile } from '../api'
import { I } from '../componenti/Icone'
import { Segmenti } from '../componenti/Controlli'
import { Riferimenti } from '../componenti/Riferimenti'
import { SceltaMisura, MISURA0, type Misura } from '../componenti/Misura'
import { AvvisoLora } from '../componenti/AvvisoLora'
import { AvvisoTurbo, useTurbo } from '../componenti/Turbo'
import { PrimaDopo } from '../componenti/PrimaDopo'
import { VistaZoom } from '../componenti/VistaZoom'
import { percentuale } from '../componenti/Coda'
import { daDataUrl, durata, immagineDaIncolla, normalizza, stimaSecondi } from '../util'
import { apriInModifica, fotoDaOpera, perQualita } from '../azioni'
import { CATEGORIE_WF, WORKFLOW, avviaWorkflow, creaFoglio, fermaRun, manca, passiDi, usaLab, valoriIniziali, workflowDa, type Run, type Workflow } from '../workflow'
import type { Opera } from '@shared/tipi'

const icona = (nome: string): JSX.Element => {
  const Ic = (I as Record<string, () => JSX.Element>)[nome] || I.crea
  return <Ic />
}

/** i LoRA che i passi di questo workflow possono usare (per proporli) */
function loraUsati(w: Workflow, v: Record<string, string>, nRif: number): Set<string> {
  const k = new Set<string>()
  for (const p of w.passi({ v, nRif: Math.max(1, nRif), camera: true })) for (const x of p.lora || []) k.add(x)
  return k
}
const ID_LORA: Record<string, string> = { coerenza: 'lora-coerenza', vestiti: 'lora-vestiti', camera: 'lora-camera' }
const PERCHE: Record<string, string> = {
  coerenza: 'Le modifiche restano sul fotogramma: luce, colori e stili cambiano, i contorni no.',
  vestiti: 'Tiene volto, pose e sfondo mentre cambia il vestito.',
  camera: 'Rifà la foto da un\'altra posizione della camera, molto più fedele.'
}

export function Laboratorio(): JSX.Element {
  const { imp, lavori, avvisa } = usaStato()
  const { runs, attiva, vista, scelto } = usaLab()
  const turbo = useTurbo()
  const [foto, setFoto] = useState<FotoBase | null>(null)
  const [rif, setRif] = useState<FotoBase[]>([])
  const [valori, setValori] = useState<Record<string, string>>({})
  const [qualita, setQualita] = useState<Qualita>('alta')
  const [mp, setMp] = useState(1)
  const [misura, setMisura] = useState<Misura>(MISURA0)
  // i passi che non voglio fare (per etichetta)
  const [esclusi, setEsclusi] = useState<string[]>([])
  const [cerca, setCerca] = useState('')
  const [aperto, setAperto] = useState<{ run: string; i: number } | null>(null)
  const [opere, setOpere] = useState<Record<string, Opera>>({})
  const [foglio, setFoglio] = useState(false)

  const w = scelto ? workflowDa(scelto) : undefined
  const run = runs.find((r) => r.id === attiva)

  // il Turbo, se c'è, è il modo giusto per fare serie di immagini
  useEffect(() => {
    if (turbo.presente) setQualita((q) => (q === 'alta' ? 'turbo' : q))
  }, [turbo.presente])

  const scegli = (id: string): void => {
    const nuovo = workflowDa(id)!
    usaLab.setState({ scelto: id, vista: 'catalogo' })
    setValori(valoriIniziali(nuovo))
    setRif([])
    setEsclusi([])
  }

  // le opere dei risultati (per vedere le immagini finite)
  useEffect(() => {
    const ids = runs.flatMap((r) => r.passi.map((p) => p.operaId)).filter((x): x is string => !!x && !opere[x])
    if (!ids.length) return
    void Promise.all(ids.map((id) => api.galleria.opera(id))).then((l) => {
      setOpere((o) => {
        const n = { ...o }
        l.forEach((x) => x && (n[x.id] = x))
        return n
      })
    })
  }, [runs])

  // incolla una foto: la prima è la foto, le altre i riferimenti
  useEffect(() => {
    const incolla = async (e: ClipboardEvent): Promise<void> => {
      if (usaStato.getState().pagina !== 'laboratorio') return
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
      const d = immagineDaIncolla(e)
      if (!d) return
      e.preventDefault()
      const f = await daDataUrl(await d)
      setFoto((x) => x || f)
    }
    const h = (e: ClipboardEvent): void => void incolla(e)
    window.addEventListener('paste', h)
    return () => window.removeEventListener('paste', h)
  }, [])

  const passi = useMemo(() => (w ? passiDi(w, valori, rif.length) : []), [w, valori, rif.length])
  const scelti = passi.filter((x) => !esclusi.includes(x.etichetta))
  const stima = imp ? stimaSecondi(imp.tempi, mp, perQualita(qualita).passi) * scelti.length : 0
  const problema = w ? manca(w, { foto, rif }) : null
  const lora = w ? [...loraUsati(w, valori, rif.length)] : []

  const parti = async (): Promise<void> => {
    if (!w) return
    if (qualita === 'turbo' && !turbo.presente) {
      avvisa('Per il Turbo scarica prima il suo LoRA, o scegli Alta', 'errore')
      return
    }
    if (!scelti.length) {
      avvisa('Scegli almeno un passo da fare', 'errore')
      return
    }
    await avviaWorkflow(w, { foto, rif, valori, opzioni: { qualita, mp, misura, escludi: esclusi } })
  }

  const scegliLaFoto = async (): Promise<void> => {
    const [f] = await scegliFoto(false)
    if (f) setFoto(f)
  }
  const fotoDaPc = async (p: string): Promise<void> => {
    try {
      setFoto(await normalizza(p))
    } catch (e) {
      avvisa((e as Error).message, 'errore')
    }
  }

  return (
    <div className="pagina">
      <div className="colonna">
        <div className="scorri">
          {!w ? (
            <div className="sezione">
              <h3>Laboratorio</h3>
              <p className="tenue" style={{ margin: '0 0 10px' }}>Ricette già pronte: scegline una a destra, dai la foto (o il testo) e premi Avvia. Il motore fa tutti i passi da solo, uno dopo l'altro, e i risultati restano in Galleria.</p>
              <p className="piccolo spento" style={{ margin: 0 }}>Due tipi: le <b>serie</b> (la stessa foto in tante versioni: pose, stili, luci…) e le <b>catene</b> (ogni passo parte dal risultato del precedente: restauro, il tempo che passa…).</p>
            </div>
          ) : (
            <>
              <div className="sezione">
                <h3>
                  <span className="ic-wf">{icona(w.icona)}</span> {w.nome}
                  <span className="dx"><span className={`distintivo ${w.modo === 'catena' ? 'forse' : 'si'}`}>{w.modo === 'catena' ? 'catena' : 'serie'} × {passi.length}</span></span>
                </h3>
                <p className="tenue" style={{ margin: 0 }}>{w.descrizione}</p>
                {lora.map((k) => <AvvisoLora key={k} id={ID_LORA[k]} perche={`${PERCHE[k]} Si accende da solo qui.`} />)}
              </div>

              {w.foto && (
                <div className="sezione">
                  <h3>La foto</h3>
                  <div
                    className="foto-wf"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const f = e.dataTransfer.files[0]
                      if (f) void fotoDaPc(api.file.percorso(f))
                    }}
                  >
                    {foto ? <img src={urlFile(foto.percorso)} alt="" /> : <div className="vuota"><I.immagine /><span>Trascina una foto qui<br />o incollala con Ctrl+V</span></div>}
                  </div>
                  <div className="riga a-capo" style={{ marginTop: 8 }}>
                    <button className="btn piccolo" onClick={scegliLaFoto}><I.galleria /> Dalla galleria</button>
                    <button className="btn piccolo" onClick={async () => { const [p] = await api.file.scegliImmagini(false); if (p) void fotoDaPc(p) }}><I.immagine /> Dal PC</button>
                    {foto && <button className="btn piccolo fantasma pericolo" onClick={() => setFoto(null)}><I.x /> Togli</button>}
                  </div>
                </div>
              )}

              {w.rif !== 'no' && (
                <div className="sezione">
                  <Riferimenti
                    lista={rif}
                    cambia={setRif}
                    inizio={w.foto ? 2 : 1}
                    inserisci={() => undefined}
                    comeBase={w.foto && foto ? (i) => { const f = rif[i]; setRif(rif.map((r, j) => (j === i ? foto : r))); setFoto(f) } : undefined}
                    esempio={w.rifNome ? `Servono ${w.rifNome}.${w.rif === 'ognuno' ? ' Ognuna fa un passo.' : ''}` : 'Foto di riferimento (facoltative).'}
                  />
                </div>
              )}

              {w.ingressi.length > 0 && (
                <div className="sezione col" style={{ gap: 10 }}>
                  {w.ingressi.map((g) =>
                    g.tipo === 'scelta' ? (
                      <div key={g.id} className="col" style={{ gap: 4 }}>
                        <span className="piccolo tenue">{g.nome}</span>
                        <Segmenti valore={valori[g.id] ?? g.predefinita} cambia={(v) => setValori({ ...valori, [g.id]: v })} voci={g.opzioni.map((o) => ({ id: o.id, nome: o.nome }))} />
                      </div>
                    ) : (
                      <label key={g.id} className="campo-preset">
                        <span>{g.nome}</span>
                        {g.tipo === 'righe' ? (
                          <textarea value={valori[g.id] ?? ''} onChange={(e) => setValori({ ...valori, [g.id]: e.target.value })} style={{ minHeight: 84 }} placeholder={g.esempio} />
                        ) : (
                          <input type="text" value={valori[g.id] ?? ''} onChange={(e) => setValori({ ...valori, [g.id]: e.target.value })} placeholder={g.esempio} />
                        )}
                      </label>
                    )
                  )}
                </div>
              )}

              {passi.length > 1 && (
                <div className="sezione">
                  <h3>
                    Cosa fare <span className="dx">{scelti.length} di {passi.length}</span>
                  </h3>
                  <div className="riga a-capo" style={{ gap: 6, marginBottom: 8 }}>
                    <button className="chip" onClick={() => setEsclusi([])}>Tutte</button>
                    <button className="chip" onClick={() => setEsclusi(passi.map((x) => x.etichetta))}>Nessuna</button>
                    <span className="piccolo spento">Segna solo quelle che ti servono</span>
                  </div>
                  <div className="scelta-passi">
                    {passi.map((x) => {
                      const su = !esclusi.includes(x.etichetta)
                      return (
                        <label key={x.etichetta} className={su ? 'su' : ''} title={x.prompt}>
                          <input type="checkbox" checked={su} onChange={() => setEsclusi(su ? [...esclusi, x.etichetta] : esclusi.filter((e) => e !== x.etichetta))} />
                          <span>{x.etichetta}</span>
                        </label>
                      )
                    })}
                  </div>
                  {w.modo === 'catena' && <div className="piccolo spento" style={{ marginTop: 6 }}>In una catena ogni passo parte dal risultato del precedente: i passi che togli vengono saltati.</div>}
                </div>
              )}

              {passi.some((x) => !x.crea) && (
                <div className="sezione">
                  <h3>Dimensioni <span className="dx">{misura.tipo === 'auto' ? 'come i megapixel' : misura.tipo === 'originale' ? 'come la foto' : 'misura mia'}</span></h3>
                  <SceltaMisura valore={misura} cambia={setMisura} base={foto} mp={mp} />
                </div>
              )}

              <div className="sezione">
                <h3>Qualità <span className="dx">{perQualita(qualita).passi} passi · ~{durata(stima)} in tutto</span></h3>
                <Segmenti<Qualita>
                  valore={qualita}
                  cambia={setQualita}
                  voci={[
                    { id: 'turbo', nome: <><I.fulmine /> Turbo</>, sotto: '8 passi' },
                    { id: 'bozza', nome: 'Veloce', sotto: '20 passi' },
                    { id: 'alta', nome: 'Alta', sotto: '40 passi' }
                  ]}
                />
                {qualita === 'turbo' && <AvvisoTurbo />}
                <div style={{ marginTop: 10 }}>
                  <Segmenti
                    valore={mp}
                    cambia={setMp}
                    voci={[{ id: 0.5, nome: '0,5 MP', sotto: 'prova' }, { id: 1, nome: '1 MP', sotto: 'consigliato' }, { id: 2, nome: '2 MP', sotto: 'dettaglio' }]}
                  />
                </div>
              </div>
            </>
          )}
        </div>
        {w && (
          <div className="sezione" style={{ borderTop: '1px solid #1d1636' }}>
            <button className="btn primario grande" style={{ width: '100%' }} onClick={() => void parti()} disabled={!!problema}>
              <I.gioca /> Avvia · {scelti.length} {scelti.length === 1 ? 'immagine' : 'immagini'}
            </button>
            <div className="piccolo spento" style={{ textAlign: 'center', marginTop: 6 }}>{problema || `~${durata(stima)} · si vedono qui e nella barra in basso`}</div>
          </div>
        )}
      </div>

      <div className="palco palco-lab">
        <div className="schede-lab">
          <button className={vista === 'catalogo' ? 'su' : ''} onClick={() => usaLab.setState({ vista: 'catalogo' })}><I.laboratorio /> Ricette <span className="n">{WORKFLOW.length}</span></button>
          <button className={vista === 'risultati' ? 'su' : ''} onClick={() => usaLab.setState({ vista: 'risultati' })} disabled={!runs.length}>
            <I.serie /> Risultati {runs.length > 0 && <span className="n">{runs.length}</span>}
          </button>
          <span className="flex1" />
          {vista === 'catalogo' && <input type="search" placeholder="Cerca una ricetta…" value={cerca} onChange={(e) => setCerca(e.target.value)} style={{ width: 260 }} />}
          {vista === 'risultati' && runs.length > 1 && (
            <select value={attiva || ''} onChange={(e) => usaLab.setState({ attiva: e.target.value })} style={{ width: 300 }}>
              {runs.map((r) => <option key={r.id} value={r.id}>{r.nome} · {new Date(r.creato).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</option>)}
            </select>
          )}
        </div>

        {vista === 'catalogo' || !run ? (
          <Catalogo cerca={cerca} scelto={scelto} scegli={scegli} />
        ) : (
          <Risultati
            run={run}
            opere={opere}
            lavori={lavori}
            apri={(i) => setAperto({ run: run.id, i })}
            foglio={foglio}
            faiFoglio={async () => {
              setFoglio(true)
              try {
                await creaFoglio(run)
                avvisa('Foglio creato: lo trovi in Galleria', 'ok')
              } catch (e) {
                avvisa((e as Error).message, 'errore')
              } finally {
                setFoglio(false)
              }
            }}
            rifai={() => {
              const wf = workflowDa(run.wfId)
              if (wf) void avviaWorkflow(wf, { foto: run.base, rif: run.rif, valori: run.ctx.v, opzioni: run.opzioni })
            }}
          />
        )}
      </div>

      {aperto && run && <Dettaglio run={run} opere={opere} i={aperto.i} cambia={(i) => setAperto({ run: aperto.run, i })} chiudi={() => setAperto(null)} />}
    </div>
  )
}

function Catalogo(p: { cerca: string; scelto: string | null; scegli: (id: string) => void }): JSX.Element {
  const q = p.cerca.trim().toLowerCase()
  return (
    <div className="catalogo-wf">
      {CATEGORIE_WF.map((c) => {
        const voci = WORKFLOW.filter((w) => w.categoria === c.id && (!q || (w.nome + ' ' + w.descrizione).toLowerCase().includes(q)))
        if (!voci.length) return null
        return (
          <section key={c.id}>
            <h2><span className="ic-wf">{icona(c.icona)}</span> {c.nome} <small>{c.testo}</small></h2>
            <div className="carte-wf">
              {voci.map((w) => (
                <button key={w.id} className={`carta-wf ${p.scelto === w.id ? 'su' : ''}`} onClick={() => p.scegli(w.id)}>
                  <div className="riga spazia">
                    <span className="ic-wf grande">{icona(w.icona)}</span>
                    <span className={`distintivo ${w.modo === 'catena' ? 'forse' : 'si'}`}>{w.modo === 'catena' ? <><I.catena /> catena</> : <><I.serie /> serie</>}</span>
                  </div>
                  <b>{w.nome}</b>
                  <span>{w.descrizione}</span>
                  <small>{w.foto ? 'serve una foto' : w.rif === 'serve' ? 'serve un logo o disegno' : 'solo testo'}</small>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function Risultati(p: {
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
function Dettaglio(p: { run: Run; opere: Record<string, Opera>; i: number; cambia: (i: number) => void; chiudi: () => void }): JSX.Element | null {
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
        {primaUrl ? <PrimaDopo prima={primaUrl} dopo={urlFile(o.file)} stile={{ maxHeight: 'calc(100vh - 110px)' }} /> : <VistaZoom src={urlFile(o.file)} />}
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
