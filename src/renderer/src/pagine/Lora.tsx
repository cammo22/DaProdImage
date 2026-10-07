// LoRA: trascinali qui o incolla un link (Hugging Face, Civitai); un clic sulla carta lo accende.
import { useEffect, useState, type JSX } from 'react'
import { usaStato, ricaricaLore } from '../stato'
import { api } from '../api'
import { I } from '../componenti/Icone'
import { Copertina } from '../componenti/SceltaLora'
import { byte } from '../util'
import type { Download, InfoLora, StatoVoce } from '@shared/tipi'

export function Lora(): JSX.Element {
  const { lore, loraAttive, toggleLora, setLoraAttive, avvisa } = usaStato()
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

  const importa = async (ps: string[]): Promise<void> => {
    const f = await api.lora.importa(ps)
    await ricaricaLore()
    avvisa(f.length ? `${f.length} LoRA aggiunti` : 'Servono file .safetensors', f.length ? 'ok' : 'errore')
  }

  const scarica = async (): Promise<void> => {
    if (!link.trim()) return
    const l = link.trim()
    setLink('')
    const d = await api.lora.scarica(l)
    await ricaricaLore()
    if (d.stato === 'fatto') avvisa(`Scaricato ${d.nome}`, 'ok')
    else if (d.stato === 'errore') avvisa(d.errore || 'Download non riuscito', 'errore')
  }

  const scaricaConsigliato = async (id: string): Promise<void> => {
    const d = await api.modelli.scarica(id)
    await ricaricaLore()
    setConsigliati((await api.modelli.stato()).filter((v) => v.tipo === 'lora'))
    if (d.stato === 'errore') avvisa(d.errore || 'Download non riuscito', 'errore')
  }

  const inCorso = Object.values(download).filter((d) => d.stato === 'in corso' || d.stato === 'verifica')
  const visibili = lore.filter((l) => !filtro || (l.nome + l.file + l.parole).toLowerCase().includes(filtro.toLowerCase()))

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
        <div className={`zona-rilascio ${sopra ? 'sopra' : ''}`}>
          <div style={{ color: 'var(--oro)' }}><I.trascina /></div>
          <div className="flex1 col" style={{ gap: 8 }}>
            <b style={{ fontSize: 17 }}>Trascina qui i LoRA (.safetensors) o incolla un link</b>
            <div className="riga">
              <input type="text" placeholder="https://huggingface.co/…  ·  https://civitai.com/models/…" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && scarica()} />
              <button className="btn primario" onClick={scarica} disabled={!link.trim()}><I.scarica /> Scarica</button>
              <button className="btn" onClick={async () => { const p = await api.file.scegli('LoRA', ['safetensors']); if (p) void importa([p]) }}><I.piu /> Da file</button>
              <button className="btn icona" onClick={() => api.lora.apriCartella()} title="Apri la cartella dei LoRA"><I.cartella /></button>
            </div>
            <span className="piccolo spento">Servono LoRA fatti per Qwen-Image 2.1: quelli per SDXL, Flux o Qwen-Image 1.x vengono segnati e non funzionano. Per Civitai a volte serve il token (Impostazioni).</span>
          </div>
        </div>

        {inCorso.map((d) => (
          <div key={d.id} className="pannello" style={{ padding: 12 }}>
            <div className="riga spazia piccolo"><b>{d.nome}</b><span className="tenue">{byte(d.ricevuti)}{d.totali ? ` / ${byte(d.totali)}` : ''} · {(d.velocita / 1e6).toFixed(1)} MB/s</span><button className="btn piccolo fantasma" onClick={() => api.modelli.annulla(d.id)}>Annulla</button></div>
            <div className={`barra-progresso ${d.totali ? '' : 'indeterminata'}`} style={{ marginTop: 8 }}><i style={{ width: d.totali ? `${(d.ricevuti / d.totali) * 100}%` : '30%' }} /></div>
          </div>
        ))}

        {consigliati.some((c) => !c.presente) && (
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
          <h3 className="tenue" style={{ margin: 0, letterSpacing: 1.4, fontSize: 12 }}>I TUOI LORA · {lore.length} · {loraAttive.length} ACCESI</h3>
          <div className="riga">
            {loraAttive.length > 0 && <button className="btn piccolo fantasma" onClick={() => setLoraAttive([])}>Spegni tutti</button>}
            <input type="search" placeholder="Cerca…" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ width: 220 }} />
          </div>
        </div>
        {lore.length === 0 && <div className="spento">Ancora nessun LoRA. Un LoRA aggiunge uno stile, un personaggio o un dettaglio al modello: trascinane uno qui sopra.</div>}
        <div className="carte">
          {visibili.map((l) => (
            <CartaLora key={l.file} l={l} attiva={loraAttive.some((a) => a.file === l.file)} toggle={() => toggleLora(l.file, l.forza)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function CartaLora({ l, attiva, toggle }: { l: InfoLora; attiva: boolean; toggle: () => void }): JSX.Element {
  const { avvisa, loraAttive, setLoraAttive } = usaStato()
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

  return (
    <div className={`carta ${attiva ? 'attiva' : ''}`}>
      <div className="copertina" onClick={toggle} title={attiva ? 'Clic per spegnerlo' : 'Clic per accenderlo'}>
        <Copertina l={l} grande />
        <span className="acceso">
          {attiva ? <span className="chip su">✓ Acceso</span> : <span className="chip">Accendi</span>}
        </span>
      </div>
      <div className="corpo">
        <div className="riga spazia">
          <div className="nome" title={l.file}>{l.nome}</div>
          <span className={`distintivo ${l.compatibile === 'si' ? 'si' : l.compatibile === 'no' ? 'no' : 'forse'}`} title={l.base || ''}>
            {l.compatibile === 'si' ? '✓ Qwen 2.1' : l.compatibile === 'no' ? '⚠ ' + (l.base?.split(' (')[0] || 'altro') : '?'}
          </span>
        </div>
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
            min={-1}
            max={2}
            step={0.05}
            value={forza}
            style={{ ['--p' as string]: `${((forza + 1) / 3) * 100}%` }}
            onChange={(e) => {
              const v = Number(e.target.value)
              setForza(v)
              if (attiva) setLoraAttive(loraAttive.map((a) => (a.file === l.file ? { ...a, forza: v } : a)))
            }}
            onPointerUp={() => salva({ forza })}
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

