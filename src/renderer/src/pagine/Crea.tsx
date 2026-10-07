// Crea: dal testo all'immagine.
import { useEffect, useMemo, useState, type JSX } from 'react'
import { usaStato, PASSI_QUALITA, type Qualita } from '../stato'
import { api, urlFile } from '../api'
import { I } from '../componenti/Icone'
import { Contatore, Cursore, Interruttore, Segmenti } from '../componenti/Controlli'
import { SceltaLora, conParoleLora } from '../componenti/SceltaLora'
import { percentuale } from '../componenti/Coda'
import { FORMATI, dimensioni, durata, normalizza, stimaSecondi } from '../util'
import { SISTEMA_DESCRIVI, SISTEMA_MIGLIORA, apriInModifica, fotoDaOpera, richiestaBase, rifinisci, riusa, varia, ingrandisci } from '../azioni'
import type { Lavoro, Opera } from '@shared/tipi'

const IDEE = [
  'Una libreria segreta dentro un faro, scale a chiocciola piene di libri, luce calda delle lanterne, pioggia sui vetri',
  'Ritratto di una donna anziana napoletana che ride, luce di finestra, pellicola Kodak Portra, grana fine',
  'Un drago di vetro soffiato su un tavolo di legno, riflessi colorati, macro, sfondo sfocato',
  'Vespa rossa parcheggiata in un vicolo di Positano al tramonto, panni stesi, buganvillea',
  'Poster minimalista anni 60 con la scritta "DaProd Image", forme geometriche, colori pastello',
  'Astronauta che pesca su un lago di nebbia sulla luna, stile illustrazione giapponese',
  'Cucina di nonna con la moka sul fuoco, mattina presto, polvere nei raggi di sole, fotografia realistica',
  'Città cyberpunk sotto la pioggia vista da un tetto, neon magenta e oro, riflessi sull\'asfalto'
]

const ar = (f: string): string => {
  const x = FORMATI.find((v) => v.id === f) || FORMATI[0]
  return `${x.w} / ${x.h}`
}

export function Crea(): JSX.Element {
  const { crea, setCrea, imp, lavori, avvisa } = usaStato()
  const [precedente, setPrecedente] = useState<string | null>(null)
  const [scrivendo, setScrivendo] = useState(false)
  const [avanzate, setAvanzate] = useState(false)
  const [scelto, setScelto] = useState<string | null>(null)
  const [opere, setOpere] = useState<Record<string, Opera>>({})
  const [vedoInCorso, setVedoInCorso] = useState(true)

  const bozza = crea.qualita === 'bozza'
  const mpReale = bozza ? Math.max(0.35, crea.mp / 2) : crea.mp
  const dim = dimensioni(crea.formato, mpReale)
  const passi = PASSI_QUALITA[crea.qualita]
  const stima = stimaSecondi(imp?.tempi, (dim.w * dim.h) / 1048576, passi) * crea.quante

  // i lavori di questa pagina (creati, rifiniti, variati)
  const miei = useMemo(() => lavori.filter((l) => ['crea', 'rifinisci', 'varia'].includes(l.richiesta.modalita)), [lavori])
  const inCorso = miei.find((l) => l.stato === 'in corso')
  useEffect(() => {
    if (inCorso) setVedoInCorso(true)
  }, [inCorso?.id])
  const mostraInCorso = !!inCorso && vedoInCorso
  const risultati = useMemo(() => miei.flatMap((l) => l.risultati).reverse(), [miei])

  useEffect(() => {
    const mancano = risultati.filter((id) => !opere[id])
    if (!mancano.length) return
    void Promise.all(mancano.map((id) => api.galleria.opera(id))).then((l) => {
      const n = { ...opere }
      l.forEach((o) => o && (n[o.id] = o))
      setOpere(n)
    })
  }, [risultati, opere])

  // l'ultimo risultato arrivato diventa quello mostrato
  useEffect(() => {
    if (risultati[0]) setScelto(risultati[0])
  }, [risultati[0]])

  const vai = async (): Promise<void> => {
    if (!crea.prompt.trim()) {
      avvisa('Scrivi prima cosa vuoi vedere', 'errore')
      return
    }
    const q = {
      ...richiestaBase(),
      modalita: 'crea' as const,
      prompt: conParoleLora(crea.prompt.trim()),
      negativo: crea.negativo,
      seed: crea.casuale ? -1 : crea.seed,
      passi,
      cfg: crea.cfg,
      sampler: crea.sampler,
      scheduler: crea.scheduler,
      larghezza: dim.w,
      altezza: dim.h,
      megapixel: crea.mp,
      quante: crea.quante,
      trasparente: crea.trasparente,
      etichetta: bozza ? 'Bozza' : undefined
    }
    await api.lavori.accoda(q)
    if (crea.quante > 1) avvisa(`${crea.quante} immagini in coda`, 'ok')
  }

  useEffect(() => {
    const tasto = (e: KeyboardEvent): void => {
      if (usaStato.getState().pagina !== 'crea') return
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        void vai()
      }
    }
    window.addEventListener('keydown', tasto)
    return () => window.removeEventListener('keydown', tasto)
  })

  const migliora = async (): Promise<void> => {
    if (!crea.prompt.trim()) return
    setScrivendo(true)
    try {
      const t = await api.testo.scrivi({ ...richiestaBase(), modalita: 'descrivi', prompt: crea.prompt, sistema: SISTEMA_MIGLIORA, maxToken: 380, etichetta: 'Migliora prompt' })
      if (t) {
        setPrecedente(crea.prompt)
        setCrea({ prompt: t })
      }
    } catch (e) {
      avvisa((e as Error).message, 'errore')
    } finally {
      setScrivendo(false)
    }
  }

  const daFoto = async (): Promise<void> => {
    const [p] = await api.file.scegliImmagini(false)
    if (!p) return
    setScrivendo(true)
    try {
      const f = await normalizza(p)
      const t = await api.testo.scrivi({ ...richiestaBase(), modalita: 'descrivi', prompt: 'Describe this image.', immagini: [f.percorso], sistema: SISTEMA_DESCRIVI, maxToken: 380, etichetta: 'Foto → prompt' })
      if (t) {
        setPrecedente(crea.prompt)
        setCrea({ prompt: t })
      }
    } catch (e) {
      avvisa((e as Error).message, 'errore')
    } finally {
      setScrivendo(false)
    }
  }

  const op = scelto ? opere[scelto] : undefined

  return (
    <div className="pagina">
      <div className="colonna">
        <div className="scorri">
          <div className="sezione">
            <h3>
              Cosa vuoi vedere
              <span className="dx">{crea.prompt.length > 0 && `${crea.prompt.length} car.`}</span>
            </h3>
            <textarea
              value={crea.prompt}
              placeholder="Descrivi l'immagine, anche in italiano. Più dettagli dai (luce, stile, inquadratura), meglio è."
              onChange={(e) => setCrea({ prompt: e.target.value })}
              style={{ minHeight: 150 }}
              disabled={scrivendo}
            />
            <div className="riga a-capo" style={{ marginTop: 8 }}>
              <button className="btn piccolo" onClick={migliora} disabled={scrivendo || !crea.prompt.trim()} title="Qwen3-VL riscrive il prompt in un paragrafo ricco, in inglese">
                <I.bacchetta /> {scrivendo ? 'Scrivo…' : 'Migliora'}
              </button>
              <button className="btn piccolo" onClick={daFoto} disabled={scrivendo} title="Scegli una foto: il modello la descrive e diventa il prompt">
                <I.immagine /> Da foto
              </button>
              <button className="btn piccolo fantasma" onClick={() => setCrea({ prompt: IDEE[Math.floor(Math.random() * IDEE.length)] })} title="Un'idea a caso">
                <I.dado />
              </button>
              {precedente !== null && (
                <button className="btn piccolo fantasma" onClick={() => { setCrea({ prompt: precedente }); setPrecedente(null) }}>
                  <I.annulla /> Torna al mio
                </button>
              )}
            </div>
          </div>

          <div className="sezione">
            <h3>Formato <span className="dx">{dim.w} × {dim.h}</span></h3>
            <div className="formati">
              {FORMATI.map((f) => {
                const k = 22 / Math.max(f.w, f.h)
                return (
                  <button key={f.id} className={`formato ${crea.formato === f.id ? 'su' : ''}`} onClick={() => setCrea({ formato: f.id })} title={f.nome}>
                    <i style={{ width: f.w * k, height: f.h * k }} />
                    {f.id}
                  </button>
                )
              })}
            </div>
            <div style={{ marginTop: 10 }}>
              <Segmenti
                valore={crea.mp}
                cambia={(mp) => setCrea({ mp })}
                voci={[
                  { id: 1, nome: '1 MP', sotto: 'veloce' },
                  { id: 2, nome: '2 MP', sotto: 'dettaglio' },
                  { id: 4, nome: '4 MP', sotto: '2K nativo', titolo: 'Qwen-Image 2.1 genera nativo fino a 2048×2048: più lento su 8 GB' }
                ]}
              />
            </div>
          </div>

          <div className="sezione">
            <h3>Qualità <span className="dx">{passi} passi · ~{durata(stima)}</span></h3>
            <Segmenti<Qualita>
              valore={crea.qualita}
              cambia={(qualita) => setCrea({ qualita })}
              voci={[
                { id: 'bozza', nome: 'Bozza veloce', sotto: '20 passi, ½ pixel', titolo: 'Per esplorare: poi "Rifinisci" porta la bozza scelta in alta qualità' },
                { id: 'alta', nome: 'Alta', sotto: '40 passi (standard)' },
                { id: 'massima', nome: 'Massima', sotto: '50 passi' }
              ]}
            />
            {bozza && <div className="piccolo tenue" style={{ marginTop: 8 }}>Esplori più idee in poco tempo; sulla bozza che ti piace premi <b className="oro">Rifinisci</b>.</div>}
          </div>

          <div className="sezione">
            <div className="riga spazia">
              <div className="col" style={{ gap: 4 }}>
                <h3 style={{ margin: 0 }}>Quante</h3>
                <Contatore valore={crea.quante} min={1} max={12} cambia={(quante) => setCrea({ quante })} />
              </div>
              <div className="col" style={{ gap: 4, alignItems: 'flex-end' }}>
                <h3 style={{ margin: 0 }}>Seed</h3>
                <div className="riga">
                  <button className={`btn piccolo ${crea.casuale ? 'attivo' : ''}`} onClick={() => setCrea({ casuale: !crea.casuale })} title="Seed casuale a ogni immagine">
                    <I.dado /> {crea.casuale ? 'Casuale' : 'Fisso'}
                  </button>
                  {!crea.casuale && <input type="number" value={crea.seed} onChange={(e) => setCrea({ seed: Math.max(0, Number(e.target.value) || 0) })} style={{ width: 130 }} />}
                </div>
              </div>
            </div>
          </div>

          <div className="sezione">
            <h3>LoRA</h3>
            <SceltaLora />
          </div>

          <div className="sezione">
            <Interruttore acceso={crea.trasparente} cambia={(trasparente) => setCrea({ trasparente })} sotto="PNG con sfondo trasparente (canale alfa nativo di Qwen-Image 2.1)">
              Sfondo trasparente
            </Interruttore>
          </div>

          <div className="sezione">
            <h3 style={{ cursor: 'pointer' }} onClick={() => setAvanzate(!avanzate)}>
              {avanzate ? '▾' : '▸'} Avanzate
            </h3>
            {avanzate && (
              <div className="col" style={{ gap: 12 }}>
                <Cursore etichetta="CFG (1 = percorso ufficiale)" valore={crea.cfg} min={1} max={6} passo={0.1} formato={(v) => v.toFixed(1)} cambia={(cfg) => setCrea({ cfg })} />
                <div className="col" style={{ gap: 4 }}>
                  <span className="piccolo tenue">Prompt negativo {crea.cfg <= 1 && <span className="spento">(conta solo con CFG sopra 1, e raddoppia il tempo)</span>}</span>
                  <textarea value={crea.negativo} onChange={(e) => setCrea({ negativo: e.target.value })} style={{ minHeight: 60 }} placeholder="es. sfocato, mani storte, testo" />
                </div>
                <div className="riga">
                  <div className="col flex1" style={{ gap: 4 }}>
                    <span className="piccolo tenue">Sampler</span>
                    <select value={crea.sampler} onChange={(e) => setCrea({ sampler: e.target.value })}>
                      {['euler', 'euler_ancestral', 'dpmpp_2m', 'res_multistep', 'heun', 'uni_pc', 'deis'].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="col flex1" style={{ gap: 4 }}>
                    <span className="piccolo tenue">Scheduler</span>
                    <select value={crea.scheduler} onChange={(e) => setCrea({ scheduler: e.target.value })}>
                      {['simple', 'sgm_uniform', 'beta', 'normal', 'karras', 'linear_quadratic', 'kl_optimal'].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <button className="btn piccolo fantasma" onClick={() => setCrea({ cfg: 1, sampler: 'euler', scheduler: 'simple', negativo: '' })}>Rimetti quelli ufficiali</button>
              </div>
            )}
          </div>
        </div>
        <div className="sezione" style={{ borderTop: '1px solid #1d1636' }}>
          <button className="btn primario grande" style={{ width: '100%' }} onClick={vai}>
            <I.crea /> {crea.quante > 1 ? `Crea ${crea.quante} immagini` : 'Crea'}
          </button>
          <div className="piccolo spento" style={{ textAlign: 'center', marginTop: 6 }}>Ctrl+Invio · ~{durata(stima)}</div>
        </div>
      </div>

      <div className="palco">
        <div className="vista">
          {mostraInCorso && inCorso ? (
            <InCorso l={inCorso} ar={ar(crea.formato)} />
          ) : op ? (
            <img className={`grande ${op.trasparente ? 'scacchi' : ''}`} src={urlFile(op.file)} alt="" onDragStart={(e) => { e.preventDefault(); api.trascina(op.file) }} />
          ) : (
            <div className="vuoto">
              <div className="grosso">CREA CON <b>QWEN-IMAGE 2.1</b></div>
              <p>Scrivi a sinistra cosa vuoi vedere e premi <b className="oro">Crea</b> (<kbd>Ctrl</kbd>+<kbd>Invio</kbd>).</p>
              <p>Puoi accodare quante immagini vuoi: partono una dopo l'altra.</p>
            </div>
          )}
        </div>
        {op && !mostraInCorso && (
          <div className="azioni-risultato">
            {op.etichetta === 'Bozza' && (
              <button className="btn primario" onClick={() => rifinisci(op)} title="La porta alla grandezza scelta e ridisegna i dettagli">
                <I.crea /> Rifinisci
              </button>
            )}
            <button className="btn" onClick={() => apriInModifica(fotoDaOpera(op))}><I.modifica /> Modifica</button>
            <button className="btn" onClick={() => varia(op)} title="Due variazioni che tengono la composizione"><I.varia /> Varia</button>
            {op.etichetta !== 'Bozza' && <button className="btn" onClick={() => rifinisci(op)} title="Ingrandisce fino al 2K e ridisegna i dettagli"><I.ingrandisci /> Rifinisci 2K</button>}
            <button className="btn" onClick={() => ingrandisci(op, 2)} title="Ingrandimento veloce 2× (4x-UltraSharp)"><I.ingrandisci /> 2×</button>
            <button className="btn" onClick={() => riusa(op)} title="Rimette prompt e seed"><I.ricicla /> Riusa</button>
            <button className={`btn icona ${op.preferita ? 'attivo' : ''}`} onClick={async () => { await api.galleria.preferita(op.id, !op.preferita); setOpere({ ...opere, [op.id]: { ...op, preferita: !op.preferita } }) }} title="Preferita">
              {op.preferita ? <I.stellaPiena /> : <I.stella />}
            </button>
            <button className="btn icona" onClick={() => api.galleria.copia(op.id).then(() => avvisa('Copiata negli appunti', 'ok'))} title="Copia"><I.copia /></button>
            <button className="btn icona" onClick={() => api.galleria.mostra(op.id)} title="Mostra nella cartella"><I.cartella /></button>
            <span className="piccolo spento" style={{ alignSelf: 'center' }}>{op.larghezza}×{op.altezza} · seed {op.seed} · {durata(op.durata)}</span>
          </div>
        )}
        <div className="striscia">
          {miei.filter((l) => l.stato === 'in corso' || l.stato === 'in coda').map((l) => (
            <div key={l.id} className="mini" style={{ ['--ar' as string]: l.richiesta.larghezza ? `${l.richiesta.larghezza} / ${l.richiesta.altezza}` : '1' }} onClick={() => setVedoInCorso(true)}>
              {l.anteprima ? <img src={l.anteprima} alt="" /> : null}
              <div className="stato">{l.stato === 'in corso' ? (percentuale(l) !== null ? `${percentuale(l)}%` : '…') : 'in coda'}</div>
            </div>
          ))}
          {risultati.map((id) => {
            const o = opere[id]
            return (
              <div key={id} className={`mini ${scelto === id ? 'su' : ''}`} style={{ ['--ar' as string]: o ? `${o.larghezza} / ${o.altezza}` : '1' }} onClick={() => { setScelto(id); setVedoInCorso(false) }}>
                {o && <img src={urlFile(o.miniatura || o.file)} alt="" />}
              </div>
            )
          })}
          {risultati.length === 0 && miei.length === 0 && <span className="spento piccolo">Qui compaiono le immagini di questa sessione. Tutte finiscono anche in Galleria.</span>}
        </div>
      </div>
    </div>
  )
}

export function InCorso({ l, ar }: { l: Lavoro; ar: string }): JSX.Element {
  const p = percentuale(l)
  return (
    <div className="in-corso" style={{ width: '100%', height: '100%' }}>
      {l.anteprima ? <img src={l.anteprima} alt="" style={{ width: 'auto', height: 'auto', maxHeight: '100%' }} /> : <div className="attesa-grande" style={{ ['--ar' as string]: ar }} />}
      <div className="sopra">
        <div className="riga spazia">
          <b>{l.fase}</b>
          <span className="tenue piccolo">
            {l.fase === 'Disegno' && `${l.passo}/${l.passiTotali} · `}
            {l.stima ? `~${durata(l.stima)}` : ''}
          </span>
        </div>
        <div className={`barra-progresso ${p === null ? 'indeterminata' : ''}`}>
          <i style={{ width: `${p ?? 30}%` }} />
        </div>
        <div className="riga spazia piccolo spento">
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 }}>{l.richiesta.etichetta || l.richiesta.prompt}</span>
          <button className="btn piccolo fantasma" onClick={() => api.lavori.annulla(l.id)}>Annulla</button>
        </div>
      </div>
    </div>
  )
}
