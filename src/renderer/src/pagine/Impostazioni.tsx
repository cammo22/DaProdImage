// Impostazioni: modelli, prestazioni, cartelle, motore.
import { useEffect, useRef, useState, type JSX } from 'react'
import { usaStato, ricaricaImp } from '../stato'
import { Lora } from './Lora'
import { api, type FileModelli } from '../api'
import { I } from '../componenti/Icone'
import { Interruttore, Segmenti } from '../componenti/Controlli'
import { byte } from '../util'
import type { Download, Impostazioni as Imp, StatoVoce } from '@shared/tipi'
import type { FileInutile } from '../api'

const GRUPPI_MODELLI: [StatoVoce['tipo'], string][] = [
  ['diffusione', 'Modello di diffusione (denoiser)'], ['encoder', 'Text encoder (l\'LLM)'], ['klein', 'FLUX 3 Klein · modelli'], ['klein-te', 'FLUX 3 Klein · text encoder'], ['klein-vae', 'FLUX 3 Klein · VAE'], ['traduttore', 'Traduttore'], ['vae', 'VAE'], ['upscaler', 'Ingrandimento'], ['anteprima', 'Anteprime dal vivo']
]

/** Opzioni: due schede, le impostazioni di sempre e i LoRA (prima avevano una voce a sinistra, nella rotaia). */
export function Impostazioni(): JSX.Element {
  const scheda = usaStato((s) => s.schedaOpzioni)
  return (
    <div className="pagina opzioni-schede">
      <div className="schede-opzioni">
        <button className={scheda === 'generali' ? 'su' : ''} onClick={() => usaStato.setState({ schedaOpzioni: 'generali' })}>Impostazioni</button>
        <button className={scheda === 'lora' ? 'su' : ''} onClick={() => usaStato.setState({ schedaOpzioni: 'lora' })}>LoRA</button>
      </div>
      <div className="corpo-opzioni">{scheda === 'lora' ? <Lora /> : <OpzioniGenerali />}</div>
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
  // i gruppi si possono chiudere (si ricorda come li hai lasciati); i più lunghi partono chiusi
  const [chiusi, setChiusi] = useState<Record<string, boolean>>(() => {
    try {
      return { 'SCARICA ALTRI MODELLI': true, 'FILE INUTILIZZATI': true, 'VALORI DI PARTENZA': true, MOTORE: true, ...JSON.parse(localStorage.getItem('dpi-opzioni-chiusi') || '{}') }
    } catch {
      return { 'SCARICA ALTRI MODELLI': true, 'FILE INUTILIZZATI': true }
    }
  })
  const alterna = (t: string): void =>
    setChiusi((c) => {
      const n = { ...c, [t]: !c[t] }
      try {
        localStorage.setItem('dpi-opzioni-chiusi', JSON.stringify(n))
      } catch {
        /* niente */
      }
      return n
    })
  const [inutili, setInutili] = useState<FileInutile[]>([])
  useEffect(() => {
    if (!chiusi['FILE INUTILIZZATI']) void api.modelli.inutilizzati().then(setInutili)
  }, [chiusi['FILE INUTILIZZATI'], catalogo])

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
      // il nome vero del file lo conosciamo solo adesso (Turbo ed encoder GGUF di terzi)
      const n = (await api.modelli.stato()).find((x) => x.id === v.id) || v
      if (v.tipo === 'diffusione' && confirm(`Usare ${v.nome} da ora?`)) await salva({ modello: n.file })
      if (v.tipo === 'encoder' && confirm(`Usare ${v.nome} come text encoder da ora?`)) await salva({ encoder: n.file })
    } else if (d.stato === 'errore') avvisa(d.errore || 'Download non riuscito', 'errore')
  }

  const voceScelta = (titolo: string, sotto: string, valore: string, lista: string[], cambia: (v: string) => void): JSX.Element => (
    <div className="voce">
      <div className="et"><b>{titolo}</b><small>{sotto}</small></div>
      <select value={valore} onChange={(e) => cambia(e.target.value)}>
        {valore && !lista.includes(valore) && <option value={valore}>{valore} (manca)</option>}
        {lista.map((f) => <option key={f || 'auto'} value={f}>{f || '(automatico)'}</option>)}
      </select>
    </div>
  )

  const vramGB = motore.vramTotale ? motore.vramTotale / 1073741824 : imp.vramMB ? imp.vramMB / 1024 : 0
  const vramUsata = motore.vramTotale && motore.vramLibera !== undefined ? 1 - motore.vramLibera / motore.vramTotale : 0

  return (
    <div className="pagina">
      <div className="impostazioni">
        <div className="gruppo">
          <h2 className="chiudibile" onClick={() => alterna('MODELLI IN USO')}>{chiusi['MODELLI IN USO'] ? '▸' : '▾'} MODELLI IN USO</h2>
          <div className="pannello" style={chiusi['MODELLI IN USO'] ? { display: 'none' } : undefined}>
            {voceScelta('Modello di diffusione', 'Il cuore: Qwen-Image 2.1 (GGUF o safetensors)', imp.modello, file.diffusione, (modello) => salva({ modello }))}
            {voceScelta('Text encoder (l\'LLM)', 'Qwen3-VL 8B: legge il prompt, guarda le foto e traduce dall\'italiano. Gli .gguf (Q4/Q6/Q8) si scaricano qui sotto', imp.encoder, file.encoder, (encoder) => salva({ encoder }))}
            {voceScelta('VAE', 'Texture-Fix = trame più pulite', imp.vae, file.vae, (vae) => salva({ vae }))}
            <div className="voce">
              <div className="et"><b>Ingranditore</b><small>Per "2×", "Rifinisci" e le misure grandi. NVIDIA RTX (RTX Video Super Resolution) usa i Tensor core della scheda: più nitido e veloce; se non c'è, si usa quello a modello</small></div>
              <Segmenti valore={imp.upscalerRtx ? 'rtx' : 'modello'} cambia={(v) => salva({ upscalerRtx: v === 'rtx' })} voci={[{ id: 'rtx', nome: 'NVIDIA RTX', sotto: 'consigliato' }, { id: 'modello', nome: 'A modello', sotto: '4x-UltraSharp' }]} />
            </div>
            {voceScelta('FLUX 3 Klein · veloce', 'Il file di Klein (8 passi). Vuoto = lo trova da solo fra quelli scaricati', imp.kleinModello, ['', ...file.klein.filter((n) => !/base/i.test(n))], (kleinModello) => salva({ kleinModello }))}
            {voceScelta('FLUX 3 Klein Base', 'Il file di Klein Base (50 passi, CFG)', imp.kleinBase, ['', ...file.klein.filter((n) => /base/i.test(n))], (kleinBase) => salva({ kleinBase }))}
            <div className="voce">
              <div className="et"><b>Espandi il prompt prima di disegnare</b><small>Con Klein. Black Forest Labs lo consiglia: Klein dà il meglio con didascalie lunghe. Lo scrive il Qwen3-VL (circa mezzo minuto in più per immagine)</small></div>
              <Interruttore acceso={imp.potenziaKlein ?? true} cambia={(potenziaKlein) => salva({ potenziaKlein })}>{(imp.potenziaKlein ?? true) ? 'Acceso' : 'Spento'}</Interruttore>
            </div>
            {voceScelta('Text encoder di Klein', 'Qwen3-VL 4B (diverso dall\'encoder 8B di Qwen)', imp.kleinEncoder, ['', ...file.kleinTe], (kleinEncoder) => salva({ kleinEncoder }))}
            {voceScelta('VAE di Klein', 'Il decoder di FLUX 3 Klein', imp.kleinVae, ['', ...file.kleinVae], (kleinVae) => salva({ kleinVae }))}
            {!imp.upscalerRtx && voceScelta('Ingranditore a modello', 'Il file in upscale_models', imp.upscaler, file.upscaler, (upscaler) => salva({ upscaler }))}
          </div>
        </div>

        <div className="gruppo">
          <h2 className="chiudibile" onClick={() => alterna('SCARICA ALTRI MODELLI')}>{chiusi['SCARICA ALTRI MODELLI'] ? '▸' : '▾'} SCARICA ALTRI MODELLI</h2>
          <div className="pannello" style={chiusi['SCARICA ALTRI MODELLI'] ? { display: 'none' } : undefined}>
            {GRUPPI_MODELLI.map(([tipo, titolo]) => {
              const voci = catalogo.filter((v) => v.tipo === tipo)
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
                    <span className="t">{v.nome}</span> {v.turbo && <span className="distintivo">8 passi</span>} {(v.file === imp.modello || v.file === imp.encoder) && v.file && <span className="distintivo si">in uso</span>} {v.consigliato && <span className="distintivo si">consigliato</span>} <span className="piccolo spento">· {v.circa ? 'circa ' : ''}{byte(v.byte)}</span>
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
                </details>
              )
            })}
          </div>
        </div>

        <div className="gruppo">
          <h2 className="chiudibile" onClick={() => alterna('FILE INUTILIZZATI')}>{chiusi['FILE INUTILIZZATI'] ? '▸' : '▾'} FILE INUTILIZZATI</h2>
          <div className="pannello" style={chiusi['FILE INUTILIZZATI'] ? { display: 'none' } : undefined}>
            <div className="piccolo tenue" style={{ padding: '4px 2px 8px' }}>
              File nella cartella dei modelli che non stai usando: vecchi VAE e modelli tolti dal catalogo, o scaricati ma non scelti. Vanno nel Cestino (si recuperano).
            </div>
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
            {inutili.length > 0 && <div className="piccolo tenue" style={{ padding: '6px 2px 0' }}>In tutto {byte(inutili.reduce((a, f) => a + f.byte, 0))}</div>}
          </div>
        </div>

        <div className="gruppo">
          <h2 className="chiudibile" onClick={() => alterna('PRESTAZIONI E MEMORIA')}>{chiusi['PRESTAZIONI E MEMORIA'] ? '▸' : '▾'} PRESTAZIONI E MEMORIA</h2>
          <div className="pannello" style={chiusi['PRESTAZIONI E MEMORIA'] ? { display: 'none' } : undefined}>
            <div className="voce">
              <div className="et"><b>Scarica da solo quello che manca</b><small>Quando l'app è ferma per un minuto, scarica i file consigliati che non hai (il traduttore…). I modelli grandi li scegli tu</small></div>
              <Interruttore acceso={imp.scaricaInIdle} cambia={(scaricaInIdle) => salva({ scaricaInIdle })}>{imp.scaricaInIdle ? 'Sì' : 'No'}</Interruttore>
            </div>
            <div className="voce">
              <div className="et">
                <b>Profilo della scheda video</b>
                <small>
                  {imp.memoria === 'auto'
                    ? `Auto: ${vramGB ? `${vramGB.toFixed(1)} GB → ${vramGB < 6.84 ? '6 GB' : vramGB < 13.7 ? '8-12 GB' : '16 GB+'}` : 'si decide quando parte il motore'}`
                    : '6 GB: VAE a tessere e margine di VRAM fisso; 8-12 GB: a tessere solo oltre i 2 MP'}
                </small>
              </div>
              <Segmenti
                valore={imp.memoria}
                cambia={(memoria) => salva({ memoria })}
                voci={[{ id: 'auto', nome: 'Auto' }, { id: 'bassa', nome: '6 GB' }, { id: 'normale', nome: '8-12 GB' }, { id: 'alta', nome: '16 GB+' }]}
              />
            </div>
            <div className="voce">
              <div className="et"><b>Traduci in inglese da solo</b><small>Qwen-Image capisce meglio l'inglese: i prompt in italiano si traducono prima di disegnare. I testi fra virgolette restano identici</small></div>
              <Interruttore acceso={imp.traduci} cambia={(traduci) => salva({ traduci })}>{imp.traduci ? 'Accesa' : 'Spenta'}</Interruttore>
            </div>
            {imp.traduci && (
              <div className="voce">
                <div className="et">
                  <b>Chi traduce</b>
                  <small>
                    {imp.traduttore === 'dedicato'
                      ? 'Un modello fatto solo per tradurre (Opus-MT, ~300 MB): sul processore, senza VRAM e senza rifiuti. Si scarica da solo la prima volta'
                      : 'Lo stesso Qwen3-VL che legge il prompt (già caricato, niente da scaricare): più lento e può ammorbidire prompt espliciti'}
                  </small>
                </div>
                <Segmenti valore={imp.traduttore} cambia={(traduttore) => salva({ traduttore })} voci={[{ id: 'dedicato', nome: 'Traduttore' }, { id: 'llm', nome: 'Qwen3-VL' }]} />
              </div>
            )}
            <div className="voce">
              <div className="et"><b>Una cosa alla volta in VRAM</b><small>Quando passi dal modello immagine all'LLM (migliora prompt, descrivi foto, Idee, Esempio…) o viceversa, scarica quello che non serve: la scheda tiene un modello solo. Costa qualche secondo a ogni cambio, ma sulle schede da 6-8 GB evita di finire nella RAM</small></div>
              <Interruttore acceso={imp.unaCosaAllaVolta} cambia={(unaCosaAllaVolta) => salva({ unaCosaAllaVolta })}>{imp.unaCosaAllaVolta ? 'Accesa' : 'Spenta'}</Interruttore>
            </div>
            <div className="voce">
              <div className="et"><b>Scrivi i testi col Qwen3-VL 4B anche con Qwen</b><small>Migliora prompt, descrivi foto, Idee, Estrai… con Qwen girano sull'encoder 8B (da 3 a 0,5 token al secondo, in buona parte sul processore). Col 4B di Klein sono 40-50 token al secondo (Migliora prompt in 5 secondi invece di 1-5 minuti), ma lo scrive un modello più piccolo e va scaricato; se il file manca resta l'8B. Con Klein il 4B scrive sempre. Il 4B e Qwen non stanno in VRAM insieme: a ogni cambio si scarica uno dei due</small></div>
              <Interruttore acceso={imp.testoCon4B ?? true} cambia={(testoCon4B) => salva({ testoCon4B })}>{(imp.testoCon4B ?? true) ? 'Acceso' : 'Spento'}</Interruttore>
            </div>
            <div className="voce">
              <div className="et"><b>Scarica i modelli quando non li uso</b><small>Se per un po' non fai niente, i modelli escono dalla VRAM e la scheda torna libera per i giochi e gli altri programmi. La prossima immagine impiega qualche secondo in più a ripartire</small></div>
              <Segmenti valore={imp.scaricaDopo} cambia={(scaricaDopo) => salva({ scaricaDopo })} voci={[{ id: 0, nome: 'Mai' }, { id: 60, nome: '1 min' }, { id: 120, nome: '2 min' }, { id: 300, nome: '5 min' }, { id: 900, nome: '15 min' }]} />
            </div>
            <div className="voce">
              <div className="et"><b>Accelerazione fp16</b><small>--fast fp16_accumulation: qualche secondo in meno sulle RTX, qualità quasi uguale</small></div>
              <Interruttore acceso={imp.veloce} cambia={(veloce) => salva({ veloce })}>{imp.veloce ? 'Accesa' : 'Spenta'}</Interruttore>
            </div>
            <div className="voce" style={{ display: 'block' }}>
              <div className="avviso-box" style={{ marginTop: 0 }}>
                <b>Ci mette minuti per una foto?</b> Su Windows, quando la VRAM finisce, il driver NVIDIA continua nella RAM
                del PC e tutto va 5-10 volte più piano senza dare errori. Apri <i>Pannello di controllo NVIDIA → Gestisci
                impostazioni 3D → Impostazioni globali</i> e metti <i>Criterio di fallback della memoria di sistema CUDA</i> su
                <b> Preferisci nessun fallback</b>: così il motore sposta lui i pezzi in RAM, molto più in fretta. Poi: scegli Klein veloce (8 passi),
                profilo 6 GB se la scheda è piccola, e chiudi browser e giochi che usano la GPU.
              </div>
            </div>
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
          <h2 className="chiudibile" onClick={() => alterna('VALORI DI PARTENZA')}>{chiusi['VALORI DI PARTENZA'] ? '▸' : '▾'} VALORI DI PARTENZA</h2>
          <div className="pannello" style={chiusi['VALORI DI PARTENZA'] ? { display: 'none' } : undefined}>
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
          <h2 className="chiudibile" onClick={() => alterna('CARTELLE')}>{chiusi['CARTELLE'] ? '▸' : '▾'} CARTELLE</h2>
          <div className="pannello" style={chiusi['CARTELLE'] ? { display: 'none' } : undefined}>
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
          <h2 className="chiudibile" onClick={() => alterna('ACCOUNT (FACOLTATIVI)')}>{chiusi['ACCOUNT (FACOLTATIVI)'] ? '▸' : '▾'} ACCOUNT (FACOLTATIVI)</h2>
          <div className="pannello" style={chiusi['ACCOUNT (FACOLTATIVI)'] ? { display: 'none' } : undefined}>
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
          <h2>AGGIORNAMENTI</h2>
          <div className="pannello" style={{ padding: 14 }}>
            <div className="riga a-capo">
              <span>Versione <b className="oro">{versione}</b></span>
              <span className="tenue">
                {{
                  nessuno: "Controllo automatico all'avvio e ogni 6 ore.",
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
              <button className="btn piccolo fantasma" onClick={() => api.app.apriLink('https://github.com/cammo22/DaProdImage/releases')}>Tutte le versioni ↗</button>
            </div>
            {agg.stato === 'scarico' && <div className="barra-progresso" style={{ marginTop: 10 }}><i style={{ width: `${agg.percentuale ?? 0}%` }} /></div>}
            {agg.note && (agg.stato === 'pronto' || agg.stato === 'scarico') && (
              <div className="log" style={{ height: 'auto', maxHeight: 220, marginTop: 10, fontFamily: 'var(--font)', fontSize: 14 }}>{agg.note}</div>
            )}
            <div className="piccolo spento" style={{ marginTop: 8 }}>
              L'app si aggiorna dalle release di GitHub (scarica solo i pezzi cambiati). Motore, modelli, galleria e LoRA restano dove sono; se una versione nuova cambia il motore, lo aggiorna da sola al primo avvio.
            </div>
          </div>
        </div>

        <div className="gruppo">
          <h2>DAPROD IMAGE</h2>
          <div className="pannello" style={{ padding: 14 }}>
            <div className="riga a-capo">
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
