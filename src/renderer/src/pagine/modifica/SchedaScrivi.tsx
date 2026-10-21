// Modifica, scheda Scrivi: il prompt, Migliora, i segnaposto delle foto e le Idee (azioni rapide che si sommano).
// Se sulla tela c'è una zona disegnata il lavoro vale solo per la zona, se no per tutta la foto (lo decide Modifica.tsx).
import { type JSX, type RefObject } from 'react'
import { usaStato, type FotoBase } from '../../stato'
import { I } from '../../componenti/Icone'
import { Casella } from '../../componenti/Casella'
import { Segmenti } from '../../componenti/Controlli'
import { AvvisoLora } from '../../componenti/AvvisoLora'
import { ControlloCamera, type PosizioneCamera } from '../../componenti/Camera'
import { FANTASIE } from '../../regista'
import type { Rapida, CategoriaRapide } from '../../rapide'

export interface PropsScrivi {
  prompt: RefObject<HTMLTextAreaElement | null>
  base: FotoBase | null
  griglia: boolean
  haMaschera: boolean
  /** in Scrivi con una zona disegnata */
  zona: boolean
  scrivendo: boolean
  migliora: () => Promise<void>
  setCameraRapida: (r: Rapida | null) => void
  inserisci: (testo: string) => void
  mancaRif: boolean
  rapida: Rapida | null | undefined
  categorie: CategoriaRapide[]
  cat: CategoriaRapide | undefined
  setCategoria: (id: string) => void
  idee: Rapida[]
  setIdee: (i: Rapida[]) => void
  usaRapida: (r: Rapida) => Promise<void>
  chiaveIdee: string
  camera: PosizioneCamera
  cambiaCamera: (c: PosizioneCamera) => void
  loraCamera: boolean
}

/** La scheda Scrivi: testo, Idee e (con una zona) la nota su cosa succede */
export function SchedaScrivi(p: PropsScrivi): JSX.Element {
  return (
    <>
      <SchedaTesto {...p} />
      <SchedaIdee {...p} />
      {p.zona && (
        <div className="sezione">
          <div className="nota-zona">
            <I.occhio /> Il modello guarda <b>tutta la foto</b> con la tua zona evidenziata e cambia <b>solo lì</b>: fuori dalla zona la foto resta identica al pixel.
            Per togliere qualcosa scrivi "rimuovi…": la zona si ripulisce da sola prima di ridisegnarla.
          </div>
        </div>
      )}
    </>
  )
}


/** «Cosa cambiare»: la casella del prompt, Migliora e i segnaposto delle foto */
function SchedaTesto({ prompt, base, griglia, zona, scrivendo, migliora, setCameraRapida, inserisci, mancaRif, rapida }: PropsScrivi): JSX.Element {
  const { modifica: m, setModifica } = usaStato()
  const fusion = m.modo === 'fusion'
  const esempioMode = m.modo === 'esempio'
  return (
    <div className="sezione">
      <h3>
        {fusion ? 'Cosa creare con le foto' : esempioMode ? 'Cosa vuoi (facoltativo)' : m.modo === 'espandi' ? 'Cosa c\'è fuori (facoltativo)' : zona ? 'Cosa fare nella zona' : 'Cosa cambiare'}
        {m.modo === 'scrivi' && <span className="dx">{zona ? <span className="oro">solo la zona segnata ✓</span> : 'tutta la foto · o segna una zona'}</span>}
      </h3>
      <Casella
        inputRef={prompt}
        valore={m.prompt}
        cambia={(v) => {
          setModifica({ prompt: v })
          if (!v.trim()) setCameraRapida(null)
        }}
        placeholder={esempioMode ? 'Facoltativo, es. "sostituisci le iridi con quelle delle mie foto". Se lasci vuoto il modello capisce da solo cosa fare' : fusion ? 'es. "la ragazza di <image1> con la giacca di <image2> in una strada di Tokyo di notte"' : zona ? 'es. "una camicia di lino bianca" o "rimuovi la persona"' : m.modo === 'espandi' ? 'es. "una spiaggia al tramonto"' : 'es. "fallo di notte con la neve", "metti la maglia di <image2>"'}
        minimo={96}
        disabled={scrivendo}
      />
      <div className="riga a-capo" style={{ marginTop: 8 }}>
        <button className="btn piccolo" onClick={migliora} disabled={(!base && !griglia) || (fusion && !m.riferimenti.length) || (esempioMode && !m.esempio) || scrivendo || !m.prompt.trim()} title="Il modello guarda la foto e rende l'istruzione precisa (in inglese)">
          <I.bacchetta /> {scrivendo ? 'Scrivo…' : 'Migliora'}
        </button>
        {!fusion && (esempioMode ? m.esempio : base) && (
          <button className="chip principale" onClick={() => inserisci('<image1>')} title={esempioMode ? 'Mette l\'esempio nel testo' : 'Mette la foto principale (quella che modifichi) nel testo'}>
            &lt;image1&gt; · {esempioMode ? 'esempio' : 'principale'}
          </button>
        )}
        {m.riferimenti.map((_, i) => (
          <button key={i} className="chip" onClick={() => inserisci(`<image${i + (fusion ? 1 : 2)}>`)} title="Inserisci il riferimento nel testo">&lt;image{i + (fusion ? 1 : 2)}&gt;</button>
        ))}
      </div>
      {mancaRif && !griglia && (
        <div className="avviso-box" style={{ marginTop: 10, padding: '8px 10px', fontSize: 13.5 }}>
          Serve {rapida?.rifNome || 'una foto di riferimento'}: aggiungila qui sotto in <b>Riferimenti</b> (nel testo è <b>&lt;image2&gt;</b>).
        </div>
      )}
    </div>
  )
}

/** Idee (le azioni rapide, che si sommano), il comando Camera e il piano delle idee */
function SchedaIdee({ griglia, zona, categorie, cat, setCategoria, idee, setIdee, usaRapida, chiaveIdee, camera, cambiaCamera, loraCamera }: PropsScrivi): JSX.Element | null {
  const { modifica: m, setModifica } = usaStato()
  if (m.modo === 'espandi' || griglia) return null
  return (
    <div className="sezione">
      <h3>Idee <span className="dx">sommale: il modello le mescola</span></h3>
      <div className="cat-rapide">
        {categorie.map((c) => {
          const Ic = (I as Record<string, () => JSX.Element>)[c.icona] || I.crea
          return (
            <button key={c.id} className={cat?.id === c.id ? 'su' : ''} onClick={() => setCategoria(c.id)}>
              <Ic />
              {c.nome}
            </button>
          )
        })}
      </div>
      {cat && cat.id === 'prospettiva' && !zona && (
        <div style={{ marginTop: 12 }}>
          <ControlloCamera valore={camera} cambia={cambiaCamera} lora={loraCamera} />
          <AvvisoLora id="lora-camera" perche="Rifà la foto da un'altra posizione della camera, molto più fedele. Si accende da solo con il comando Camera." />
        </div>
      )}
      {cat && cat.id === 'vestiti' && <div style={{ marginTop: 10 }}><AvvisoLora id="lora-vestiti" perche="Tiene volto, pose e sfondo mentre cambia il vestito. Si accende da solo qui." /></div>}
      <div className="riga a-capo" style={{ marginTop: 10, gap: 6 }}>
        {cat?.voci.map((r) => (
          <button key={r.id} className={`chip ${idee.some((x) => x.id === r.id) ? 'su' : ''}`} onClick={() => void usaRapida(r)} title={r.rif ? `Serve ${r.rifNome || 'una foto di riferimento'}` : 'Un clic la accende, un altro la spegne: puoi sommarne quante vuoi'}>
            {r.rif ? '＋ ' : ''}{r.nome}
          </button>
        ))}
      </div>
      {idee.length > 0 && (
        <div className="idee-scelte">
          <div className="riga spazia">
            <b className="oro piccolo">{idee.length} {idee.length === 1 ? 'idea' : 'idee'}: {idee.map((r) => r.nome.replace('…', '')).join(' + ')}</b>
            <button className="btn piccolo fantasma" onClick={() => setIdee([])}>Togli tutte</button>
          </div>
          <span className="piccolo tenue">Fantasia del modello</span>
          <Segmenti valore={m.fantasia} cambia={(fantasia) => setModifica({ fantasia })} voci={FANTASIE.map((f) => ({ id: f.id, nome: f.nome, sotto: f.sotto }))} />
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
