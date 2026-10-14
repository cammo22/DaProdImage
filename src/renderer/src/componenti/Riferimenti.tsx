// Le foto di riferimento: persone, vestiti, oggetti, stili. Nel testo si chiamano <image1>, <image2>…
// (in Modifica la foto che modifichi è <image1>, quindi i riferimenti cominciano da <image2>).
import type { JSX } from 'react'
import { api, urlFile } from '../api'
import { I } from './Icone'
import { scegliFoto, type FotoBase } from '../stato'
import { normalizza } from '../util'

export function Riferimenti(p: {
  lista: FotoBase[]
  cambia: (l: FotoBase[]) => void
  /** il numero del primo riferimento nel testo: 1 in Crea, 2 in Modifica */
  inizio: number
  inserisci: (tag: string) => void
  max?: number
  esempio: string
  /** il pulsante "usa come base": la foto numero i diventa la foto principale (e la base di prima passa qui) */
  comeBase?: (i: number) => void
  /** titolo della sezione */
  titolo?: string
  /** la foto principale (quella che modifichi): compare per prima, e un clic la mette nel testo come <image1> */
  principale?: string
}): JSX.Element {
  const max = p.max ?? 9
  const tag = (i: number): string => `<image${i + p.inizio}>`
  const aggiungi = async (): Promise<void> => {
    const nuove = await scegliFoto(true)
    if (nuove.length) p.cambia([...p.lista, ...nuove].slice(0, max))
  }
  return (
    <>
      <h3>{p.titolo || 'Riferimenti'} <span className="dx">{p.lista.length}/{max} · nel testo: {tag(0).replace('>', '')}&gt;…</span></h3>
      <div className="rif">
        {p.principale && (
          <div className="r principale">
            <img src={urlFile(p.principale)} alt="" />
            <span className="n" onClick={() => p.inserisci('<image1>')} title="Mette la foto principale nel testo">&lt;image1&gt;</span>
            <span className="et">principale</span>
          </div>
        )}
        {p.lista.map((r, i) => (
          <div className="r" key={r.percorso + i}>
            <img src={urlFile(r.percorso)} alt="" />
            <span className="n" onClick={() => p.inserisci(tag(i))} title="Mette il riferimento nel testo">&lt;image{i + p.inizio}&gt;</span>
            {p.comeBase && <button className="base" onClick={() => p.comeBase!(i)} title="Usa questa come foto principale (la base che viene modificata)">★ base</button>}
            <button className="x" onClick={() => p.cambia(p.lista.filter((_, j) => j !== i))} title="Togli"><I.x /></button>
          </div>
        ))}
        {p.lista.length < max && (
          <button
            className="aggiungi"
            onClick={aggiungi}
            title="Aggiungi foto di riferimento dalla galleria o dal PC (anche trascinate qui, o Ctrl+V)"
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault()
              e.stopPropagation()
              const fs = Array.from(e.dataTransfer.files).slice(0, max - p.lista.length)
              const n: FotoBase[] = []
              for (const f of fs) n.push(await normalizza(api.file.percorso(f)))
              if (n.length) p.cambia([...p.lista, ...n])
            }}
          >
            +
          </button>
        )}
      </div>
      {p.lista.length === 0 && <div className="piccolo spento" style={{ marginTop: 6 }}>{p.esempio}</div>}
    </>
  )
}
