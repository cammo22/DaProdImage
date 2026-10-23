// Modifica, la colonna a destra: le schede (Scrivi, Espandi, Fusion/Esempio), riferimenti, dimensioni, versioni, LoRA e il pulsante.
// Lo stato vive in Modifica.tsx: qui si disegna e basta.
import { type JSX } from 'react'
import { usaStato, type FotoBase } from '../../stato'
import { urlFile } from '../../api'
import { I } from '../../componenti/Icone'
import { Casella } from '../../componenti/Casella'
import { Contatore, Segmenti } from '../../componenti/Controlli'
import { SceltaLora } from '../../componenti/SceltaLora'
import { Riferimenti } from '../../componenti/Riferimenti'
import { SceltaMisura, ScegliMp, MISURA0, dimMp } from '../../componenti/Misura'
import { FORMATI_FUSION, chiaveEsempio } from '../../fusion'
import { durata } from '../../util'
import { usaSpeciale } from '../../workflow'
import { SchedaScrivi, type PropsScrivi } from './SchedaScrivi'
import { SchedaEspandi, type PresetEspandi } from './SchedaEspandi'

interface Props extends PropsScrivi {
  espandiPreset: (tipo: PresetEspandi) => void
  comeBase: (i: number) => void
  passi: number
  stima: number
  dimOut: { w: number; h: number } | null
  manda: () => Promise<void>
}

export function SchedeModifica(p: Props): JSX.Element {
  const { modifica: m, setModifica } = usaStato()
  const sp = usaSpeciale()
  const fusion = sp === 'unisci'
  const esempioMode = sp === 'esempio'
  const { base, griglia, passi, stima, dimOut, manda } = p

  return (
    <div className="colonna destra">
      <div className="scorri">
        <SchedaScrivi {...p} />
        <SchedaEsempio />
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

        <SchedaDimensioni base={base} zona={p.zona} />
        <SchedaQualita passi={passi} stima={stima} />

        <div className="sezione">
          <h3>LoRA</h3>
          <SceltaLora />
        </div>
      </div>
      <div className="sezione" style={{ borderTop: '1px solid #1d1636' }}>
        <button className="btn primario grande" style={{ width: '100%' }} onClick={manda} disabled={fusion ? !m.riferimenti.length : esempioMode ? !m.esempio || !m.riferimenti.length : !base}>
          {p.zona ? <I.zona /> : m.modo === 'espandi' ? <I.espandi /> : griglia ? <I.crea /> : <I.modifica />}
          {p.zona ? 'Cambia la zona' : m.modo === 'espandi' ? 'Espandi' : fusion ? 'Unisci · crea la foto nuova' : esempioMode ? 'Crea come l\'esempio' : 'Modifica'}
        </button>
        <div className="piccolo spento" style={{ textAlign: 'center', marginTop: 6 }}>{dimOut ? `${dimOut.w} × ${dimOut.h} px · ` : ''}Ctrl+Invio · ~{durata(stima)}</div>
      </div>
    </div>
  )
}

/** Esempio: «Il piano del modello» */
function SchedaEsempio(): JSX.Element | null {
  const { modifica: m, setModifica } = usaStato()
  if (usaSpeciale() !== 'esempio') return null
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

/** Dimensioni della foto che esce: per Fusion (foto nuova) o per gli altri modi */
function SchedaDimensioni({ base, zona }: { base: FotoBase | null; zona: boolean }): JSX.Element {
  const { modifica: m, setModifica } = usaStato()
  const sp = usaSpeciale()
  const fusion = sp === 'unisci'
  const esempioMode = sp === 'esempio'
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
            senzaPx={zona} auto={zona && base ? { w: base.larghezza, h: base.altezza, nota: 'resta com\'è, cambia solo la zona' } : undefined} />
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
