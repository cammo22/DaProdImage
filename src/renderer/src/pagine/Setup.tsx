// Primo avvio: controllo del PC, scelta del modello (anche quello già scaricato), installazione del motore.
import { useEffect, useState, type JSX } from 'react'
import { api, type ModelloTrovato } from '../api'
import { usaStato, ricaricaImp } from '../stato'
import { byte } from '../util'
import type { ControlloSistema, PassoSetup, StatoVoce } from '@shared/tipi'

type Fase = 'controllo' | 'modello' | 'installa'

export function Setup({ fatto }: { fatto: () => void }): JSX.Element {
  const { imp } = usaStato()
  const [fase, setFase] = useState<Fase>('controllo')
  const [controllo, setControllo] = useState<ControlloSistema | null>(null)
  const [cartella, setCartella] = useState(imp?.cartellaModelli || '')
  const [trovati, setTrovati] = useState<ModelloTrovato[]>([])
  const [catalogo, setCatalogo] = useState<StatoVoce[]>([])
  const [scelta, setScelta] = useState<string>('q4km') // id catalogo o "file:<percorso>"
  const [extra, setExtra] = useState<string[]>(['lora-detail'])
  const [passi, setPassi] = useState<PassoSetup[]>([])
  const [righe, setRighe] = useState<string[]>([])
  const [esito, setEsito] = useState<boolean | null>(null)
  const [motoreGia, setMotoreGia] = useState(false)

  useEffect(() => {
    if (imp && !cartella) setCartella(imp.cartellaModelli)
  }, [imp])

  useEffect(() => {
    if (!cartella) return
    void api.sistema.controllo(cartella).then(setControllo)
  }, [cartella])

  useEffect(() => {
    void (async () => {
      const t = await api.setup.cerca()
      setTrovati(t)
      const s = await api.setup.stato()
      setMotoreGia(s.motore)
      setCatalogo(s.modelli)
      const presente = s.modelli.find((m) => m.tipo === 'diffusione' && m.presente)
      if (presente) setScelta(presente.id)
      else if (t[0]) setScelta('file:' + t[0].percorso)
    })()
    return api.su.setup((p, r) => {
      setPassi(p)
      if (r) setRighe((x) => [...x.slice(-200), r])
    })
  }, [])

  const diffusione = catalogo.filter((c) => c.tipo === 'diffusione')
  const lore = catalogo.filter((c) => c.tipo === 'lora')
  const necessari = catalogo.filter((c) => c.necessario)
  const sceltaVoce = scelta.startsWith('file:') ? null : catalogo.find((c) => c.id === scelta)
  const daScaricare =
    necessari.filter((c) => !c.presente).reduce((a, c) => a + c.byte, 0) +
    (sceltaVoce && !sceltaVoce.presente ? sceltaVoce.byte : 0) +
    lore.filter((l) => extra.includes(l.id) && !l.presente).reduce((a, c) => a + c.byte, 0) +
    (motoreGia ? 0 : 3.6e9)

  const installa = async (): Promise<void> => {
    setFase('installa')
    setEsito(null)
    setRighe([])
    const fileEsistente = scelta.startsWith('file:') ? scelta.slice(5) : undefined
    const id = fileEsistente ? trovati.find((t) => t.percorso === fileEsistente)?.id || 'q4km' : scelta
    const ok = await api.setup.avvia({ cartellaModelli: cartella, modello: id, fileEsistente, extra })
    setEsito(ok)
    if (ok) await ricaricaImp()
  }

  return (
    <div className="setup">
      <div className="scheda">
        <img src="./icona.svg" alt="" style={{ width: 64, height: 64 }} />
        <h1>DAPROD <b>IMAGE</b></h1>
        <p className="sotto">Qwen-Image 2.1 sul tuo PC: crea, modifica le foto e le loro zone, LoRA con un clic. Prima prepariamo il motore (una volta sola).</p>

        <div className="pannello blocco">
          <h2>1 · Il tuo PC</h2>
          {controllo ? (
            <>
              <div className="controlli">
                <div className="c"><small>Scheda video</small><b>{controllo.gpu || '—'}</b></div>
                <div className="c"><small>VRAM</small><b>{controllo.vramMB ? `${(controllo.vramMB / 1024).toFixed(0)} GB` : '—'}</b></div>
                <div className="c"><small>RAM</small><b>{controllo.ramGB} GB</b></div>
                <div className="c"><small>Disco libero</small><b>{controllo.liberoGB} GB</b></div>
              </div>
              {controllo.avvisi.map((a) => <div key={a} className={`avviso-box ${controllo.ok ? '' : 'errore'}`}>{a}</div>)}
            </>
          ) : (
            <div className="tenue">Controllo…</div>
          )}
        </div>

        {fase !== 'installa' && (
          <>
            <div className="pannello blocco">
              <h2>2 · Il modello</h2>
              {trovati.map((t) => (
                <label key={t.percorso} className={`opzione ${scelta === 'file:' + t.percorso ? 'su' : ''}`}>
                  <input type="radio" checked={scelta === 'file:' + t.percorso} onChange={() => setScelta('file:' + t.percorso)} />
                  <div>
                    <div className="t">Usa quello che hai già ✓</div>
                    <small>{t.percorso} · {byte(t.byte)} — niente da scaricare{t.id ? '' : ' (non è fra i file che conosco: lo provo lo stesso)'}</small>
                  </div>
                </label>
              ))}
              {diffusione.map((d) => (
                <label key={d.id} className={`opzione ${scelta === d.id ? 'su' : ''}`}>
                  <input type="radio" checked={scelta === d.id} onChange={() => setScelta(d.id)} />
                  <div>
                    <div className="t">{d.nome} {d.consigliato && <span className="distintivo si">consigliato per 8 GB</span>} {d.presente && <span className="distintivo si">già presente</span>}</div>
                    <small>{d.descrizione} · {byte(d.byte)}</small>
                  </div>
                </label>
              ))}
              <div className="piccolo tenue" style={{ marginTop: 10 }}>
                Insieme al modello: <b>Qwen3-VL 8B</b> (text encoder, {byte(9.35e9)}), il <b>VAE Texture-Fix</b> (trame più pulite) e <b>4x-UltraSharp</b> per gli ingrandimenti.
              </div>
              <h2 style={{ marginTop: 16 }}>LoRA consigliati</h2>
              {lore.map((l) => (
                <label key={l.id} className={`opzione ${extra.includes(l.id) ? 'su' : ''}`}>
                  <input type="checkbox" checked={extra.includes(l.id)} onChange={(e) => setExtra(e.target.checked ? [...extra, l.id] : extra.filter((x) => x !== l.id))} />
                  <div>
                    <div className="t">{l.nome}</div>
                    <small>{l.descrizione} · {byte(l.byte)}</small>
                  </div>
                </label>
              ))}
            </div>

            <div className="pannello blocco">
              <h2>3 · Dove metterlo</h2>
              <div className="riga">
                <input type="text" value={cartella} onChange={(e) => setCartella(e.target.value)} />
                <button className="btn" onClick={async () => { const c = await api.file.scegliCartella(cartella); if (c) setCartella(c) }}>Cambia</button>
              </div>
              <div className="piccolo tenue" style={{ marginTop: 8 }}>
                Da scaricare: circa <b className="oro">{byte(daScaricare)}</b>{!motoreGia && ' (motore ComfyUI con PyTorch CUDA compreso)'}. Il motore va in %LOCALAPPDATA%\DaProdImage.
              </div>
              <div className="riga" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
                <button className="btn primario grande" onClick={installa} disabled={!controllo?.ok}>Installa e inizia</button>
              </div>
            </div>
          </>
        )}

        {fase === 'installa' && (
          <div className="pannello blocco">
            <h2>Installazione</h2>
            <div className="passi-setup">
              {passi.map((p) => (
                <div key={p.id} className={`passo-setup ${p.stato.replace(' ', '')}`}>
                  <div className="ic">{p.stato === 'fatto' || p.stato === 'saltato' ? '✓' : p.stato === 'errore' ? '!' : p.stato === 'in corso' ? '…' : '·'}</div>
                  <div>
                    <b>{p.titolo}</b>
                    {p.dettaglio && <div className="d">{p.dettaglio}</div>}
                    {p.stato === 'in corso' && p.avanzamento !== undefined && (
                      <div className="barra-progresso" style={{ marginTop: 6 }}><i style={{ width: `${p.avanzamento * 100}%` }} /></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {righe.length > 0 && <div className="log" style={{ height: 150, marginTop: 12 }}>{righe.slice(-60).join('\n')}</div>}
            <div className="riga" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
              {esito === null && <button className="btn" onClick={() => api.setup.annulla()}>Annulla</button>}
              {esito === false && (
                <>
                  <span className="tenue flex1">Qualcosa non è andato: riprova, riparte da dove si era fermato.</span>
                  <button className="btn" onClick={() => setFase('modello')}>Indietro</button>
                  <button className="btn primario" onClick={installa}>Riprova</button>
                </>
              )}
              {esito === true && (
                <>
                  <span className="oro flex1" style={{ fontWeight: 700 }}>Tutto pronto!</span>
                  <button className="btn primario grande" onClick={fatto}>Inizia a creare</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
