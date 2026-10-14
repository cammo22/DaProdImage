// Fusion: più foto che sono tutte riferimenti (persone, vestiti, oggetti, luoghi, stili) e un prompt: il modello le guarda
// insieme e ne disegna una immagine nuova. Qui si vedono le foto (<image1>, <image2>…) e, sotto, quello che esce.
import { useEffect, useState, type JSX } from 'react'
import { urlFile } from '../api'
import { I } from './Icone'
import { VistaZoom } from './VistaZoom'
import { percentuale } from './Coda'
import type { FotoBase } from '../stato'
import type { Lavoro, Opera } from '@shared/tipi'

export const MAX_FUSION = 9

export function Fusion(p: {
  foto: FotoBase[]
  cambia: (l: FotoBase[]) => void
  inserisci: (tag: string) => void
  risultati: Opera[]
  inCorso?: Lavoro
  inAttesa: number
  daGalleria: () => void
  daPc: () => void
  /** un risultato torna fra le foto (per fonderlo ancora) */
  riusa: (o: Opera) => void
  apriInModifica: (o: Opera) => void
  mostra: (o: Opera) => void
}): JSX.Element {
  const [sel, setSel] = useState<string | null>(null)
  // l'ultimo risultato arrivato si guarda subito
  useEffect(() => {
    if (p.risultati[0]) setSel(p.risultati[0].id)
  }, [p.risultati[0]?.id])
  const vedo = p.risultati.find((o) => o.id === sel)
  const vivo = p.inCorso?.anteprima
  const sposta = (i: number, d: number): void => {
    const l = [...p.foto]
    const j = i + d
    if (j < 0 || j >= l.length) return
    ;[l[i], l[j]] = [l[j], l[i]]
    p.cambia(l)
  }

  return (
    <div className="fusion">
      <div className="fusion-foto">
        <div className="fusion-testa">
          <b>LE TUE FOTO</b>
          <span className="piccolo tenue">{p.foto.length}/{MAX_FUSION} · sono tutte riferimenti: nel testo <b>&lt;image1&gt;</b>, <b>&lt;image2&gt;</b>…</span>
          <span className="flex1" />
          {p.foto.length > 0 && <button className="btn piccolo fantasma pericolo" onClick={() => p.cambia([])}><I.x /> Svuota</button>}
        </div>
        {p.foto.length === 0 ? (
          <div className="vuoto fusion-vuoto">
            <div className="grosso">FUSION</div>
            <p>Metti qui <b className="oro">più foto</b>: persone, vestiti, oggetti, luoghi, stili. Tutte sono riferimenti: il modello le guarda insieme e crea <b>una foto nuova</b> in base a quello che scrivi.</p>
            <p className="piccolo">Trascinale qui (anche tante insieme), incollale con <kbd>Ctrl</kbd>+<kbd>V</kbd>, o scegli.</p>
            <div className="riga" style={{ justifyContent: 'center', marginTop: 12 }}>
              <button className="btn primario" onClick={p.daGalleria}><I.galleria /> Dalla galleria</button>
              <button className="btn" onClick={p.daPc}><I.immagine /> Dal PC</button>
            </div>
          </div>
        ) : (
          <div className="fusion-griglia">
            {p.foto.map((f, i) => (
              <div className="fusion-tessera" key={f.percorso + i}>
                <img src={urlFile(f.percorso)} alt="" />
                <button className="tag" onClick={() => p.inserisci(`<image${i + 1}>`)} title="Mette questa foto nel testo">&lt;image{i + 1}&gt;</button>
                <div className="az">
                  <button disabled={i === 0} onClick={() => sposta(i, -1)} title="Una posizione prima">◂</button>
                  <button disabled={i === p.foto.length - 1} onClick={() => sposta(i, 1)} title="Una posizione dopo">▸</button>
                  <button onClick={() => p.cambia(p.foto.filter((_, j) => j !== i))} title="Togli"><I.x /></button>
                </div>
              </div>
            ))}
            {p.foto.length < MAX_FUSION && (
              <div className="fusion-tessera aggiungi">
                <button onClick={p.daGalleria}><I.galleria /> Galleria</button>
                <button onClick={p.daPc}><I.immagine /> Dal PC</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fusion-ris">
        <div className="fusion-testa">
          <b>RISULTATI</b>
          {p.inAttesa > 0 && <span className="piccolo oro">{p.inCorso ? `si sta creando${percentuale(p.inCorso) !== null ? ` · ${percentuale(p.inCorso)}%` : ''}` : 'in coda'}{p.inAttesa > 1 ? ` · +${p.inAttesa - 1}` : ''}</span>}
        </div>
        {!p.risultati.length && !p.inAttesa ? (
          <div className="spento piccolo" style={{ padding: '10px 16px' }}>Scrivi cosa vuoi a destra e premi <b>Fusion</b>: la foto nuova compare qui e finisce anche in Galleria.</div>
        ) : (
          <div className="fusion-ris-corpo">
            <div className="fusion-grande">
              {vedo && !vivo ? <VistaZoom src={urlFile(vedo.file)} scacchi={vedo.trasparente} /> : vivo ? <img className="vivo" src={vivo} alt="" /> : <div className="attesa-grande" style={{ width: '60%', height: '60%' }} />}
            </div>
            <div className="fusion-strip">
              {p.risultati.map((o) => (
                <div key={o.id} className={`mini ${sel === o.id && !vivo ? 'su' : ''}`} style={{ ['--ar' as string]: `${o.larghezza} / ${o.altezza}` }} onClick={() => setSel(o.id)}>
                  <img src={urlFile(o.miniatura || o.file)} alt="" />
                </div>
              ))}
            </div>
            {vedo && !vivo && (
              <div className="riga a-capo fusion-azioni">
                <button className="btn piccolo" onClick={() => p.riusa(vedo)} title="La rimette fra le foto: puoi fonderla ancora con altre"><I.piu /> Fra le foto</button>
                <button className="btn piccolo" onClick={() => p.apriInModifica(vedo)}><I.modifica /> Modifica</button>
                <button className="btn piccolo" onClick={() => p.mostra(vedo)}><I.cartella /> Mostra</button>
                <span className="piccolo spento">{vedo.larghezza}×{vedo.altezza} · seed {vedo.seed}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
