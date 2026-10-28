// «L'LLM legge il prompt»: un interruttore per modello (Klein di serie acceso, Qwen spento). Sta sotto la casella del prompt di Crea e di Modifica.
// Con lui acceso, prima di disegnare l'LLM (Qwen3-VL) guarda le foto e riscrive la richiesta in una descrizione completa in inglese: BFL dice di non
// usare Klein senza (con i prompt corti i cambi di persona non riescono), e anche con Qwen aiuta le modifiche difficili.
import type { JSX } from 'react'
import { potenziaPer } from '@shared/modelli'
import { api } from '../api'
import { ricaricaImp, usaStato } from '../stato'
import { Interruttore } from './Controlli'

export function InterruttoreLLM(): JSX.Element | null {
  const imp = usaStato((s) => s.imp)
  if (!imp) return null
  const fam = imp.famiglia
  const acceso = potenziaPer(imp, fam)
  const cambia = async (v: boolean): Promise<void> => {
    await api.impostazioni.salva(fam === 'qwen' ? { potenziaQwen: v } : { potenziaKlein: v })
    await ricaricaImp()
  }
  return (
    <div className="llm-int" data-llm={acceso ? 'si' : 'no'}>
      <Interruttore
        acceso={acceso}
        cambia={(v) => void cambia(v)}
        sotto={acceso ? (fam === 'qwen' ? "L'LLM guarda le foto e riscrive la richiesta (qualche secondo in più)" : "Klein rende molto meglio con descrizioni complete: lo fa l'LLM, guardando le foto") : 'Il modello riceve il tuo testo com\'è'}
        titolo="Prima di disegnare, l'LLM legge il prompt (e guarda le foto) e lo riscrive in una descrizione completa in inglese"
      >
        L&apos;LLM legge il prompt
      </Interruttore>
    </div>
  )
}
