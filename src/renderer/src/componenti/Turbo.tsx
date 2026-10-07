// Il Turbo: un LoRA di distillazione (Turbo8) che fa le immagini in 8 passi invece di 40.
// Qui c'è lo scaricamento con un clic (una volta sola, ~1,4 GB) e il riquadro che lo propone.
import type { JSX } from 'react'
import { create } from 'zustand'
import { api } from '../api'
import { ricaricaLore, usaStato } from '../stato'
import { turboPresente } from '../azioni'
import { I } from './Icone'
import type { Download } from '@shared/tipi'

const usaDl = create<{ dl: Download | null }>(() => ({ dl: null }))
let collegato = false

export async function scaricaTurbo(): Promise<void> {
  if (usaDl.getState().dl?.stato === 'in corso') return
  if (!collegato) {
    collegato = true
    api.su.download((d) => {
      if (/turbo/i.test(d.nome)) usaDl.setState({ dl: { ...d } })
    })
  }
  usaDl.setState({ dl: { id: '', nome: 'Turbo', ricevuti: 0, totali: 0, velocita: 0, stato: 'in corso' } })
  const d = await api.modelli.scarica('lora-turbo')
  usaDl.setState({ dl: d })
  if (d.stato === 'fatto') {
    await ricaricaLore()
    usaStato.getState().avvisa('Turbo pronto: ora le immagini escono in 8 passi', 'ok')
  } else if (d.stato === 'errore') usaStato.getState().avvisa(d.errore || 'Download non riuscito', 'errore')
}

export function useTurbo(): { presente: boolean; dl: Download | null } {
  usaStato((s) => s.lore)
  const dl = usaDl((s) => s.dl)
  return { presente: turboPresente(), dl }
}

/** il riquadro che compare quando si sceglie Turbo ma il LoRA non c'è ancora */
export function AvvisoTurbo(): JSX.Element | null {
  const { presente, dl } = useTurbo()
  if (presente) return null
  const va = dl?.stato === 'in corso' || dl?.stato === 'verifica'
  const perc = dl?.totali ? Math.round((dl.ricevuti / dl.totali) * 100) : 0
  return (
    <div className="turbo-box">
      <div className="riga" style={{ alignItems: 'flex-start' }}>
        <span className="turbo-ic"><I.fulmine /></span>
        <div className="flex1">
          <b>Turbo: 8 passi invece di 40</b>
          <div className="piccolo tenue">Circa 5 volte più veloce, anche su 6 GB. Serve un LoRA da ~1,4 GB (Turbo8, si scarica una volta sola).</div>
        </div>
      </div>
      {va ? (
        <>
          <div className="barra-progresso" style={{ marginTop: 8 }}><i style={{ width: `${perc}%` }} /></div>
          <div className="riga spazia piccolo tenue" style={{ marginTop: 4 }}>
            <span>{perc}% · {((dl?.velocita || 0) / 1e6).toFixed(1)} MB/s</span>
            {dl?.id && <button className="btn piccolo fantasma" onClick={() => api.modelli.annulla(dl.id)}>Annulla</button>}
          </div>
        </>
      ) : (
        <button className="btn piccolo primario" style={{ marginTop: 8 }} onClick={() => void scaricaTurbo()}>
          <I.scarica /> Scarica il Turbo
        </button>
      )}
    </div>
  )
}
