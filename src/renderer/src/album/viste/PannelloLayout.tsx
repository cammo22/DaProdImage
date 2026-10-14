// I layout per lo spread aperto: i modelli della libreria (abbinati alle tue foto) e qualche impaginazione a misura.
// Si vedono con le tue foto vere: un clic e lo spread è fatto così. "Un altro" ne prova uno a caso fra i migliori.
import { useMemo, type JSX } from 'react'
import { usaAlbum } from '../stato'
import { proposte, eAttiva } from '../proposte'
import { Miniatura } from './Miniatura'
import { I } from '../../componenti/Icone'
import type { Album, Spread } from '../tipi'

export function PannelloLayout(p: { album: Album; spread: Spread | undefined; corrente: number }): JSX.Element {
  const { album, spread } = p
  // le proposte dipendono da foto, formato e margini: non dagli elementi che sposti
  const chiave = spread ? JSON.stringify([spread.piazze.map((q) => q.foto), album.formato, album.pagina, album.doppie, album.spazio, album.margine, album.abbondanza, album.taglioMax, album.evitaPiega]) : ''
  const lista = useMemo(() => (spread ? proposte(album, spread) : []), [chiave]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!spread) return <div className="spento piccolo" style={{ padding: 14 }}>Scegli uno spread, o aggiungi le foto: qui compaiono i layout per ogni pagina.</div>
  if (!spread.piazze.length) return <div className="spento piccolo" style={{ padding: 14 }}>Questo spread è vuoto: clicca le foto a sinistra per metterle qui. I layout compaiono da soli.</div>

  const applica = (q: (typeof lista)[number]): void => {
    usaAlbum.getState().mod((a) => {
      const sp = a.spreads[p.corrente]
      if (!sp) return
      sp.modello = q.sp.modello
      sp.layout = q.sp.layout
      sp.stile = q.sp.stile
      sp.piazze = q.sp.piazze
    })
    usaAlbum.setState({ cella: null })
  }
  const altro = (): void => {
    const altri = lista.filter((q) => !eAttiva(q, spread))
    if (altri.length) applica(altri[Math.floor(Math.random() * Math.min(8, altri.length))])
  }
  const modelli = lista.filter((q) => q.tipo === 'modello')
  const auto = lista.filter((q) => q.tipo === 'auto')

  return (
    <div className="pannello-layout">
      <div className="riga spazia" style={{ marginBottom: 10 }}>
        <span className="piccolo tenue">{spread.piazze.length} {spread.piazze.length === 1 ? 'foto' : 'foto'} in questo spread</span>
        <button className="btn piccolo" onClick={altro} title="Prova un layout a caso fra i migliori"><I.ricicla /> Un altro</button>
      </div>
      <div className="griglia-layout">
        {modelli.map((q) => (
          <Scheda key={q.id} album={album} q={q} attiva={eAttiva(q, spread)} applica={() => applica(q)} />
        ))}
      </div>
      {auto.length > 0 && (
        <>
          <div className="titolo-mini">Su misura per le tue foto</div>
          <div className="griglia-layout">
            {auto.map((q) => <Scheda key={q.id} album={album} q={q} attiva={eAttiva(q, spread)} applica={() => applica(q)} />)}
          </div>
        </>
      )}
      {modelli.length === 0 && auto.length === 0 && <div className="spento piccolo">Per tante foto in uno spread solo ci sono pochi layout: prova a spostarne qualcuna in un'altra pagina.</div>}
    </div>
  )
}

function Scheda(p: { album: Album; q: ReturnType<typeof proposte>[number]; attiva: boolean; applica: () => void }): JSX.Element {
  return (
    <div role="button" tabIndex={0} className={`scheda-layout ${p.attiva ? 'su' : ''}`} onClick={p.applica} onKeyDown={(e) => e.key === 'Enter' && p.applica()} title={p.q.nome}>
      <Miniatura album={p.album} spread={p.q.sp} larg={132} senzaElementi />
      <span>{p.q.nome}</span>
    </div>
  )
}
