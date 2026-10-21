// Modifica, la colonna a destra: le schede (cosa cambiare, esempio, idee, espandi, riferimenti, dimensioni, qualità, LoRA) e il pulsante.
// Lo stato vive in Modifica.tsx: qui si disegna e basta.
import { type JSX, type RefObject } from 'react'
import { usaStato, type FotoBase } from '../../stato'
import { urlFile } from '../../api'
import { I } from '../../componenti/Icone'
import { Casella } from '../../componenti/Casella'
import { ScegliModello } from '../../componenti/ScegliModello'
import { Contatore, Cursore, Segmenti } from '../../componenti/Controlli'
import { SceltaLora } from '../../componenti/SceltaLora'
import { AvvisoLora } from '../../componenti/AvvisoLora'
import { Riferimenti } from '../../componenti/Riferimenti'
import { SceltaMisura, ScegliMp, MISURA0, dimMp } from '../../componenti/Misura'
import { ControlloCamera, type PosizioneCamera } from '../../componenti/Camera'
import { FANTASIE } from '../../regista'
import { FORMATI_FUSION, chiaveEsempio } from '../../fusion'
import { durata } from '../../util'
import type { Rapida, CategoriaRapide } from '../../rapide'
import type { Bordi } from '@shared/tipi'

export const NIENTE: Bordi = { sinistra: 0, sopra: 0, destra: 0, sotto: 0 }

interface Props {
  prompt: RefObject<HTMLTextAreaElement | null>
  base: FotoBase | null
  griglia: boolean
  haMaschera: boolean
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
  espandiPreset: (tipo: 'tutto' | 'largo' | 'alto' | 'quadrato') => void
  comeBase: (i: number) => void
  passi: number
  stima: number
  dimOut: { w: number; h: number } | null
  manda: () => Promise<void>
}

export function SchedeModifica(p: Props): JSX.Element {
  const { modifica: m, setModifica, imp } = usaStato()
  const fusion = m.modo === 'fusion'
  const esempioMode = m.modo === 'esempio'
  const { base, griglia, passi, stima, dimOut, manda } = p

  return (
    <div className="colonna destra">
      <div className="scorri">
        <div className="sezione"><ScegliModello /></div>
        <SchedaTesto {...p} />
        <SchedaEsempio />
        <SchedaIdee {...p} />
        <SchedaEspandi espandiPreset={p.espandiPreset} />

        {!griglia && <div className="sezione">
          <Riferimenti
            lista={m.riferimenti}
            cambia={(riferimenti) => setModifica({ riferimenti })}
            inizio={2}
            inserisci={p.inserisci}
            principale={base?.percorso}
            comeBase={p.comeBase}
            titolo="Riferimenti"
            esempio={'Es. "metti a <image1> la giacca di <image2>". Persone, vestiti, oggetti, stili: fino a 9 foto in più (dalla galleria, dal PC o incollate con Ctrl+V).'}
          />
        </div>}

        {m.modo === 'zona' && (
          <div className="sezione">
            <div className="nota-zona">
              <I.occhio /> Il modello guarda <b>tutta la foto</b> con la tua zona evidenziata e cambia <b>solo lì</b>: fuori dalla zona la foto resta identica al pixel.
              Per togliere qualcosa scrivi "rimuovi…": la zona si ripulisce da sola prima di ridisegnarla.
            </div>
          </div>
        )}

        <SchedaDimensioni base={base} />
        <SchedaQualita passi={passi} stima={stima} />

        {(imp?.famiglia || 'qwen') === 'qwen' && (
          <div className="sezione">
            <h3>LoRA</h3>
            <SceltaLora />
          </div>
        )}
      </div>
      <div className="sezione" style={{ borderTop: '1px solid #1d1636' }}>
        <button className="btn primario grande" style={{ width: '100%' }} onClick={manda} disabled={fusion ? !m.riferimenti.length : esempioMode ? !m.esempio || !m.riferimenti.length : !base}>
          {m.modo === 'zona' ? <I.zona /> : m.modo === 'espandi' ? <I.espandi /> : griglia ? <I.crea /> : <I.modifica />}
          {m.modo === 'zona' ? 'Cambia la zona' : m.modo === 'espandi' ? 'Espandi' : fusion ? 'Fusion · crea la foto nuova' : esempioMode ? 'Crea come l\'esempio' : 'Modifica'}
        </button>
        <div className="piccolo spento" style={{ textAlign: 'center', marginTop: 6 }}>{dimOut ? `${dimOut.w} × ${dimOut.h} px · ` : ''}Ctrl+Invio · ~{durata(stima)}</div>
      </div>
    </div>
  )
}

/** «Cosa cambiare»: la casella del prompt, Migliora e i segnaposto delle foto */
function SchedaTesto({ prompt, base, griglia, haMaschera, scrivendo, migliora, setCameraRapida, inserisci, mancaRif, rapida }: Props): JSX.Element {
  const { modifica: m, setModifica } = usaStato()
  const fusion = m.modo === 'fusion'
  const esempioMode = m.modo === 'esempio'
  return (
    <div className="sezione">
      <h3>
        {fusion ? 'Cosa creare con le foto' : esempioMode ? 'Cosa vuoi (facoltativo)' : m.modo === 'espandi' ? 'Cosa c\'è fuori (facoltativo)' : m.modo === 'zona' ? 'Cosa fare nella zona' : 'Cosa cambiare'}
        {m.modo === 'zona' && <span className="dx">{haMaschera ? <span className="oro">zona segnata ✓</span> : 'segnala col pennello'}</span>}
      </h3>
      <Casella
        inputRef={prompt}
        valore={m.prompt}
        cambia={(v) => {
          setModifica({ prompt: v })
          if (!v.trim()) setCameraRapida(null)
        }}
        placeholder={esempioMode ? 'Facoltativo, es. "sostituisci le iridi con quelle delle mie foto". Se lasci vuoto il modello capisce da solo cosa fare' : fusion ? 'es. "la ragazza di <image1> con la giacca di <image2> in una strada di Tokyo di notte"' : m.modo === 'zona' ? 'es. "una camicia di lino bianca" o "rimuovi la persona"' : m.modo === 'espandi' ? 'es. "una spiaggia al tramonto"' : 'es. "fallo di notte con la neve", "metti la maglia di <image2>"'}
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

/** Esempio: «Il piano del modello» */
function SchedaEsempio(): JSX.Element | null {
  const { modifica: m, setModifica } = usaStato()
  if (m.modo !== 'esempio') return null
  return (
    <>
      <div className="sezione">
        <h3>Il piano del modello {m.pianoEsempio && <button className="btn piccolo fantasma" style={{ marginLeft: 'auto' }} onClick={() => setModifica({ pianoEsempio: null })} title="Al prossimo lavoro il modello guarda di nuovo le foto e rifà il piano">Rifai</button>}</h3>
        {m.pianoEsempio && m.pianoEsempio.chiave === chiaveEsempio(m) ? (
          <>
            <Casella valore={m.pianoEsempio.testo} minimo={120} senzaCestino cambia={(testo) => setModifica({ pianoEsempio: { ...m.pianoEsempio!, testo } })} />
            {m.pianoEsempio.ritagli?.some(Boolean) && (
              <div style={{ marginTop: 8 }}>
                <span className="piccolo tenue">Le parti delle tue foto che contano (ritagliate dal modello)</span>
                <div className="riga a-capo" style={{ gap: 6, marginTop: 4 }}>
                  {m.pianoEsempio.ritagli.map((r, i) => r && <img key={i} src={urlFile(r)} alt="" style={{ height: 56, borderRadius: 6, border: '1px solid var(--bordo2)' }} title={`<image${i + 2}>`} />)}
                </div>
              </div>
            )}
            <div className="piccolo spento" style={{ marginTop: 4 }}>L'ha scritto il modello guardando le foto: puoi correggerlo. Si usa così com'è finché non cambi le foto o le note.</div>
          </>
        ) : (
          <div className="piccolo spento">Quando premi il pulsante il modello guarda l'esempio e le tue foto insieme e decide da solo cosa sostituire con cosa, e cosa lasciare com'è. Qui vedrai cosa ha deciso, e potrai correggerlo.</div>
        )}
      </div>
    </>
  )
}

/** Idee (le azioni rapide, che si sommano), il comando Camera e il piano delle idee */
function SchedaIdee({ griglia, categorie, cat, setCategoria, idee, setIdee, usaRapida, chiaveIdee, camera, cambiaCamera, loraCamera }: Props): JSX.Element | null {
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
      {cat && cat.id === 'prospettiva' && m.modo === 'tutta' && (
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

/** Espandi: di quanto allargare la foto */
function SchedaEspandi({ espandiPreset }: Pick<Props, 'espandiPreset'>): JSX.Element | null {
  const { modifica: m, setModifica } = usaStato()
  const base = m.base
  if (m.modo !== 'espandi' || !base) return null
  return (
    <div className="sezione">
      <h3>Di quanto allargare <span className="dx">{base.larghezza + m.bordi.sinistra + m.bordi.destra} × {base.altezza + m.bordi.sopra + m.bordi.sotto}</span></h3>
      <div className="riga a-capo" style={{ gap: 6, marginBottom: 10 }}>
        <button className="chip" onClick={() => espandiPreset('tutto')}>+25% ovunque</button>
        <button className="chip" onClick={() => espandiPreset('largo')}>Larga 16:9</button>
        <button className="chip" onClick={() => espandiPreset('alto')}>Alta 9:16</button>
        <button className="chip" onClick={() => espandiPreset('quadrato')}>Quadrata</button>
        <button className="chip" onClick={() => setModifica({ bordi: { ...NIENTE } })}>Azzera</button>
      </div>
      {(['sinistra', 'destra', 'sopra', 'sotto'] as const).map((k) => (
        <Cursore key={k} etichetta={k[0].toUpperCase() + k.slice(1)} valore={m.bordi[k]} min={0} max={Math.round(Math.max(base.larghezza, base.altezza) * 0.75 / 32) * 32} passo={32} formato={(v) => `${v}px`} cambia={(v) => setModifica({ bordi: { ...m.bordi, [k]: v } })} />
      ))}
    </div>
  )
}

/** Dimensioni della foto che esce: per Fusion (foto nuova) o per gli altri modi */
function SchedaDimensioni({ base }: { base: FotoBase | null }): JSX.Element {
  const { modifica: m, setModifica } = usaStato()
  const fusion = m.modo === 'fusion'
  const esempioMode = m.modo === 'esempio'
  return (
    <>
      {fusion && (() => {
        const mis = m.misura && m.misura.tipo !== 'originale' ? m.misura : MISURA0
        const prima = m.riferimenti[0] ? { larghezza: m.riferimenti[0].larghezza, altezza: m.riferimenti[0].altezza } : null
        return (
          <div className="sezione">
            <h3>Dimensioni della foto nuova <span className="dx">{mis.tipo === 'custom' ? `${mis.w} × ${mis.h}` : 'automatiche'}</span></h3>
            <SceltaMisura valore={mis} cambia={(misura) => setModifica({ misura })} base={prima} mp={m.mp} ammetti={['auto', 'custom']} cambiaMp={(mp) => setModifica({ mp })} auto={(() => {
              const [a, b] = FORMATI_FUSION.find((f) => f.id === (m.formatoFusion || 'prima'))?.r || (prima ? [prima.larghezza, prima.altezza] : [1, 1])
              return dimMp(m.mp, a, b)
            })()} />
            {mis.tipo === 'auto' && (
              <div style={{ marginTop: 10 }}>
                <span className="piccolo tenue">Proporzioni</span>
                <Segmenti valore={m.formatoFusion || 'prima'} cambia={(formatoFusion) => setModifica({ formatoFusion })} voci={FORMATI_FUSION.map((f) => ({ id: f.id, nome: f.nome }))} />
              </div>
            )}

          </div>
        )
      })()}

      {m.modo !== 'espandi' && !fusion && (
        <div className="sezione">
          <h3>Dimensioni <span className="dx">{(m.misura ?? MISURA0).tipo === 'auto' ? 'come i megapixel' : (m.misura ?? MISURA0).tipo === 'originale' ? 'come la foto' : 'misura mia'}</span></h3>
          <SceltaMisura valore={m.misura ?? MISURA0} cambia={(misura) => setModifica({ misura })} base={esempioMode ? m.esempio : base} mp={m.mp} cambiaMp={(mp) => setModifica({ mp })}
            senzaPx={m.modo === 'zona'} auto={m.modo === 'zona' && base ? { w: base.larghezza, h: base.altezza, nota: 'resta com\'è, cambia solo la zona' } : undefined} />
        </div>
      )}
    </>
  )
}

/** Passi del modello, quante versioni e (in Espandi) i megapixel */
function SchedaQualita({ passi, stima }: { passi: number; stima: number }): JSX.Element {
  const { modifica: m, setModifica } = usaStato()
  return (
    <div className="sezione">
      <h3>Versioni <span className="dx">{passi} passi · ~{durata(stima)}</span></h3>
      <div className="riga spazia">
        <span className="tenue">Quante versioni</span>
        <Contatore valore={m.quante} min={1} max={8} cambia={(quante) => setModifica({ quante })} />
      </div>
      {m.modo === 'espandi' && (
        <div style={{ marginTop: 12 }}>
          <span className="piccolo tenue">Megapixel a cui lavora il modello</span>
          <ScegliMp mp={m.mp} cambia={(mp) => setModifica({ mp })} />
        </div>
      )}
    </div>
  )
}
