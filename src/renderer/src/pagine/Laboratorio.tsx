// Laboratorio: workflow già pronti, per tutto. Scegli una ricetta, dai la foto (o il testo), premi Avvia:
// il motore fa tutti i passi uno dopo l'altro e qui trovi la griglia dei risultati, con il prima/dopo e il foglio unico.
import { useEffect, useMemo, useState, type JSX } from 'react'
import { usaStato, scegliFoto, type FotoBase, type Qualita } from '../stato'
import { api, urlFile } from '../api'
import { I } from '../componenti/Icone'
import { Casella } from '../componenti/Casella'
import { ScegliQualita } from '../componenti/ScegliQualita'
import { Segmenti } from '../componenti/Controlli'
import { Riferimenti } from '../componenti/Riferimenti'
import { SceltaMisura, ScegliMp, MISURA0, type Misura } from '../componenti/Misura'
import { AvvisoLora } from '../componenti/AvvisoLora'
import { AvvisoTurbo, useTurbo } from '../componenti/Turbo'
import { daDataUrl, durata, immagineDaIncolla, normalizza, stimaSecondi } from '../util'
import { perQualita } from '../azioni'
import { CAMERA0, ControlloCamera } from '../componenti/Camera'
import { Omino } from '../componenti/Omino'
import { leggiPosa, posaDi, posaInTesto } from '../omino'
import { fileLoraCamera } from '../azioni'
import { POSA_TUA, VISTA_TUA, leggiCamera, WORKFLOW_BASE, avviaLotto, avviaWorkflow, creaFoglio, elencoWorkflow, inUtente, manca, passiDi, usaLab, valoriIniziali, workflowDa, type Workflow } from '../workflow'
import { usaRicette, type RicettaUtente } from '../ricette'
import { EditorRicetta } from '../componenti/EditorRicetta'
import { Catalogo, Dettaglio, Risultati, icona } from '../componenti/LabVista'
import type { Opera } from '@shared/tipi'


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
  // le foto da lavorare (anche tante: la ricetta parte per ognuna)
  const [fotos, setFotos] = useState<FotoBase[]>([])
  const foto = fotos[0] ?? null
  const [rif, setRif] = useState<FotoBase[]>([])
  const [valori, setValori] = useState<Record<string, string>>({})
  const [qualita, setQualita] = useState<Qualita>('alta')
  const [mp, setMp] = useState(1)
  const [misura, setMisura] = useState<Misura>(MISURA0)
  // i passi da fare (per etichetta): all'inizio non c'è niente di segnato
  const [fai, setFai] = useState<string[]>([])
  const [vediPrompt, setVediPrompt] = useState(false)
  const [editor, setEditor] = useState<RicettaUtente | null>(null)
  const ricette = usaRicette()
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
    setFai([])
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
      setFotos((x) => [...x, f].slice(0, 40))
    }
    const h = (e: ClipboardEvent): void => void incolla(e)
    window.addEventListener('paste', h)
    return () => window.removeEventListener('paste', h)
  }, [])

  const passi = useMemo(() => (w ? passiDi(w, valori, rif.length) : []), [w, valori, rif.length, ricette.utente])
  const scelti = passi.filter((x) => fai.includes(x.etichetta))
  const nFoto = w?.foto ? Math.max(1, fotos.length) : 1
  const stima = imp ? stimaSecondi(imp.tempi, mp, perQualita(qualita).passi) * scelti.length * nFoto : 0
  const problema = w ? manca(w, { foto, rif }) : null
  const lora = w ? [...loraUsati(w, valori, rif.length)] : []

  const parti = async (): Promise<void> => {
    if (!w) return
    if (qualita === 'turbo' && !turbo.presente) {
      avvisa('Per il Turbo scarica prima il suo LoRA, o scegli Alta', 'errore')
      return
    }
    if (!scelti.length) {
      avvisa('Segna almeno una cosa da fare', 'errore')
      return
    }
    await avviaLotto(w, { foto: fotos, rif, valori, opzioni: { qualita, mp, misura, fai: scelti.map((x) => x.etichetta) } })
  }

  const scegliLaFoto = async (): Promise<void> => {
    const f = await scegliFoto(true)
    if (f.length) setFotos((x) => [...x, ...f].slice(0, 40))
  }
  const fotoDaPc = async (p: string): Promise<void> => {
    try {
      const f = await normalizza(p)
      setFotos((x) => [...x, f].slice(0, 40))
    } catch (e) {
      avvisa((e as Error).message, 'errore')
    }
  }

  // i preset di questa ricetta: i valori dei campi e i passi segnati, con un nome
  const [nomePreset, setNomePreset] = useState('')
  const presetQui = w ? ricette.preset.filter((x) => x.ricetta === w.id) : []
  const caricaPreset = (id: string): void => {
    const x = ricette.preset.find((y) => y.id === id)
    if (!x) return
    setValori({ ...(w ? valoriIniziali(w) : {}), ...x.valori })
    setFai(x.fai)
  }
  const salvaPreset = (): void => {
    if (!w || !nomePreset.trim()) return
    usaRicette.getState().salvaPreset({ ricetta: w.id, nome: nomePreset.trim(), valori, fai })
    setNomePreset('')
    avvisa('Preset salvato', 'ok')
  }
  const nuovaRicetta = (): void =>
    setEditor({ id: 'u-' + crypto.randomUUID().slice(0, 8), nome: 'La mia ricetta', categoria: 'personaggio', descrizione: '', modo: 'serie', foto: true, rif: 'no', ingressi: [], passi: [{ etichetta: 'Passo 1', prompt: 'Change <image1> so that ' }] })
  const modificaRicetta = (x: Workflow): void => {
    const u = ricette.utente.find((r) => r.id === x.id)
    setEditor(u ? { ...u } : inUtente(x))
  }
  const togliRicetta = (x: Workflow): void => {
    if (x.utente) {
      if (confirm(`Elimino la ricetta "${x.nome}"?`)) {
        usaRicette.getState().elimina(x.id)
        usaLab.setState({ scelto: null })
      }
    } else if (confirm(`Nascondo la ricetta "${x.nome}"? La ritrovi da "Ricette nascoste".`)) {
      usaRicette.getState().nascondi(x.id)
      usaLab.setState({ scelto: null })
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
                <div className="riga a-capo" style={{ gap: 6, marginTop: 8 }}>
                  <button className="btn piccolo" onClick={() => modificaRicetta(w)} title={w.utente ? 'Cambia nome, campi e prompt' : 'Ne fa una copia tua da cambiare'}><I.modifica /> {w.utente ? 'Modifica' : 'Duplica e modifica'}</button>
                  <button className="btn piccolo fantasma pericolo" onClick={() => togliRicetta(w)} title={w.utente ? 'Elimina la ricetta' : 'La nasconde (si può ripristinare)'}><I.cestino /> {w.utente ? 'Elimina' : 'Nascondi'}</button>
                </div>
                {lora.map((k) => <AvvisoLora key={k} id={ID_LORA[k]} perche={`${PERCHE[k]} Si accende da solo qui.`} />)}
              </div>

              {w.foto && (
                <div className="sezione">
                  <h3>{fotos.length > 1 ? 'Le foto' : 'La foto'} <span className="dx">{fotos.length > 1 ? `${fotos.length} · la ricetta parte per ognuna` : ''}</span></h3>
                  <div
                    className="foto-wf lotto"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      for (const f of Array.from(e.dataTransfer.files).slice(0, 40)) void fotoDaPc(api.file.percorso(f))
                    }}
                  >
                    {fotos.length === 0 ? (
                      <div className="vuota"><I.immagine /><span>Trascina qui una o più foto<br />o incollale con Ctrl+V</span></div>
                    ) : (
                      <div className="griglia-lotto">
                        {fotos.map((f, i) => (
                          <div key={f.percorso + i} className="t">
                            <img src={urlFile(f.percorso)} alt="" />
                            <button className="x" onClick={() => setFotos(fotos.filter((_, j) => j !== i))} title="Togli"><I.x /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="riga a-capo" style={{ marginTop: 8 }}>
                    <button className="btn piccolo" onClick={scegliLaFoto}><I.galleria /> Dalla galleria</button>
                    <button className="btn piccolo" onClick={async () => { for (const p of await api.file.scegliImmagini(true)) await fotoDaPc(p) }}><I.immagine /> Dal PC</button>
                    {fotos.length > 0 && <button className="btn piccolo fantasma pericolo" onClick={() => setFotos([])}><I.x /> Togli {fotos.length > 1 ? 'tutte' : ''}</button>}
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
                    comeBase={w.foto && foto ? (i) => { const f = rif[i]; setRif(rif.map((r, j) => (j === i ? foto : r))); setFotos([f, ...fotos.slice(1)]) } : undefined}
                    esempio={w.rifNome ? `Servono ${w.rifNome}.${w.rif === 'ognuno' ? ' Ognuna fa un passo.' : ''}` : 'Foto di riferimento (facoltative).'}
                  />
                </div>
              )}

              {w.ingressi.length > 0 && (
                <div className="sezione col" style={{ gap: 10 }}>
                  {w.ingressi.map((g) =>
                    g.tipo === 'posa' ? (
                      <div key={g.id} className="col" style={{ gap: 6 }}>
                        <span className="piccolo tenue">{g.nome}</span>
                        <Omino
                          valore={leggiPosa(valori[g.id]) ?? posaDi('t')}
                          cambia={(po) => {
                            setValori({ ...valori, [g.id]: posaInTesto(po) })
                            // muovendo l'omino il passo "La tua posa" si segna da solo
                            if (!fai.includes(POSA_TUA)) setFai([...fai, POSA_TUA])
                          }}
                        />
                        <button className="btn piccolo fantasma" style={{ alignSelf: 'flex-start' }} onClick={() => { setValori({ ...valori, [g.id]: '' }); setFai(fai.filter((x) => x !== POSA_TUA)) }}>Non usare l'omino</button>
                      </div>
                    ) : g.tipo === 'camera' ? (
                      <div key={g.id} className="col" style={{ gap: 6 }}>
                        <span className="piccolo tenue">{g.nome}</span>
                        <ControlloCamera
                          valore={leggiCamera(valori[g.id]) ?? CAMERA0}
                          lora={!!fileLoraCamera()}
                          cambia={(c) => {
                            setValori({ ...valori, [g.id]: JSON.stringify(c) })
                            // muovendo la camera il passo "La tua vista" si segna da solo
                            if (!fai.includes(VISTA_TUA)) setFai([...fai, VISTA_TUA])
                          }}
                        />
                        <button className="btn piccolo fantasma" style={{ alignSelf: 'flex-start' }} onClick={() => { setValori({ ...valori, [g.id]: '' }); setFai(fai.filter((x) => x !== VISTA_TUA)) }}>Azzera la camera</button>
                      </div>
                    ) : g.tipo === 'scelta' ? (
                      <div key={g.id} className="col" style={{ gap: 4 }}>
                        <span className="piccolo tenue">{g.nome}</span>
                        <Segmenti valore={valori[g.id] ?? g.predefinita} cambia={(v) => setValori({ ...valori, [g.id]: v })} voci={g.opzioni.map((o) => ({ id: o.id, nome: o.nome }))} />
                      </div>
                    ) : (
                      <label key={g.id} className="campo-preset">
                        <span>{g.nome}</span>
                        {g.tipo === 'righe' ? (
                          <Casella valore={valori[g.id] ?? ''} cambia={(v) => setValori({ ...valori, [g.id]: v })} minimo={84} placeholder={g.esempio} />
                        ) : (
                          <input type="text" value={valori[g.id] ?? ''} onChange={(e) => setValori({ ...valori, [g.id]: e.target.value })} placeholder={g.esempio} />
                        )}
                      </label>
                    )
                  )}
                </div>
              )}

              <div className="sezione">
                <h3>
                  Cosa fare <span className="dx">{scelti.length} di {passi.length}</span>
                </h3>
                <div className="riga a-capo" style={{ gap: 6, marginBottom: 8 }}>
                  <button className="chip" onClick={() => setFai(passi.filter((x) => !x.sorpresa).map((x) => x.etichetta))}>Tutte</button>
                  <button className="chip" onClick={() => setFai([])}>Nessuna</button>
                  <button className={`chip ${vediPrompt ? 'su' : ''}`} onClick={() => setVediPrompt(!vediPrompt)} title="Mostra il prompt di ogni passo">Vedi i prompt</button>
                </div>
                <div className={`scelta-passi ${vediPrompt ? 'con-prompt' : ''}`}>
                  {passi.map((x) => {
                    const su = fai.includes(x.etichetta)
                    return (
                      <label key={x.etichetta} className={`${su ? 'su' : ''} ${x.sorpresa ? 'sorpresa' : ''}`} title={x.sorpresa ? 'Il modello inventa una variazione nuova, diversa ogni volta' : x.prompt}>
                        <input type="checkbox" checked={su} onChange={() => setFai(su ? fai.filter((e) => e !== x.etichetta) : [...fai, x.etichetta])} />
                        <span>{x.etichetta}</span>
                        {vediPrompt && <small>{x.sorpresa ? 'Un\'idea a caso del modello, nello stile della ricetta' : x.prompt}</small>}
                      </label>
                    )
                  })}
                </div>
                {w.modo === 'catena' && <div className="piccolo spento" style={{ marginTop: 6 }}>In una catena ogni passo parte dal risultato del precedente: i passi che non segni vengono saltati.</div>}
              </div>

              <div className="sezione">
                <h3>Preset <span className="dx">{presetQui.length ? `${presetQui.length}` : ''}</span></h3>
                {presetQui.length > 0 && (
                  <div className="riga a-capo" style={{ gap: 6, marginBottom: 8 }}>
                    {presetQui.map((x) => (
                      <span key={x.id} className="chip-preset">
                        <button onClick={() => caricaPreset(x.id)} title="Rimette i campi e i passi segnati">{x.nome}</button>
                        <button className="x" onClick={() => usaRicette.getState().eliminaPreset(x.id)} title="Elimina il preset"><I.x /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="riga" style={{ gap: 6 }}>
                  <input type="text" value={nomePreset} onChange={(e) => setNomePreset(e.target.value)} placeholder="Salva questi campi e passi come preset…" style={{ flex: 1, minWidth: 0 }} onKeyDown={(e) => e.key === 'Enter' && salvaPreset()} />
                  <button className="btn piccolo" onClick={salvaPreset} disabled={!nomePreset.trim()}>Salva</button>
                </div>
              </div>

              {passi.some((x) => !x.crea) && (
                <div className="sezione">
                  <h3>Dimensioni <span className="dx">{misura.tipo === 'auto' ? 'come i megapixel' : misura.tipo === 'originale' ? 'come la foto' : 'misura mia'}</span></h3>
                  <SceltaMisura valore={misura} cambia={setMisura} base={foto} mp={mp} cambiaMp={setMp} />
                </div>
              )}

              <div className="sezione">
                <h3>Qualità <span className="dx">{perQualita(qualita).passi} passi · ~{durata(stima)} in tutto</span></h3>
                <ScegliQualita valore={qualita} cambia={setQualita} senzaMassima />
                {!passi.some((x) => !x.crea) && (
                  <div style={{ marginTop: 10 }}>
                    <span className="piccolo tenue">Grandezza della foto</span>
                    <ScegliMp mp={mp} cambia={setMp} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        {w && (
          <div className="sezione" style={{ borderTop: '1px solid #1d1636' }}>
            <button className="btn primario grande" style={{ width: '100%' }} onClick={() => void parti()} disabled={!!problema || !scelti.length}>
              <I.gioca /> Avvia · {scelti.length * nFoto} {scelti.length * nFoto === 1 ? 'immagine' : 'immagini'}
            </button>
            <div className="piccolo spento" style={{ textAlign: 'center', marginTop: 6 }}>{problema || (!scelti.length ? 'Segna cosa fare qui sopra' : `~${durata(stima)} · si vedono qui e nella barra in basso`)}</div>
          </div>
        )}
      </div>

      <div className="palco palco-lab">
        <div className="schede-lab">
          <button className={vista === 'catalogo' ? 'su' : ''} onClick={() => usaLab.setState({ vista: 'catalogo' })}><I.laboratorio /> Ricette <span className="n">{WORKFLOW_BASE.length - ricette.nascoste.length + ricette.utente.length}</span></button>
          <button className={vista === 'risultati' ? 'su' : ''} onClick={() => usaLab.setState({ vista: 'risultati' })} disabled={!runs.length}>
            <I.serie /> Risultati {runs.length > 0 && <span className="n">{runs.length}</span>}
          </button>
          <span className="flex1" />
          {vista === 'catalogo' && <button className="btn piccolo" onClick={nuovaRicetta}><I.piu /> Nuova ricetta</button>}
          {vista === 'catalogo' && ricette.nascoste.length > 0 && <button className="btn piccolo fantasma" onClick={() => usaRicette.getState().mostraTutte()} title="Rimette le ricette che avevi nascosto">{ricette.nascoste.length === 1 ? 'Mostra la ricetta nascosta' : `Mostra le ${ricette.nascoste.length} nascoste`}</button>}
          {vista === 'catalogo' && <input type="search" placeholder="Cerca una ricetta…" value={cerca} onChange={(e) => setCerca(e.target.value)} style={{ width: 240 }} />}
          {vista === 'risultati' && runs.length > 1 && (
            <select value={attiva || ''} onChange={(e) => usaLab.setState({ attiva: e.target.value })} style={{ width: 300 }}>
              {runs.map((r) => <option key={r.id} value={r.id}>{r.nome} · {new Date(r.creato).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</option>)}
            </select>
          )}
        </div>

        {vista === 'catalogo' || !run ? (
          <Catalogo cerca={cerca} scelto={scelto} scegli={scegli} elenco={elencoWorkflow()} />
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

      {editor && <EditorRicetta ricetta={editor} chiudi={() => setEditor(null)} salvata={(r) => { usaRicette.getState().salva(r); setEditor(null); scegli(r.id) }} />}
      {aperto && run && <Dettaglio run={run} opere={opere} i={aperto.i} cambia={(i) => setAperto({ run: aperto.run, i })} chiudi={() => setAperto(null)} />}
    </div>
  )
}
