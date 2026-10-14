// Il formato dell'album: quadrato, orizzontale, verticale, A4… con la forma vera disegnata, e aperto (due pagine) o singola.
import { useState, type JSX } from 'react'
import { usaAlbum, riadatta } from '../stato'
import { Segmenti } from '../../componenti/Controlli'
import { FORMATI, spreadDi, type Album } from '../tipi'

export function SceltaFormato(p: { album: Album }): JSX.Element {
  const { album } = p
  const mod = usaAlbum.getState().mod
  return (
    <div className="scelta-formato">
      <div className="formati-album">
        {FORMATI.filter((f) => f.id !== 'custom').map((f) => {
          const k = 34 / Math.max(f.w, f.h)
          return (
            <div key={f.id} role="button" tabIndex={0} className={`formato-card ${album.formato === f.id ? 'su' : ''}`} onClick={() => mod((a) => { a.formato = f.id; a.pagina = { w: f.w, h: f.h } })} onKeyDown={(e) => e.key === 'Enter' && mod((a) => { a.formato = f.id; a.pagina = { w: f.w, h: f.h } })}>
              <i style={{ width: f.w * k, height: f.h * k }} />
              <span>{f.nome.replace(' cm', '')}</span>
            </div>
          )
        })}
      </div>
      {(
        <div className="riga" style={{ gap: 6, marginTop: 10 }}>
          <span className="piccolo tenue">Misura tua (cm, una pagina)</span>
          <input type="number" min={5} max={80} step={0.5} style={{ width: 64 }} value={album.pagina.w / 10} onChange={(e) => mod((a) => { a.formato = 'custom'; a.pagina.w = Math.round(Number(e.target.value) * 10) }, true)} />
          <span className="tenue">×</span>
          <input type="number" min={5} max={80} step={0.5} style={{ width: 64 }} value={album.pagina.h / 10} onChange={(e) => mod((a) => { a.formato = 'custom'; a.pagina.h = Math.round(Number(e.target.value) * 10) }, true)} />
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <Segmenti valore={album.doppie ? 'doppie' : 'singola'} cambia={(v) => mod((a) => { a.doppie = v === 'doppie'; riadatta(a) })} voci={[{ id: 'doppie', nome: 'Aperto', sotto: '2 pagine affiancate' }, { id: 'singola', nome: 'Pagina singola' }]} />
      </div>
    </div>
  )
}

/** il pulsante con il formato attuale; apre il menu per cambiarlo */
export function MenuFormato(p: { album: Album }): JSX.Element {
  const [aperto, setAperto] = useState(false)
  const d = spreadDi(p.album)
  return (
    <div className="menu-album">
      <button className="btn piccolo" onClick={() => setAperto(!aperto)} title="Formato dell'album">{d.w / 10} × {d.h / 10} cm {p.album.doppie ? '· aperto' : ''} ▾</button>
      {aperto && (
        <>
          <div className="velo-menu" onClick={() => setAperto(false)} />
          <div className="menu-pop"><SceltaFormato album={p.album} /></div>
        </>
      )}
    </div>
  )
}
