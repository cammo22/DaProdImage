// Crea: dal testo all'immagine. GUI v2: ogni scelta è una tessera (motore, genere, atmosfera, stile, formato, misura, sfondo, quante),
// la misura finale è sempre sul palco (HUD) e il prompt di stile/sfondo si aggiunge da sé al momento di mandare.
import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { usaStato } from '../stato'
import { api, urlFile } from '../api'
import { I } from '../componenti/Icone'
import { ImgAsset } from '../componenti/Tessere'
import { MASCOTTE, SFONDI } from '../anteprime'
import { AdattaFoto } from '../componenti/AdattaFoto'
import { SezioneChiudibile } from '../componenti/Controlli'
import { conParoleLora } from '../componenti/SceltaLora'
import { percentuale } from '../componenti/Coda'
import { VistaZoom } from '../componenti/VistaZoom'
import { AtmosferaGenere, CampiGenere, GrigliaGeneri } from '../componenti/Generi'
import { IntensitaStile, ScaffaliStili } from '../componenti/ScaffaliStili'
import { HudCrea, SezFormato, SezMisura, SezQuante, SezSfondo } from '../componenti/SezioniCrea'
import { Hud } from '../componenti/Hud'
import { SceltaLora } from '../componenti/SceltaLora'
import { Riferimenti } from '../componenti/Riferimenti'
import { Casella } from '../componenti/Casella'
import { InterruttoreLLM } from '../componenti/InterruttoreLLM'
import { durata, normalizza, stimaSecondi, FORMATI } from '../util'
import { SISTEMA_DESCRIVI, SISTEMA_IDEA, SISTEMA_MIGLIORA, apriInEstrai, apriInModifica, fotoDaOpera, richiestaBase, rifaiCon, rifacibileIn, rifinisci, riusa, varia, ingrandisci } from '../azioni'
import { presetDa } from '../preset'
import { stileDa } from '../stili'
import { misuraCrea } from '../misura'
import { promptCrea, sfondoRichiesto } from '../creaPrompt'
import { MODELLI, modelloDaImpostazioni, parametriModello } from '@shared/modelli'
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
  const prompt = useRef<HTMLTextAreaElement>(null)
  // le ultime opere della galleria, per ripartire da lì quando la pagina è vuota
  const [recenti, setRecenti] = useState<Opera[]>([])
  useEffect(() => {
    void api.galleria.elenco({ modalita: 'tutte' }).then((l) => setRecenti(l.slice(0, 8)))
  }, [lavori.filter((l) => l.stato === 'fatto').length])

  // la misura: la stessa funzione che costruisce la richiesta e che disegna il HUD («la cifra che vedi è quella che esce»)
  const mis = misuraCrea(crea)
  const { finale, lav } = mis
  // il modello si sceglie dalla barra in alto e porta con sé i passi (e il CFG)
  const modello = MODELLI[modelloDaImpostazioni(imp)]
  const passi = modello.passi
  const quante = Math.max(1, Math.min(8, crea.quante))
  const preset = presetDa(crea.preset)
  const stima = stimaSecondi(imp?.tempi, (lav.w * lav.h) / 1048576, passi) * quante
  const qwen = (imp?.famiglia || 'qwen') === 'qwen'
  // Klein ha un'interfaccia più semplice: niente generi, stili, box e ricette. Una sola pagina: scrivi, e se vuoi aggiungi foto
  // (la prima è quella che cambia, le altre sono riferimenti). Senza foto disegna da zero.
  const klein = !qwen
  const conFoto = klein && crea.riferimenti.length > 0
  const comeLaFoto = conFoto && !crea.misuraLibera

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
    // Klein con foto, misura «come la foto 1»: è una modifica (esce grande come la prima foto, a ~1 MP al massimo)
    const prima = crea.riferimenti[0]
    const mpFoto = prima ? Math.round(Math.max(0.3, Math.min(1, (prima.larghezza * prima.altezza) / 1048576)) * 100) / 100 : 1
    const q = {
      ...richiestaBase(),
      modalita: 'crea' as const,
      prompt: conParoleLora(promptCrea(crea, qwen)),
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
      trasparente: crea.sfondo === 'trasparente',
      sfondo: sfondoRichiesto(crea),
      ...parametriModello(modello.id),
      ...(comeLaFoto && prima ? { modalita: 'modifica' as const, megapixel: mpFoto, larghezza: prima.larghezza, altezza: prima.altezza, uscita: undefined } : {}),
      etichetta: preset ? preset.nome : stileDa(crea.stileId)?.nome
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
    const t = prompt.current
    const v = crea.prompt
    const i = t ? t.selectionStart : v.length
    setCrea({ prompt: v.slice(0, i) + testo + v.slice(i) })
  }

  const stileAttivo = stileDa(crea.stileId)
  const nLora = usaStato((s) => s.loraAttive.length)

  return (
    <div className="pagina">
      <div className="palco">
        <div className={`vista sfondo-${crea.anteSfondo}`} style={{ ['--tinta-vista' as string]: crea.tinta }}>
          {mostraInCorso && inCorso ? (
            <InCorso l={inCorso} ar={ar(crea.formato)} />
          ) : op ? (
            <VistaZoom src={urlFile(op.file)} scacchi={op.trasparente} />
          ) : (
            <div className="vuoto">
              <ImgAsset chiave={SFONDI.eroe} className="hero-pianeta" />
              <ImgAsset chiave={MASCOTTE.vuoto} className="mascotte-vuoto" />
              <div className="grosso">COSA COSTRUIAMO <b>OGGI?</b></div>
              {klein ? (
                <>
                  <p>Scrivi a destra cosa vuoi vedere e premi <b className="oro">Crea</b> (<kbd>Ctrl</kbd>+<kbd>Invio</kbd>).</p>
                  <p>Per cambiare una foto, o unire persone e cose di più foto, aggiungile sotto il testo: Klein fa tutto da solo.</p>
                </>
              ) : (
                <>
                  <p>Scrivi a sinistra cosa vuoi vedere e premi <b className="oro">Crea</b> (<kbd>Ctrl</kbd>+<kbd>Invio</kbd>).</p>
                  <p>Puoi accodare quante immagini vuoi: partono una dopo l'altra.</p>
                </>
              )}
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
          {/* con foto «come la foto 1» la misura la decide la foto: il riquadro con 1024 × 1024 non direbbe il vero */}
          {!comeLaFoto && <HudCrea />}
        </div>
        {op && !mostraInCorso && (
          <div className="azioni-risultato">
            <button className="btn" onClick={() => apriInModifica(fotoDaOpera(op))} title={klein ? 'Usa questa immagine come foto da cambiare: scrivi cosa vuoi cambiare' : undefined}><I.modifica /> {klein ? 'Cambia' : 'Modifica'}</button>
            {!klein && <button className="btn" onClick={() => apriInEstrai(fotoDaOpera(op))} title="Estrai una persona o un oggetto da questa immagine"><I.estrai /> Estrai</button>}
            <button className="btn" onClick={() => varia(op)} title="Due variazioni che tengono la composizione"><I.varia /> Varia</button>
            {rifacibileIn(op).includes('klein-base') && <button className="btn primario" onClick={() => void rifaiCon(op, 'klein-base')} title="Rifà questa foto con Klein Base (50 passi, CFG 3,5): stesso prompt e stesso seed, la stessa famiglia di modelli"><I.crea /> Rifai in qualità piena</button>}
            {rifacibileIn(op).includes('qwen-base') && <button className="btn" onClick={() => void rifaiCon(op, 'qwen-base')} title="Rifà il prompt con Qwen-Image 2.1 (25 passi, coi LoRA): è un altro modello, non esce la stessa immagine"><I.crea /> Rifai con Qwen</button>}
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
        {op && !mostraInCorso && op.promptInglese && (
          <details className="llm-scritto">
            <summary>Quello che ha visto il modello (in inglese, scritto dall&apos;LLM o tradotto)</summary>
            <p>{op.promptInglese}</p>
          </details>
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

      <div className="colonna destra">
        <div className="scorri">
          {!klein && (
            <>
          {preset && (
            <div className="sezione">
              <h3>Genere <span className="dx">{preset.nome}</span></h3>
              <CampiGenere />
            </div>
          )}

          <div className="sezione">
            <h3>
              {preset ? 'Prompt (lo scrive il genere)' : 'Cosa vuoi vedere'}
              <span className="dx">{crea.prompt.length > 0 && `${crea.prompt.length} car.`}</span>
            </h3>
            <Casella
              inputRef={prompt}
              valore={crea.prompt}
              placeholder="Descrivi l'immagine, anche in italiano."
              cambia={(p) => setCrea({ prompt: p })}
              minimo={preset ? 90 : 120}
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
            <InterruttoreLLM />
          </div>

          <div className="sezione">
            <h3>Formato <span className="dx oro">{finale.w} × {finale.h} px</span></h3>
            <SezFormato />
            <h4 className="sotto">Misura <span className="dx">lato corto {Math.min(finale.w, finale.h)} px</span></h4>
            <SezMisura />
          </div>

          <SezioneChiudibile id="crea-genere" titolo="Genere" aperta={false} destra={preset ? preset.nome : 'libero'}>
            <GrigliaGeneri prima={setPrecedente} />
            {preset && preset.stili.length > 1 && (
              <>
                <h4 className="sotto">Atmosfera</h4>
                <AtmosferaGenere />
              </>
            )}
          </SezioneChiudibile>

          <SezioneChiudibile id="crea-stile" titolo="Stile" aperta={false} destra={stileAttivo ? stileAttivo.nome : 'nessuno'}>
            <ScaffaliStili valore={crea.stileId} scegli={(stileId) => setCrea({ stileId })} />
            {stileAttivo && <IntensitaStile valore={crea.intensita} cambia={(intensita) => setCrea({ intensita })} />}
          </SezioneChiudibile>

          <SezioneChiudibile id="crea-altro" titolo="Altro" aperta={false} destra={[crea.sfondo !== 'scena' && 'sfondo', crea.riferimenti.length > 0 && `${crea.riferimenti.length} foto`, quante > 1 && `${quante} immagini`].filter(Boolean).join(' · ') || 'sfondo, foto, quante'}>
            <h4 className="sotto">Sfondo</h4>
            <SezSfondo />
            <Riferimenti
              lista={crea.riferimenti}
              cambia={(riferimenti) => setCrea({ riferimenti })}
              inizio={1}
              inserisci={inserisci}
              esempio={'Una persona, un vestito, un oggetto, uno stile: "una donna come <image1> su una spiaggia". Fino a 9 foto.'}
            />
            <h4 className="sotto">Quante <span className="dx">{quante > 1 ? `${quante}, una dopo l'altra` : ''}</span></h4>
            <SezQuante />
            {!crea.casuale && (
              <div className="riga" style={{ marginTop: 8 }}>
                <span className="piccolo tenue">Seed</span>
                <input type="number" value={crea.seed} onChange={(e) => setCrea({ seed: Math.max(0, Number(e.target.value) || 0) })} style={{ width: 130 }} />
              </div>
            )}
          </SezioneChiudibile>

          <SezioneChiudibile id="crea-lora" titolo="LoRA" aperta={false} destra={nLora ? `${nLora} accesi` : 'nessuno'}>
            <SceltaLora />
          </SezioneChiudibile>
            </>
          )}

          {klein && (
            <>
              <div className="sezione">
                <h3>
                  {conFoto ? 'Cosa cambio?' : 'Cosa vuoi vedere'}
                  <span className="dx">{crea.prompt.length > 0 && `${crea.prompt.length} car.`}</span>
                </h3>
                <Casella
                  inputRef={prompt}
                  valore={crea.prompt}
                  placeholder={conFoto ? 'Es.: metti la persona della foto 2 al posto di quella della foto 1' : "Descrivi l'immagine, anche in italiano."}
                  cambia={(p) => setCrea({ prompt: p })}
                  minimo={110}
                  disabled={scrivendo}
                />
                <InterruttoreLLM />
              </div>

              <div className="sezione">
                <Riferimenti
                  titolo="Foto"
                  lista={crea.riferimenti}
                  cambia={(riferimenti) => setCrea({ riferimenti })}
                  inizio={1}
                  max={10}
                  inserisci={inserisci}
                  esempio="Aggiungi una foto per cambiarla; due o più per unire persone, vestiti e oggetti. La prima è quella che cambia, le altre sono riferimenti."
                />
              </div>

              {comeLaFoto ? (
                <div className="sezione">
                  <h3>Misura <span className="dx oro">come la foto 1</span></h3>
                  <div className="riga a-capo">
                    <span className="piccolo tenue">Esce grande come la prima foto.</span>
                    <button className="btn piccolo fantasma" onClick={() => setCrea({ misuraLibera: true })}>Scelgo io</button>
                  </div>
                </div>
              ) : (
                <div className="sezione">
                  <h3>Formato <span className="dx oro">{finale.w} × {finale.h} px</span></h3>
                  <SezFormato />
                  <h4 className="sotto">Misura <span className="dx">lato corto {Math.min(finale.w, finale.h)} px</span></h4>
                  <SezMisura />
                  {conFoto && <button className="btn piccolo fantasma" style={{ marginTop: 8 }} onClick={() => setCrea({ misuraLibera: false })}>Come la foto 1</button>}
                </div>
              )}

              <SezioneChiudibile id="crea-altro-klein" titolo="Altro" aperta={false} destra={quante > 1 ? `${quante} immagini` : 'quante, seed'}>
                <h4 className="sotto">Quante <span className="dx">{quante > 1 ? `${quante}, una dopo l'altra` : ''}</span></h4>
                <SezQuante />
                {!crea.casuale && (
                  <div className="riga" style={{ marginTop: 8 }}>
                    <span className="piccolo tenue">Seed</span>
                    <input type="number" value={crea.seed} onChange={(e) => setCrea({ seed: Math.max(0, Number(e.target.value) || 0) })} style={{ width: 130 }} />
                  </div>
                )}
              </SezioneChiudibile>

              <SezioneChiudibile id="crea-lora" titolo="LoRA" aperta={false} destra={nLora ? `${nLora} accesi` : 'nessuno'}>
                <SceltaLora />
              </SezioneChiudibile>
            </>
          )}
        </div>

        <div className="sezione azione-prima" style={{ borderTop: '1px solid var(--bordo-vetro)' }}>
          <div className="riga-info">
            <div className="scelte-attive" aria-label="Scelte attive">
              {preset && <button type="button" title={`Genere: ${preset.nome} (clic: torna a Libero)`} onClick={() => setCrea({ preset: '' })}><I.libero /></button>}
              {stileAttivo && <button type="button" title={`Stile: ${stileAttivo.nome} (clic: toglilo)`} onClick={() => setCrea({ stileId: '' })}><span aria-hidden>{stileAttivo.icona}</span></button>}
              {crea.sfondo !== 'scena' && <button type="button" title={crea.sfondo === 'trasparente' ? 'Senza sfondo (clic: torna alla scena)' : 'Tinta unita (clic: torna alla scena)'} onClick={() => setCrea({ sfondo: 'scena', trasparente: false })}>{crea.sfondo === 'trasparente' ? <I.scacchi /> : <I.tinta />}</button>}
              {crea.riferimenti.length > 0 && <button type="button" title={`${crea.riferimenti.length} foto di riferimento`} onClick={() => setCrea({ riferimenti: [] })}><I.immagine /></button>}
              {nLora > 0 && <button type="button" title={`${nLora} LoRA accesi`} onClick={() => usaStato.getState().vai('lora')}><I.pila /></button>}
            </div>
            {!comeLaFoto && <Hud corto d={{ w: finale.w, h: finale.h, rapporto: mis.rapporto, mp: mis.mp, stato: mis.stato, nota: mis.nota }} />}
          </div>
          <button className="btn primario grande aurora" style={{ width: '100%' }} onClick={vai}>
            <I.crea /> {quante > 1 ? `CREA ${quante} IMMAGINI` : 'CREA'}
          </button>
          <div className="piccolo spento" style={{ textAlign: 'center' }}>Ctrl+Invio · ~{durata(stima)}</div>
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
