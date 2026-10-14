// Le foto dell'album, grandi e a proporzioni vere. Quando scegli uno spread, le foto che usa si illuminano (col numero della
// loro cella) e le altre si abbassano: così vedi subito cosa c'è in questa pagina. Con una cella scelta, un clic su un'altra
// foto la mette al suo posto. Senza cella scelta, un clic su una foto illuminata sceglie la sua cella; su una spenta la aggiunge.
import { useEffect, useRef, useState, type JSX } from 'react'
import { riproponi, usaAlbum } from '../stato'
import { urlFile } from '../../api'
import { I } from '../../componenti/Icone'
import { ordina, piazza, raggruppa } from '../costruisci'
import type { Album, Spread } from '../tipi'

export function Foto(p: { album: Album; spread: Spread | undefined; cella: number | null; daGalleria: () => void; daPc: () => void }): JSX.Element {
  const { album, spread, cella } = p
  const [solo, setSolo] = useState<'tutte' | 'qui' | 'nuove'>('tutte')
  const lista = useRef<HTMLDivElement>(null)
  const mod = usaAlbum.getState().mod
  const usate = new Map<string, number>()
  for (const s of album.spreads) for (const q of s.piazze) usate.set(q.foto, (usate.get(q.foto) || 0) + 1)
  // le foto di questo spread e il numero della loro cella
  const qui = new Map<string, number>()
  spread?.piazze.forEach((q, i) => qui.set(q.foto, i))
  const nuove = album.foto.filter((f) => !usate.has(f.id)).length
  const elenco = ordina(album.foto, album.ordine).filter((f) => solo === 'tutte' || (solo === 'qui' ? qui.has(f.id) : !usate.has(f.id)))
  // cambiando spread, la prima foto illuminata viene in vista
  const chiaveQui = [...qui.keys()].join(',')
  useEffect(() => {
    lista.current?.querySelector('.ft.accesa')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [chiaveQui, solo])
  const sceltaId = cella !== null && spread ? spread.piazze[cella]?.foto : undefined

  const clic = (id: string): void => {
    const s = usaAlbum.getState()
    if (!spread) return
    if (cella !== null && spread.piazze[cella]) {
      // sostituisci (o scambia se era già in questo spread)
      s.metti(id, cella)
      return
    }
    const i = qui.get(id)
    if (i !== undefined) s.scegli(s.corrente, i)
    else s.metti(id)
  }

  return (
    <div className="foto-album">
      <div className="foto-album-testa">
        <div className="riga" style={{ gap: 6 }}>
          <button className="btn primario" style={{ flex: 1 }} onClick={p.daGalleria}><I.galleria /> Dalla galleria</button>
          <button className="btn" style={{ flex: 1 }} onClick={p.daPc} title="JPG, PNG, HEIC, TIFF e i RAW di tutte le fotocamere (CR2, CR3, NEF, ARW, DNG, RAF, ORF…). Puoi anche trascinarle qui."><I.immagine /> Dal PC</button>
        </div>
        {album.foto.length > 0 && (
          <div className="riga spazia" style={{ marginTop: 8 }}>
            <div className="mini-segmenti">
              <button className={solo === 'tutte' ? 'su' : ''} onClick={() => setSolo('tutte')}>Tutte {album.foto.length}</button>
              {spread && <button className={solo === 'qui' ? 'su' : ''} onClick={() => setSolo('qui')} title="Solo le foto di questa pagina">Qui {qui.size}</button>}
              <button className={solo === 'nuove' ? 'su' : ''} onClick={() => setSolo('nuove')} title="Quelle che non sono in nessuna pagina">Non usate {nuove}</button>
            </div>
            {nuove > 0 && <button className="btn piccolo" onClick={() => aggiungiNuove(album)} title="Le mette in pagine nuove in fondo all'album"><I.piu /> Impagina</button>}
          </div>
        )}
        {cella !== null && spread?.piazze[cella] ? (
          <div className="suggerimento-foto">Clicca un'altra foto per <b>sostituire</b> quella scelta · <button className="link" onClick={() => usaAlbum.setState({ cella: null })}>annulla</button></div>
        ) : spread && album.foto.length > 0 ? (
          <div className="piccolo spento" style={{ marginTop: 6 }}>Le foto illuminate sono in questa pagina. Clic su una spenta = la aggiungi.</div>
        ) : null}
      </div>
      <div className="foto-album-lista" ref={lista}>
        {album.foto.length === 0 && <div className="spento piccolo" style={{ padding: 8 }}>Nessuna foto ancora. Aggiungile da qui, oppure trascinale su questa finestra.</div>}
        <div className="foto-album-colonne">
          {elenco.map((f) => {
            const i = qui.get(f.id)
            const acceso = i !== undefined
            const classe = ['ft', spread ? (acceso ? 'accesa' : 'spenta') : '', sceltaId === f.id ? 'scelta' : '', usate.has(f.id) ? '' : 'nuova'].join(' ')
            return (
              <div key={f.id} role="button" tabIndex={0} className={classe} style={{ aspectRatio: `${f.w} / ${f.h}` }} draggable
                onDragStart={(e) => { e.dataTransfer.setData('application/x-foto-album', f.id); e.dataTransfer.effectAllowed = 'copy' }}
                onClick={() => clic(f.id)} onKeyDown={(e) => e.key === 'Enter' && clic(f.id)}
                title={`${f.nome} · ${f.w}×${f.h}${f.data ? ' · ' + new Date(f.data).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : ''}`}>
                <img src={urlFile(f.mini)} alt="" draggable={false} loading="lazy" />
                {acceso && <span className="cella-n">{i! + 1}</span>}
                {!usate.has(f.id) && <span className="nuova-et">nuova</span>}
                <button className={`st ${f.preferita ? 'si' : ''}`} title="Preferita: può avere una pagina tutta sua" onClick={(e) => { e.stopPropagation(); mod((a) => { const x = a.foto.find((y) => y.id === f.id); if (x) x.preferita = !x.preferita }) }}>{f.preferita ? <I.stellaPiena /> : <I.stella />}</button>
                <button className="x" title="Toglie la foto dall'album" onClick={(e) => { e.stopPropagation(); mod((a) => { a.foto = a.foto.filter((y) => y.id !== f.id); for (const s of a.spreads) s.piazze = s.piazze.filter((q) => q.foto !== f.id); a.spreads = a.spreads.filter((s) => s.piazze.length) }) }}><I.x /></button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** le foto che non sono in nessuna pagina vanno in pagine nuove in fondo, impaginate come il resto dell'album */
function aggiungiNuove(album: Album): void {
  const usate = new Set(album.spreads.flatMap((s) => s.piazze.map((q) => q.foto)))
  const rimaste = album.foto.filter((f) => !usate.has(f.id))
  if (!rimaste.length) return
  const fine = album.spreads.length
  usaAlbum.getState().mod((a) => {
    for (const g of raggruppa(rimaste, { ...a, copertina: false, seme: Date.now() })) {
      a.spreads.push({ id: crypto.randomUUID(), piazze: g.ids.map(piazza), layout: 0, stile: g.ids.length === 1 ? 'pieno' : 'classico' })
      riproponi(a, a.spreads.length - 1)
    }
  })
  usaAlbum.getState().scegli(fine)
}
