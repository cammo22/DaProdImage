// I modi di Modifica (Scrivi, Espandi, Ricette, Estrai): sta in cima alla pagina, anche quando si guarda il catalogo delle ricette.
import { type JSX } from 'react'
import { usaStato, type ModoModifica } from '../../stato'
import { Segmenti } from '../../componenti/Controlli'

export function SelettoreModo(): JSX.Element {
  const { modifica: m, setModifica } = usaStato()
  return (
    <div style={{ width: 560 }}>
      <Segmenti<ModoModifica>
        valore={m.modo}
        cambia={(modo) => setModifica({ modo })}
        voci={[
          { id: 'scrivi', nome: 'Scrivi', titolo: 'Scrivi cosa cambiare: se segni una zona col pennello cambia solo lì, se no tutta la foto' },
          { id: 'espandi', nome: 'Espandi' },
          { id: 'ricette', nome: 'Ricette', titolo: 'Cose già pronte in più passi (pose, stili, luci…), anche su tante foto; con Unisci foto e Come l\'esempio' },
          { id: 'estrai', nome: 'Estrai', titolo: 'Dalla foto estrai una persona o un oggetto, su sfondo pulito' }
        ]}
      />
    </div>
  )
}
