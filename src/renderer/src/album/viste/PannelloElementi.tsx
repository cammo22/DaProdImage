// Testi e forme sullo spread: si aggiungono con un clic, si trascinano sulla pagina e si ritoccano qui.
import { type JSX } from 'react'
import { usaAlbum } from '../stato'
import { Cursore, Interruttore, Segmenti } from '../../componenti/Controlli'
import { I } from '../../componenti/Icone'
import { FONT_ALBUM, spreadDi, type Album, type Elemento, type Spread } from '../tipi'

const COLORI = ['#ffffff', '#111111', '#e6d3a3', '#c0392b', '#2d6cdf', '#2f9e6f', '#f5b83d', '#8e5bd6']

const nuovo = (a: Album, base: Partial<Elemento>): Elemento => ({
  id: crypto.randomUUID(), tipo: 'testo', x: 0.5, y: 0.5, w: 0.4, dim: 8, colore: a.coloreTesto, font: a.font, ...base
})

export function PannelloElementi(p: { album: Album; spread: Spread | undefined; corrente: number; elemento: string | null }): JSX.Element {
  const { album, spread, corrente } = p
  const mod = usaAlbum.getState().mod
  if (!spread) return <div className="spento piccolo" style={{ padding: 14 }}>Scegli uno spread per aggiungerci testi e forme.</div>
  const h = spreadDi(album).h
  const els = spread.elementi || []
  const sel = els.find((e) => e.id === p.elemento)

  const aggiungi = (e: Partial<Elemento>): void => {
    const el = nuovo(album, e)
    mod((a) => { (a.spreads[corrente].elementi ??= []).push(el) })
    usaAlbum.getState().scegliElemento(el.id)
  }
  const cambia = (f: (e: Elemento) => void, senzaStoria = true): void => {
    if (!sel) return
    mod((a) => { const e = a.spreads[corrente].elementi?.find((x) => x.id === sel.id); if (e) f(e) }, senzaStoria)
  }
  const togli = (): void => {
    if (!sel) return
    mod((a) => { a.spreads[corrente].elementi = a.spreads[corrente].elementi?.filter((x) => x.id !== sel.id) })
    usaAlbum.getState().scegliElemento(null)
  }

  return (
    <div className="pannello-elementi">
      <div className="riga a-capo" style={{ gap: 6 }}>
        <button className="btn" onClick={() => aggiungi({ testo: 'Il tuo titolo', dim: Math.round(h * 0.08), w: 0.5, y: 0.5, grassetto: true })}><I.testo /> Titolo</button>
        <button className="btn" onClick={() => aggiungi({ testo: 'Una didascalia', dim: Math.max(3, Math.round(h * 0.03)), w: 0.4, y: 0.92 })}><I.testo /> Didascalia</button>
        <button className="btn" onClick={() => aggiungi({ tipo: 'forma', forma: 'cerchio', w: 0.12, h: 0.12 * (spreadDi(album).w / h), colore: '#e6d3a3', opacita: 0.9, dim: 1 })}>● Cerchio</button>
        <button className="btn" onClick={() => aggiungi({ tipo: 'forma', forma: 'rett', w: 0.3, h: 0.12, colore: '#ffffff', opacita: 0.85, dim: 1 })}>▬ Riquadro</button>
        <button className="btn" onClick={() => aggiungi({ tipo: 'forma', forma: 'linea', w: 0.3, y: 0.5, colore: '#ffffff', dim: 0.8 })}>— Linea</button>
        <button className="btn" onClick={() => aggiungi({ tipo: 'forma', forma: 'cornice', w: 0.4, h: 0.5, colore: '#ffffff', dim: 1.2 })}>▢ Cornice</button>
      </div>

      {!sel && (
        <div style={{ marginTop: 12 }}>
          {els.length === 0 ? (
            <div className="spento piccolo">Niente ancora su questo spread. Aggiungi un testo o una forma: poi lo trascini sulla pagina.</div>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              <span className="piccolo tenue">Su questo spread</span>
              {els.map((e) => (
                <div key={e.id} className="riga-persona" onClick={() => usaAlbum.getState().scegliElemento(e.id)}>
                  <span className="n">{e.tipo === 'testo' ? 'T' : '◆'}</span>
                  <span className="t">{e.tipo === 'testo' ? e.testo || '(vuoto)' : e.forma}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {sel && (
        <div className="col" style={{ gap: 10, marginTop: 12 }}>
          {sel.tipo === 'testo' && (
            <>
              <textarea value={sel.testo || ''} rows={2} onChange={(e) => cambia((x) => { x.testo = e.target.value })} placeholder="Scrivi qui" autoFocus />
              <Cursore etichetta="Grandezza" valore={sel.dim} min={2} max={Math.max(40, Math.round(h * 0.25))} passo={0.5} formato={(v) => `${v} mm`} cambia={(v) => cambia((x) => { x.dim = v })} />
              <Segmenti valore={sel.font || album.font} cambia={(v) => cambia((x) => { x.font = v }, false)} voci={FONT_ALBUM.map((f) => ({ id: f.id, nome: <span style={{ fontFamily: f.id }}>{f.nome}</span> }))} />
              <Segmenti valore={sel.allinea || 'centro'} cambia={(v) => cambia((x) => { x.allinea = v }, false)} voci={[{ id: 'sinistra', nome: 'A sinistra' }, { id: 'centro', nome: 'Al centro' }]} />
              <Interruttore acceso={!!sel.ombra} cambia={(v) => cambia((x) => { x.ombra = v }, false)} sotto="Utile sopra le foto">Ombra dietro le lettere</Interruttore>
            </>
          )}
          {sel.tipo === 'forma' && (
            <>
              <Cursore etichetta="Trasparenza" valore={Math.round((sel.opacita ?? 1) * 100)} min={10} max={100} passo={5} formato={(v) => `${v}%`} cambia={(v) => cambia((x) => { x.opacita = v / 100 })} />
              {(sel.forma === 'linea' || sel.forma === 'cornice') && <Cursore etichetta="Spessore" valore={sel.dim} min={0.3} max={8} passo={0.1} formato={(v) => `${v.toFixed(1)} mm`} cambia={(v) => cambia((x) => { x.dim = v })} />}
            </>
          )}
          <div>
            <span className="piccolo tenue">Colore</span>
            <div className="colori-album">
              {COLORI.map((c) => <button key={c} className={sel.colore === c ? 'su' : ''} style={{ background: c }} onClick={() => cambia((x) => { x.colore = c }, false)} />)}
              <input type="color" value={sel.colore} onChange={(e) => cambia((x) => { x.colore = e.target.value })} />
            </div>
          </div>
          <div className="riga a-capo" style={{ gap: 6 }}>
            <button className="btn piccolo" onClick={() => { const { id: _scarto, ...resto } = sel; void _scarto; aggiungi({ ...resto, x: Math.min(0.9, sel.x + 0.04), y: Math.min(0.9, sel.y + 0.04) }) }}><I.copia /> Duplica</button>
            <button className="btn piccolo fantasma pericolo" onClick={togli}><I.cestino /> Elimina</button>
            <button className="btn piccolo fantasma" onClick={() => usaAlbum.getState().scegliElemento(null)}>Fatto</button>
          </div>
          <div className="piccolo spento">Trascinalo sulla pagina · il quadratino azzurro lo allarga · si attacca al centro.</div>
        </div>
      )}
    </div>
  )
}
