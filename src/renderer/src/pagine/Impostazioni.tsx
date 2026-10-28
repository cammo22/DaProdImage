// Opzioni: in cima poche cose chiare (motore, modelli, come lavora, cartelle, aggiornamenti); tutto il resto sta in «Avanzate», chiuso.
import { useEffect, useRef, useState, type JSX } from 'react'
import { usaStato, ricaricaImp } from '../stato'
import { api, type FileModelli } from '../api'
import { I } from '../componenti/Icone'
import { Interruttore, Segmenti } from '../componenti/Controlli'
import { byte } from '../util'
import { MODELLI, ORDINE_MODELLI, type IdModello } from '@shared/modelli'
import type { Download, Impostazioni as Imp, StatoVoce } from '@shared/tipi'
import type { FileInutile } from '../api'
import { LaboratorioUncensored } from '../componenti/LaboratorioUncensored'

const GRUPPI_MODELLI: [StatoVoce['tipo'], string][] = [
  ['diffusione', 'Qwen · modelli'], ['encoder', 'Qwen · text encoder'], ['klein', 'Klein · modelli'], ['klein-te', 'Klein · text encoder'], ['klein-vae', 'Klein · VAE'], ['traduttore', 'Traduttore'], ['vae', 'VAE di Qwen'], ['upscaler', 'Ingrandimento'], ['anteprima', 'Anteprime dal vivo']
]

/** Opzioni: le impostazioni di sempre (i LoRA hanno la pagina loro, nella rotaia). */
export function Impostazioni(): JSX.Element {
  return (
    <div className="pagina opzioni-schede">
      <div className="corpo-opzioni"><OpzioniGenerali /></div>
    </div>
  )
}

function OpzioniGenerali(): JSX.Element {
  const { imp, motore, avvisa, agg } = usaStato()
  const [file, setFile] = useState<FileModelli>({ diffusione: [], encoder: [], vae: [], upscaler: [], klein: [], kleinTe: [], kleinVae: [] })
  const [catalogo, setCatalogo] = useState<StatoVoce[]>([])
  const [download, setDownload] = useState<Record<string, Download>>({})
  const [log, setLog] = useState<string[]>([])
  const [versione, setVersione] = useState('')
  const fineLog = useRef<HTMLDivElement>(null)
  // i gruppi di «Avanzate» si possono chiudere (si ricorda come li hai lasciati); di serie è tutto chiuso
  const [aperti, setAperti] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('dpi-opzioni-aperti') || '{}')
    } catch {
      return {}
    }
  })
  const alterna = (t: string): void =>
    setAperti((c) => {
      const n = { ...c, [t]: !c[t] }
      try {
        localStorage.setItem('dpi-opzioni-aperti', JSON.stringify(n))
      } catch {
        /* niente */
      }
      return n
    })
  const [inutili, setInutili] = useState<FileInutile[]>([])
  useEffect(() => {
    if (aperti['FILE INUTILIZZATI']) void api.modelli.inutilizzati().then(setInutili)
  }, [aperti['FILE INUTILIZZATI'], catalogo])

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
      // il nome vero del file lo conosciamo solo adesso (ed encoder GGUF di terzi)
      const n = (await api.modelli.stato()).find((x) => x.id === v.id) || v
      if (v.tipo === 'diffusione' && confirm(`Usare ${v.nome} da ora?`)) await salva({ modello: n.file })
      if (v.tipo === 'encoder' && confirm(`Usare ${v.nome} come text encoder da ora?`)) await salva({ encoder: n.file })
    } else if (d.stato === 'errore') avvisa(d.errore || 'Download non riuscito', 'errore')
  }

  const voceScelta = (titolo: string, sotto: string, valore: string, lista: string[], cambia: (v: string) => void): JSX.Element => (
    <div className="voce">
      <div className="et"><b>{titolo}</b>{sotto && <small>{sotto}</small>}</div>
      <select value={valore} onChange={(e) => cambia(e.target.value)}>
        {valore && !lista.includes(valore) && <option value={valore}>{valore} (manca)</option>}
        {lista.map((f) => <option key={f || 'auto'} value={f}>{f || '(automatico)'}</option>)}
      </select>
    </div>
  )
  const voceInterruttore = (titolo: string, sotto: string, acceso: boolean, cambia: (v: boolean) => void): JSX.Element => (
    <div className="voce">
      <div className="et"><b>{titolo}</b><small>{sotto}</small></div>
      <Interruttore acceso={acceso} cambia={cambia}>{acceso ? 'Sì' : 'No'}</Interruttore>
    </div>
  )
  /** un gruppo di «Avanzate»: titolo che si apre e si chiude, chiuso di serie */
  const gruppo = (titolo: string, corpo: JSX.Element): JSX.Element => (
    <div className="gruppo">
      <h2 className="chiudibile" onClick={() => alterna(titolo)}>{aperti[titolo] ? '▾' : '▸'} {titolo}</h2>
      {aperti[titolo] && <div className="pannello">{corpo}</div>}
    </div>
  )

  const vramGB = motore.vramTotale ? motore.vramTotale / 1073741824 : imp.vramMB ? imp.vramMB / 1024 : 0
  // i modelli che si possono usare adesso (Klein: modello, text encoder e VAE nelle cartelle)
  const comuni = (file.kleinTe?.length ?? 0) > 0 && (file.kleinVae?.length ?? 0) > 0
  const pronti: Record<IdModello, boolean> = {
    'qwen-base': true,
    'qwen-veloce': !!file.lightning,
    klein: comuni && !!file.klein?.some((n) => !/base/i.test(n)),
    'klein-base': comuni && !!file.klein?.some((n) => /base/i.test(n))
  }
  const statoMotore = motore.stato === 'pronto' ? 'pronto' : motore.stato === 'avvio' ? 'avvio' : motore.stato === 'errore' ? 'errore' : ''

  return (
    <div className="pagina">
      <div className="impostazioni">
        <div className="gruppo">
          <h2>MOTORE</h2>
          <div className="pannello" style={{ padding: 14 }}>
            <div className="riga a-capo">
              <span className={`pillola ${statoMotore}`}><span className="punto" /> {motore.stato}</span>
              {motore.gpu && <span className="tenue">{motore.gpu}</span>}
              {motore.vramTotale ? <span className="tenue">VRAM {byte(motore.vramTotale - (motore.vramLibera || 0))} / {byte(motore.vramTotale)}</span> : null}
              <span className="flex1" />
              <button className="btn piccolo" onClick={() => api.motore.libera().then(() => avvisa('VRAM liberata', 'ok'))} title="Scarica i modelli dalla VRAM">Libera VRAM</button>
              <button className="btn piccolo" onClick={() => api.motore.riavvia().catch((e: Error) => avvisa(e.message, 'errore'))}><I.ricicla /> Riavvia</button>
            </div>
            {motore.messaggio && motore.stato === 'errore' && <div className="avviso-box errore" style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>{motore.messaggio}</div>}
          </div>
        </div>

        <div className="gruppo">
          <h2>MODELLI</h2>
          <div className="pannello">
            {ORDINE_MODELLI.map((id) => {
              const m = MODELLI[id]
              return (
                <div className="voce" key={id}>
                  <div className="et"><b>{id === 'qwen-base' ? 'Qwen-Image 2.1' : id === 'klein' ? 'FLUX 3 Klein' : 'FLUX 3 Klein Base'}</b><small>{m.sotto}</small></div>
                  {pronti[id] ? <span className="distintivo si">✓ pronto</span> : <span className="piccolo tenue">si scarica dalla barra in alto</span>}
                </div>
              )
            })}
          </div>
        </div>

        <div className="gruppo">
          <h2>COME LAVORA</h2>
          <div className="pannello">
            <div className="voce">
              <div className="et"><b>Scheda video</b><small>{imp.memoria === 'auto' ? `Auto${vramGB ? ` · ${vramGB.toFixed(1)} GB` : ''}` : 'Scelta a mano'}</small></div>
              <Segmenti valore={imp.memoria} cambia={(memoria) => salva({ memoria })} voci={[{ id: 'auto', nome: 'Auto' }, { id: 'bassa', nome: '6 GB' }, { id: 'normale', nome: '8-12 GB' }, { id: 'alta', nome: '16 GB+' }]} />
            </div>
            {voceInterruttore('Traduci in inglese', 'I prompt in italiano si traducono da soli', imp.traduci, (traduci) => salva({ traduci }))}
            {voceInterruttore("Klein: l'LLM legge il prompt", 'Lo riscrive guardando le foto: Klein ne ha bisogno (BFL lo chiede)', imp.potenziaKlein ?? true, (potenziaKlein) => salva({ potenziaKlein }))}
            {voceInterruttore("Qwen: l'LLM legge il prompt", 'Aiuta le modifiche difficili; qualche secondo in più', imp.potenziaQwen ?? false, (potenziaQwen) => salva({ potenziaQwen }))}
            {voceInterruttore('Anteprima dal vivo', "Vedi l'immagine nascere", imp.anteprimaLive, (anteprimaLive) => salva({ anteprimaLive }))}
            <div className="voce">
              <div className="et"><b>Libera la scheda video dopo</b><small>Se non fai niente per un po'</small></div>
              <Segmenti valore={imp.scaricaDopo} cambia={(scaricaDopo) => salva({ scaricaDopo })} voci={[{ id: 0, nome: 'Mai' }, { id: 60, nome: '1 min' }, { id: 300, nome: '5 min' }, { id: 900, nome: '15 min' }]} />
            </div>
          </div>
        </div>

        <div className="gruppo">
          <h2>CARTELLE</h2>
          <div className="pannello">
            <div className="voce">
              <div className="et"><b>Immagini</b></div>
              <div className="riga">
                <input type="text" value={imp.cartellaGalleria} readOnly />
                <button className="btn piccolo" onClick={async () => { const c = await api.file.scegliCartella(imp.cartellaGalleria); if (c) await salva({ cartellaGalleria: c }) }}>Cambia</button>
                <button className="btn piccolo icona" onClick={() => api.galleria.apriCartella()}><I.cartella /></button>
              </div>
            </div>
            <div className="voce">
              <div className="et"><b>Modelli</b></div>
              <div className="riga">
                <input type="text" value={imp.cartellaModelli} readOnly />
                <button className="btn piccolo" onClick={async () => { const c = await api.file.scegliCartella(imp.cartellaModelli); if (c && confirm('Cambiare la cartella dei modelli? I modelli che non sono lì andranno riscaricati o spostati.')) await salva({ cartellaModelli: c }) }}>Cambia</button>
                <button className="btn piccolo icona" onClick={() => api.app.apriCartella('modelli')}><I.cartella /></button>
              </div>
            </div>
          </div>
        </div>

        <div className="gruppo">
          <h2>AGGIORNAMENTI</h2>
          <div className="pannello" style={{ padding: 14 }}>
            <div className="riga a-capo">
              <span>Versione <b className="oro">{versione}</b></span>
              <span className="tenue">
                {{
                  nessuno: 'Controllo automatico.',
                  sviluppo: 'In sviluppo gli aggiornamenti sono spenti.',
                  controllo: 'Controllo…',
                  aggiornato: "È l'ultima versione.",
                  scarico: `Scarico la ${agg.versione}… ${agg.percentuale ?? 0}%`,
                  pronto: `La ${agg.versione} è pronta: si installa al riavvio.`,
                  errore: `Non riesco a controllare: ${agg.errore || ''}`
                }[agg.stato]}
              </span>
              <span className="flex1" />
              {agg.stato === 'pronto' ? (
                <button className="btn primario" onClick={() => api.aggiornamento.installa()}><I.ricicla /> Riavvia e aggiorna</button>
              ) : (
                <button className="btn piccolo" disabled={agg.stato === 'sviluppo' || agg.stato === 'controllo' || agg.stato === 'scarico'} onClick={() => api.aggiornamento.controlla()}>
                  <I.ricicla /> Controlla ora
                </button>
              )}
            </div>
            {agg.stato === 'scarico' && <div className="barra-progresso" style={{ marginTop: 10 }}><i style={{ width: `${agg.percentuale ?? 0}%` }} /></div>}
          </div>
        </div>

        <details className="avanzate" open={!!aperti.AVANZATE} onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open !== !!aperti.AVANZATE) alterna('AVANZATE') }}>
          <summary>Avanzate <span className="piccolo spento">file dei modelli, memoria, account, log</span></summary>

          <LaboratorioUncensored imp={imp} catalogo={catalogo} download={download} salva={salva} scarica={scarica} />

          {gruppo('FILE DEI MODELLI', (
            <>
              {voceScelta('Qwen · modello', '', imp.modello, file.diffusione, (modello) => salva({ modello }))}
              {voceScelta('Qwen · text encoder', '', imp.encoder, file.encoder, (encoder) => salva({ encoder }))}
              {voceScelta('Qwen · VAE', '', imp.vae, file.vae, (vae) => salva({ vae }))}
              {voceScelta('Klein', 'Vuoto = lo trova da solo', imp.kleinModello, ['', ...file.klein.filter((n) => !/base/i.test(n))], (kleinModello) => salva({ kleinModello }))}
              {voceScelta('Klein Base', 'Vuoto = lo trova da solo', imp.kleinBase, ['', ...file.klein.filter((n) => /base/i.test(n))], (kleinBase) => salva({ kleinBase }))}
              {voceScelta('Klein · text encoder', '', imp.kleinEncoder, ['', ...file.kleinTe], (kleinEncoder) => salva({ kleinEncoder }))}
              {voceScelta('Klein · VAE', '', imp.kleinVae, ['', ...file.kleinVae], (kleinVae) => salva({ kleinVae }))}
              <div className="voce">
                <div className="et"><b>Ingranditore</b><small>Per «2×», «Rifinisci» e le misure grandi</small></div>
                <Segmenti valore={imp.upscalerRtx ? 'rtx' : 'modello'} cambia={(v) => salva({ upscalerRtx: v === 'rtx' })} voci={[{ id: 'rtx', nome: 'NVIDIA RTX', sotto: 'consigliato' }, { id: 'modello', nome: 'A modello', sotto: '4x-UltraSharp' }]} />
              </div>
              {!imp.upscalerRtx && voceScelta('Ingranditore a modello', '', imp.upscaler, file.upscaler, (upscaler) => salva({ upscaler }))}
            </>
          ))}

          {gruppo('SCARICA ALTRI MODELLI', (
            <>
              {GRUPPI_MODELLI.map(([tipo, titolo]) => {
                const voci = catalogo.filter((v) => v.tipo === tipo && !v.uncensored)
                if (!voci.length) return null
                return (
                  <details key={tipo} className="tipo-modelli" open={tipo === 'traduttore'}>
                    <summary>{titolo} <span className="piccolo spento">· {voci.filter((x) => x.presente).length}/{voci.length} presenti</span></summary>
                    {voci.map((v) => {
                      const d = download[v.nome]
                      const vaGiu = d && (d.stato === 'in corso' || d.stato === 'verifica')
                      return (
                        <div className="modello" key={v.id}>
                          <div>
                            <span className="t">{v.nome}</span> {(v.file === imp.modello || v.file === imp.encoder) && v.file && <span className="distintivo si">in uso</span>} {v.consigliato && <span className="distintivo si">consigliato</span>} <span className="piccolo spento">· {v.circa ? 'circa ' : ''}{byte(v.byte)}</span>
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
                          {vaGiu && <div className="barra-progresso" style={{ gridColumn: '1 / -1' }}><i style={{ width: `${d.totali ? (d.ricevuti / d.totali) * 100 : 0}%` }} /></div>}
                        </div>
                      )
                    })}
                  </details>
                )
              })}
            </>
          ))}

          {gruppo('FILE INUTILIZZATI', (
            <>
              {inutili.length === 0 && <div className="spento piccolo" style={{ padding: 8 }}>Niente da togliere: ogni file è in uso.</div>}
              {inutili.map((f) => (
                <div className="modello" key={f.percorso}>
                  <div><span className="t">{f.nome}</span> <span className="piccolo spento">· {f.cartella} · {byte(f.byte)} · {f.motivo}</span></div>
                  <button className="btn piccolo fantasma pericolo" onClick={async () => {
                    if (!confirm(`Metto "${f.nome}" nel Cestino?`)) return
                    try {
                      await api.modelli.elimina(f.percorso)
                      setInutili(await api.modelli.inutilizzati())
                      await ricarica()
                    } catch (e) {
                      avvisa((e as Error).message, 'errore')
                    }
                  }}><I.cestino /> Cestino</button>
                </div>
              ))}
              {inutili.length > 0 && <div className="piccolo tenue" style={{ padding: '6px 2px 0' }}>In tutto {byte(inutili.reduce((a, f) => a + f.byte, 0))} (vanno nel Cestino, si recuperano)</div>}
            </>
          ))}

          {gruppo('MEMORIA E VELOCITÀ', (
            <>
              {voceInterruttore('Scarica da solo quello che manca', 'Quando l\'app è ferma, i file consigliati (il traduttore…)', imp.scaricaInIdle, (scaricaInIdle) => salva({ scaricaInIdle }))}
              {imp.traduci && (
                <div className="voce">
                  <div className="et"><b>Chi traduce</b><small>{imp.traduttore === 'dedicato' ? 'Un modello solo per tradurre (Opus-MT), sul processore' : 'Lo stesso Qwen3-VL: più lento, può ammorbidire'}</small></div>
                  <Segmenti valore={imp.traduttore} cambia={(traduttore) => salva({ traduttore })} voci={[{ id: 'dedicato', nome: 'Traduttore' }, { id: 'llm', nome: 'Qwen3-VL' }]} />
                </div>
              )}
              {voceInterruttore('Una cosa alla volta in VRAM', 'Scarica il modello che non serve: evita di finire nella RAM', imp.unaCosaAllaVolta, (unaCosaAllaVolta) => salva({ unaCosaAllaVolta }))}
              {voceInterruttore('Testi col Qwen3-VL 4B anche con Qwen', 'Migliora prompt e Idee molto più veloci; se manca resta l\'8B', imp.testoCon4B ?? true, (testoCon4B) => salva({ testoCon4B }))}
              {voceInterruttore('Accelerazione fp16', 'Qualche secondo in meno sulle RTX', imp.veloce, (veloce) => salva({ veloce }))}
              <div className="voce">
                <div className="et"><b>Cache KV di Qwen</b><small>Auto = VRAM libera, poi RAM</small></div>
                <Segmenti valore={imp.cacheKV} cambia={(cacheKV) => salva({ cacheKV })} voci={[{ id: 'auto', nome: 'Auto' }, { id: 'gpu', nome: 'GPU' }, { id: 'cpu', nome: 'RAM' }, { id: 'off', nome: 'Spenta' }]} />
              </div>
              <div className="voce">
                <div className="et"><b>Precisione della cache KV</b><small>Q4 = un quarto della memoria, circa il 10% più veloce, stessa qualità a occhio</small></div>
                <Segmenti valore={imp.cacheTipo} cambia={(cacheTipo) => salva({ cacheTipo })} voci={[{ id: 'default', nome: 'Piena' }, { id: 'int8', nome: 'Q8' }, { id: 'int4', nome: 'Q4' }]} />
              </div>
              {voceInterruttore('Text encoder sul processore', 'Lascia la VRAM al disegno; il prompt si legge più piano', imp.encoderSuCpu, (encoderSuCpu) => salva({ encoderSuCpu }))}
              <div className="voce">
                <div className="et"><b>VRAM da lasciare libera</b><small>GB per Windows (0 = decide il motore)</small></div>
                <input type="number" min={0} max={4} step={0.25} value={imp.riservaVram} onChange={(e) => salva({ riservaVram: Number(e.target.value) || 0 })} />
              </div>
              <div className="voce">
                <div className="et"><b>Argomenti extra del motore</b><small>Per esperti</small></div>
                <input type="text" value={imp.argomentiExtra} onChange={(e) => usaStato.setState({ imp: { ...imp, argomentiExtra: e.target.value } })} onBlur={(e) => salva({ argomentiExtra: e.target.value })} />
              </div>
              <div className="voce" style={{ display: 'block' }}>
                <div className="avviso-box" style={{ marginTop: 0 }}>
                  <b>Una foto ci mette minuti?</b> Nel Pannello di controllo NVIDIA → Impostazioni 3D → globali, metti <i>Criterio di fallback della memoria di sistema CUDA</i> su <b>Preferisci nessun fallback</b>.
                </div>
              </div>
            </>
          ))}

          {gruppo('VALORI DI PARTENZA DI QWEN', (
            <div className="voce">
              <div className="et"><b>Passi</b><small>Ufficiali: 40, euler, simple, CFG 1</small></div>
              <div className="riga">
                <input type="number" min={4} max={100} value={imp.predefiniti.passi} onChange={(e) => salva({ predefiniti: { ...imp.predefiniti, passi: Number(e.target.value) || 40 } })} />
                <button className="btn piccolo fantasma" onClick={() => salva({ predefiniti: { passi: 40, cfg: 1, sampler: 'euler', scheduler: 'simple', megapixel: 1 } })}>Ufficiali</button>
              </div>
            </div>
          ))}

          {gruppo('ACCOUNT (FACOLTATIVI)', (
            <>
              <div className="voce">
                <div className="et"><b>Token Civitai</b><small>Per i LoRA che chiedono l'accesso</small></div>
                <input type="password" value={imp.tokenCivitai} placeholder="civitai.com → Account → API Keys" onChange={(e) => usaStato.setState({ imp: { ...imp, tokenCivitai: e.target.value } })} onBlur={(e) => salva({ tokenCivitai: e.target.value.trim() })} />
              </div>
              <div className="voce">
                <div className="et"><b>Token Hugging Face</b><small>Per Klein e i repository con accesso</small></div>
                <input type="password" value={imp.tokenHF} placeholder="hf_…" onChange={(e) => usaStato.setState({ imp: { ...imp, tokenHF: e.target.value } })} onBlur={(e) => salva({ tokenHF: e.target.value.trim() })} />
              </div>
            </>
          ))}

          {gruppo('LOG DEL MOTORE', (
            <div style={{ padding: 14 }}>
              <div className="riga a-capo" style={{ marginBottom: 10 }}>
                {motore.versione && <span className="spento">ComfyUI {motore.versione} · porta {motore.porta}</span>}
                <span className="flex1" />
                {motore.stato === 'pronto' ? <button className="btn piccolo" onClick={() => api.motore.ferma()}><I.stop /> Ferma</button> : <button className="btn piccolo" onClick={() => api.motore.avvia().catch((e: Error) => avvisa(e.message, 'errore'))}><I.play /> Avvia</button>}
                <button className="btn piccolo fantasma" onClick={() => api.motore.apriComfy()} title="L'interfaccia di ComfyUI nel browser (per esperti)">ComfyUI ↗</button>
                <button className="btn piccolo fantasma" onClick={() => api.app.apriCartella('log')}>Cartella dei log</button>
                <button className="btn piccolo fantasma" onClick={() => api.app.apriLink('https://github.com/cammo22/DaProdImage/releases')}>Tutte le versioni ↗</button>
              </div>
              <div className="log" ref={fineLog}>{log.join('\n')}</div>
            </div>
          ))}
        </details>

        <div className="gruppo">
          <div className="pannello" style={{ padding: 14 }}>
            <div className="riga a-capo">
              <span className="spento">DaProd Image · Qwen-Image 2.1 (Qwen Research License) · FLUX 3 Klein (FLUX Kommunity) · ComfyUI (GPL-3.0)</span>
              <span className="flex1" />
              <button className="btn piccolo" onClick={() => api.app.apriLink('https://github.com/cammo22/DaProdImage')}><I.link /> GitHub</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
