// Galleria: tutte le immagini, con ricerca, preferite, visore e azioni.
import { useEffect, useMemo, useState, type JSX } from 'react'
import { usaStato } from '../stato'
import { api, urlFile } from '../api'
import { I } from '../componenti/Icone'
import { Segmenti } from '../componenti/Controlli'
import { PrimaDopo } from '../componenti/PrimaDopo'
import { durata, ETICHETTE_MODALITA } from '../util'
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
          const n = await api.galleria.importa(ps)
          avvisa(n.length ? `${n.length} immagini importate con le loro impostazioni` : 'Solo i PNG fatti con DaProd Image si importano con le impostazioni', n.length ? 'ok' : 'info')
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
            <span className="spento piccolo">{opere.length} immagini · Ctrl+clic per sceglierne più</span>
          )}
          <input type="range" min={130} max={420} value={lato} style={{ width: 110, ['--p' as string]: `${((lato - 130) / 290) * 100}%` }} onChange={(e) => { setLato(Number(e.target.value)); localStorage.setItem('dpi-lato', e.target.value) }} title="Grandezza delle miniature" />
          <button className="btn piccolo" onClick={() => api.galleria.apriCartella()}><I.cartella /> Cartella</button>
        </div>
        <div className="griglia" style={{ ['--lato' as string]: `${lato}px` }}>
          {opere.length === 0 && (
            <div className="vuoto" style={{ gridColumn: '1 / -1', margin: '80px auto' }}>
              <div className="grosso">LA GALLERIA È <b>VUOTA</b></div>
              <p>Tutto quello che crei o modifichi finisce qui (e nella cartella Immagini\DaProd Image).</p>
              <p className="piccolo">Trascina qui dei PNG fatti con DaProd Image per riportarli dentro con le loro impostazioni.</p>
            </div>
          )}
          {gruppi.map((g) => (
            <GruppoGiorno key={g.titolo} titolo={g.titolo} opere={g.opere} scelte={scelte} clic={clic} />
          ))}
        </div>
      </div>
      {visore && <Visore opere={opere} />}
    </div>
  )
}

function GruppoGiorno(p: { titolo: string; opere: Opera[]; scelte: Set<string>; clic: (o: Opera, e: React.MouseEvent) => void }): JSX.Element {
  return (
    <>
      <div className="giorno">{p.titolo}</div>
      {p.opere.map((o) => (
        <div
          key={o.id}
          className={`tessera ${p.scelte.has(o.id) ? 'scelta' : ''} ${o.trasparente ? 'scacchi' : ''}`}
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
          <img src={urlFile(attuale.file)} alt="" className={attuale.trasparente ? 'scacchi' : ''} draggable onDragStart={(e) => { e.preventDefault(); api.trascina(attuale.file) }} />
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
