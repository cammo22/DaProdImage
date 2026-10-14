// Personaggio (modo di Modifica): a sinistra la foto con le persone riquadrate (clic = si illumina quella scelta; trascina per
// riquadrarne una a mano), a destra i personaggi estratti e le viste dalla camera. I comandi stanno nella colonna di destra.
import { useEffect, useRef, useState, type JSX } from 'react'
import { usaStato, type FotoBase, type Qualita } from '../stato'
import { api, urlFile } from '../api'
import { I } from './Icone'
import { VistaZoom } from './VistaZoom'
import { AdattaFoto } from './AdattaFoto'
import { percentuale } from './Coda'
import { Contatore, Segmenti } from './Controlli'
import { AvvisoTurbo, useTurbo } from './Turbo'
import { CAMERA0, ControlloCamera, descriviCamera, type PosizioneCamera } from './Camera'
import { fileLoraCamera } from '../azioni'
import { durata, stimaSecondi } from '../util'
import {
  FORMATI_PERSONAGGIO, POSE_ESTRAI, SFONDI_ESTRAI, VISTE_CLASSICHE, VISTE_GIRO, attesiPersonaggio, impostaPersonaggio, richiestaEstrai, richiestaVista,
  trovaPersone, usaPersonaggio, type Persona
} from '../personaggio'
import { PASSI_QUALITA } from '../stato'

/** la foto con le persone: i riquadri si vedono, quella scelta si illumina e il resto si abbassa */
function FotoPersone(p: { foto: FotoBase }): JSX.Element {
  const { persone, scelta, cercando } = usaPersonaggio()
  const box = useRef<HTMLDivElement>(null)
  const [bozza, setBozza] = useState<[number, number, number, number] | null>(null)
  const inizio = useRef<{ x: number; y: number } | null>(null)

  const punto = (e: React.PointerEvent): { x: number; y: number } => {
    const r = box.current!.getBoundingClientRect()
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }
  }
  const giu = (e: React.PointerEvent): void => {
    inizio.current = punto(e)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const muovi = (e: React.PointerEvent): void => {
    const a = inizio.current
    if (!a) return
    const b = punto(e)
    if (Math.abs(b.x - a.x) > 0.015 || Math.abs(b.y - a.y) > 0.015) setBozza([Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)])
  }
  const su = (e: React.PointerEvent): void => {
    const a = inizio.current
    inizio.current = null
    if (!a) return
    if (bozza && bozza[2] - bozza[0] > 0.04 && bozza[3] - bozza[1] > 0.06) {
      // un riquadro disegnato a mano è una persona in più, già scelta
      const n: Persona = { id: 'm-' + crypto.randomUUID().slice(0, 6), box: bozza, nome: '', manuale: true }
      impostaPersonaggio({ persone: [...usaPersonaggio.getState().persone, n], scelta: n.id })
    } else {
      // un clic: la persona sotto il dito (la più piccola se si sovrappongono), o nessuna
      const q = punto(e)
      const sotto = persone
        .filter((x) => q.x >= x.box[0] && q.x <= x.box[2] && q.y >= x.box[1] && q.y <= x.box[3])
        .sort((m, n) => (m.box[2] - m.box[0]) * (m.box[3] - m.box[1]) - (n.box[2] - n.box[0]) * (n.box[3] - n.box[1]))[0]
      impostaPersonaggio({ scelta: sotto ? (sotto.id === scelta ? null : sotto.id) : null })
    }
    setBozza(null)
  }

  const stile = (b: [number, number, number, number]): React.CSSProperties => ({ left: `${b[0] * 100}%`, top: `${b[1] * 100}%`, width: `${(b[2] - b[0]) * 100}%`, height: `${(b[3] - b[1]) * 100}%` })

  return (
    <AdattaFoto ar={p.foto.larghezza / p.foto.altezza} margine={10}>
      <div className={`pers-foto ${scelta ? 'con-scelta' : ''}`} ref={box} onPointerDown={giu} onPointerMove={muovi} onPointerUp={su} onPointerCancel={() => { inizio.current = null; setBozza(null) }}>
        <img src={urlFile(p.foto.percorso)} alt="" draggable={false} />
        {persone.map((x, i) => (
          <div key={x.id} className={`pers-box ${x.id === scelta ? 'su' : ''}`} style={stile(x.box)} title={x.nome || `Persona ${i + 1}`}>
            <span>{i + 1}</span>
          </div>
        ))}
        {bozza && <div className="pers-box bozza" style={stile(bozza)} />}
        {cercando && <div className="pers-cerca"><span>Cerco le persone…</span></div>}
      </div>
    </AdattaFoto>
  )
}

/** a sinistra la foto, a destra i risultati */
export function PalcoPersonaggio(p: { base: FotoBase | null; daGalleria: () => void; daPc: () => void }): JSX.Element {
  const { ris, sorgente } = usaPersonaggio()
  const lavori = usaStato((s) => s.lavori)
  const inCorso = lavori.find((l) => l.stato === 'in corso' && attesiPersonaggio.has(l.id))
  const inAttesa = lavori.filter((l) => (l.stato === 'in coda' || l.stato === 'in corso') && attesiPersonaggio.has(l.id)).length
  const [vedi, setVedi] = useState<string | null>(null)
  const scelto = ris.find((r) => r.opera.id === (vedi || sorgente)) || ris[0]
  const vivo = inCorso?.anteprima
  // una foto nuova: le persone della foto di prima non valgono più
  useEffect(() => {
    if (p.base && usaPersonaggio.getState().foto !== p.base.percorso) impostaPersonaggio({ foto: p.base.percorso, persone: [], scelta: null })
  }, [p.base?.percorso])

  if (!p.base)
    return (
      <div className="tela" style={{ display: 'grid', placeItems: 'center', cursor: 'default' }}>
        <div className="vuoto">
          <div className="grosso">ESTRAI UN <b>PERSONAGGIO</b></div>
          <p>Dai una foto con <b className="oro">una o più persone</b>: il modello le trova, tu clicchi quella che vuoi e la estrai a figura intera (T-pose, A-pose…).</p>
          <p className="piccolo">Poi muovi la camera attorno a lei: una vista sola o il giro completo.</p>
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
        <div className="fusion-testa"><b>LA FOTO</b><span className="piccolo tenue">clic su una persona per sceglierla · trascina per riquadrarne una a mano</span></div>
        <div className="pers-palco"><FotoPersone foto={p.base} /></div>
      </div>
      <div className="pers-col pers-ris">
        <div className="fusion-testa">
          <b>PERSONAGGI</b>
          {inAttesa > 0 && <span className="piccolo oro">{inCorso ? `si sta creando${percentuale(inCorso) !== null ? ` · ${percentuale(inCorso)}%` : ''}` : 'in coda'}{inAttesa > 1 ? ` · +${inAttesa - 1}` : ''}</span>}
        </div>
        {!ris.length && !inAttesa ? (
          <div className="spento piccolo" style={{ padding: '10px 16px' }}>Scegli una persona e premi <b>Estrai il personaggio</b>: compare qui, e finisce anche in Galleria. Poi puoi girarci attorno con la camera.</div>
        ) : (
          <div className="pers-ris-corpo">
            <div className="pers-grande">
              {vivo ? <AdattaFoto ar={inCorso?.richiesta.larghezza && inCorso.richiesta.altezza ? inCorso.richiesta.larghezza / inCorso.richiesta.altezza : 1} margine={8}><img src={vivo} alt="" /></AdattaFoto>
                : scelto ? <VistaZoom src={urlFile(scelto.opera.file)} scacchi={scelto.opera.trasparente} /> : <div className="attesa-grande" />}
            </div>
            <div className="fusion-strip">
              {ris.map((r) => (
                <div key={r.opera.id} className={`mini ${scelto?.opera.id === r.opera.id && !vivo ? 'su' : ''} ${r.opera.id === sorgente ? 'sorgente' : ''}`} style={{ ['--ar' as string]: `${r.opera.larghezza} / ${r.opera.altezza}` }}
                  onClick={() => setVedi(r.opera.id)} title={r.etichetta}>
                  <img src={urlFile(r.opera.miniatura || r.opera.file)} alt="" />
                  <span className="et">{r.etichetta.replace('Personaggio · ', '')}</span>
                </div>
              ))}
            </div>
            {scelto && !vivo && (
              <div className="riga a-capo fusion-azioni">
                <button className={`btn piccolo ${sorgente === scelto.opera.id ? 'attivo' : ''}`} onClick={() => impostaPersonaggio({ sorgente: scelto.opera.id })} title="La camera lavora su questa immagine"><I.camera /> {sorgente === scelto.opera.id ? 'Camera su questa' : 'Usa per la camera'}</button>
                <button className="btn piccolo" onClick={() => void api.galleria.mostra(scelto.opera.id)}><I.cartella /> Mostra</button>
                <span className="piccolo spento">{scelto.opera.larghezza}×{scelto.opera.altezza}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** la colonna dei comandi: 1 scegli la persona, 2 estrai, 3 muovi la camera */
export function ControlliPersonaggio(p: { base: FotoBase | null }): JSX.Element {
  const s = usaPersonaggio()
  const { modifica: m, setModifica, avvisa } = usaStato()
  const turbo = useTurbo()
  const [camera, setCamera] = useState<PosizioneCamera>(s.camera || CAMERA0)
  const [viste, setViste] = useState<string[]>(VISTE_CLASSICHE)
  const persona = s.persone.find((x) => x.id === s.scelta)
  const sorgente = s.ris.find((r) => r.opera.id === s.sorgente)
  const stima = stimaSecondi(usaStato.getState().imp?.tempi, m.mp, PASSI_QUALITA[m.qualita])
  const loraCamera = !!fileLoraCamera()

  const manda = async (f: () => Promise<{ ids: string[]; tipo: 'estratto' | 'vista'; etichetta: string }[]>): Promise<void> => {
    if (m.qualita === 'turbo' && !turbo.presente) {
      avvisa('Per il Turbo scarica prima il suo LoRA (il pulsante sotto Qualità), o scegli Alta', 'errore')
      return
    }
    try {
      for (const x of await f()) x.ids.forEach((id) => attesiPersonaggio.set(id, { tipo: x.tipo, etichetta: x.etichetta }))
    } catch (e) {
      avvisa((e as Error).message, 'errore')
    }
  }

  const estrai = (): Promise<void> =>
    manda(async () => {
      const base = p.base
      if (!base || !persona) return []
      const q = await richiestaEstrai(base, persona, { qualita: m.qualita, mp: m.mp, quante: m.quante })
      return [{ ids: await api.lavori.accoda(q), tipo: 'estratto' as const, etichetta: q.etichetta || 'Personaggio' }]
    })

  const vista = (c: PosizioneCamera, nome: string): Promise<void> =>
    manda(async () => {
      if (!sorgente) return []
      const q = richiestaVista(sorgente, c, nome, { qualita: m.qualita, mp: m.mp })
      return [{ ids: await api.lavori.accoda(q), tipo: 'vista' as const, etichetta: q.etichetta || nome }]
    })

  const giro = (): Promise<void> =>
    manda(async () => {
      if (!sorgente) return []
      const fuori: { ids: string[]; tipo: 'vista'; etichetta: string }[] = []
      for (const v of VISTE_GIRO.filter((x) => viste.includes(x.nome))) {
        const q = richiestaVista(sorgente, v.c, v.nome, { qualita: m.qualita, mp: m.mp })
        fuori.push({ ids: await api.lavori.accoda(q), tipo: 'vista', etichetta: q.etichetta || v.nome })
      }
      return fuori
    })

  return (
    <div className="colonna destra">
      <div className="scorri">
        <div className="sezione">
          <h3><span className="num-passo">1</span> Chi estrarre <span className="dx">{s.persone.length ? `${s.persone.length} ${s.persone.length === 1 ? 'persona' : 'persone'}` : ''}</span></h3>
          <button className="btn primario" style={{ width: '100%' }} disabled={!p.base || s.cercando} onClick={() => p.base && void trovaPersone(p.base)}>
            <I.occhio /> {s.cercando ? 'Cerco…' : s.persone.length ? 'Cerca di nuovo le persone' : 'Trova le persone nella foto'}
          </button>
          <div className="piccolo spento" style={{ marginTop: 6 }}>Il modello le trova da solo. Se ne manca una, riquadrala trascinando sulla foto.</div>
          {s.persone.length > 0 && (
            <div className="col" style={{ gap: 6, marginTop: 10 }}>
              {s.persone.map((x, i) => (
                <div key={x.id} className={`riga-persona ${x.id === s.scelta ? 'su' : ''}`} onClick={() => impostaPersonaggio({ scelta: x.id === s.scelta ? null : x.id })}>
                  <span className="n">{i + 1}</span>
                  <span className="t">{x.nome || (x.manuale ? 'Riquadro mio' : `Persona ${i + 1}`)}</span>
                  <button className="btn fantasma piccolo icona" title="Toglie questo riquadro" onClick={(e) => { e.stopPropagation(); impostaPersonaggio({ persone: s.persone.filter((y) => y.id !== x.id), scelta: s.scelta === x.id ? null : s.scelta }) }}><I.x /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sezione">
          <h3><span className="num-passo">2</span> Estrai a figura intera</h3>
          <span className="piccolo tenue">Posa</span>
          <Segmenti valore={s.posa} cambia={(posa) => impostaPersonaggio({ posa })} voci={POSE_ESTRAI.map((x) => ({ id: x.id, nome: x.nome, sotto: x.sotto }))} />
          <div style={{ marginTop: 10 }}>
            <span className="piccolo tenue">Sfondo</span>
            <Segmenti valore={s.sfondo} cambia={(sfondo) => impostaPersonaggio({ sfondo })} voci={SFONDI_ESTRAI.map((x) => ({ id: x.id, nome: x.nome }))} />
          </div>
          <div style={{ marginTop: 10 }}>
            <span className="piccolo tenue">Proporzioni</span>
            <Segmenti valore={s.formato} cambia={(formato) => impostaPersonaggio({ formato })} voci={FORMATI_PERSONAGGIO.map((x) => ({ id: x.id, nome: x.nome, sotto: x.sotto }))} />
          </div>
          <input type="text" style={{ marginTop: 10 }} value={s.nota} onChange={(e) => impostaPersonaggio({ nota: e.target.value })} placeholder="Note (facoltative): es. «senza cappello», «scarpe nere»" />
          <button className="btn primario grande" style={{ width: '100%', marginTop: 10 }} disabled={!p.base || !persona} onClick={() => void estrai()}>
            <I.ritratto /> Estrai il personaggio
          </button>
          {!persona && <div className="piccolo spento" style={{ marginTop: 6, textAlign: 'center' }}>Scegli prima una persona sulla foto</div>}
        </div>

        <div className="sezione">
          <h3><span className="num-passo">3</span> Muovi la camera <span className="dx">{sorgente ? 'sul personaggio scelto' : 'prima estrai un personaggio'}</span></h3>
          <div className={sorgente ? '' : 'spento-tutto'}>
            <ControlloCamera valore={camera} cambia={(c) => { setCamera(c); impostaPersonaggio({ camera: c }) }} lora={loraCamera} />
            <button className="btn" style={{ width: '100%', marginTop: 10 }} disabled={!sorgente} onClick={() => void vista(camera, descriviCamera(camera).split(' · ')[0])}>
              <I.camera /> Crea questa vista
            </button>
            <div style={{ marginTop: 14 }}>
              <span className="piccolo tenue">Il giro completo: scegli le viste</span>
              <div className="riga a-capo" style={{ gap: 5, marginTop: 6 }}>
                {VISTE_GIRO.map((v) => (
                  <button key={v.nome} className={`chip ${viste.includes(v.nome) ? 'su' : ''}`} onClick={() => setViste(viste.includes(v.nome) ? viste.filter((x) => x !== v.nome) : [...viste, v.nome])}>{v.nome}</button>
                ))}
              </div>
              <div className="riga a-capo" style={{ gap: 6, marginTop: 8 }}>
                <button className="btn piccolo fantasma" onClick={() => setViste(VISTE_CLASSICHE)}>Le 4 classiche</button>
                <button className="btn piccolo fantasma" onClick={() => setViste(VISTE_GIRO.map((v) => v.nome))}>Tutte e 8</button>
              </div>
              <button className="btn primario" style={{ width: '100%', marginTop: 8 }} disabled={!sorgente || !viste.length} onClick={() => void giro()}>
                <I.serie /> Crea il giro · {viste.length} {viste.length === 1 ? 'vista' : 'viste'}
              </button>
            </div>
          </div>
        </div>

        <div className="sezione">
          <h3>Qualità <span className="dx">{PASSI_QUALITA[m.qualita]} passi · ~{durata(stima)}</span></h3>
          <Segmenti<Qualita>
            valore={m.qualita}
            cambia={(qualita) => setModifica({ qualita })}
            voci={[
              { id: 'turbo', nome: <><I.fulmine /> Turbo</>, sotto: '8 passi', titolo: 'LoRA Turbo8: circa 5 volte più veloce' },
              { id: 'bozza', nome: 'Veloce', sotto: '20 passi' },
              { id: 'alta', nome: 'Alta', sotto: '40 passi' },
              { id: 'massima', nome: 'Massima', sotto: '50 passi' }
            ]}
          />
          {m.qualita === 'turbo' && <AvvisoTurbo />}
          <div className="riga spazia" style={{ marginTop: 10 }}>
            <span className="tenue">Quante versioni dell'estrazione</span>
            <Contatore valore={m.quante} min={1} max={4} cambia={(quante) => setModifica({ quante })} />
          </div>
          <div style={{ marginTop: 10 }}>
            <span className="piccolo tenue">Grandezza</span>
            <Segmenti valore={m.mp} cambia={(mp) => setModifica({ mp })} voci={[{ id: 0.5, nome: '0,5 MP', sotto: 'veloce' }, { id: 1, nome: '1 MP', sotto: 'consigliato' }, { id: 2, nome: '2 MP', sotto: 'dettaglio' }]} />
          </div>
        </div>
      </div>
    </div>
  )
}
