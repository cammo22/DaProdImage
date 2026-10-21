// Modifica, scheda Espandi: di quanto allargare la foto oltre i bordi (scorciatoie e quattro cursori).
import { type JSX } from 'react'
import { usaStato } from '../../stato'
import { Cursore } from '../../componenti/Controlli'
import type { Bordi } from '@shared/tipi'

export const NIENTE: Bordi = { sinistra: 0, sopra: 0, destra: 0, sotto: 0 }

export type PresetEspandi = 'tutto' | 'largo' | 'alto' | 'quadrato'

/** i bordi per una scorciatoia (multipli di 32) */
export function bordiPreset(tipo: PresetEspandi, W: number, H: number): Bordi {
  const t32 = (x: number): number => Math.round(x / 32) * 32
  if (tipo === 'tutto') {
    const d = t32(Math.min(W, H) * 0.25)
    return { sinistra: d, sopra: d, destra: d, sotto: d }
  }
  if (tipo === 'largo') {
    const d = t32((Math.max(W, Math.round((H * 16) / 9)) - W) / 2)
    return { sinistra: d, sopra: 0, destra: d, sotto: 0 }
  }
  if (tipo === 'alto') {
    const d = t32((Math.max(H, Math.round((W * 16) / 9)) - H) / 2)
    return { sinistra: 0, sopra: d, destra: 0, sotto: d }
  }
  const lato = Math.max(W, H)
  return { sinistra: t32((lato - W) / 2), destra: t32((lato - W) / 2), sopra: t32((lato - H) / 2), sotto: t32((lato - H) / 2) }
}

/** Espandi: di quanto allargare la foto */
export function SchedaEspandi({ espandiPreset }: { espandiPreset: (tipo: PresetEspandi) => void }): JSX.Element | null {
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
