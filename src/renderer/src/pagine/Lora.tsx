// LoRA: due scaffali, uno per Qwen e uno per Flux (FLUX 3 Klein), ognuno con la sua pila di LoRA accesi. Trascina i file o incolla un link
// (Hugging Face, Civitai) dentro la scheda giusta; un clic sulla carta lo accende. I LoRA che l'app non riconosce stanno in «Altri».
import { useEffect, useState, type JSX } from 'react'
import { usaStato, ricaricaLore } from '../stato'
import { api } from '../api'
import { I } from '../componenti/Icone'
import { Copertina } from '../componenti/SceltaLora'
import { byte } from '../util'
import type { Download, Famiglia, GruppoLora, InfoLora, StatoVoce } from '@shared/tipi'
import { GRUPPI_LORA, NOME_GRUPPO, gruppoDa, gruppoDiFamiglia } from '@shared/loraBase'
import { compatibilitaLora, forzaLora, spostaLora } from '../pilaLora'

type Scheda = GruppoLora | 'altri'
/** il modello di riferimento di uno scaffale: per Flux è Klein (Klein veloce e Klein Base hanno gli stessi LoRA) */
const FAMIGLIA_DI: Record<GruppoLora, Famiglia> = { qwen: 'qwen', flux: 'klein' }
const CHI: Record<GruppoLora, string> = { qwen: 'Qwen-Image 2.1', flux: 'FLUX 3 Klein' }

export function Lora(): JSX.Element {
  const { lore, loraPile, setLoraPila, toggleLoraPer, avvisa, imp } = usaStato()
  const gruppoModello = gruppoDiFamiglia(imp?.famiglia)
  const [scheda, setScheda] = useState<Scheda>(gruppoModello)
  const [link, setLink] = useState('')
  const [sopra, setSopra] = useState(false)
  const [download, setDownload] = useState<Record<string, Download>>({})
  const [consigliati, setConsigliati] = useState<StatoVoce[]>([])
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    void ricaricaLore()
    void api.modelli.stato().then((s) => setConsigliati(s.filter((v) => v.tipo === 'lora')))
    return api.su.download((d) => setDownload((x) => ({ ...x, [d.id]: d })))
  }, [])

  const gruppo: GruppoLora | undefined = scheda === 'altri' ? undefined : scheda
  const famiglia = gruppo ? FAMIGLIA_DI[gruppo] : (imp?.famiglia || 'qwen')
  const pila = gruppo ? loraPile[gruppo] : []
  const conteggio = (g: GruppoLora): number => lore.filter((l) => gruppoDa(l) === g).length
  const altri = lore.filter((l) => gruppoDa(l) === undefined)

  const importa = async (ps: string[]): Promise<void> => {
    const f = await api.lora.importa(ps, gruppo)
    await ricaricaLore()
    if (!f.length) {
      avvisa('Servono file .safetensors', 'errore')
      return
    }
    avvisaDove(f)
  }

  /** dice dove sono finiti i file: se i nomi dei tensori dicono un altro modello, il LoRA sta nello scaffale giusto, non in quello aperto */
  const avvisaDove = (files: string[]): void => {
    const fresche = usaStato.getState().lore.filter((l) => files.includes(l.file))
    const altrove = fresche.filter((l) => gruppoDa(l) !== gruppo)
    if (!altrove.length) {
      avvisa(`${files.length} LoRA aggiunti`, 'ok')
      return
    }
    const l = altrove[0]
    const g = gruppoDa(l)
    avvisa(g ? `«${l.nome}» è un LoRA per ${NOME_GRUPPO[g]}: l'ho messo nella scheda ${NOME_GRUPPO[g]}` : `«${l.nome}» non è fatto per Qwen né per Flux (${l.base || 'altro modello'}): sta in «Altri»`, g ? 'ok' : 'errore')
    if (g) setScheda(g)
  }

  const scarica = async (): Promise<void> => {
    if (!link.trim()) return
    const l = link.trim()
    setLink('')
    const d = await api.lora.scarica(l, gruppo)
    await ricaricaLore()
    if (d.stato === 'fatto') {
      if (d.nome) avvisaDove([d.nome])
      else avvisa(`Scaricato ${d.nome}`, 'ok')
    } else if (d.stato === 'errore') avvisa(d.errore || 'Download non riuscito', 'errore')
  }

  const scaricaConsigliato = async (id: string): Promise<void> => {
    const d = await api.modelli.scarica(id)
    await ricaricaLore()
    setConsigliati((await api.modelli.stato()).filter((v) => v.tipo === 'lora'))
    if (d.stato === 'errore') avvisa(d.errore || 'Download non riuscito', 'errore')
  }

  const inCorso = Object.values(download).filter((d) => d.stato === 'in corso' || d.stato === 'verifica')
  const visibili = (gruppo ? lore.filter((l) => gruppoDa(l) === gruppo) : altri).filter((l) => !filtro || (l.nome + l.file + l.parole).toLowerCase().includes(filtro.toLowerCase()))
  const accesi = gruppo ? loraPile[gruppo].length : 0

  return (
    <div className="pagina">
      <div
        className="lore"
        onDragOver={(e) => {
          e.preventDefault()
          setSopra(true)
        }}
        onDragLeave={() => setSopra(false)}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setSopra(false)
          void importa(Array.from(e.dataTransfer.files).map((f) => api.file.percorso(f)))
        }}
      >
        <div className="segmenti" role="tablist" aria-label="Scaffali dei LoRA" data-schede-lora>
          {GRUPPI_LORA.map((g) => (
            <button key={g} type="button" role="tab" aria-selected={scheda === g} className={scheda === g ? 'su' : ''} onClick={() => setScheda(g)} data-scheda-lora={g} title={`I LoRA fatti per ${CHI[g]}`}>
              {NOME_GRUPPO[g]} <small>{conteggio(g)} LoRA{loraPile[g].length ? ` · ${loraPile[g].length} accesi` : ''}{g === gruppoModello ? ' · modello scelto' : ''}</small>
            </button>
          ))}
          {altri.length > 0 && (
            <button type="button" role="tab" aria-selected={scheda === 'altri'} className={scheda === 'altri' ? 'su' : ''} onClick={() => setScheda('altri')} data-scheda-lora="altri" title="LoRA che l'app non riconosce o fatti per altri modelli">
              Altri <small>{altri.length}</small>
            </button>
          )}
        </div>

        {gruppo ? (
          <div className={`zona-rilascio ${sopra ? 'sopra' : ''}`}>
            <div style={{ color: 'var(--oro)' }}><I.trascina /></div>
            <div className="flex1 col" style={{ gap: 8 }}>
              <b style={{ fontSize: 17 }}>Trascina qui i LoRA per {NOME_GRUPPO[gruppo]} (.safetensors) o incolla un link</b>
              <div className="riga">
                <input type="text" placeholder="https://huggingface.co/…  ·  https://civitai.com/models/…" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && scarica()} />
                <button className="btn primario" onClick={scarica} disabled={!link.trim()}><I.scarica /> Scarica</button>
                <button className="btn" onClick={async () => { const p = await api.file.scegli('LoRA', ['safetensors']); if (p) void importa([p]) }}><I.piu /> Da file</button>
                <button className="btn icona" onClick={() => api.lora.apriCartella()} title="Apri la cartella dei LoRA"><I.cartella /></button>
              </div>
              <span className="piccolo spento">Qui vanno i LoRA fatti per {CHI[gruppo]}{gruppo === 'flux' ? ' (valgono per Klein veloce e per Klein Base)' : ''}. Qwen e Flux non sono intercambiabili: se carichi un LoRA dell'altro modello lo metto nella sua scheda. Per Civitai a volte serve il token (Impostazioni).</span>
            </div>
          </div>
        ) : (
          <div className="pannello col" style={{ padding: 14 }}>
            <b>LoRA che l'app non riconosce</b>
            <span className="piccolo spento">Dai nomi dei tensori non si capisce per quale modello siano, o sono fatti per un altro (Stable Diffusion, SDXL, FLUX.1…). Se sai per quale modello sono, scegli lo scaffale: da lì in poi si accendono con quel modello. Se non vanno, il motore si ferma con un errore.</span>
          </div>
        )}

        {inCorso.map((d) => (
          <div key={d.id} className="pannello" style={{ padding: 12 }}>
            <div className="riga spazia piccolo"><b>{d.nome}</b><span className="tenue">{byte(d.ricevuti)}{d.totali ? ` / ${byte(d.totali)}` : ''} · {(d.velocita / 1e6).toFixed(1)} MB/s</span><button className="btn piccolo fantasma" onClick={() => api.modelli.annulla(d.id)}>Annulla</button></div>
            <div className={`barra-progresso ${d.totali ? '' : 'indeterminata'}`} style={{ marginTop: 8 }}><i style={{ width: d.totali ? `${(d.ricevuti / d.totali) * 100}%` : '30%' }} /></div>
          </div>
        ))}

        {gruppo && (
          <section className="pannello col" aria-label={`Pila LoRA ${NOME_GRUPPO[gruppo]}`} style={{ padding: 16 }}>
            <div className="riga spazia"><h2 style={{ margin: 0 }}>Pila LoRA · {NOME_GRUPPO[gruppo]}</h2><span className="piccolo tenue">{pila.length} slot</span></div>
            <p className="piccolo spento">
              Dall'alto verso il basso: questo è l'ordine di applicazione. Forza 0 lascia lo slot spento senza cancellarlo.{' '}
              {gruppo === gruppoModello ? `Parte con il modello scelto adesso (${NOME_GRUPPO[gruppo]}).` : `Parte quando scegli ${NOME_GRUPPO[gruppo]} fra i modelli della barra in alto (adesso è ${NOME_GRUPPO[gruppoModello]}).`}
            </p>
            {!pila.length && <span className="tenue">Accendi un LoRA dalla libreria per aggiungerlo alla pila.</span>}
            {pila.map((a, i) => {
              const l = lore.find((x) => x.file === a.file)
              const compatibile = l ? compatibilitaLora(l, famiglia) : '?'
              const nome = l?.nome || a.file
              return <div key={a.file} className="pannello col" style={{ padding: 10 }}>
                <div className="riga spazia"><b>{i + 1}. {nome}</b><span className={`distintivo ${compatibile === 'si' ? 'si' : 'no'}`}>{compatibile === 'si' ? 'Compatibile' : compatibile === 'no' ? 'Non compatibile' : 'Da verificare'}</span></div>
                <div className="riga">
                  <button className="btn piccolo" title="Sposta prima" aria-label={`Sposta prima ${nome}`} disabled={i === 0} onClick={() => setLoraPila(gruppo, spostaLora(pila, a.file, -1))}>↑</button>
                  <button className="btn piccolo" title="Sposta dopo" aria-label={`Sposta dopo ${nome}`} disabled={i === pila.length - 1} onClick={() => setLoraPila(gruppo, spostaLora(pila, a.file, 1))}>↓</button>
                  <input type="range" aria-label={`Forza di ${nome}`} min={-2} max={2} step={0.05} value={a.forza} onChange={(e) => setLoraPila(gruppo, pila.map((x) => x.file === a.file ? { ...x, forza: forzaLora(Number(e.target.value)) } : x))} />
                  <output style={{ minWidth: 40 }}>{a.forza.toFixed(2)}</output>
                  <button className="btn piccolo" title={`Togli ${nome} dalla pila`} onClick={() => setLoraPila(gruppo, pila.filter((x) => x.file !== a.file))}><I.x /></button>
                </div>
                {l?.parole && <span className="piccolo tenue">Parole chiave: {l.parole}</span>}
                {compatibile !== 'si' && <span className="piccolo oro">{compatibile === 'no' ? `Spegni questo slot: non è fatto per ${CHI[gruppo]}.` : 'Architettura non riconosciuta: controlla la scheda del LoRA prima di usarlo.'}</span>}
              </div>
            })}
          </section>
        )}

        {gruppo === 'qwen' && consigliati.some((c) => !c.presente) && (
          <div className="col">
            <h3 className="tenue" style={{ margin: 0, letterSpacing: 1.4, fontSize: 12 }}>CONSIGLIATI PER QWEN-IMAGE 2.1</h3>
            <div className="carte">
              {consigliati.filter((c) => !c.presente).map((c) => (
                <div key={c.id} className="carta">
                  <div className="corpo">
                    <div className="nome">{c.nome}</div>
                    <div className="piccolo tenue">{c.descrizione}</div>
                    <button className="btn piccolo" onClick={() => scaricaConsigliato(c.id)}><I.scarica /> Scarica · {byte(c.byte)}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="riga spazia">
          <h3 className="tenue" style={{ margin: 0, letterSpacing: 1.4, fontSize: 12 }}>{gruppo ? `LORA PER ${NOME_GRUPPO[gruppo].toUpperCase()}` : 'ALTRI LORA'} · {visibili.length} · {accesi} {accesi === 1 ? 'ACCESO' : 'ACCESI'}</h3>
          <div className="riga">
            {gruppo && pila.length > 0 && <button className="btn piccolo fantasma" onClick={() => setLoraPila(gruppo, [])}>Spegni tutti</button>}
            <input type="search" placeholder="Cerca…" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ width: 220 }} />
          </div>
        </div>
        {visibili.length === 0 && gruppo && (
          <div className="spento">
            {gruppo === 'flux'
              ? 'Ancora nessun LoRA per Flux. Carica un LoRA fatto per FLUX 3 Klein: trascinalo qui sopra o incolla il link.'
              : 'Ancora nessun LoRA per Qwen. Un LoRA aggiunge uno stile, un personaggio o un dettaglio al modello: trascinane uno qui sopra.'}
          </div>
        )}
        <div className="carte">
          {visibili.map((l) => (
            <CartaLora
              key={l.file}
              l={l}
              gruppo={gruppo}
              famiglia={famiglia}
              attiva={!!gruppo && loraPile[gruppo].some((a) => a.file === l.file)}
              toggle={() => {
                if (!gruppo) return
                if (!loraPile[gruppo].some((a) => a.file === l.file) && compatibilitaLora(l, famiglia) === 'no') {
                  avvisa(`Questo LoRA non è compatibile con ${NOME_GRUPPO[gruppo]}.`, 'errore')
                  return
                }
                toggleLoraPer(gruppo, l.file, forzaLora(l.forza))
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function CartaLora({ l, attiva, toggle, gruppo, famiglia }: { l: InfoLora; attiva: boolean; toggle: () => void; gruppo?: GruppoLora; famiglia: Famiglia }): JSX.Element {
  const { avvisa, loraPile, setLoraPila } = usaStato()
  const compatibile = compatibilitaLora(l, famiglia)
  const [parole, setParole] = useState(l.parole)
  const [forza, setForza] = useState(l.forza)
  useEffect(() => {
    setParole(l.parole)
    setForza(l.forza)
  }, [l.file])

  const salva = async (m: Partial<InfoLora>): Promise<void> => {
    await api.lora.aggiorna(l.file, m)
    await ricaricaLore()
  }

  const anteprima = async (): Promise<void> => {
    const [p] = await api.file.scegliImmagini(false)
    if (!p) return
    const [dentro] = await api.file.portaDentro([p])
    await salva({ anteprima: dentro })
  }

  /** dice a quale scaffale appartiene un LoRA che l'app non riconosce (da lì in poi si accende con quel modello) */
  const assegna = async (g: GruppoLora): Promise<void> => {
    await salva({ gruppo: g })
    avvisa(`«${l.nome}» ora sta nello scaffale ${NOME_GRUPPO[g]}`, 'ok')
  }

  return (
    <div className={`carta ${attiva ? 'attiva' : ''}`}>
      <div className="copertina" onClick={toggle} title={!gruppo ? 'Prima scegli per quale modello è fatto' : attiva ? 'Clic per spegnerlo' : 'Clic per accenderlo'}>
        <Copertina l={l} grande />
        <span className="acceso">
          {attiva ? <span className="chip su">✓ Acceso</span> : gruppo ? <span className="chip">Accendi</span> : null}
        </span>
      </div>
      <div className="corpo">
        <div className="riga spazia">
          <div className="nome" title={l.file}>{l.nome}</div>
          <span className={`distintivo ${compatibile === 'si' ? 'si' : compatibile === 'no' ? 'no' : 'forse'}`} title={l.base || ''}>
            {compatibile === 'si' ? '✓ Compatibile' : compatibile === 'no' ? '⚠ ' + (l.base?.split(' (')[0] || 'altro modello') : '? Da verificare'}
          </span>
        </div>
        {!gruppo && (
          <div className="riga" style={{ flexWrap: 'wrap' }}>
            <span className="piccolo tenue">Usalo con</span>
            {GRUPPI_LORA.map((g) => <button key={g} type="button" className="btn piccolo" onClick={() => void assegna(g)} data-assegna={g}>{NOME_GRUPPO[g]}</button>)}
          </div>
        )}
        <input
          type="text"
          value={parole}
          placeholder="Parole chiave (si aggiungono al prompt)"
          onChange={(e) => setParole(e.target.value)}
          onBlur={() => parole !== l.parole && salva({ parole })}
          style={{ padding: '6px 9px', fontSize: 13.5 }}
        />
        <div className="riga">
          <span className="piccolo tenue">Forza</span>
          <input
            type="range"
            min={-2}
            max={2}
            step={0.05}
            value={forza}
            style={{ ['--p' as string]: `${((forza + 2) / 4) * 100}%` }}
            onChange={(e) => {
              const v = forzaLora(Number(e.target.value))
              setForza(v)
              if (attiva && gruppo) setLoraPila(gruppo, loraPile[gruppo].map((a) => (a.file === l.file ? { ...a, forza: v } : a)))
            }}
            onPointerUp={() => salva({ forza })}
            onBlur={() => salva({ forza })}
          />
          <b className="oro piccolo" style={{ width: 36, textAlign: 'right' }}>{forza.toFixed(2)}</b>
        </div>
        <div className="riga spazia piccolo spento">
          <span>{byte(l.dimensione)}</span>
          <div className="riga" style={{ gap: 2 }}>
            {l.fonte && <button className="btn fantasma piccolo icona" title="Apri la pagina" onClick={() => api.app.apriLink(l.fonte!)}><I.link /></button>}
            <button className="btn fantasma piccolo icona" title="Scegli un'immagine di copertina" onClick={anteprima}><I.immagine /></button>
            <button
              className="btn fantasma piccolo icona pericolo"
              title="Nel Cestino"
              onClick={async () => {
                if (!confirm(`Spostare ${l.nome} nel Cestino?`)) return
                await api.lora.elimina(l.file)
                await ricaricaLore()
                avvisa('LoRA nel Cestino', 'ok')
              }}
            >
              <I.cestino />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
