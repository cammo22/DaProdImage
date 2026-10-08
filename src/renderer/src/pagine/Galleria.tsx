// Galleria: tutte le immagini, con ricerca, preferite, visore e azioni.
import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { usaStato } from '../stato'
import { api, urlFile } from '../api'
import { I } from '../componenti/Icone'
import { Segmenti } from '../componenti/Controlli'
import { PrimaDopo } from '../componenti/PrimaDopo'
import { durata, ETICHETTE_MODALITA, normalizza } from '../util'
import { VistaZoom } from '../componenti/VistaZoom'
import { apriInModifica, fotoDaOpera, ingrandisci, rifinisci, riusa, varia } from '../azioni'
import type { FiltroGalleria, Opera } from '@shared/tipi'

const giorno = (t: number): string => {
  const d = new Date(t)
  const oggi = new Date()
  const ieri = new Date(Date.now() - 864e5)
  if (d.toDateString() === oggi.toDateString()) return 'OGGI'
  if (d.toDateString() === ieri.toDateString()) return 'IERI'
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
}

export function Galleria(): JSX.Element {
  const { avvisa, apriVisore, visore } = usaStato()
  const [opere, setOpere] = useState<Opera[]>([])
  const [filtro, setFiltro] = useState<FiltroGalleria>({ modalita: 'tutte', testo: '' })
  const [lato, setLato] = useState(() => Number(localStorage.getItem('dpi-lato') || 220))
  const [scelte, setScelte] = useState<Set<string>>(new Set())
  const [importo, setImporto] = useState(0)
  const griglia = useRef<HTMLDivElement>(null)
  const [larghezza, setLarghezza] = useState(0)

  // le righe si ricalcolano sulla larghezza vera della griglia
  useEffect(() => {
    const el = griglia.current
    if (!el) return
    const ro = new ResizeObserver(() => setLarghezza(el.clientWidth - 36))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cambiaLato = (n: number): void => {
    const v = Math.max(110, Math.min(460, Math.round(n)))
    setLato(v)
    localStorage.setItem('dpi-lato', String(v))
  }
  // Ctrl+rotella = miniature più grandi o più piccole
  useEffect(() => {
    const el = griglia.current
    if (!el) return
    const rotella = (e: WheelEvent): void => {
      if (!e.ctrlKey) return
      e.preventDefault()
      cambiaLato(lato * (e.deltaY < 0 ? 1.12 : 1 / 1.12))
    }
    el.addEventListener('wheel', rotella, { passive: false })
    return () => el.removeEventListener('wheel', rotella)
  })

  /** PNG di DaProd con le impostazioni; tutte le altre foto si convertono in PNG ed entrano come "Importate" */
  const importaFile = async (ps: string[]): Promise<void> => {
    setImporto(ps.length)
    try {
      const r = await api.galleria.importa(ps)
      let fatte = r.importate.length
      let errori = 0
      for (const p of r.altre) {
        try {
          const f = await normalizza(p)
          await api.galleria.importaFoto(f.percorso, p)
          fatte++
        } catch {
          errori++
        }
      }
      if (fatte) avvisa(`${fatte} ${fatte === 1 ? 'immagine importata' : 'immagini importate'}${r.importate.length ? ` (${r.importate.length} con le impostazioni di DaProd)` : ''}`, 'ok')
      if (errori) avvisa(`${errori} ${errori === 1 ? 'file non si apre' : 'file non si aprono'} come immagine`, 'errore')
    } finally {
      setImporto(0)
    }
  }

  const carica = (): void => {
    void api.galleria.elenco(filtro).then(setOpere)
  }
  useEffect(carica, [filtro])
  useEffect(() => api.su.galleria(carica), [filtro])

  const gruppi = useMemo(() => {
    const g: { titolo: string; opere: Opera[] }[] = []
    for (const o of opere) {
      const t = giorno(o.creata)
      if (!g.length || g[g.length - 1].titolo !== t) g.push({ titolo: t, opere: [] })
      g[g.length - 1].opere.push(o)
    }
    return g
  }, [opere])

  const elimina = async (ids: string[]): Promise<void> => {
    if (!confirm(ids.length > 1 ? `Spostare ${ids.length} immagini nel Cestino?` : 'Spostare l\'immagine nel Cestino?')) return
    await api.galleria.elimina(ids)
    setScelte(new Set())
    avvisa('Nel Cestino (si possono recuperare da lì)', 'ok')
  }

  const clic = (o: Opera, e: React.MouseEvent): void => {
    if (e.ctrlKey || e.shiftKey || scelte.size) {
      const n = new Set(scelte)
      if (n.has(o.id)) n.delete(o.id)
      else n.add(o.id)
      setScelte(n)
    } else apriVisore(o)
  }

  return (
    <div className="pagina">
      <div
        className="galleria"
        onDragOver={(e) => e.preventDefault()}
        onDrop={async (e) => {
          e.preventDefault()
          e.stopPropagation()
          const ps = Array.from(e.dataTransfer.files).map((f) => api.file.percorso(f))
          if (ps.length) await importaFile(ps)
        }}
      >
        <div className="testa">
          <input type="search" placeholder="Cerca nei prompt, o un seed…" value={filtro.testo} onChange={(e) => setFiltro({ ...filtro, testo: e.target.value })} />
          <div style={{ width: 420 }}>
            <Segmenti
              valore={filtro.modalita || 'tutte'}
              cambia={(modalita) => setFiltro({ ...filtro, modalita })}
              voci={[
                { id: 'tutte', nome: 'Tutte' },
                { id: 'create', nome: 'Create' },
                { id: 'modificate', nome: 'Modificate' },
                { id: 'preferite', nome: '★ Preferite' }
              ]}
            />
          </div>
          <span className="flex1" />
          {scelte.size > 0 ? (
            <>
              <span className="oro">{scelte.size} scelte</span>
              <button className="btn piccolo pericolo" onClick={() => elimina([...scelte])}><I.cestino /> Nel Cestino</button>
              <button className="btn piccolo" onClick={() => setScelte(new Set())}>Annulla scelta</button>
            </>
          ) : (
            <span className="spento piccolo">{importo ? `Importo ${importo} file…` : `${opere.length} immagini · Ctrl+clic: sceglierne più · Ctrl+rotella: grandezza`}</span>
          )}
          <input type="range" min={110} max={460} value={lato} style={{ width: 110, ['--p' as string]: `${((lato - 110) / 350) * 100}%` }} onChange={(e) => cambiaLato(Number(e.target.value))} title="Grandezza delle miniature (anche Ctrl+rotella)" />
          <button className="btn piccolo" onClick={async () => { const ps = await api.file.scegliImmagini(true); if (ps.length) await importaFile(ps) }} title="Porta dentro foto dal PC (diventano PNG)"><I.piu /> Importa</button>
          <button className="btn piccolo" onClick={() => api.galleria.apriCartella()}><I.cartella /> Cartella</button>
        </div>
        <div className="griglia" ref={griglia}>
          {opere.length === 0 && (
            <div className="vuoto" style={{ gridColumn: '1 / -1', margin: '80px auto' }}>
              <div className="grosso">LA GALLERIA È <b>VUOTA</b></div>
              <p>Tutto quello che crei o modifichi finisce qui (e nella cartella Immagini\DaProd Image).</p>
              <p className="piccolo">Trascina qui delle foto per portarle dentro (diventano PNG); i PNG fatti con DaProd Image tornano con le loro impostazioni.</p>
            </div>
          )}
          {gruppi.map((g) => (
            <GruppoGiorno key={g.titolo} titolo={g.titolo} opere={g.opere} scelte={scelte} clic={clic} lato={lato} larghezza={larghezza} />
          ))}
        </div>
      </div>
      {visore && <Visore opere={opere} />}
    </div>
  )
}

const SPAZIO = 10

/** righe "giustificate": ogni foto con le sue proporzioni, le righe piene arrivano esatte al bordo (come Google Foto) */
function righe(opere: Opera[], lato: number, larghezza: number): { h: number; opere: Opera[] }[] {
  const out: { h: number; opere: Opera[] }[] = []
  if (larghezza <= 0) return [{ h: lato, opere }]
  let riga: Opera[] = []
  let somma = 0
  for (const o of opere) {
    const a = o.larghezza && o.altezza ? Math.max(0.25, Math.min(4, o.larghezza / o.altezza)) : 1
    riga.push(o)
    somma += a
    const spazi = SPAZIO * (riga.length - 1)
    if (somma * lato + spazi >= larghezza) {
      out.push({ h: (larghezza - spazi) / somma, opere: riga })
      riga = []
      somma = 0
    }
  }
  if (riga.length) out.push({ h: lato, opere: riga })
  return out
}

function GruppoGiorno(p: { titolo: string; opere: Opera[]; scelte: Set<string>; clic: (o: Opera, e: React.MouseEvent) => void; lato: number; larghezza: number }): JSX.Element {
  const r = useMemo(() => righe(p.opere, p.lato, p.larghezza), [p.opere, p.lato, p.larghezza])
  return (
    <>
      <div className="giorno">{p.titolo}</div>
      {r.map((riga, i) => (
        <div className="riga-foto" key={i} style={{ height: Math.round(riga.h) }}>
          {riga.opere.map((o) => {
            const a = o.larghezza && o.altezza ? Math.max(0.25, Math.min(4, o.larghezza / o.altezza)) : 1
            return (
              <div
                key={o.id}
                className={`tessera ${p.scelte.has(o.id) ? 'scelta' : ''} ${o.trasparente ? 'scacchi' : ''}`}
                style={{ width: Math.floor(a * riga.h) }}
                onClick={(e) => p.clic(o, e)}
                draggable
                onDragStart={(e) => {
                  e.preventDefault()
                  api.trascina(o.file)
                }}
              >
                <img src={urlFile(o.miniatura || o.file)} alt="" loading="lazy" />
                <span className="tipo">{o.etichetta === 'Bozza' ? 'BOZZA' : ETICHETTE_MODALITA[o.modalita]?.toUpperCase()}</span>
                <div className="stelle">
                  <button
                    className={o.preferita ? 'si' : ''}
                    onClick={(e) => {
                      e.stopPropagation()
                      void api.galleria.preferita(o.id, !o.preferita)
                    }}
                    title="Preferita"
                  >
                    {o.preferita ? <I.stellaPiena /> : <I.stella />}
                  </button>
                </div>
                <div className="velo">{o.prompt || o.etichetta}</div>
              </div>
            )
          })}
        </div>
      ))}
    </>
  )
}

function Visore({ opere }: { opere: Opera[] }): JSX.Element | null {
  const { visore: o, apriVisore, avvisa } = usaStato()
  const [origine, setOrigine] = useState<Opera | null>(null)
  const [confronta, setConfronta] = useState(false)
  const i = o ? opere.findIndex((x) => x.id === o.id) : -1

  useEffect(() => {
    setConfronta(false)
    setOrigine(null)
    if (o?.origine) void api.galleria.opera(o.origine).then((x) => setOrigine(x || null))
  }, [o?.id])

  useEffect(() => {
    const t = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape') apriVisore(null)
      else if (e.key === 'ArrowLeft' && i > 0) apriVisore(opere[i - 1])
      else if (e.key === 'ArrowRight' && i < opere.length - 1) apriVisore(opere[i + 1])
      else if (e.key === 'Delete' && o) void elimina()
    }
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  })

  if (!o) return null
  const attuale = opere[i] || o

  async function elimina(): Promise<void> {
    if (!o || !confirm('Spostare l\'immagine nel Cestino?')) return
    const prossima = opere[i + 1] || opere[i - 1] || null
    await api.galleria.elimina([o.id])
    apriVisore(prossima)
  }

  return (
    <div className="visore" onClick={(e) => e.target === e.currentTarget && apriVisore(null)}>
      <div className="immagine" onClick={(e) => e.target === e.currentTarget && apriVisore(null)}>
        {confronta && origine ? (
          <PrimaDopo prima={urlFile(origine.file)} dopo={urlFile(attuale.file)} stile={{ maxHeight: 'calc(100vh - 90px)' }} />
        ) : (
          <VistaZoom src={urlFile(attuale.file)} scacchi={attuale.trasparente} />
        )}
        {i > 0 && <button className="freccia sx" onClick={() => apriVisore(opere[i - 1])}>‹</button>}
        {i < opere.length - 1 && <button className="freccia dx" onClick={() => apriVisore(opere[i + 1])}>›</button>}
      </div>
      <div className="info">
        <div className="riga spazia sezione">
          <b className="oro" style={{ fontFamily: 'var(--titolo)', letterSpacing: 1.5, fontSize: 13 }}>{(attuale.etichetta === 'Bozza' ? 'BOZZA' : ETICHETTE_MODALITA[attuale.modalita]).toUpperCase()}</b>
          <button className="btn fantasma piccolo icona" onClick={() => apriVisore(null)} title="Chiudi (Esc)"><I.x /></button>
        </div>
        <div className="scorri">
          <div className="sezione col">
            {attuale.prompt && <div className="prompt">{attuale.prompt}</div>}
            {attuale.promptInglese && <div className="piccolo spento" style={{ userSelect: 'text' }}>Al modello, in inglese: {attuale.promptInglese}</div>}
            {attuale.negativo && <div className="piccolo spento">Negativo: {attuale.negativo}</div>}
            <div className="riga a-capo">
              <button className="btn piccolo" onClick={() => navigator.clipboard.writeText(attuale.prompt).then(() => avvisa('Prompt copiato', 'ok'))}><I.copia /> Copia prompt</button>
              <button className="btn piccolo" onClick={() => riusa(attuale)}><I.ricicla /> Riusa</button>
            </div>
          </div>
          <div className="sezione">
            <dl className="dati">
              <dt>Dimensioni</dt><dd>{attuale.larghezza} × {attuale.altezza}</dd>
              <dt>Seed</dt><dd>{attuale.seed}</dd>
              <dt>Passi</dt><dd>{attuale.passi} · cfg {attuale.cfg} · {attuale.sampler}/{attuale.scheduler}</dd>
              {attuale.forza !== undefined && <><dt>Forza</dt><dd>{Math.round(attuale.forza * 100)}%</dd></>}
              <dt>Tempo</dt><dd>{durata(attuale.durata)}</dd>
              <dt>Modello</dt><dd>{attuale.modello}</dd>
              {attuale.lora?.length > 0 && <><dt>LoRA</dt><dd>{attuale.lora.map((l) => `${l.file} (${l.forza})`).join(', ')}</dd></>}
              <dt>Creata</dt><dd>{new Date(attuale.creata).toLocaleString('it-IT')}</dd>
              <dt>File</dt><dd>{attuale.file}</dd>
            </dl>
          </div>
          <div className="sezione col">
            <h3>Fai di più</h3>
            <div className="riga a-capo">
              <button className="btn" onClick={() => apriInModifica(fotoDaOpera(attuale))}><I.modifica /> Modifica</button>
              <button className="btn" onClick={() => varia(attuale)}><I.varia /> Varia</button>
              {attuale.etichetta === 'Bozza' ? (
                <button className="btn primario" onClick={() => rifinisci(attuale)}><I.crea /> Rifinisci</button>
              ) : (
                <button className="btn" onClick={() => rifinisci(attuale)} title="Fino al 2K, ridisegnando i dettagli"><I.ingrandisci /> Rifinisci 2K</button>
              )}
              <button className="btn" onClick={() => ingrandisci(attuale, 2)} title="4x-UltraSharp, senza ridisegnare"><I.ingrandisci /> 2×</button>
              <button className="btn" onClick={() => ingrandisci(attuale, 4)}><I.ingrandisci /> 4×</button>
            </div>
            {origine && (
              <button className={`btn ${confronta ? 'attivo' : ''}`} onClick={() => setConfronta(!confronta)}><I.occhio /> Confronta con l'originale</button>
            )}
          </div>
          <div className="sezione">
            <div className="riga a-capo">
              <button className={`btn piccolo ${attuale.preferita ? 'attivo' : ''}`} onClick={() => { void api.galleria.preferita(attuale.id, !attuale.preferita); apriVisore({ ...attuale, preferita: !attuale.preferita }) }}>
                {attuale.preferita ? <I.stellaPiena /> : <I.stella />} Preferita
              </button>
              <button className="btn piccolo" onClick={() => api.galleria.copia(attuale.id).then(() => avvisa('Copiata negli appunti', 'ok'))}><I.copia /> Copia</button>
              <button className="btn piccolo" onClick={() => api.galleria.esporta(attuale.id)}><I.scarica /> Esporta…</button>
              <button className="btn piccolo" onClick={() => api.galleria.mostra(attuale.id)}><I.cartella /> Mostra</button>
              <button className="btn piccolo pericolo" onClick={elimina}><I.cestino /> Cestino</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
