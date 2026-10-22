// Studio: Crea, Modifica, Box e Ricette sullo stesso palco. Qui c'è la strip dei modi (in cima) e il pezzo che la lega al resto:
// i modi non sono pagine nuove, sono le pagine di sempre (Crea, Modifica, Box) che restano montate, così la maschera disegnata,
// il prompt e i riquadri non si perdono passando da un modo all'altro.
import type { JSX } from 'react'
import { usaStato, type Pagina } from '../stato'
import { MODELLI, modelloDaImpostazioni } from '@shared/modelli'
import { I } from '../componenti/Icone'

export type ModoStudio = 'crea' | 'modifica' | 'box' | 'ricette'

export const PAGINE_STUDIO: Pagina[] = ['crea', 'modifica', 'box']

/** in quale modo dello Studio siamo (Ricette è Modifica col catalogo aperto) */
export function modoStudio(): ModoStudio | null {
  const s = usaStato.getState()
  if (s.pagina === 'crea' || s.pagina === 'box') return s.pagina
  if (s.pagina === 'modifica') return s.modifica.modo === 'ricette' ? 'ricette' : 'modifica'
  return null
}

/** apre un modo dello Studio */
export function vaiModo(modo: ModoStudio): void {
  const s = usaStato.getState()
  if (modo === 'ricette') {
    s.setModifica({ modo: 'ricette' })
    s.vai('modifica')
    return
  }
  if (modo === 'modifica' && s.modifica.modo === 'ricette') s.setModifica({ modo: 'scrivi' })
  s.vai(modo)
}

const MODI: { id: ModoStudio; nome: string; icona: () => JSX.Element; titolo: string; tasto: string }[] = [
  { id: 'crea', nome: 'Crea', icona: I.crea, titolo: 'Dal testo all\'immagine (1)', tasto: '1' },
  { id: 'modifica', nome: 'Modifica', icona: I.modifica, titolo: 'Cambia una foto: tutta, una zona, espandila o estrai (2)', tasto: '2' },
  { id: 'box', nome: 'Box', icona: I.box, titolo: 'Disegna dei riquadri e di\' cosa ci va in ognuno (3)', tasto: '3' },
  { id: 'ricette', nome: 'Ricette', icona: I.ricette, titolo: 'Cose già pronte in più passi, anche su più foto (4)', tasto: '4' }
]

export function StripModi(): JSX.Element {
  const pagina = usaStato((s) => s.pagina)
  const modo = usaStato((s) => s.modifica.modo)
  const imp = usaStato((s) => s.imp)
  const nLora = usaStato((s) => s.loraAttive.length)
  const vai = usaStato((s) => s.vai)
  const attivo: ModoStudio = pagina === 'modifica' ? (modo === 'ricette' ? 'ricette' : 'modifica') : pagina === 'box' ? 'box' : 'crea'
  const m = MODELLI[modelloDaImpostazioni(imp)]
  return (
    <div className="strip-modi" role="tablist" aria-label="Modi dello Studio">
      {MODI.map((x) => (
        <button key={x.id} type="button" role="tab" aria-selected={attivo === x.id} className={`modo ${attivo === x.id ? 'su' : ''}`} onClick={() => vaiModo(x.id)} title={x.titolo} data-modo={x.id}>
          <x.icona /> {x.nome}
        </button>
      ))}
      <span className="spazio" />
      <span className="pillola-motore" title="Il modello che disegna: si sceglie nel pannello a destra, in «Motore»">
        <I.chip /> Motore <b>{m.nome}</b>
      </span>
      {(imp?.famiglia || 'qwen') === 'qwen' && (
        <button type="button" className="pillola-motore" onClick={() => vai('lora')} title="La pila dei LoRA accesi: forza, ordine, parole chiave">
          <I.pila /> LoRA <b>{nLora}</b>
        </button>
      )}
    </div>
  )
}
