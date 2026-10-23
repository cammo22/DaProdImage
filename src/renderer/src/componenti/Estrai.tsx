// Estrai (modo di Modifica): a sinistra la foto intera con persone e oggetti riquadrati (clic = si illumina quello scelto; trascina per
// riquadrarne uno a mano), a destra quello che hai estratto. I comandi stanno nella colonna di destra e cambiano se hai scelto
// una persona (posa, inquadratura) o un oggetto (vista).
import { useEffect, useRef, useState, type JSX } from 'react'
import { usaStato, passiDi, type FotoBase } from '../stato'
import { api, urlFile } from '../api'
import { I } from './Icone'
import { VistaZoom } from './VistaZoom'
import { AdattaFoto } from './AdattaFoto'
import { percentuale } from './Coda'
import { Contatore, Interruttore, Segmenti } from './Controlli'
import { ScegliMp, Uscita } from './Misura'
import { Omino } from './Omino'
import { controllaScheletro } from '../pulisciOmino'
import { apriInModifica, fotoDaOpera } from '../azioni'
import { durata, stimaSecondi } from '../util'
import {
  FORMATI_ESTRAI, INQUADRATURE, misuraEstrai, POSE_ESTRAI, SFONDI_ESTRAI, VISTE_OGGETTO, attesiEstrai, dimensioniEstrai, impostaEstrai, proporzioniEstrai, richiestaEstrai,
  richiestaRitaglio, trovaElementi, usaEstrai, type Elemento
} from '../estrai'

const corto = (e: Elemento, i: number): string => (e.nome ? e.nome.split(/[,.;]/)[0].slice(0, 28) : e.tipo === 'persona' ? `Persona ${i + 1}` : `Oggetto ${i + 1}`)
const area = (e: Elemento): number => (e.box[2] - e.box[0]) * (e.box[3] - e.box[1])

/** la foto con le cose trovate: i riquadri si vedono, quello scelto si illumina e il resto si abbassa */
function FotoElementi(p: { foto: FotoBase }): JSX.Element {
  const { elementi, scelto, cercando } = usaEstrai()
  const box = useRef<HTMLDivElement>(null)
  const [bozza, setBozza] = useState<[number, number, number, number] | null>(null)
  const [sopra, setSopra] = useState<string | null>(null)
  const inizio = useRef<{ x: number; y: number } | null>(null)

  const punto = (e: React.PointerEvent): { x: number; y: number } => {
    const r = box.current!.getBoundingClientRect()
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }
  }
  /** le cose sotto il dito, dalla più piccola alla più grande */
  const sotto = (q: { x: number; y: number }): Elemento[] =>
    elementi.filter((x) => q.x >= x.box[0] && q.x <= x.box[2] && q.y >= x.box[1] && q.y <= x.box[3]).sort((m, n) => area(m) - area(n))

  const giu = (e: React.PointerEvent): void => {
    inizio.current = punto(e)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const muovi = (e: React.PointerEvent): void => {
    const a = inizio.current
    const b = punto(e)
    if (!a) {
      setSopra(sotto(b)[0]?.id ?? null)
      return
    }
    if (Math.abs(b.x - a.x) > 0.015 || Math.abs(b.y - a.y) > 0.015) setBozza([Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)])
  }
  const su = (e: React.PointerEvent): void => {
    const a = inizio.current
    inizio.current = null
    if (!a) return
    if (bozza && bozza[2] - bozza[0] > 0.03 && bozza[3] - bozza[1] > 0.04) {
      // un riquadro disegnato a mano è una cosa in più, già scelta (di default un oggetto: si cambia a destra)
      const n: Elemento = { id: 'm-' + crypto.randomUUID().slice(0, 6), box: bozza, nome: '', tipo: 'oggetto', manuale: true }
      impostaEstrai({ elementi: [...usaEstrai.getState().elementi, n], scelto: n.id })
    } else {
      // un clic sceglie la cosa più piccola lì sotto; cliccando ancora si passa a quella più grande che la contiene, e poi si toglie la scelta
      const l = sotto(punto(e))
      const i = l.findIndex((x) => x.id === scelto)
      if (!l.length) {
        // un clic nel vuoto: SAM 2 trova la cosa da quel punto (un solo punto alla volta; si vede un segno attorno)
        const q = punto(e)
        const n: Elemento = { id: 'p-' + crypto.randomUUID().slice(0, 6), box: [Math.max(0, q.x - 0.05), Math.max(0, q.y - 0.05), Math.min(1, q.x + 0.05), Math.min(1, q.y + 0.05)], nome: '', tipo: 'oggetto', manuale: true, punto: q }
        impostaEstrai({ elementi: [...usaEstrai.getState().elementi.filter((x) => !x.punto), n], scelto: n.id })
      } else impostaEstrai({ scelto: i < 0 ? l[0].id : i + 1 < l.length ? l[i + 1].id : null })
    }
    setBozza(null)
  }

  const stile = (b: [number, number, number, number]): React.CSSProperties => ({ left: `${b[0] * 100}%`, top: `${b[1] * 100}%`, width: `${(b[2] - b[0]) * 100}%`, height: `${(b[3] - b[1]) * 100}%` })

  return (
    <AdattaFoto ar={p.foto.larghezza / p.foto.altezza} margine={10}>
      <div className={`pers-foto ${scelto ? 'con-scelta' : ''}`} ref={box} onPointerDown={giu} onPointerMove={muovi} onPointerUp={su} onPointerLeave={() => setSopra(null)} onPointerCancel={() => { inizio.current = null; setBozza(null) }}>
        <img src={urlFile(p.foto.percorso)} alt="" draggable={false} />
        {elementi.map((x, i) => (
          <div key={x.id} className={`pers-box ${x.tipo} ${x.id === scelto ? 'su' : ''} ${x.id === sopra ? 'sopra' : ''}`} style={stile(x.box)}>
            {(x.id === scelto || x.id === sopra) && <span>{x.tipo === 'persona' ? <I.ritratto /> : <I.prodotto />} {corto(x, i)}</span>}
          </div>
        ))}
        {bozza && <div className="pers-box bozza" style={stile(bozza)} />}
        {cercando && <div className="pers-cerca"><span>Cerco persone e oggetti…</span></div>}
      </div>
    </AdattaFoto>
  )
}

/** a sinistra la foto, a destra quello che hai estratto */
export function PalcoEstrai(p: { base: FotoBase | null; daGalleria: () => void; daPc: () => void }): JSX.Element {
  const { ris } = usaEstrai()
  const lavori = usaStato((s) => s.lavori)
  const inCorso = lavori.find((l) => l.stato === 'in corso' && attesiEstrai.has(l.id))
  const inAttesa = lavori.filter((l) => (l.stato === 'in coda' || l.stato === 'in corso') && attesiEstrai.has(l.id)).length
  const [vedi, setVedi] = useState<string | null>(null)
  const scelto = ris.find((r) => r.opera.id === vedi) || ris[0]
  const vivo = inCorso?.anteprima
  // una foto nuova: le cose trovate in quella di prima non valgono più (la ricerca parte solo quando premi il pulsante)
  useEffect(() => {
    if (p.base && usaEstrai.getState().foto !== p.base.percorso) impostaEstrai({ foto: p.base.percorso, elementi: [], scelto: null })
  }, [p.base?.percorso])

  if (!p.base)
    return (
      <div className="tela" style={{ display: 'grid', placeItems: 'center', cursor: 'default' }}>
        <div className="vuoto">
          <div className="grosso">ESTRAI <b>DA UNA FOTO</b></div>
          <p>Dai una foto, <b className="oro">clicca la cosa che vuoi</b> e premi <b className="oro">Ritaglia</b>: la ottieni su sfondo trasparente, con i pixel della foto (due clic). Con «Trova persone e oggetti» il modello le riquadra per te.</p>
          <p className="piccolo">Una persona a figura intera (T-pose, A-pose, una posa disegnata), un busto o un volto; un oggetto intero, da davanti, di lato o dall'alto.</p>
          <div className="riga" style={{ justifyContent: 'center', marginTop: 14 }}>
            <button className="btn primario" onClick={p.daGalleria}><I.galleria /> Dalla galleria</button>
            <button className="btn" onClick={p.daPc}><I.immagine /> Dal PC</button>
          </div>
        </div>
      </div>
    )

  return (
    <div className="pers">
      <div className="pers-col">
        <div className="fusion-testa"><b>LA FOTO</b><span className="piccolo tenue">{usaEstrai.getState().elementi.length ? 'clicca una persona o un oggetto · trascina per riquadrare a mano' : 'premi «Trova persone e oggetti», oppure trascina per riquadrare a mano'}</span></div>
        <div className="pers-palco"><FotoElementi foto={p.base} /></div>
      </div>
      <div className="pers-col pers-ris">
        <div className="fusion-testa">
          <b>ESTRATTI</b>
          {inAttesa > 0 && <span className="piccolo oro">{inCorso ? `si sta creando${percentuale(inCorso) !== null ? ` · ${percentuale(inCorso)}%` : ''}` : 'in coda'}{inAttesa > 1 ? ` · +${inAttesa - 1}` : ''}</span>}
        </div>
        {!ris.length && !inAttesa ? (
          <div className="spento piccolo" style={{ padding: '10px 16px' }}>Clicca una cosa sulla foto e premi <b>Ritaglia</b> (o <b>Ricrea</b>): compare qui, e finisce anche in Galleria.</div>
        ) : (
          <div className="pers-ris-corpo">
            <div className="pers-grande">
              {vivo ? <AdattaFoto ar={inCorso?.richiesta.larghezza && inCorso.richiesta.altezza ? inCorso.richiesta.larghezza / inCorso.richiesta.altezza : 1} margine={8}><img src={vivo} alt="" /></AdattaFoto>
                : scelto ? <VistaZoom src={urlFile(scelto.opera.file)} scacchi={scelto.opera.trasparente} /> : <div className="attesa-grande" />}
            </div>
            <div className="fusion-strip">
              {ris.map((r) => (
                <div key={r.opera.id} className={`mini ${scelto?.opera.id === r.opera.id && !vivo ? 'su' : ''}`} style={{ ['--ar' as string]: `${r.opera.larghezza} / ${r.opera.altezza}` }}
                  onClick={() => setVedi(r.opera.id)} title={r.etichetta}>
                  <img src={urlFile(r.opera.miniatura || r.opera.file)} alt="" />
                  <span className="et">{r.etichetta.replace('Estrai · ', '')}</span>
                </div>
              ))}
            </div>
            {scelto && !vivo && (
              <div className="riga a-capo fusion-azioni">
                <button className="btn piccolo" onClick={() => apriInModifica(fotoDaOpera(scelto.opera))}><I.modifica /> Modifica</button>
                <button className="btn piccolo" onClick={() => void api.galleria.mostra(scelto.opera.id)}><I.cartella /> Mostra</button>
                <span className="piccolo spento">{scelto.opera.larghezza} × {scelto.opera.altezza} px</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** la colonna dei comandi: cosa estrarre, come lo vuoi, dimensioni e qualità */
export function ControlliEstrai(p: { base: FotoBase | null }): JSX.Element {
  const s = usaEstrai()
  const { modifica: m, setModifica, avvisa } = usaStato()
  const el = s.elementi.find((x) => x.id === s.scelto)
  const stima = stimaSecondi(usaStato.getState().imp?.tempi, m.mp, passiDi(m.qualita)) * m.quante
  const r = proporzioniEstrai(s, el, p.base)
  const dim = dimensioniEstrai(m.mp, r)
  const fin = misuraEstrai(s.lato, dim)
  const persona = el?.tipo === 'persona'
  const [stretto, setStretto] = useState(true)
  const dalPunto = !!el?.punto
  const trovati = s.elementi.filter((x) => !x.punto).length

  /** il ritaglio fedele: i pixel sono quelli della foto, lo sfondo diventa trasparente (SAM 2) */
  const ritaglio = async (): Promise<void> => {
    if (!p.base || !el) return
    try {
      const [id] = await api.lavori.accoda(richiestaRitaglio(p.base, el, stretto))
      attesiEstrai.set(id, { etichetta: `Ritaglio · ${corto(el, s.elementi.indexOf(el))}` })
    } catch (e) {
      avvisa((e as Error).message, 'errore')
    }
  }

  const estrai = async (): Promise<void> => {
    if (!p.base || !el) return
    try {
      const q = await richiestaEstrai(p.base, el, { qualita: m.qualita, mp: m.mp, quante: m.quante })
      const conOmino = persona && s.inquadratura === 'intera' && s.posa === 'omino'
      for (const id of await api.lavori.accoda(q)) {
        attesiEstrai.set(id, { etichetta: q.etichetta || 'Estratto' })
        // con l'omino, a lavoro finito si controlla che non sia rimasta una traccia della guida; se c'è, la foto ripulita prende il posto
        if (conOmino) {
          controllaScheletro(id, m.qualita, (pulita, originale) => usaEstrai.setState((st) => ({ ris: st.ris.map((x) => (x.opera.id === originale.id ? { ...x, opera: pulita } : x)) })))
        }
      }
    } catch (e) {
      avvisa((e as Error).message, 'errore')
    }
  }

  return (
    <div className="colonna destra">
      <div className="scorri">
        <div className="sezione">
          <h3><span className="num-passo">1</span> Cosa estrarre <span className="dx">{trovati ? `${trovati} trovati` : ''}</span></h3>
          {el ? (
            <div className="est-scelta">
              <span className="ic">{persona ? <I.ritratto /> : <I.prodotto />}</span>
              <span className="t">{corto(el, s.elementi.indexOf(el))}</span>
              <button className="btn fantasma piccolo icona" title="Toglie questa scelta" onClick={() => impostaEstrai({ scelto: null })}><I.x /></button>
            </div>
          ) : (
            <div className="piccolo spento">{s.cercando ? 'Il modello sta guardando la foto…' : !p.base ? 'Prima scegli una foto.' : s.elementi.length ? 'Clicca sulla foto la persona o l\'oggetto che vuoi (cliccando ancora nello stesso punto passi a quello più grande che lo contiene).' : 'Clicca sulla foto la cosa da ritagliare (SAM 2 la trova da solo), oppure premi il pulsante: il modello trova persone e oggetti. Puoi anche riquadrare a mano trascinando.'}</div>
          )}
          {el && (
            <div className="riga" style={{ gap: 8, marginTop: 8 }}>
              <span className="piccolo tenue">È</span>
              <div className="mini-segmenti">
                <button className={persona ? 'su' : ''} onClick={() => impostaEstrai({ elementi: s.elementi.map((x) => (x.id === el.id ? { ...x, tipo: 'persona' } : x)) })}>una persona</button>
                <button className={!persona ? 'su' : ''} onClick={() => impostaEstrai({ elementi: s.elementi.map((x) => (x.id === el.id ? { ...x, tipo: 'oggetto' } : x)) })}>un oggetto</button>
              </div>
            </div>
          )}
          <button className={`btn ${trovati ? 'piccolo fantasma' : 'primario'}`} style={{ marginTop: 8, width: trovati ? undefined : '100%' }} disabled={!p.base || s.cercando} onClick={() => p.base && void trovaElementi(p.base)}>
            <I.occhio /> {s.cercando ? 'Cerco…' : trovati ? 'Cerca di nuovo' : 'Trova persone e oggetti'}
          </button>
        </div>

        {el && !dalPunto && (
          <div className="sezione">
            <h3><span className="num-passo">2</span> Come lo vuoi</h3>
            {persona ? (
              <>
                <span className="piccolo tenue">Inquadratura</span>
                <Segmenti valore={s.inquadratura} cambia={(inquadratura) => impostaEstrai({ inquadratura })} voci={INQUADRATURE.map((x) => ({ id: x.id, nome: x.nome, sotto: x.sotto }))} />
                {s.inquadratura === 'intera' && (
                  <div style={{ marginTop: 10 }}>
                    <span className="piccolo tenue">Posa</span>
                    <Segmenti valore={s.posa} cambia={(posa) => impostaEstrai({ posa })} voci={POSE_ESTRAI.map((x) => ({ id: x.id, nome: x.nome, titolo: x.sotto }))} />
                    {s.posa === 'omino' && (
                      <div style={{ marginTop: 10 }}>
                        <Omino valore={s.omino} cambia={(omino) => impostaEstrai({ omino })} />
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <span className="piccolo tenue">Vista</span>
                <Segmenti valore={s.vista} cambia={(vista) => impostaEstrai({ vista })} voci={VISTE_OGGETTO.map((x) => ({ id: x.id, nome: x.nome, titolo: x.sotto }))} />
                <div className="piccolo spento" style={{ marginTop: 6 }}>Se una parte è coperta o tagliata, il modello la completa.</div>
              </>
            )}
            <div style={{ marginTop: 10 }}>
              <span className="piccolo tenue">Sfondo</span>
              <Segmenti valore={s.sfondo} cambia={(sfondo) => impostaEstrai({ sfondo })} voci={SFONDI_ESTRAI.map((x) => ({ id: x.id, nome: x.nome }))} />
            </div>
            {s.sfondo !== 'trasparente' && (
              <div style={{ marginTop: 10 }}>
                <Interruttore acceso={s.ombra} cambia={(ombra) => impostaEstrai({ ombra })}>Ombra sul pavimento</Interruttore>
              </div>
            )}
            <input type="text" style={{ marginTop: 10 }} value={s.nota} onChange={(e) => impostaEstrai({ nota: e.target.value })} placeholder={persona ? 'Note (facoltative): es. «senza cappello», «scarpe nere»' : 'Note (facoltative): es. «senza etichetta», «più luminoso»'} />
          </div>
        )}

        <div className="sezione" style={dalPunto ? { display: 'none' } : undefined}>
          <h3><span className="num-passo">{el ? 3 : 2}</span> Dimensioni e qualità</h3>
          <span className="piccolo tenue">Proporzioni</span>
          <div className="riga a-capo" style={{ gap: 6, marginTop: 4 }}>
            {FORMATI_ESTRAI.map((f) => (
              <button key={f.id} className={`chip ${s.formato === f.id ? 'su' : ''}`} onClick={() => impostaEstrai({ formato: f.id })} title={f.id === 'auto' ? 'Le sceglie l\'app: per un oggetto come il suo riquadro, per una persona in piedi 3:4' : `Proporzioni ${f.id}`}>{f.id === 'auto' ? `Auto (${r[0]}:${r[1]})` : f.id}</button>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <span className="piccolo tenue">Grandezza della foto</span>
            <ScegliMp mp={m.mp} cambia={(mp) => setModifica({ mp })} ar={{ w: r[0], h: r[1] }} />
          </div>
          <div style={{ marginTop: 10 }}>
            <span className="piccolo tenue">Misura finale (lato lungo)</span>
            <div className="riga a-capo" style={{ gap: 6, marginTop: 4 }}>
              {[0, 480, 720, 1024, 1536, 2048].map((l) => (
                <button key={l} className={`chip ${s.lato === l ? 'su' : ''}`} onClick={() => impostaEstrai({ lato: l })} title={l ? `La foto esce con il lato lungo a ${l} px: il modello la disegna ai megapixel scelti e poi la porta lì` : 'Esce com\'è disegnata dal modello'}>{l ? `${l} px` : 'Come disegna'}</button>
              ))}
            </div>
          </div>
          <Uscita w={fin.w} h={fin.h} nota={fin.w !== dim.w || fin.h !== dim.h ? `disegnata a ${dim.w}×${dim.h} e poi portata qui` : undefined} />
          <div style={{ marginTop: 12 }}>
            <span className="piccolo tenue">{passiDi(m.qualita)} passi · ~{durata(stima)}</span>
          </div>
          <div className="riga spazia" style={{ marginTop: 10 }}>
            <span className="tenue">Quante versioni</span>
            <Contatore valore={m.quante} min={1} max={4} cambia={(quante) => setModifica({ quante })} />
          </div>
        </div>
      </div>
      <div className="sezione" style={{ borderTop: '1px solid #1d1636' }}>
        <button className="btn primario grande" style={{ width: '100%' }} disabled={!p.base || !el} onClick={() => void ritaglio()} title="Taglia la cosa dalla foto con SAM 2: i pixel restano quelli della foto, lo sfondo diventa trasparente">
          {persona ? <I.ritratto /> : <I.prodotto />} {el ? 'Ritaglia (fedele, sfondo trasparente)' : 'Clicca cosa ritagliare sulla foto'}
        </button>
        <div style={{ marginTop: 8 }}><Interruttore acceso={stretto} cambia={setStretto}>Ritaglio stretto attorno alla cosa</Interruttore></div>
        <button className="btn grande" style={{ width: '100%', marginTop: 8 }} disabled={!p.base || !el || dalPunto} onClick={() => void estrai()} title={dalPunto ? 'Per ricreare riquadra la cosa (trascina) o usa «Trova persone e oggetti»' : 'Ridisegna la cosa su sfondo pulito, con la posa e la vista che hai scelto'}>
          <I.bacchetta /> {dalPunto ? 'Ricrea: riquadra la cosa' : `Ricrea ${persona ? 'la persona' : 'l\'oggetto'} in studio`}
        </button>
        <div className="piccolo spento" style={{ textAlign: 'center', marginTop: 6, display: dalPunto ? 'none' : undefined }}>{fin.w} × {fin.h} px · ~{durata(stima)}</div>
      </div>
    </div>
  )
}
