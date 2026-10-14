// Album: le foto a sinistra (si illuminano quelle dello spread aperto), lo spread al centro con la striscia di tutti gli
// spread, a destra layout / stile / elementi. Si parte da un formato e dalle foto: l'album si impagina da solo; poi si ritocca
// con un clic (un altro layout, uno stile, un testo) e si esporta per la stampa.
import { useEffect, useState, type JSX } from 'react'
import { usaStato, scegliFoto } from '../stato'
import { api } from '../api'
import { I } from '../componenti/Icone'
import { Interruttore, Segmenti } from '../componenti/Controlli'
import { usaAlbum } from '../album/stato'
import { DENSITA, type Album as TipoAlbum } from '../album/tipi'
import { Foto } from '../album/viste/Foto'
import { Palco } from '../album/viste/Palco'
import { Miniatura } from '../album/viste/Miniatura'
import { PannelloLayout } from '../album/viste/PannelloLayout'
import { PannelloStile } from '../album/viste/PannelloStile'
import { PannelloElementi } from '../album/viste/PannelloElementi'
import { PannelloEsporta } from '../album/viste/Esporta'
import { MenuFormato } from '../album/viste/Formato'
import { Avvio } from '../album/viste/Avvio'

type Scheda = 'layout' | 'stile' | 'elementi'

export function Album(): JSX.Element {
  const { album, elenco, corrente, cella, elemento, lavoro, storia, futuro } = usaAlbum()
  const [esportando, setEsportando] = useState(false)
  const [guide, setGuide] = useState(false)
  const [scheda, setScheda] = useState<Scheda>('layout')
  const avvisa = usaStato((s) => s.avvisa)

  // all'apertura: l'ultimo album, o uno nuovo
  useEffect(() => {
    void (async () => {
      await usaAlbum.getState().aggiornaElenco()
      // se un album è già aperto (si è solo cambiata pagina) resta quello, con il suo annulla
      if (usaAlbum.getState().album) return
      const l = usaAlbum.getState().elenco
      if (l.length) await usaAlbum.getState().apri(l[0].id)
      else await usaAlbum.getState().nuovo('Il mio primo album')
    })()
  }, [])

  // tasti: Ctrl+Z / Ctrl+Y, frecce fra gli spread, Canc toglie quello che è scelto
  useEffect(() => {
    const t = (e: KeyboardEvent): void => {
      if (usaStato.getState().pagina !== 'album') return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      const s = usaAlbum.getState()
      if (e.ctrlKey && e.key.toLowerCase() === 'z') s.annulla()
      else if (e.ctrlKey && e.key.toLowerCase() === 'y') s.ripeti()
      else if (e.key === 'ArrowLeft' && s.album) s.scegli(Math.max(0, s.corrente - 1))
      else if (e.key === 'ArrowRight' && s.album) s.scegli(Math.min(s.album.spreads.length - 1, s.corrente + 1))
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.elemento) {
          const id = s.elemento
          s.mod((a) => { a.spreads[s.corrente].elementi = a.spreads[s.corrente].elementi?.filter((x) => x.id !== id) })
          usaAlbum.setState({ elemento: null })
        } else if (s.cella !== null) s.togli(s.cella)
      } else if (e.key === 'Escape') usaAlbum.setState({ cella: null, elemento: null })
    }
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  }, [])

  if (!album) return <div className="pagina"><div className="vuoto"><div className="grosso">ALBUM</div><p>Apro…</p></div></div>

  const mod = usaAlbum.getState().mod
  const spread = album.spreads[corrente]

  const aggiungi = async (percorsi: string[]): Promise<void> => {
    if (!percorsi.length) return
    const n = await usaAlbum.getState().importa(percorsi)
    if (n) avvisa(`${n} foto nell'album`, 'ok')
  }
  const daGalleria = async (): Promise<void> => aggiungi((await scegliFoto(true)).map((x) => x.percorso))
  const daPc = async (): Promise<void> => aggiungi(await api.file.scegliImmagini(true))

  const vuoto = album.foto.length === 0 ? (
    <Avvio album={album} daGalleria={daGalleria} daPc={daPc} />
  ) : (
    <div className="vuoto"><div className="grosso">ALBUM</div><p>Premi <b className="oro">Impagina da capo</b> per mettere le foto nelle pagine.</p></div>
  )

  return (
    <div className="pagina"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const fs = Array.from(e.dataTransfer.files)
        if (!fs.length) return
        e.preventDefault()
        e.stopPropagation()
        void aggiungi(fs.map((f) => api.file.percorso(f)))
      }}
    >
      <div className="colonna colonna-album">
        <Testata album={album} elenco={elenco} />
        <Foto album={album} spread={spread} cella={cella} daGalleria={daGalleria} daPc={daPc} />
      </div>

      <div className="palco palco-album">
        <div className="barra-album">
          <button className="btn icona piccolo" onClick={() => usaAlbum.getState().annulla()} disabled={!storia.length} title="Annulla (Ctrl+Z)"><I.annulla /></button>
          <button className="btn icona piccolo" onClick={() => usaAlbum.getState().ripeti()} disabled={!futuro.length} title="Ripeti (Ctrl+Y)"><I.ripeti /></button>
          <span className="sep" />
          {album.spreads.length > 0 && (
            <>
              <button className="btn icona piccolo" disabled={corrente <= 0} onClick={() => usaAlbum.getState().scegli(corrente - 1)} title="Spread prima (←)"><span className="freccina">‹</span></button>
              <span className="piccolo tenue">Spread <b>{corrente + 1}</b> di {album.spreads.length}</span>
              <button className="btn icona piccolo" disabled={corrente >= album.spreads.length - 1} onClick={() => usaAlbum.getState().scegli(corrente + 1)} title="Spread dopo (→)"><span className="freccina">›</span></button>
            </>
          )}
          <span className="flex1" />
          {album.foto.length > 0 && <ImpaginaDaCapo album={album} />}
          <button className={`btn piccolo icona ${guide ? 'attivo' : ''}`} onClick={() => setGuide(!guide)} title="Mostra il vivo (rosa), i margini (azzurro) e la piega"><I.rettangolo /></button>
          {spread && <button className="btn piccolo icona fantasma pericolo" onClick={() => mod((a) => { a.spreads.splice(corrente, 1) })} title="Toglie questo spread (le foto restano nell'album)"><I.cestino /></button>}
        </div>

        <Palco spread={spread} album={album} cella={cella} elemento={elemento} guide={guide} vuoto={vuoto} testoDoppio={() => setScheda('elementi')} />

        <div className="strisce-album">
          <div className="spreads-album">
            {album.spreads.map((s, i) => (
              <div key={s.id} className={`mini-spread ${i === corrente ? 'su' : ''}`} onClick={() => usaAlbum.getState().scegli(i)}
                onDragOver={(e) => e.dataTransfer.types.includes('application/x-foto-album') && e.preventDefault()}
                onDrop={(e) => { const id = e.dataTransfer.getData('application/x-foto-album'); if (id) { e.preventDefault(); e.stopPropagation(); usaAlbum.getState().metti(id, undefined, i) } }}>
                <Miniatura album={album} spread={s} larg={150} />
                <span className="num">{i + 1}</span>
                <div className="az">
                  <button onClick={(e) => { e.stopPropagation(); mod((a) => { const j = i - 1; if (j >= 0) [a.spreads[i], a.spreads[j]] = [a.spreads[j], a.spreads[i]] }); usaAlbum.getState().scegli(Math.max(0, i - 1)) }} title="Sposta prima">◂</button>
                  <button onClick={(e) => { e.stopPropagation(); mod((a) => { const j = i + 1; if (j < a.spreads.length) [a.spreads[i], a.spreads[j]] = [a.spreads[j], a.spreads[i]] }); usaAlbum.getState().scegli(Math.min(album.spreads.length - 1, i + 1)) }} title="Sposta dopo">▸</button>
                  <button onClick={(e) => { e.stopPropagation(); mod((a) => { a.spreads.splice(i, 1) }) }} title="Toglie lo spread"><I.x /></button>
                </div>
              </div>
            ))}
            <button className="nuovo-spread" onClick={() => { mod((a) => { a.spreads.push({ id: crypto.randomUUID(), piazze: [], layout: 0, stile: 'classico' }) }); usaAlbum.getState().scegli(album.spreads.length) }} title="Uno spread vuoto: poi ci metti le foto"><I.piu /></button>
          </div>
        </div>

        {lavoro && (
          <div className="lavoro-album">
            <div className="barra-progresso"><i style={{ width: `${(lavoro.fatto / Math.max(1, lavoro.totale)) * 100}%` }} /></div>
            <span>{lavoro.testo}</span>
          </div>
        )}
      </div>

      <div className="colonna destra colonna-album-dx">
        <div className="schede-album">
          <Segmenti<Scheda>
            valore={scheda}
            cambia={setScheda}
            voci={[{ id: 'layout', nome: 'Layout' }, { id: 'stile', nome: 'Stile' }, { id: 'elementi', nome: 'Testi e forme' }]}
          />
        </div>
        <div className="scorri">
          <div className="sezione">
            {scheda === 'layout' && <PannelloLayout album={album} spread={spread} corrente={corrente} />}
            {scheda === 'stile' && <PannelloStile album={album} spread={spread} />}
            {scheda === 'elementi' && <PannelloElementi album={album} spread={spread} corrente={corrente} elemento={elemento} />}
          </div>
        </div>
        <div className="sezione" style={{ borderTop: '1px solid #1d1636' }}>
          <button className="btn primario grande" style={{ width: '100%' }} onClick={() => setEsportando(true)} disabled={!album.spreads.length}>
            <I.scarica /> Esporta per la stampa
          </button>
          <div className="piccolo spento" style={{ textAlign: 'center', marginTop: 6 }}>JPEG o PDF · 150–300 dpi · con abbondanza</div>
        </div>
      </div>

      {esportando && <PannelloEsporta album={album} chiudi={() => setEsportando(false)} />}
    </div>
  )
}

/** il nome dell'album, gli altri album, il formato */
function Testata(p: { album: TipoAlbum; elenco: ReturnType<typeof usaAlbum.getState>['elenco'] }): JSX.Element {
  const { album, elenco } = p
  const mod = usaAlbum.getState().mod
  return (
    <div className="testata-album">
      <input type="text" className="nome-album" value={album.nome} onChange={(e) => mod((a) => { a.nome = e.target.value }, true)} placeholder="Nome dell'album" />
      <div className="riga" style={{ gap: 6, marginTop: 8 }}>
        <MenuFormato album={album} />
        <span className="flex1" />
        <button className="btn piccolo icona" onClick={() => void usaAlbum.getState().nuovo()} title="Un album nuovo"><I.piu /></button>
        <button className="btn piccolo fantasma pericolo icona" title="Elimina questo album (le foto originali restano dove sono)" onClick={() => confirm(`Elimino l'album "${album.nome}"? Le tue foto originali non si toccano.`) && void usaAlbum.getState().elimina(album.id).then(async () => {
          const l = usaAlbum.getState().elenco
          if (l.length) await usaAlbum.getState().apri(l[0].id)
          else await usaAlbum.getState().nuovo()
        })}><I.cestino /></button>
      </div>
      {elenco.length > 1 && (
        <select value={album.id} onChange={(e) => void usaAlbum.getState().apri(e.target.value)} style={{ width: '100%', marginTop: 8 }} title="I tuoi album">
          {!elenco.some((x) => x.id === album.id) && <option value={album.id}>{album.nome}</option>}
          {elenco.map((x) => <option key={x.id} value={x.id}>{x.nome} · {x.foto} foto</option>)}
        </select>
      )}
    </div>
  )
}

/** rifà tutta l'impaginazione: pochi controlli (quanto fitto, copertina, preferite grandi) */
function ImpaginaDaCapo(p: { album: TipoAlbum }): JSX.Element {
  const [aperto, setAperto] = useState(false)
  const { album } = p
  const mod = usaAlbum.getState().mod
  return (
    <div className="menu-album">
      <button className="btn piccolo" onClick={() => setAperto(!aperto)}><I.crea /> Impagina da capo ▾</button>
      {aperto && (
        <>
          <div className="velo-menu" onClick={() => setAperto(false)} />
          <div className="menu-pop destra">
            <span className="piccolo tenue">Quante foto per pagina</span>
            <Segmenti valore={album.densita} cambia={(v) => mod((a) => { a.densita = v })} voci={(Object.keys(DENSITA) as TipoAlbum['densita'][]).map((k) => ({ id: k, nome: DENSITA[k].nome, sotto: DENSITA[k].sotto }))} />
            <div className="col" style={{ gap: 8, marginTop: 10 }}>
              <Interruttore acceso={album.copertina} cambia={(v) => mod((a) => { a.copertina = v })} sotto="La prima foto (o una ★) con il titolo">Copertina</Interruttore>
              <Interruttore acceso={album.preferiteGrandi} cambia={(v) => mod((a) => { a.preferiteGrandi = v })} sotto="Le foto con la ★ hanno una pagina tutta per loro">Preferite a tutto foglio</Interruttore>
            </div>
            <button className="btn primario" style={{ width: '100%', marginTop: 12 }} onClick={() => {
              if (album.spreads.length && !confirm('Rifaccio tutta l\'impaginazione? I ritocchi agli spread si perdono (puoi annullare con Ctrl+Z).')) return
              usaAlbum.getState().costruisci()
              setAperto(false)
            }}><I.crea /> Impagina tutto</button>
          </div>
        </>
      )}
    </div>
  )
}
