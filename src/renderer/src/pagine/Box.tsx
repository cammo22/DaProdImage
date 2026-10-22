// Box: l'editor regionale. Disegni dei riquadri sulla tela (stesso formato e stessa misura di Crea), ognuno con il suo testo,
// il suo tipo, la sua foto di riferimento e quanto è rigido. Il motore riceve `box` + `promptScena`; intanto la descrizione a parole
// (box.ts) finisce anche nel prompt, così il disegno conta con qualunque modello.
import { useEffect, useMemo, useRef, useState, type JSX, type PointerEvent as PE } from 'react'
import { usaStato, scegliFoto } from '../stato'
import { api, urlFile } from '../api'
import { I } from '../componenti/Icone'
import { Tessera, Tessere, E } from '../componenti/Tessere'
import { AdattaFoto } from '../componenti/AdattaFoto'
import { Casella } from '../componenti/Casella'
import { SezioneChiudibile } from '../componenti/Controlli'
import { SelettoreModello } from '../componenti/ScegliModello'
import { HudCrea, SezFormato, SezMisura, SezQuante, SezSfondo } from '../componenti/SezioniCrea'
import { IntensitaStile, ScaffaliStili } from '../componenti/ScaffaliStili'
import { Hud } from '../componenti/Hud'
import { InCorso } from './Crea'
import { conParoleLora } from '../componenti/SceltaLora'
import { percentuale } from '../componenti/Coda'
import { VistaZoom } from '../componenti/VistaZoom'
import { MODELLI, modelloDaImpostazioni, parametriModello } from '@shared/modelli'
import { durata, stimaSecondi } from '../util'
import { misuraCrea } from '../misura'
import { promptCrea, sfondoRichiesto } from '../creaPrompt'
import { stileDa } from '../stili'
import { richiestaBase } from '../azioni'
import { DISPOSIZIONI, MAX_BOX, RIGIDITA, TIPI_BOX, coloreBox, nuovaRegione, promptDaBox, rettDaPunti, trasforma, type Maniglia, type Rect } from '../box'
import type { BoxRegione, Opera } from '@shared/tipi'

const MANIGLIE: Maniglia[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const ICONA_TIPO: Record<BoxRegione['tipo'], () => JSX.Element> = { persona: I.ritratto, oggetto: I.prodotto, testo: I.testo, sfondo: I.scena }

/** quel che succede con il mouse: disegnare un riquadro nuovo, spostarne uno, o tirarne una maniglia */
type Gesto = { tipo: 'disegna'; x: number; y: number } | { tipo: 'muovi'; id: string; m: Maniglia; x: number; y: number; rect: Rect }

export function Box(): JSX.Element {
  const { crea, setCrea, box, setBox, imp, lavori, avvisa } = usaStato()
  const cornice = useRef<HTMLDivElement>(null)
  const gesto = useRef<Gesto | null>(null)
  const [bozza, setBozza] = useState<Rect | null>(null)
  const [opere, setOpere] = useState<Record<string, Opera>>({})
  const [scelto, setScelto] = useState<string | null>(null)
  const [vedoInCorso, setVedoInCorso] = useState(true)
  const [vistaRis, setVistaRis] = useState(false)

  const mis = misuraCrea(crea)
  const { finale, lav } = mis
  const modello = MODELLI[modelloDaImpostazioni(imp)]
  const quante = Math.max(1, Math.min(8, crea.quante))
  const stima = stimaSecondi(imp?.tempi, (lav.w * lav.h) / 1048576, modello.passi) * quante
  const stileAttivo = stileDa(crea.stileId)
  const { regioni, selezionata, scena } = box
  const sel = regioni.find((r) => r.id === selezionata) || null

  // i lavori partiti da qui (hanno `box`): il risultato si guarda sulla tela al posto dei riquadri
  const miei = useMemo(() => lavori.filter((l) => l.richiesta.modalita === 'crea' && !!l.richiesta.box), [lavori])
  const inCorso = miei.find((l) => l.stato === 'in corso')
  useEffect(() => {
    if (inCorso) {
      setVedoInCorso(true)
      setVistaRis(false)
    }
  }, [inCorso?.id])
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
  useEffect(() => {
    if (risultati[0]) {
      setScelto(risultati[0])
      setVistaRis(true)
      setVedoInCorso(false)
    }
  }, [risultati[0]])
  const op = scelto ? opere[scelto] : undefined
  const mostraInCorso = !!inCorso && vedoInCorso

  const cambia = (id: string, m: Partial<BoxRegione>): void => setBox({ regioni: usaStato.getState().box.regioni.map((r) => (r.id === id ? { ...r, ...m } : r)) })
  const seleziona = (id: string | null): void => setBox({ selezionata: id })
  const togli = (id: string): void => {
    const s = usaStato.getState().box
    setBox({ regioni: s.regioni.filter((x) => x.id !== id), selezionata: s.selezionata === id ? null : s.selezionata })
  }
  const duplica = (id: string): void => {
    const s = usaStato.getState().box
    const o = s.regioni.find((r) => r.id === id)
    if (!o || s.regioni.length >= MAX_BOX) return
    const n = { ...nuovaRegione(trasforma(o.rect, 'corpo', 0.04, 0.04), s.regioni, o.tipo), prompt: o.prompt, rigidita: o.rigidita }
    setBox({ regioni: [...s.regioni, n], selezionata: n.id })
  }

  // ---- il mouse sulla tela ----
  const punto = (e: PE): { x: number; y: number } => {
    const r = cornice.current!.getBoundingClientRect()
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }
  }
  const giuTela = (e: PE): void => {
    if (e.button !== 0 || vistaRis) return
    if (usaStato.getState().box.regioni.length >= MAX_BOX) {
      avvisa(`Al massimo ${MAX_BOX} riquadri`, 'errore')
      return
    }
    const p = punto(e)
    gesto.current = { tipo: 'disegna', ...p }
    setBozza([p.x, p.y, p.x, p.y])
    e.currentTarget.setPointerCapture(e.pointerId)
    seleziona(null)
  }
  const giuRegione = (e: PE, r: BoxRegione, m: Maniglia): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    const p = punto(e)
    gesto.current = { tipo: 'muovi', id: r.id, m, x: p.x, y: p.y, rect: r.rect }
    cornice.current?.setPointerCapture(e.pointerId)
    seleziona(r.id)
  }
  const muoviTela = (e: PE): void => {
    const g = gesto.current
    if (!g) return
    const p = punto(e)
    if (g.tipo === 'disegna') setBozza(rettDaPunti(g.x, g.y, p.x, p.y))
    else cambia(g.id, { rect: trasforma(g.rect, g.m, p.x - g.x, p.y - g.y) })
  }
  const suTela = (e: PE): void => {
    const g = gesto.current
    gesto.current = null
    if (!g) return
    try {
      cornice.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* già rilasciato */
    }
    if (g.tipo !== 'disegna') return
    const p = punto(e)
    const r = rettDaPunti(g.x, g.y, p.x, p.y)
    setBozza(null)
    // un clic senza trascinare non fa un riquadro
    if (r[2] - r[0] < 0.03 || r[3] - r[1] < 0.03) return
    const s = usaStato.getState().box
    const n = nuovaRegione(r, s.regioni, r[2] - r[0] > 0.9 && r[3] - r[1] > 0.9 ? 'sfondo' : 'oggetto')
    setBox({ regioni: [...s.regioni, n], selezionata: n.id })
  }

  // ---- tastiera: Canc elimina, Ctrl+D duplica, frecce muovono (Maiusc = 10×), Tab passa al successivo, Ctrl+Invio lancia ----
  useEffect(() => {
    const t = (e: KeyboardEvent): void => {
      if (usaStato.getState().pagina !== 'box') return
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        void componi()
        return
      }
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
      const s = usaStato.getState().box
      const id = s.selezionata
      if (!id) return
      if (e.key === 'Delete' || e.key === 'Backspace') togli(id)
      else if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplica(id)
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const passo = e.shiftKey ? 0.02 : 0.002
        const r = s.regioni.find((x) => x.id === id)
        if (r) cambia(id, { rect: trasforma(r.rect, 'corpo', e.key === 'ArrowLeft' ? -passo : e.key === 'ArrowRight' ? passo : 0, e.key === 'ArrowUp' ? -passo : e.key === 'ArrowDown' ? passo : 0) })
      } else if (e.key === 'Tab' && s.regioni.length) {
        e.preventDefault()
        const i = s.regioni.findIndex((x) => x.id === id)
        seleziona(s.regioni[(i + (e.shiftKey ? s.regioni.length - 1 : 1)) % s.regioni.length].id)
      } else if (e.key === 'Escape') seleziona(null)
    }
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  })

  // ---- le disposizioni pronte: i riquadri nuovi tengono i testi di quelli che c'erano ----
  const applicaDisposizione = (id: string): void => {
    const d = DISPOSIZIONI.find((x) => x.id === id)
    if (!d) return
    const vecchie = usaStato.getState().box.regioni
    const nuove: BoxRegione[] = d.box.map((b, i) => ({ ...nuovaRegione(b.rect, [], b.tipo), ordine: i + 1, prompt: vecchie[i]?.prompt ?? '', rif: vecchie[i]?.rif, rigidita: vecchie[i]?.rigidita ?? 'decisa' }))
    setBox({ regioni: nuove, selezionata: nuove[0]?.id ?? null })
  }

  const daRif = async (r: BoxRegione): Promise<void> => {
    const [f] = await scegliFoto(false)
    if (f) cambia(r.id, { rif: f.percorso })
  }

  // ---- il lancio ----
  async function componi(): Promise<void> {
    const s = usaStato.getState()
    const nascosti = new Set(s.box.regioni.filter((r) => r.nascosta).map((r) => r.id))
    const attive = s.box.regioni.filter((r) => !nascosti.has(r.id))
    if (!attive.length && !s.box.scena.trim()) {
      avvisa('Disegna almeno un riquadro (o scrivi la scena)', 'errore')
      return
    }
    if (attive.some((r) => r.tipo !== 'sfondo' && !r.prompt.trim() && !r.rif)) {
      avvisa('Ogni riquadro ha bisogno di un testo (o di una foto di riferimento)', 'errore')
      return
    }
    const m = misuraCrea(s.crea)
    const pronti = promptDaBox(s.box.scena, s.box.regioni, nascosti)
    const q = {
      ...richiestaBase(),
      modalita: 'crea' as const,
      prompt: conParoleLora(promptCrea({ ...s.crea, prompt: pronti.prompt }, (s.imp?.famiglia || 'qwen') === 'qwen')),
      // il disegno vale più di una didascalia: niente espansione del prompt
      potenzia: false,
      negativo: '',
      seed: s.crea.casuale ? -1 : s.crea.seed,
      cfg: 1,
      sampler: 'euler',
      scheduler: 'simple',
      larghezza: m.lav.w,
      altezza: m.lav.h,
      megapixel: (m.lav.w * m.lav.h) / 1048576,
      ...(Math.abs(m.finale.w - m.lav.w) > 1 || Math.abs(m.finale.h - m.lav.h) > 1 ? { uscita: { w: m.finale.w, h: m.finale.h } } : {}),
      quante: Math.max(1, Math.min(8, s.crea.quante)),
      immagini: pronti.immagini,
      trasparente: s.crea.sfondo === 'trasparente',
      sfondo: sfondoRichiesto(s.crea),
      box: pronti.regioni,
      promptScena: s.box.scena.trim() || undefined,
      ...parametriModello(MODELLI[modelloDaImpostazioni(s.imp)].id),
      etichetta: `Box · ${pronti.regioni.length} ${pronti.regioni.length === 1 ? 'riquadro' : 'riquadri'}`
    }
    setVistaRis(false)
    await api.lavori.accoda(q)
    if (q.quante > 1) avvisa(`${q.quante} immagini in coda`, 'ok')
  }

  const attivi = regioni.filter((r) => !r.nascosta).length

  return (
    <div className="pagina">
      <div className="palco">
        <div className={`vista sfondo-${crea.anteSfondo}`} style={{ ['--tinta-vista' as string]: crea.tinta }}>
          {mostraInCorso && inCorso ? (
            <InCorso l={inCorso} ar={`${finale.w} / ${finale.h}`} />
          ) : vistaRis && op ? (
            <VistaZoom src={urlFile(op.file)} scacchi={op.trasparente} />
          ) : (
            <AdattaFoto ar={finale.w / finale.h} margine={26}>
              <div ref={cornice} className="box-cornice" style={{ width: '100%', height: '100%' }} onPointerDown={giuTela} onPointerMove={muoviTela} onPointerUp={suTela} onPointerCancel={suTela} data-box-tela>
                {regioni.length === 0 && !bozza && (
                  <div className="box-vuoto"><div><b>DISEGNA UN RIQUADRO</b>Trascina sulla tela e di' cosa ci va dentro. Oppure scegli una disposizione a sinistra.</div></div>
                )}
                {regioni.map((r, i) => (
                  <div
                    key={r.id}
                    className={`box-regione ${r.id === selezionata ? 'sel' : ''} ${r.nascosta ? 'nascosta' : ''}`}
                    style={{ left: `${r.rect[0] * 100}%`, top: `${r.rect[1] * 100}%`, width: `${(r.rect[2] - r.rect[0]) * 100}%`, height: `${(r.rect[3] - r.rect[1]) * 100}%`, ['--c' as string]: coloreBox(i), zIndex: r.ordine }}
                    onPointerDown={(e) => giuRegione(e, r, 'corpo')}
                    data-box={r.id}
                  >
                    <span className="numero">{i + 1}</span>
                    <div className="testo-box">{r.prompt || (r.rif ? 'foto di riferimento' : '')}</div>
                    {r.id === selezionata && MANIGLIE.map((m) => <span key={m} className={`maniglia ${m}`} onPointerDown={(e) => giuRegione(e, r, m)} />)}
                  </div>
                ))}
                {bozza && <div className="box-regione disegno" style={{ left: `${bozza[0] * 100}%`, top: `${bozza[1] * 100}%`, width: `${(bozza[2] - bozza[0]) * 100}%`, height: `${(bozza[3] - bozza[1]) * 100}%`, ['--c' as string]: coloreBox(regioni.length) }} />}
              </div>
            </AdattaFoto>
          )}
          {(mostraInCorso || (vistaRis && op)) && (
            <button className="btn piccolo" style={{ position: 'absolute', right: 16, top: 14, zIndex: 8 }} onClick={() => { setVedoInCorso(false); setVistaRis(false) }} data-azione="torna-riquadri"><I.box /> Torna ai riquadri</button>
          )}
          <HudCrea />
        </div>
        <div className="striscia">
          {miei.filter((l) => l.stato === 'in corso' || l.stato === 'in coda').map((l) => (
            <div key={l.id} className="mini" style={{ ['--ar' as string]: l.richiesta.larghezza ? `${l.richiesta.larghezza} / ${l.richiesta.altezza}` : '1' }} onClick={() => { setVedoInCorso(true); setVistaRis(false) }}>
              {l.anteprima ? <img src={l.anteprima} alt="" /> : null}
              <div className="stato">{l.stato === 'in corso' ? (percentuale(l) !== null ? `${percentuale(l)}%` : '…') : 'in coda'}</div>
            </div>
          ))}
          {risultati.map((id) => {
            const o = opere[id]
            return (
              <div key={id} className={`mini ${scelto === id ? 'su' : ''}`} style={{ ['--ar' as string]: o ? `${o.larghezza} / ${o.altezza}` : '1' }} onClick={() => { setScelto(id); setVistaRis(true); setVedoInCorso(false) }}>
                {o && <img src={urlFile(o.miniatura || o.file)} alt="" />}
              </div>
            )
          })}
          {risultati.length === 0 && miei.length === 0 && <span className="spento piccolo">Qui compaiono le composizioni di questa sessione. Tutte finiscono anche in Galleria.</span>}
        </div>
      </div>

      <div className="colonna destra">
        <div className="scorri">
          <div className="sezione">
            <h3>Motore <span className="dx">{modello.nome}</span></h3>
            <SelettoreModello variante="tessere" />
            {modello.id === 'qwen-base' && <div className="piccolo spento" style={{ marginTop: 6 }}>Con Qwen i riquadri guidano la composizione a parole; con Klein 3 il motore li userà come regioni vere.</div>}
          </div>

          <div className="sezione">
            <h3>Disposizioni</h3>
            <div className="disposizioni">
              {DISPOSIZIONI.map((d) => (
                <button key={d.id} type="button" title={d.nome} onClick={() => applicaDisposizione(d.id)} data-disposizione={d.id}>
                  {d.box.map((b, i) => <i key={i} style={{ left: `${b.rect[0] * 100}%`, top: `${b.rect[1] * 100}%`, width: `${(b.rect[2] - b.rect[0]) * 100}%`, height: `${(b.rect[3] - b.rect[1]) * 100}%` }} />)}
                </button>
              ))}
            </div>
          </div>

          <div className="sezione">
            <h3>Scena generale <span className="dx">facoltativa</span></h3>
            <Casella valore={scena} cambia={(s) => setBox({ scena: s })} minimo={64} placeholder="Luce, atmosfera, stile dell'insieme: «al tramonto, colori caldi, fotografia»" />
          </div>

          <div className="sezione">
            <h3>Riquadri <span className="dx">{regioni.length} / {MAX_BOX}</span></h3>
            {regioni.length === 0 && <div className="piccolo spento">Nessun riquadro: trascina sulla tela per disegnarne uno.</div>}
            <div className="box-lista">
              {regioni.map((r, i) => {
                const aperto = r.id === selezionata
                const Ic = ICONA_TIPO[r.tipo]
                return (
                  <div key={r.id} className={`box-scheda ${aperto ? 'sel' : ''}`} style={{ ['--c' as string]: coloreBox(i) }} data-scheda={r.id}>
                    <div className="testa" onClick={() => seleziona(aperto ? null : r.id)}>
                      <span className="n">{i + 1}</span>
                      <Ic />
                      <span className="riassunto">{r.prompt || (r.rif ? 'foto di riferimento' : <i>da descrivere…</i>)}</span>
                      <button type="button" title={r.nascosta ? 'Mostra' : 'Nascondi (non parte)'} onClick={(e) => { e.stopPropagation(); cambia(r.id, { nascosta: !r.nascosta }) }}>{r.nascosta ? <I.occhioBarrato /> : <I.occhio />}</button>
                      <button type="button" title="Duplica (Ctrl+D)" onClick={(e) => { e.stopPropagation(); duplica(r.id) }}><I.duplica /></button>
                      <button type="button" title="Elimina (Canc)" onClick={(e) => { e.stopPropagation(); togli(r.id) }}><I.cestino /></button>
                    </div>
                    {aperto && (
                      <>
                        <Tessere colonne={4}>
                          {TIPI_BOX.map((t) => {
                            const T = ICONA_TIPO[t.id]
                            return <Tessera key={t.id} id={`tipo-${t.id}`} icona={<T />} nome={t.nome} titolo={t.titolo} su={r.tipo === t.id} onClick={() => cambia(r.id, { tipo: t.id })} />
                          })}
                        </Tessere>
                        <Casella
                          valore={r.prompt}
                          cambia={(prompt) => cambia(r.id, { prompt })}
                          minimo={64}
                          senzaCestino
                          placeholder={r.tipo === 'testo' ? 'Il testo da scrivere (fra virgolette resta identico)' : r.tipo === 'sfondo' ? 'Com\'è lo sfondo' : r.tipo === 'persona' ? 'Chi è e cosa fa: «una ragazza con un cappotto rosso»' : 'Cos\'è: «un cane che dorme»'}
                        />
                        <div className="riga" style={{ gap: 10, alignItems: 'flex-start' }}>
                          {r.rif ? (
                            <div className="rif" style={{ gridTemplateColumns: '64px', width: 64 }}>
                              <div className="r"><img src={urlFile(r.rif)} alt="" /><button className="x" onClick={() => cambia(r.id, { rif: undefined })} title="Togli la foto"><I.x /></button></div>
                            </div>
                          ) : (
                            <button type="button" className="tessera-o" style={{ width: 64, minHeight: 64 }} onClick={() => void daRif(r)} title="Una foto che diventa il riferimento di questo riquadro (persona, oggetto, vestito)"><span className="ic"><I.piu /></span><span className="nome">Foto</span></button>
                          )}
                          <div style={{ flex: 1 }}>
                            <div className="rigidita">
                              {RIGIDITA.map((g) => <Tessera key={g.id} id={`rigidita-${g.id}`} icona={E(g.id === 'guida' ? '◔' : g.id === 'decisa' ? '◑' : '●')} nome={g.nome} titolo={g.titolo} su={r.rigidita === g.id} onClick={() => cambia(r.id, { rigidita: g.id })} />)}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="sezione">
            <h3>Formato <span className="dx oro">{finale.w} × {finale.h} px</span></h3>
            <SezFormato />
          </div>
          <div className="sezione">
            <h3>Misura</h3>
            <SezMisura />
          </div>
          <SezioneChiudibile id="box-stile" titolo="Stile" aperta={false} destra={stileAttivo ? stileAttivo.nome : 'nessuno'}>
            <ScaffaliStili valore={crea.stileId} scegli={(stileId) => setCrea({ stileId })} />
            {stileAttivo && <IntensitaStile valore={crea.intensita} cambia={(intensita) => setCrea({ intensita })} />}
          </SezioneChiudibile>
          <SezioneChiudibile id="box-sfondo" titolo="Sfondo" aperta={false} destra={crea.sfondo === 'scena' ? 'scena' : crea.sfondo === 'trasparente' ? 'senza sfondo' : 'tinta unita'}>
            <SezSfondo />
          </SezioneChiudibile>
          <div className="sezione">
            <h3>Quante</h3>
            <SezQuante />
          </div>
        </div>

        <div className="sezione azione-prima" style={{ borderTop: '1px solid var(--bordo-vetro)' }}>
          <div className="riga-info">
            <span className="piccolo tenue">{attivi} {attivi === 1 ? 'riquadro' : 'riquadri'}{sel ? ` · selezionato il ${regioni.indexOf(sel) + 1}` : ''}</span>
            <Hud corto d={{ w: finale.w, h: finale.h, rapporto: mis.rapporto, mp: mis.mp, stato: mis.stato, nota: mis.nota }} />
          </div>
          <button className="btn primario grande aurora" style={{ width: '100%' }} onClick={() => void componi()} data-azione="componi">
            <I.box /> {quante > 1 ? `COMPONI ${quante} IMMAGINI` : 'COMPONI'}
          </button>
          <div className="piccolo spento" style={{ textAlign: 'center' }}>Ctrl+Invio · ~{durata(stima)}</div>
        </div>
      </div>
    </div>
  )
}
