// L'esportazione per la stampa: JPEG per spread o un PDF a grandezza vera, 150–300 dpi, con l'abbondanza.
import { useRef, useState, type JSX } from 'react'
import { usaStato } from '../../stato'
import { api } from '../../api'
import { I } from '../../componenti/Icone'
import { Cursore, Interruttore, Segmenti } from '../../componenti/Controlli'
import { usaAlbum } from '../stato'
import { esporta } from '../esporta'
import { spreadDi, type Album as TipoAlbum } from '../tipi'

export function PannelloEsporta(p: { album: TipoAlbum; chiudi: () => void }): JSX.Element {
  const { album } = p
  const [formato, setFormato] = useState<'pdf' | 'jpeg'>('pdf')
  const [pagine, setPagine] = useState<'doppie' | 'singole'>(album.doppie ? 'doppie' : 'singole')
  const [dpi, setDpi] = useState(300)
  const [abb, setAbb] = useState(album.abbondanza > 0)
  const [qualita, setQualita] = useState(92)
  const [cartella, setCartella] = useState('')
  const [nome, setNome] = useState(album.nome.replace(/[\\/:*?"<>|]+/g, '_'))
  const [stato, setStato] = useState<{ fatto: number; totale: number; testo: string } | null>(null)
  const [usciti, setUsciti] = useState<string[]>([])
  const fermo = useRef({ si: false })
  const avvisa = usaStato((s) => s.avvisa)
  const s = spreadDi(album)
  const lato = (pagine === 'singole' && album.doppie ? s.w / 2 : s.w) + (abb ? 2 * album.abbondanza : 0)
  const px = Math.round((lato / 25.4) * dpi)
  const lavora = !!stato && stato.fatto < stato.totale

  const scegliCartella = async (): Promise<void> => {
    const c = await api.file.scegliCartella(cartella || undefined)
    if (c) setCartella(c)
  }
  const vai = async (): Promise<void> => {
    if (!cartella) {
      avvisa('Scegli la cartella dove salvare', 'errore')
      return
    }
    fermo.current.si = false
    setUsciti([])
    try {
      const out = await esporta(album, { cartella, nome: nome || 'album', formato, pagine, dpi, abbondanza: abb, qualita: qualita / 100 }, (fatto, totale, testo) => setStato({ fatto, totale, testo }), fermo.current)
      setUsciti(out)
      if (out.length) avvisa(formato === 'pdf' ? 'PDF pronto' : `${out.length} immagini esportate`, 'ok')
    } catch (e) {
      avvisa((e as Error).message, 'errore')
      setStato(null)
    }
  }

  return (
    <div className="album-modale" onClick={(e) => e.target === e.currentTarget && !lavora && p.chiudi()}>
      <div className="pannello">
        <header>
          <b>ESPORTA PER LA STAMPA</b>
          <span className="flex1" />
          <button className="btn fantasma piccolo icona" onClick={p.chiudi} disabled={lavora}><I.x /></button>
        </header>
        <div className="corpo">
          <div>
            <span className="piccolo tenue">Formato del file</span>
            <Segmenti valore={formato} cambia={setFormato} voci={[{ id: 'pdf', nome: 'PDF', sotto: 'un file solo' }, { id: 'jpeg', nome: 'JPEG', sotto: 'un file per spread' }]} />
          </div>
          {album.doppie && (
            <div>
              <span className="piccolo tenue">Pagine</span>
              <Segmenti valore={pagine} cambia={setPagine} voci={[{ id: 'doppie', nome: 'Doppie', sotto: 'come le vedi' }, { id: 'singole', nome: 'Singole', sotto: 'una per pagina' }]} />
            </div>
          )}
          <div>
            <span className="piccolo tenue">Risoluzione</span>
            <Segmenti valore={dpi} cambia={setDpi} voci={[{ id: 150, nome: '150 dpi', sotto: 'bozza' }, { id: 200, nome: '200 dpi' }, { id: 300, nome: '300 dpi', sotto: 'stampa' }]} />
            <div className="piccolo spento" style={{ marginTop: 4 }}>Ogni file è largo circa {px} px</div>
          </div>
          <Interruttore acceso={abb} cambia={setAbb} sotto={`${album.abbondanza} mm di vivo attorno, come lo chiede il laboratorio`}>Con l'abbondanza</Interruttore>
          <Cursore etichetta="Abbondanza (vivo)" valore={album.abbondanza} min={0} max={10} passo={1} formato={(v) => `${v} mm`} cambia={(v) => usaAlbum.getState().mod((x) => { x.abbondanza = v }, true)} titolo="Quanto si estende il disegno oltre il taglio, come lo vuole il laboratorio di stampa" />
          {formato === 'jpeg' && <Cursore etichetta="Qualità JPEG" valore={qualita} min={70} max={100} passo={1} formato={(v) => `${v}`} cambia={setQualita} />}
          <div>
            <span className="piccolo tenue">Cartella</span>
            <div className="riga" style={{ gap: 6 }}>
              <input type="text" value={cartella} readOnly placeholder="Scegli dove salvare" style={{ flex: 1, minWidth: 0 }} />
              <button className="btn" onClick={scegliCartella}><I.cartella /> Scegli</button>
            </div>
          </div>
          <label className="campo-preset"><span>Nome del file</span><input type="text" value={nome} onChange={(e) => setNome(e.target.value)} /></label>
          {stato && (
            <div>
              <div className="barra-progresso"><i style={{ width: `${(stato.fatto / Math.max(1, stato.totale)) * 100}%` }} /></div>
              <div className="piccolo tenue" style={{ marginTop: 4 }}>{stato.testo}</div>
            </div>
          )}
          {usciti.length > 0 && !lavora && (
            <div className="riga a-capo" style={{ gap: 8 }}>
              <span className="oro">✓ {usciti.length} {usciti.length === 1 ? 'file' : 'file'}</span>
              <button className="btn piccolo" onClick={() => void api.album.mostra(usciti[0])}><I.cartella /> Mostra</button>
            </div>
          )}
        </div>
        <footer>
          {lavora ? <button className="btn pericolo" onClick={() => { fermo.current.si = true }}>Ferma</button> : <button className="btn" onClick={p.chiudi}>Chiudi</button>}
          <button className="btn primario" onClick={() => void vai()} disabled={lavora}><I.scarica /> Esporta {album.spreads.length} {album.spreads.length === 1 ? 'spread' : 'spread'}</button>
        </footer>
      </div>
    </div>
  )
}
