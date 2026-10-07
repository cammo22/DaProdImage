// Impostazioni: modelli, prestazioni, cartelle, motore.
import { useEffect, useRef, useState, type JSX } from 'react'
import { usaStato, ricaricaImp } from '../stato'
import { api, type FileModelli } from '../api'
import { I } from '../componenti/Icone'
import { Interruttore, Segmenti } from '../componenti/Controlli'
import { byte } from '../util'
import type { Download, Impostazioni as Imp, StatoVoce } from '@shared/tipi'

export function Impostazioni(): JSX.Element {
  const { imp, motore, avvisa } = usaStato()
  const [file, setFile] = useState<FileModelli>({ diffusione: [], encoder: [], vae: [], upscaler: [] })
  const [catalogo, setCatalogo] = useState<StatoVoce[]>([])
  const [download, setDownload] = useState<Record<string, Download>>({})
  const [log, setLog] = useState<string[]>([])
  const [versione, setVersione] = useState('')
  const fineLog = useRef<HTMLDivElement>(null)

  const ricarica = async (): Promise<void> => {
    setFile(await api.modelli.file())
    setCatalogo(await api.modelli.stato())
  }
  useEffect(() => {
    void ricarica()
    void api.motore.log().then(setLog)
    void api.app.versione().then(setVersione)
    const a = api.su.download((d) => setDownload((x) => ({ ...x, [d.nome]: d })))
    const b = api.su.motoreLog((r) => setLog((l) => [...l.slice(-500), r]))
    return () => {
      a()
      b()
    }
  }, [])
  useEffect(() => {
    fineLog.current?.scrollTo(0, fineLog.current.scrollHeight)
  }, [log])

  if (!imp) return <div />
  const salva = async (m: Partial<Imp>): Promise<void> => {
    await api.impostazioni.salva(m)
    await ricaricaImp()
  }
  const scarica = async (v: StatoVoce): Promise<void> => {
    const d = await api.modelli.scarica(v.id)
    await ricarica()
    if (d.stato === 'fatto') {
      avvisa(`${v.nome} scaricato`, 'ok')
      if (v.tipo === 'diffusione' && confirm(`Usare ${v.nome} da ora?`)) await salva({ modello: v.file })
    } else if (d.stato === 'errore') avvisa(d.errore || 'Download non riuscito', 'errore')
  }

  const voceScelta = (titolo: string, sotto: string, valore: string, lista: string[], cambia: (v: string) => void): JSX.Element => (
    <div className="voce">
      <div className="et"><b>{titolo}</b><small>{sotto}</small></div>
      <select value={valore} onChange={(e) => cambia(e.target.value)}>
        {!lista.includes(valore) && <option value={valore}>{valore} (manca)</option>}
        {lista.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
    </div>
  )

  const vramUsata = motore.vramTotale && motore.vramLibera !== undefined ? 1 - motore.vramLibera / motore.vramTotale : 0

  return (
    <div className="pagina">
      <div className="impostazioni">
        <div className="gruppo">
          <h2>MODELLI IN USO</h2>
          <div className="pannello">
            {voceScelta('Modello di diffusione', 'Il cuore: Qwen-Image 2.1 (GGUF o safetensors)', imp.modello, file.diffusione, (modello) => salva({ modello }))}
            {voceScelta('Text encoder', 'Qwen3-VL 8B: legge il prompt e guarda le foto', imp.encoder, file.encoder, (encoder) => salva({ encoder }))}
            {voceScelta('VAE', 'Texture-Fix = trame più pulite', imp.vae, file.vae, (vae) => salva({ vae }))}
            {voceScelta('Ingranditore', 'Per "2×" e "Rifinisci"', imp.upscaler, file.upscaler, (upscaler) => salva({ upscaler }))}
          </div>
        </div>

        <div className="gruppo">
          <h2>SCARICA ALTRI MODELLI</h2>
          <div className="pannello">
            {catalogo.filter((v) => v.tipo !== 'lora').map((v) => {
              const d = download[v.nome]
              const vaGiu = d && (d.stato === 'in corso' || d.stato === 'verifica')
              return (
                <div className="modello" key={v.id}>
                  <div>
                    <span className="t">{v.nome}</span> {v.consigliato && <span className="distintivo si">consigliato</span>} <span className="piccolo spento">· {byte(v.byte)}</span>
                  </div>
                  <div className="riga">
                    {v.presente ? (
                      <span className="distintivo si">✓ presente</span>
                    ) : vaGiu ? (
                      <>
                        <span className="piccolo tenue">{d.totali ? Math.round((d.ricevuti / d.totali) * 100) : 0}% · {(d.velocita / 1e6).toFixed(0)} MB/s</span>
                        <button className="btn piccolo fantasma" onClick={() => api.modelli.annulla(d.id)}>Annulla</button>
                      </>
                    ) : (
                      <button className="btn piccolo" onClick={() => scarica(v)}><I.scarica /> Scarica</button>
                    )}
                  </div>
                  <small>{v.descrizione}</small>
                  {vaGiu && <div className="barra-progresso" style={{ gridColumn: '1 / -1' }}><i style={{ width: `${d.totali ? (d.ricevuti / d.totali) * 100 : 0}%` }} /></div>}
                </div>
              )
            })}
          </div>
        </div>

        <div className="gruppo">
          <h2>PRESTAZIONI (8 GB DI VRAM)</h2>
          <div className="pannello">
            <div className="voce">
              <div className="et"><b>Cache KV di Qwen 2.1</b><small>Riusa il prompt fra un passo e l'altro. Auto = VRAM libera, poi RAM.</small></div>
              <Segmenti valore={imp.cacheKV} cambia={(cacheKV) => salva({ cacheKV })} voci={[{ id: 'auto', nome: 'Auto' }, { id: 'gpu', nome: 'GPU' }, { id: 'cpu', nome: 'RAM' }, { id: 'off', nome: 'Spenta' }]} />
            </div>
            <div className="voce">
              <div className="et"><b>Precisione della cache</b><small>int8 dimezza la memoria quasi senza perdite (utile con molte foto di riferimento)</small></div>
              <Segmenti valore={imp.cacheTipo} cambia={(cacheTipo) => salva({ cacheTipo })} voci={[{ id: 'default', nome: 'Piena' }, { id: 'int8', nome: 'int8' }, { id: 'int4', nome: 'int4' }]} />
            </div>
            <div className="voce">
              <div className="et"><b>Text encoder sul processore</b><small>Lascia tutta la VRAM al disegno; il prompt si legge più lentamente</small></div>
              <Interruttore acceso={imp.encoderSuCpu} cambia={(encoderSuCpu) => salva({ encoderSuCpu })}>{imp.encoderSuCpu ? 'Sul processore' : 'Automatico (GPU quando c\'è posto)'}</Interruttore>
            </div>
            <div className="voce">
              <div className="et"><b>Anteprima dal vivo</b><small>Vedi l'immagine nascere passo per passo</small></div>
              <Interruttore acceso={imp.anteprimaLive} cambia={(anteprimaLive) => salva({ anteprimaLive })}>{imp.anteprimaLive ? 'Accesa' : 'Spenta'}</Interruttore>
            </div>
            <div className="voce">
              <div className="et"><b>VRAM da lasciare libera</b><small>GB per Windows e gli altri programmi (0 = decide il motore)</small></div>
              <input type="number" min={0} max={4} step={0.25} value={imp.riservaVram} onChange={(e) => salva({ riservaVram: Number(e.target.value) || 0 })} />
            </div>
            <div className="voce">
              <div className="et"><b>Argomenti extra del motore</b><small>Per esperti (es. --use-sage-attention, --fast)</small></div>
              <input type="text" value={imp.argomentiExtra} onChange={(e) => usaStato.setState({ imp: { ...imp, argomentiExtra: e.target.value } })} onBlur={(e) => salva({ argomentiExtra: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="gruppo">
          <h2>VALORI DI PARTENZA</h2>
          <div className="pannello">
            <div className="voce">
              <div className="et"><b>Passi e campionatore</b><small>La pipeline ufficiale: 40 passi, euler, simple, CFG 1</small></div>
              <div className="riga">
                <input type="number" min={4} max={100} value={imp.predefiniti.passi} onChange={(e) => salva({ predefiniti: { ...imp.predefiniti, passi: Number(e.target.value) || 40 } })} />
                <span className="piccolo tenue">passi (per "Alta")</span>
                <button className="btn piccolo fantasma" onClick={() => salva({ predefiniti: { passi: 40, cfg: 1, sampler: 'euler', scheduler: 'simple', megapixel: 1 } })}>Ufficiali</button>
              </div>
            </div>
          </div>
        </div>

        <div className="gruppo">
          <h2>CARTELLE</h2>
          <div className="pannello">
            <div className="voce">
              <div className="et"><b>Galleria</b><small>Dove finiscono le immagini</small></div>
              <div className="riga">
                <input type="text" value={imp.cartellaGalleria} readOnly />
                <button className="btn piccolo" onClick={async () => { const c = await api.file.scegliCartella(imp.cartellaGalleria); if (c) await salva({ cartellaGalleria: c }) }}>Cambia</button>
                <button className="btn piccolo icona" onClick={() => api.galleria.apriCartella()}><I.cartella /></button>
              </div>
            </div>
            <div className="voce">
              <div className="et"><b>Modelli</b><small>Dentro: diffusion_models, text_encoders, vae, loras, upscale_models</small></div>
              <div className="riga">
                <input type="text" value={imp.cartellaModelli} readOnly />
                <button className="btn piccolo" onClick={async () => { const c = await api.file.scegliCartella(imp.cartellaModelli); if (c && confirm('Cambiare la cartella dei modelli? I modelli che non sono lì andranno riscaricati o spostati.')) await salva({ cartellaModelli: c }) }}>Cambia</button>
                <button className="btn piccolo icona" onClick={() => api.app.apriCartella('modelli')}><I.cartella /></button>
              </div>
            </div>
          </div>
        </div>

        <div className="gruppo">
          <h2>ACCOUNT (FACOLTATIVI)</h2>
          <div className="pannello">
            <div className="voce">
              <div className="et"><b>Token Civitai</b><small>Per scaricare i LoRA che chiedono l'accesso</small></div>
              <input type="password" value={imp.tokenCivitai} placeholder="civitai.com → Account → API Keys" onChange={(e) => usaStato.setState({ imp: { ...imp, tokenCivitai: e.target.value } })} onBlur={(e) => salva({ tokenCivitai: e.target.value.trim() })} />
            </div>
            <div className="voce">
              <div className="et"><b>Token Hugging Face</b><small>Per i repository privati o con accesso</small></div>
              <input type="password" value={imp.tokenHF} placeholder="hf_…" onChange={(e) => usaStato.setState({ imp: { ...imp, tokenHF: e.target.value } })} onBlur={(e) => salva({ tokenHF: e.target.value.trim() })} />
            </div>
          </div>
        </div>

        <div className="gruppo">
          <h2>MOTORE</h2>
          <div className="pannello" style={{ padding: 14 }}>
            <div className="riga a-capo" style={{ marginBottom: 10 }}>
              <span className={`pillola ${motore.stato === 'pronto' ? 'pronto' : motore.stato === 'avvio' ? 'avvio' : motore.stato === 'errore' ? 'errore' : ''}`}><span className="punto" /> {motore.stato}</span>
              {motore.gpu && <span className="tenue">{motore.gpu}</span>}
              {motore.vramTotale ? <span className="tenue">VRAM {byte(motore.vramTotale - (motore.vramLibera || 0))} / {byte(motore.vramTotale)} ({Math.round(vramUsata * 100)}%)</span> : null}
              {motore.versione && <span className="spento">ComfyUI {motore.versione} · porta {motore.porta}</span>}
              <span className="flex1" />
              <button className="btn piccolo" onClick={() => api.motore.libera().then(() => avvisa('VRAM liberata', 'ok'))} title="Scarica i modelli dalla VRAM">Libera VRAM</button>
              <button className="btn piccolo" onClick={() => api.motore.riavvia().catch((e: Error) => avvisa(e.message, 'errore'))}><I.ricicla /> Riavvia</button>
              {motore.stato === 'pronto' ? <button className="btn piccolo" onClick={() => api.motore.ferma()}><I.stop /> Ferma</button> : <button className="btn piccolo" onClick={() => api.motore.avvia().catch((e: Error) => avvisa(e.message, 'errore'))}><I.play /> Avvia</button>}
              <button className="btn piccolo fantasma" onClick={() => api.motore.apriComfy()} title="L'interfaccia di ComfyUI nel browser (per esperti)">ComfyUI ↗</button>
              <button className="btn piccolo fantasma" onClick={() => api.app.apriCartella('log')}>Log</button>
            </div>
            {motore.messaggio && motore.stato === 'errore' && <div className="avviso-box errore" style={{ whiteSpace: 'pre-wrap' }}>{motore.messaggio}</div>}
            <div className="log" ref={fineLog}>{log.join('\n')}</div>
          </div>
        </div>

        <div className="gruppo">
          <h2>DAPROD IMAGE</h2>
          <div className="pannello" style={{ padding: 14 }}>
            <div className="riga a-capo">
              <span>Versione <b className="oro">{versione}</b></span>
              <span className="spento">Qwen-Image 2.1 (Qwen Research License) · ComfyUI (GPL-3.0) · ComfyUI-GGUF (Apache-2.0)</span>
              <span className="flex1" />
              <button className="btn piccolo" onClick={() => api.app.apriLink('https://github.com/cammo22/DaProdImage')}><I.link /> GitHub</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
