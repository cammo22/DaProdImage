// Lo stile di tutto l'album: un clic su una delle anteprime cambia colori, margini, angoli, cornici e carattere.
// Sotto, per chi vuole ritoccare, i pochi controlli che servono davvero (chiusi di partenza) e lo sfondo.
import { useEffect, useState, type JSX } from 'react'
import { usaAlbum } from '../stato'
import { api } from '../../api'
import { ascoltatoriLavoro, scegliFoto, usaStato } from '../../stato'
import { richiestaBase, perQualita } from '../../azioni'
import { Cursore, Interruttore } from '../../componenti/Controlli'
import { I } from '../../componenti/Icone'
import { TEMI, applicaTema } from '../temi'
import { COLORI_SFONDO, spreadDi, type Album, type Spread } from '../tipi'
import { Miniatura } from './Miniatura'

export function PannelloStile(p: { album: Album; spread: Spread | undefined }): JSX.Element {
  const { album } = p
  const mod = usaAlbum.getState().mod
  const avvisa = usaStato((s) => s.avvisa)
  const [ia, setIa] = useState('')
  const [iaInCorso, setIaInCorso] = useState(false)
  // l'anteprima di ogni stile: il primo spread con foto, con quei colori
  const esempio = p.spread && p.spread.piazze.length ? p.spread : album.spreads.find((s) => s.piazze.length)

  // lo sfondo fatto dall'AI: quando il lavoro finisce diventa lo sfondo dell'album
  useEffect(() => {
    const h = (uno: { id: string; stato: string; risultati: string[]; richiesta: { etichetta?: string } }): void => {
      if (uno.richiesta.etichetta !== 'Sfondo album') return
      if (uno.stato === 'fatto' && uno.risultati[0]) {
        void api.galleria.opera(uno.risultati[0]).then((o) => {
          if (o) usaAlbum.getState().mod((a) => { a.sfondo = { tipo: 'immagine', percorso: o.file, colore: a.sfondo.colore } })
          setIaInCorso(false)
        })
      } else if (uno.stato === 'errore' || uno.stato === 'annullato') setIaInCorso(false)
    }
    ascoltatoriLavoro.push(h as never)
    return () => {
      const i = ascoltatoriLavoro.indexOf(h as never)
      if (i >= 0) ascoltatoriLavoro.splice(i, 1)
    }
  }, [])

  const sfondoIa = async (): Promise<void> => {
    if (!ia.trim()) return
    setIaInCorso(true)
    const d = spreadDi(album)
    const ar = d.w / d.h
    const m32 = (x: number): number => Math.max(512, Math.round(x / 32) * 32)
    const w = m32(Math.sqrt(1048576 * 1.3 * ar))
    const h = m32(Math.sqrt((1048576 * 1.3) / ar))
    try {
      await api.lavori.accoda({
        ...richiestaBase(),
        modalita: 'crea',
        prompt: `${ia.trim()}. A seamless, subtle, elegant background texture for a photo album page, no text, no objects, no people, soft and uncluttered.`,
        larghezza: w, altezza: h, megapixel: (w * h) / 1048576, quante: 1, etichetta: 'Sfondo album', ...perQualita('alta')
      })
      avvisa('Genero lo sfondo: lo trovi nella coda; appena è pronto lo metto nell\'album', 'ok')
    } catch (e) {
      setIaInCorso(false)
      avvisa((e as Error).message, 'errore')
    }
  }

  return (
    <div className="pannello-stile">
      <div className="griglia-layout">
        {TEMI.map((t) => {
          const prova: Album = { ...album, ...t, sfondo: { ...t.sfondo }, tema: t.id }
          return (
            <div key={t.id} role="button" tabIndex={0} className={`scheda-layout ${album.tema === t.id ? 'su' : ''}`} onClick={() => mod((a) => applicaTema(a, t))} onKeyDown={(e) => e.key === 'Enter' && mod((a) => applicaTema(a, t))} title={t.sotto}>
              {esempio ? <Miniatura album={prova} spread={esempio} larg={132} senzaElementi /> : <div className="muto-tema" style={{ background: t.sfondo.colore }} />}
              <span>{t.nome}</span>
            </div>
          )
        })}
      </div>

      <details className="dettagli-album">
        <summary>Ritocca</summary>
        <Cursore etichetta="Margine" valore={album.margine} min={0} max={40} passo={1} formato={(v) => `${v} mm`} cambia={(v) => mod((a) => { a.margine = v }, true)} />
        <Cursore etichetta="Spazio fra le foto" valore={album.spazio} min={0} max={30} passo={1} formato={(v) => `${v} mm`} cambia={(v) => mod((a) => { a.spazio = v }, true)} />
        <Cursore etichetta="Angoli arrotondati" valore={album.angoli} min={0} max={20} passo={1} formato={(v) => (v ? `${v} mm` : 'no')} cambia={(v) => mod((a) => { a.angoli = v }, true)} />
        <Cursore etichetta="Cornice alle foto" valore={album.bordoFoto} min={0} max={10} passo={0.5} formato={(v) => (v ? `${v} mm` : 'no')} cambia={(v) => mod((a) => { a.bordoFoto = v }, true)} />
        <div style={{ marginTop: 8 }}><Interruttore acceso={album.ombra} cambia={(v) => mod((a) => { a.ombra = v })}>Ombra sotto le foto</Interruttore></div>
      </details>

      <details className="dettagli-album">
        <summary>Sfondo</summary>
        <div className="colori-album">
          {COLORI_SFONDO.map((c) => (
            <button key={c} className={album.sfondo.tipo === 'colore' && album.sfondo.colore === c ? 'su' : ''} style={{ background: c }} onClick={() => mod((a) => { a.sfondo = { tipo: 'colore', colore: c } })} title={c} />
          ))}
          <input type="color" value={album.sfondo.colore} onChange={(e) => mod((a) => { a.sfondo = { tipo: 'colore', colore: e.target.value } }, true)} title="Un colore a scelta" />
        </div>
        <div className="riga a-capo" style={{ gap: 6, marginTop: 8 }}>
          <button className="btn piccolo" onClick={async () => { const [f] = await scegliFoto(false); if (f) mod((a) => { a.sfondo = { tipo: 'immagine', percorso: f.percorso, colore: a.sfondo.colore } }) }}><I.galleria /> Immagine dalla galleria</button>
          {album.sfondo.tipo === 'immagine' && <button className="btn piccolo fantasma" onClick={() => mod((a) => { a.sfondo = { tipo: 'colore', colore: a.sfondo.colore } })}><I.x /> Togli</button>}
        </div>
        <div className="riga" style={{ gap: 6, marginTop: 8 }}>
          <input type="text" value={ia} onChange={(e) => setIa(e.target.value)} placeholder="Sfondo con l'AI: es. carta crema, acquerello" style={{ flex: 1, minWidth: 0 }} onKeyDown={(e) => e.key === 'Enter' && void sfondoIa()} />
          <button className="btn piccolo" onClick={() => void sfondoIa()} disabled={iaInCorso || !ia.trim()} title="Qwen-Image disegna uno sfondo delle proporzioni dello spread">{iaInCorso ? '…' : <I.bacchetta />}</button>
        </div>
      </details>
    </div>
  )
}
