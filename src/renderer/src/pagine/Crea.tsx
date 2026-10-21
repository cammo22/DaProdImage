// Crea: dal testo all'immagine.
import { useEffect, useMemo, useState, type JSX } from 'react'
import { usaStato } from '../stato'
import { api, urlFile } from '../api'
import { I } from '../componenti/Icone'
import { AdattaFoto } from '../componenti/AdattaFoto'
import { Interruttore, SezioneChiudibile, Segmenti } from '../componenti/Controlli'
import { SceltaMisura, ScegliMp, Uscita, MISURA0, dimMp } from '../componenti/Misura'
import { SceltaLora, conParoleLora } from '../componenti/SceltaLora'
import { percentuale } from '../componenti/Coda'
import { MenuStili, SchedaPreset } from '../componenti/Preset'
import { VistaZoom } from '../componenti/VistaZoom'
import { FORMATI, RISOLUZIONI, dimensioniRis, durata, normalizza, stimaSecondi } from '../util'
import { Riferimenti } from '../componenti/Riferimenti'
import { SISTEMA_DESCRIVI, SISTEMA_IDEA, SISTEMA_MIGLIORA, apriInModifica, fotoDaOpera, richiestaBase, rifaiCon, rifacibileIn, rifinisci, riusa, varia, ingrandisci } from '../azioni'
import { presetDa } from '../preset'
import { MODELLI, modelloDaImpostazioni, parametriModello } from '@shared/modelli'
import { Casella } from '../componenti/Casella'
import type { Lavoro, Opera } from '@shared/tipi'


const ar = (f: string): string => {
  const x = FORMATI.find((v) => v.id === f) || FORMATI[0]
  return `${x.w} / ${x.h}`
}

export function Crea(): JSX.Element {
  const { crea, setCrea, imp, lavori, avvisa } = usaStato()
  const [precedente, setPrecedente] = useState<string | null>(null)
  const [scrivendo, setScrivendo] = useState(false)
  const [scelto, setScelto] = useState<string | null>(null)
  const [opere, setOpere] = useState<Record<string, Opera>>({})
  const [vedoInCorso, setVedoInCorso] = useState(true)
  // le ultime opere della galleria, per ripartire da lì quando la pagina è vuota
  const [recenti, setRecenti] = useState<Opera[]>([])
  useEffect(() => {
    void api.galleria.elenco({ modalita: 'tutte' }).then((l) => setRecenti(l.slice(0, 8)))
  }, [lavori.filter((l) => l.stato === 'fatto').length])

  const dim = dimensioniRis(crea.formato, crea.ris)
  // la foto che esce (la misura precisa se c'è, se no la risoluzione scelta) e le dimensioni a cui la disegna il modello: con i megapixel
  // scelti il modello lavora a quelli (anche 4 MP per una foto da 480p) e poi la riduce alla misura finale
  const mis = crea.misura?.tipo === 'custom' ? crea.misura : null
  const finale = mis ? { w: mis.w, h: mis.h } : dim
  const mpLav = crea.mpLavoro ? Math.min(crea.mpLavoro, 4.19) : 0
  const m16 = (x: number): number => Math.max(256, Math.round(x / 16) * 16)
  const lav = mpLav
    ? dimMp(mpLav, finale.w, finale.h)
    : mis
      ? { w: m16(Math.sqrt(dim.w * dim.h * (mis.w / mis.h))), h: m16(Math.sqrt((dim.w * dim.h) / (mis.w / mis.h))) }
      : dim
  // il modello si sceglie dalla barra in alto e porta con sé i passi (e il CFG): qui non c'è niente da regolare
  const modello = MODELLI[modelloDaImpostazioni(imp)]
  const passi = modello.passi
  const quante = crea.quante <= 1 ? 1 : crea.quante <= 2 ? 2 : 4
  const preset = presetDa(crea.preset)
  const stima = stimaSecondi(imp?.tempi, (lav.w * lav.h) / 1048576, passi) * quante

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
      // Klein: la richiesta breve si espande in una didascalia dettagliata (se non è un preset, che il prompt lo scrive già lungo)
      potenzia: !preset,
      // i valori ufficiali del modello (Klein sceglie CFG, sampler e scheduler da sé nel motore)
      negativo: '',
      seed: crea.casuale ? -1 : crea.seed,
      cfg: 1,
      sampler: 'euler',
      scheduler: 'simple',
      larghezza: lav.w,
      altezza: lav.h,
      megapixel: (lav.w * lav.h) / 1048576,
      // se il modello lavora a una misura diversa da quella che vuoi, il motore porta la foto alla misura finale
      ...(Math.abs(finale.w - lav.w) > 1 || Math.abs(finale.h - lav.h) > 1 ? { uscita: { w: finale.w, h: finale.h } } : {}),
      quante,
      immagini: crea.riferimenti.map((r) => r.percorso),
      trasparente: crea.trasparente,
      ...parametriModello(modello.id),
      etichetta: preset ? preset.nome : undefined
    }
    await api.lavori.accoda(q)
    if (quante > 1) avvisa(`${quante} immagini in coda`, 'ok')
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
      <div className="colonna">
        <div className="scorri">
          <div className="sezione">
            <MenuStili prima={setPrecedente} />
          </div>
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
            {(imp?.famiglia || 'qwen') === 'qwen' && <div style={{ marginTop: 10 }}><SceltaLora /></div>}
          </div>

          <div className="sezione">
            <h3>Formato <span className="dx">{finale.w} × {finale.h} px</span></h3>
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
            <h3 style={{ marginTop: 14 }}>Lato corto</h3>
            <div className="risoluzioni">
              {RISOLUZIONI.map((r) => (
                <button key={r.id} className={`formato ${crea.ris === r.id ? 'su' : ''}`} onClick={() => setCrea({ ris: r.id })} title={r.titolo}>
                  <b>{r.nome}</b>
                  <small>{r.sotto}</small>
                </button>
              ))}
            </div>
          </div>

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
            <h3>Quante <span className="dx">{quante > 1 ? `${quante} immagini, una dopo l'altra` : ''}</span></h3>
            <Segmenti valore={quante} voci={[{ id: 1, nome: '1' }, { id: 2, nome: '2' }, { id: 4, nome: '4' }]} cambia={(q) => setCrea({ quante: q })} />
          </div>

          <SezioneChiudibile id="crea-altro" titolo="Altro" aperta={false} destra="seed, megapixel, misura, sfondo">
            <div className="col" style={{ gap: 14 }}>
              <div className="col" style={{ gap: 6 }}>
                <h3 style={{ margin: 0 }}>Seed</h3>
                <div className="riga">
                  <button className={`btn piccolo ${crea.casuale ? 'attivo' : ''}`} onClick={() => setCrea({ casuale: !crea.casuale })} title="Seed casuale a ogni immagine">
                    <I.dado /> {crea.casuale ? 'Casuale' : 'Fisso'}
                  </button>
                  {!crea.casuale && <input type="number" value={crea.seed} onChange={(e) => setCrea({ seed: Math.max(0, Number(e.target.value) || 0) })} style={{ width: 130 }} />}
                </div>
              </div>
              <Interruttore acceso={crea.trasparente} cambia={(trasparente) => setCrea({ trasparente })} sotto="PNG con sfondo trasparente (canale alfa nativo di Qwen-Image 2.1)">
                Sfondo trasparente
              </Interruttore>
              <div>
            <h3>Megapixel del modello <span className="dx">{crea.mpLavoro ? `${(lav.w * lav.h / 1048576).toFixed(2).replace('.', ',')} MP` : 'come la misura finale'}</span></h3>
            <span className="piccolo spento" style={{ display: 'block', marginBottom: 6 }}>A quanti megapixel disegna il modello. Con più megapixel della risoluzione finale disegna grande e poi riduce: più dettagli e linee più pulite anche per una foto piccola (es. 480p disegnata a 4 MP).</span>
            <ScegliMp mp={crea.mpLavoro} cambia={(mpLavoro) => setCrea({ mpLavoro })} ar={{ w: finale.w, h: finale.h }} auto="come la misura" />
            <Uscita w={finale.w} h={finale.h} nota={Math.abs(finale.w - lav.w) > 1 || Math.abs(finale.h - lav.h) > 1 ? `disegnata a ${lav.w}×${lav.h} e poi portata qui` : undefined} />
            <h3 style={{ marginTop: 14 }}>Misura precisa <span className="dx">{crea.misura?.tipo === 'custom' ? 'attiva' : 'no'}</span></h3>
            <SceltaMisura valore={crea.misura ?? MISURA0} cambia={(misura) => setCrea({ misura })} base={null} mp={Math.round((dim.w * dim.h) / 1e5) / 10} ammetti={['auto', 'custom']} auto={{ w: dim.w, h: dim.h }} senzaUscita />
              </div>
            </div>
          </SezioneChiudibile>
        </div>
        <div className="sezione" style={{ borderTop: '1px solid #1d1636' }}>
          <button className="btn primario grande" style={{ width: '100%' }} onClick={vai}>
            <I.crea /> {quante > 1 ? `Crea ${quante} immagini` : 'Crea'}
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
            <button className="btn" onClick={() => apriInModifica(fotoDaOpera(op))}><I.modifica /> Modifica</button>
            <button className="btn" onClick={() => varia(op)} title="Due variazioni che tengono la composizione"><I.varia /> Varia</button>
            {rifacibileIn(op).includes('klein-base') && <button className="btn primario" onClick={() => void rifaiCon(op, 'klein-base')} title="Rifà questa foto con Klein Base (50 passi, CFG 3,5): stesso prompt e stesso seed, la stessa famiglia di modelli"><I.crea /> Rifai in qualità piena</button>}
            {rifacibileIn(op).includes('qwen-base') && <button className="btn" onClick={() => void rifaiCon(op, 'qwen-base')} title="Rifà il prompt con Qwen-Image 2.1 (40 passi, coi LoRA): è un altro modello, non esce la stessa immagine"><I.crea /> Rifai con Qwen</button>}
            <button className="btn" onClick={() => rifinisci(op)} title="Ingrandisce fino al 2K e ridisegna i dettagli"><I.ingrandisci /> Rifinisci 2K</button>
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
