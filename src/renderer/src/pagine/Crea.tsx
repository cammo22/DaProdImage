// Crea: dal testo all'immagine.
import { useEffect, useMemo, useState, type JSX } from 'react'
import { usaStato, type Qualita } from '../stato'
import { api, urlFile } from '../api'
import { I } from '../componenti/Icone'
import { AdattaFoto } from '../componenti/AdattaFoto'
import { Contatore, Cursore, Interruttore, SezioneChiudibile, Segmenti } from '../componenti/Controlli'
import { SceltaMisura, ScegliMp, MISURA0 } from '../componenti/Misura'
import { SceltaLora, LoraAttivi, conParoleLora } from '../componenti/SceltaLora'
import { percentuale } from '../componenti/Coda'
import { BarraPreset, SchedaPreset } from '../componenti/Preset'
import { VistaZoom } from '../componenti/VistaZoom'
import { AvvisoTurbo, useTurbo } from '../componenti/Turbo'
import { FORMATI, RISOLUZIONI, dimensioniRis, durata, normalizza, stimaSecondi } from '../util'
import { Riferimenti } from '../componenti/Riferimenti'
import { SISTEMA_DESCRIVI, SISTEMA_IDEA, SISTEMA_MIGLIORA, apriInModifica, fotoDaOpera, perQualita, richiestaBase, rifinisci, riusa, varia, ingrandisci } from '../azioni'
import { presetDa } from '../preset'
import { Casella } from '../componenti/Casella'
import type { Lavoro, Opera } from '@shared/tipi'


const ar = (f: string): string => {
  const x = FORMATI.find((v) => v.id === f) || FORMATI[0]
  return `${x.w} / ${x.h}`
}

export function Crea(): JSX.Element {
  const { crea, setCrea, imp, lavori, avvisa, loraAttive } = usaStato()
  const turbo = useTurbo()
  const [precedente, setPrecedente] = useState<string | null>(null)
  const [scrivendo, setScrivendo] = useState(false)
  const [avanzate, setAvanzate] = useState(false)
  const [scelto, setScelto] = useState<string | null>(null)
  const [opere, setOpere] = useState<Record<string, Opera>>({})
  const [vedoInCorso, setVedoInCorso] = useState(true)
  // le ultime opere della galleria, per ripartire da lì quando la pagina è vuota
  const [recenti, setRecenti] = useState<Opera[]>([])
  useEffect(() => {
    void api.galleria.elenco({ modalita: 'tutte' }).then((l) => setRecenti(l.slice(0, 8)))
  }, [lavori.filter((l) => l.stato === 'fatto').length])

  const bozza = crea.qualita === 'bozza'
  // la bozza lavora a metà dei pixel (lato corto / √2)
  const dim = dimensioniRis(crea.formato, bozza ? Math.max(256, Math.round(crea.ris / Math.SQRT2)) : crea.ris)
  const { passi } = perQualita(crea.qualita)
  const preset = presetDa(crea.preset)
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
    if (crea.qualita === 'turbo' && !turbo.presente) {
      avvisa('Per il Turbo scarica prima il suo LoRA (il pulsante sotto Qualità), o scegli Alta', 'errore')
      return
    }
    // misura precisa: il modello lavora ai megapixel scelti con le proporzioni di quella misura, poi si porta lì
    const mis = crea.misura?.tipo === 'custom' ? crea.misura : null
    const px = dim.w * dim.h
    const m16 = (x: number): number => Math.max(256, Math.round(x / 16) * 16)
    const lav = mis ? { w: m16(Math.sqrt(px * (mis.w / mis.h))), h: m16(Math.sqrt(px / (mis.w / mis.h))) } : dim
    const q = {
      ...richiestaBase(),
      modalita: 'crea' as const,
      prompt: conParoleLora(crea.prompt.trim()),
      negativo: crea.negativo,
      seed: crea.casuale ? -1 : crea.seed,
      cfg: crea.cfg,
      sampler: crea.sampler,
      scheduler: crea.scheduler,
      larghezza: lav.w,
      altezza: lav.h,
      megapixel: (lav.w * lav.h) / 1048576,
      ...(mis ? { uscita: { w: mis.w, h: mis.h } } : {}),
      quante: crea.quante,
      immagini: crea.riferimenti.map((r) => r.percorso),
      trasparente: crea.trasparente,
      ...perQualita(crea.qualita),
      etichetta: bozza ? 'Bozza' : preset ? preset.nome : undefined
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

  /** il modello inventa un'idea originale: si parte da lì */
  const sorprendimi = async (): Promise<void> => {
    setScrivendo(true)
    try {
      const seed = Math.floor(Math.random() * 2 ** 31)
      const t = await api.testo.scrivi({ ...richiestaBase(), modalita: 'descrivi', prompt: `Invent a new image idea (random seed ${seed % 9973}).`, sistema: SISTEMA_IDEA, maxToken: 260, temperatura: 1.1, seed, immagini: [], etichetta: 'Idea a sorpresa' })
      if (t) {
        setPrecedente(crea.prompt)
        setCrea({ prompt: t.trim() })
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

  const inserisci = (testo: string): void => {
    const t = document.querySelector<HTMLTextAreaElement>('.colonna:not(.destra) textarea')
    const v = crea.prompt
    const i = t ? t.selectionStart : v.length
    setCrea({ prompt: v.slice(0, i) + testo + v.slice(i) })
  }

  return (
    <div className="pagina">
      <BarraPreset prima={setPrecedente} />
      <div className="colonna">
        <div className="scorri">
          <SchedaPreset />
          <div className="sezione">
            <h3>
              {preset ? 'Prompt (lo scrive il preset)' : 'Cosa vuoi vedere'}
              <span className="dx">{crea.prompt.length > 0 && `${crea.prompt.length} car.`}</span>
            </h3>
            <Casella
              valore={crea.prompt}
              placeholder="Descrivi l'immagine, anche in italiano. Più dettagli dai (luce, stile, inquadratura), meglio è."
              cambia={(prompt) => setCrea({ prompt })}
              minimo={preset ? 110 : 150}
              disabled={scrivendo}
            />
            <LoraAttivi />
            <div className="riga a-capo" style={{ marginTop: 8 }}>
              <button className="btn piccolo" onClick={migliora} disabled={scrivendo || !crea.prompt.trim()} title="Qwen3-VL riscrive il prompt in un paragrafo ricco, in inglese">
                <I.bacchetta /> {scrivendo ? 'Scrivo…' : 'Migliora'}
              </button>
              <button className="btn piccolo" onClick={daFoto} disabled={scrivendo} title="Scegli una foto: il modello la descrive e diventa il prompt">
                <I.immagine /> Da foto
              </button>
              <button className="btn piccolo" onClick={sorprendimi} disabled={scrivendo} title="Il modello inventa un'idea originale e la scrive al posto del prompt">
                <I.dado /> Sorprendimi
              </button>
              {precedente !== null && (
                <button className="btn piccolo fantasma" onClick={() => { setCrea({ prompt: precedente }); setPrecedente(null) }}>
                  <I.annulla /> Torna al mio
                </button>
              )}
            </div>
          </div>

          <SezioneChiudibile id="crea-formato" titolo="Formato e risoluzione" destra={crea.misura?.tipo === 'custom' ? `${crea.misura.w} × ${crea.misura.h}` : `${dim.w} × ${dim.h}`}>
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
            <h3 style={{ marginTop: 14 }}>Risoluzione <span className="dx">{dim.w} × {dim.h} px · {((dim.w * dim.h) / 1048576).toFixed(2).replace('.', ',')} MP{bozza ? ' · bozza' : ''}</span></h3>
            <div className="risoluzioni">
              {RISOLUZIONI.map((r) => (
                <button key={r.id} className={`formato ${crea.ris === r.id ? 'su' : ''}`} onClick={() => setCrea({ ris: r.id })} title={r.titolo}>
                  <b>{r.nome}</b>
                  <small>{r.sotto}</small>
                </button>
              ))}
            </div>
            <span className="piccolo tenue" style={{ display: 'block', marginTop: 10 }}>Oppure scegli per megapixel (anche 4 MP con la risoluzione bassa che vuoi, poi sotto la porti alla misura)</span>
            <ScegliMp
              mp={[0.25, 0.5, 1, 2, 4].find((x) => Math.abs(x - (dim.w * dim.h) / 1048576) / x < 0.09) ?? -1}
              cambia={(mp) => {
                const f = FORMATI.find((x) => x.id === crea.formato) || FORMATI[0]
                const lungo = Math.max(f.w, f.h) / Math.min(f.w, f.h)
                setCrea({ ris: Math.max(256, Math.round(Math.sqrt((mp * 1048576) / lungo) / 16) * 16) })
              }}
              ar={{ w: dim.w, h: dim.h }}
            />
            <h3 style={{ marginTop: 14 }}>Misura precisa <span className="dx">{crea.misura?.tipo === 'custom' ? 'attiva' : 'no'}</span></h3>
            <SceltaMisura valore={crea.misura ?? MISURA0} cambia={(misura) => setCrea({ misura })} base={null} mp={Math.round((dim.w * dim.h) / 1e5) / 10} ammetti={['auto', 'custom']} auto={{ w: dim.w, h: dim.h }} />
          </SezioneChiudibile>

          <SezioneChiudibile id="crea-qualita" titolo="Qualità" destra={`${passi} passi · ~${durata(stima)}`}>
            <Segmenti<Qualita>
              valore={crea.qualita}
              cambia={(qualita) => setCrea({ qualita })}
              voci={[
                { id: 'turbo', nome: <><I.fulmine /> Turbo</>, sotto: '8 passi · 5× veloce', titolo: 'LoRA Turbo8: 8 passi invece di 40, CFG 1. Il modo più veloce, anche su 6 GB' },
                { id: 'bozza', nome: 'Bozza', sotto: '20 passi, ½ pixel', titolo: 'Per esplorare: poi "Rifinisci" porta la bozza scelta in alta qualità' },
                { id: 'alta', nome: 'Alta', sotto: '40 passi' },
                { id: 'massima', nome: 'Massima', sotto: '50 passi' }
              ]}
            />
            {crea.qualita === 'turbo' && <AvvisoTurbo />}
            {bozza && <div className="piccolo tenue" style={{ marginTop: 8 }}>Esplori più idee in poco tempo; sulla bozza che ti piace premi <b className="oro">Rifinisci</b>.</div>}
          </SezioneChiudibile>

          <div className="sezione">
            <Riferimenti
              lista={crea.riferimenti}
              cambia={(riferimenti) => setCrea({ riferimenti })}
              inizio={1}
              inserisci={inserisci}
              esempio={'Una persona, un vestito, un oggetto, uno stile: "una donna come <image1> su una spiaggia", "la giacca di <image1> addosso a un robot". Fino a 9 foto.'}
            />
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

          <SezioneChiudibile id="crea-lora" titolo="LoRA" destra={loraAttive.filter((a) => a.file !== imp?.loraTurbo).length ? `${loraAttive.filter((a) => a.file !== imp?.loraTurbo).length} attivi` : undefined} aperta={false}>
            <SceltaLora />
          </SezioneChiudibile>

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
                {crea.qualita === 'turbo' && <div className="piccolo oro">Col Turbo CFG, sampler e scheduler restano quelli suoi (1, euler, simple).</div>}
                <Cursore etichetta="CFG (1 = percorso ufficiale)" valore={crea.cfg} min={1} max={6} passo={0.1} formato={(v) => v.toFixed(1)} cambia={(cfg) => setCrea({ cfg })} />
                <div className="col" style={{ gap: 4 }}>
                  <span className="piccolo tenue">Prompt negativo {crea.cfg <= 1 && <span className="spento">(conta solo con CFG sopra 1, e raddoppia il tempo)</span>}</span>
                  <Casella valore={crea.negativo} cambia={(negativo) => setCrea({ negativo })} minimo={60} placeholder="es. sfocato, mani storte, testo" />
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
            <VistaZoom src={urlFile(op.file)} scacchi={op.trasparente} />
          ) : (
            <div className="vuoto">
              <div className="grosso">CREA CON <b>QWEN-IMAGE 2.1</b></div>
              <p>Scrivi a sinistra cosa vuoi vedere e premi <b className="oro">Crea</b> (<kbd>Ctrl</kbd>+<kbd>Invio</kbd>).</p>
              <p>Puoi accodare quante immagini vuoi: partono una dopo l'altra.</p>
              {recenti.length > 0 && (
                <div className="recenti-crea">
                  <span className="piccolo tenue">Riparti da una delle ultime (rimette prompt e impostazioni)</span>
                  <div className="griglia-recenti">
                    {recenti.map((o) => (
                      <div key={o.id} role="button" tabIndex={0} className="t" onClick={() => riusa(o)} onKeyDown={(e) => e.key === 'Enter' && riusa(o)} title={o.prompt}>
                        <img src={urlFile(o.miniatura || o.file)} alt="" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

/** la foto che nasce (anteprima nitida a ogni passo); fase, passi e tempo stanno nella barra in basso.
 *  Sta sempre dentro l'area (come la foto finita con lo zoom): la scatola si adatta alle proporzioni, mai oltre i bordi. */
export function InCorso({ l, ar }: { l: Lavoro; ar: string }): JSX.Element {
  const [nat, setNat] = useState<number | null>(null)
  const [a, b] = ar.split('/').map((x) => Number(x.trim()) || 1)
  return (
    <AdattaFoto ar={nat ?? a / b} margine={22}>
      {l.anteprima ? <img src={l.anteprima} alt="" onLoad={(e) => setNat(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} /> : <div className="attesa-grande" />}
    </AdattaFoto>
  )
}
