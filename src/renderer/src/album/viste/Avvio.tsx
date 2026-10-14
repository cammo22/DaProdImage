// Album vuoto: tre cose sole. Il formato, le foto (galleria o PC, anche RAW, oppure trascinate), e l'album si impagina da solo.
import type { JSX } from 'react'
import { I } from '../../componenti/Icone'
import { SceltaFormato } from './Formato'
import type { Album } from '../tipi'

export function Avvio(p: { album: Album; daGalleria: () => void; daPc: () => void }): JSX.Element {
  return (
    <div className="avvio-album">
      <div className="grosso">IL TUO <b>ALBUM</b></div>
      <p>Scegli il formato, aggiungi le foto: l'album si <b className="oro">impagina da solo</b>. Poi cambi layout, stile e aggiungi testi con un clic.</p>
      <div className="passo-avvio"><span className="num-passo">1</span> Il formato</div>
      <SceltaFormato album={p.album} />
      <div className="passo-avvio"><span className="num-passo">2</span> Le foto</div>
      <div className="riga" style={{ justifyContent: 'center', gap: 10 }}>
        <button className="btn primario grande" onClick={p.daGalleria}><I.galleria /> Dalla galleria</button>
        <button className="btn grande" onClick={p.daPc}><I.immagine /> Dal PC · anche RAW</button>
      </div>
      <p className="piccolo spento" style={{ marginTop: 10 }}>Oppure trascinale su questa finestra. I RAW diventano JPEG ad alta qualità (6000 px): gli originali non si toccano.</p>
    </div>
  )
}
