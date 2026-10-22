// I modi di Modifica (Scrivi, Espandi, Estrai) come tessere: stanno in cima alla tela. Ricette ha il suo bottone nella strip dello Studio.
import { type JSX } from 'react'
import { usaStato, type ModoModifica } from '../../stato'
import { I } from '../../componenti/Icone'
import { Tessera } from '../../componenti/Tessere'

const MODI: { id: ModoModifica; nome: string; icona: () => JSX.Element; titolo: string }[] = [
  { id: 'scrivi', nome: 'Scrivi', icona: I.modifica, titolo: 'Scrivi cosa cambiare: se segni una zona col pennello cambia solo lì, se no tutta la foto' },
  { id: 'espandi', nome: 'Espandi', icona: I.espandi, titolo: 'Allarga la foto oltre i bordi' },
  { id: 'estrai', nome: 'Estrai', icona: I.estrai, titolo: 'Dalla foto estrai una persona o un oggetto: un clic sulla cosa, poi scegli l\'uscita' }
]

export function SelettoreModo(): JSX.Element {
  const { modifica: m, setModifica } = usaStato()
  return (
    <div className="modi-modifica" role="radiogroup" aria-label="Cosa fai con la foto">
      {MODI.map((x) => (
        <Tessera key={x.id} id={`modo-${x.id}`} icona={<x.icona />} nome={x.nome} titolo={x.titolo} su={m.modo === x.id} onClick={() => setModifica({ modo: x.id })} />
      ))}
    </div>
  )
}
