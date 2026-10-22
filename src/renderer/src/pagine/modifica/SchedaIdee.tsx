// Modifica: le Idee come griglia di tessere con icona (nessun chip di testo). Le categorie sono tessere; aprendone una compaiono le sue azioni,
// anch'esse tessere (un'icona e una parola, il nome lungo nel tooltip). Le scelte si sommano e il modello le mescola.
// «Estrai» è la tessera grande in cima; la categoria Stili ha gli scaffali dei 28 stili con l'intensità; il comando Camera resta in Prospettiva.
import { type JSX } from 'react'
import { usaStato } from '../../stato'
import { I } from '../../componenti/Icone'
import { Casella } from '../../componenti/Casella'
import { AvvisoLora } from '../../componenti/AvvisoLora'
import { ControlloCamera } from '../../componenti/Camera'
import { Pianeti, Tessera, Tessere } from '../../componenti/Tessere'
import { IntensitaStile, ScaffaliStili } from '../../componenti/ScaffaliStili'
import { FANTASIE } from '../../regista'
import { iconaRapida } from '../../iconeRapide'
import { frasiStileModifica, stileDa, type Intensita } from '../../stili'
import type { PropsScrivi } from './SchedaScrivi'

const ID_STILE = 'stile-'

export function SchedaIdee({ griglia, zona, categorie, cat, setCategoria, idee, setIdee, usaRapida, chiaveIdee, camera, cambiaCamera, loraCamera }: PropsScrivi): JSX.Element | null {
  const { modifica: m, setModifica } = usaStato()
  if (m.modo === 'espandi' || griglia) return null

  const stileAttivo = idee.find((r) => r.id.startsWith(ID_STILE))?.id.slice(ID_STILE.length) || ''
  /** quante idee attive ci sono in una categoria (la pallina luminosa sulla tessera) */
  const quante = (id: string): number => {
    if (id === 'stili') return idee.filter((r) => r.id.startsWith(ID_STILE)).length
    return idee.filter((r) => categorie.find((c) => c.id === id)?.voci.some((v) => v.id === r.id)).length
  }
  const scegliStile = (id: string): void => {
    const senza = idee.filter((r) => !r.id.startsWith(ID_STILE))
    const s = stileDa(id)
    setIdee(s ? [...senza, { id: ID_STILE + s.id, nome: s.nome, prompt: frasiStileModifica(s, m.intensitaStile) }] : senza)
  }
  const cambiaIntensita = (i: Intensita): void => {
    setModifica({ intensitaStile: i })
    setIdee(idee.map((r) => (r.id.startsWith(ID_STILE) ? { ...r, prompt: frasiStileModifica(stileDa(r.id.slice(ID_STILE.length))!, i) } : r)))
  }

  return (
    <div className="sezione">
      <h3>Idee <span className="dx">sommale: il modello le mescola</span></h3>
      <Tessere colonne={2} stile={{ marginBottom: 8 }}>
        <Tessera id="cat-estrai" icona={<I.estrai />} nome="Estrai" sotto="persone e oggetti, un clic" titolo="Estrai una persona o un oggetto dalla foto: un clic sulla cosa, poi scegli l'uscita" onClick={() => setModifica({ modo: 'estrai' })} />
        <Tessera id="cat-espandi" icona={<I.espandi />} nome="Espandi" sotto="allarga oltre i bordi" titolo="Allarga la foto oltre i bordi" onClick={() => setModifica({ modo: 'espandi' })} />
      </Tessere>
      <Tessere colonne={3}>
        {categorie.map((c) => {
          const Ic = (I as Record<string, () => JSX.Element>)[c.icona] || I.crea
          return <Tessera key={c.id} id={`cat-${c.id}`} icona={<Ic />} nome={c.nome} su={cat?.id === c.id} pallina={quante(c.id)} onClick={() => setCategoria(c.id)} />
        })}
      </Tessere>

      {cat && cat.id === 'prospettiva' && !zona && (
        <div style={{ marginTop: 12 }}>
          <ControlloCamera valore={camera} cambia={cambiaCamera} lora={loraCamera} />
          <AvvisoLora id="lora-camera" perche="Rifà la foto da un'altra posizione della camera, molto più fedele. Si accende da solo con il comando Camera." />
        </div>
      )}
      {cat && cat.id === 'vestiti' && <div style={{ marginTop: 10 }}><AvvisoLora id="lora-vestiti" perche="Tiene volto, pose e sfondo mentre cambia il vestito. Si accende da solo qui." /></div>}

      {cat && cat.id === 'stili' ? (
        <div style={{ marginTop: 12 }}>
          <ScaffaliStili valore={stileAttivo} scegli={scegliStile} />
          {stileAttivo && <IntensitaStile valore={m.intensitaStile} cambia={cambiaIntensita} />}
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <Tessere colonne={4}>
            {cat?.voci.map((r) => {
              const x = iconaRapida(r)
              return (
                <Tessera
                  key={r.id}
                  id={`idea-${r.id}`}
                  icona={<span aria-hidden>{x.icona}</span>}
                  nome={x.nome}
                  su={idee.some((y) => y.id === r.id)}
                  onClick={() => void usaRapida(r)}
                  titolo={`${r.nome.replace('…', '')}${r.rif ? ` · serve ${r.rifNome || 'una foto di riferimento'}` : ''} · un clic la accende, un altro la spegne`}
                />
              )
            })}
          </Tessere>
        </div>
      )}

      {idee.length > 0 && (
        <div className="idee-scelte">
          <div className="riga spazia">
            <b className="oro piccolo">{idee.length} {idee.length === 1 ? 'idea' : 'idee'}: {idee.map((r) => r.nome.replace('…', '')).join(' + ')}</b>
            <button className="btn piccolo fantasma icona" onClick={() => setIdee([])} title="Togli tutte"><I.cestino /></button>
          </div>
          <span className="piccolo tenue">Fantasia del modello</span>
          <Pianeti valore={m.fantasia} cambia={(fantasia) => setModifica({ fantasia })} voci={FANTASIE.map((f) => ({ id: f.id, nome: f.nome, titolo: f.sotto }))} />
          {m.pianoIdee && m.pianoIdee.chiave === chiaveIdee ? (
            <div style={{ marginTop: 8 }}>
              <div className="riga spazia"><span className="piccolo tenue">Il piano del modello (puoi correggerlo)</span><button className="btn piccolo fantasma" onClick={() => setModifica({ pianoIdee: null })} title="Al prossimo lavoro il modello rimescola le idee, con dettagli nuovi">Rifai</button></div>
              <Casella minimo={110} senzaCestino valore={m.pianoIdee.testo} cambia={(testo) => setModifica({ pianoIdee: { chiave: m.pianoIdee!.chiave, testo } })} />
            </div>
          ) : (
            <div className="piccolo spento" style={{ marginTop: 6 }}>Quando premi «Modifica» il modello guarda la foto, mescola le idee e inventa i dettagli. Qui vedrai cosa ha deciso.</div>
          )}
        </div>
      )}
      {cat && ['luce', 'ritocco', 'situazioni'].includes(cat.id) && <div style={{ marginTop: 10 }}><AvvisoLora id="lora-coerenza" perche="Le modifiche restano sul fotogramma: luce, colori e stili cambiano, i contorni no. Si accende da solo in queste azioni." /></div>}
    </div>
  )
}
