// "Con questo LoRA va molto meglio": un riquadro piccolo che compare dove serve (prova vestito, camera, coerenza)
// e lo scarica con un clic, una volta sola. Il LoRA si accende poi da solo nelle azioni giuste.
import { useEffect, useState, type JSX } from 'react'
import { create } from 'zustand'
import { api } from '../api'
import { ricaricaLore, usaStato } from '../stato'
import { I } from './Icone'
import { byte } from '../util'
import type { Download, StatoVoce } from '@shared/tipi'

const usaScarichi = create<{ dl: Record<string, Download> }>(() => ({ dl: {} }))
let collegato = false

async function scarica(v: StatoVoce): Promise<void> {
  if (!collegato) {
    collegato = true
    api.su.download((d) => usaScarichi.setState((s) => ({ dl: { ...s.dl, [d.nome]: d } })))
  }
  usaScarichi.setState((s) => ({ dl: { ...s.dl, [v.nome]: { id: '', nome: v.nome, ricevuti: 0, totali: 0, velocita: 0, stato: 'in corso' } } }))
  let d: Download
  try {
    d = await api.modelli.scarica(v.id)
  } catch (e) {
    usaScarichi.setState((s) => {
      const { [v.nome]: _tolto, ...resto } = s.dl
      return { dl: resto }
    })
    usaStato.getState().avvisa(e instanceof Error ? e.message : 'Download non riuscito', 'errore')
    return
  }
  usaScarichi.setState((s) => ({ dl: { ...s.dl, [v.nome]: d } }))
  await ricaricaLore()
  if (d.stato === 'fatto') usaStato.getState().avvisa(`${v.nome}: pronto`, 'ok')
  else if (d.stato === 'errore') usaStato.getState().avvisa(d.errore || 'Download non riuscito', 'errore')
}

export function AvvisoLora(p: { id: string; perche: string }): JSX.Element | null {
  const [voce, setVoce] = useState<StatoVoce | null>(null)
  const dl = usaScarichi((s) => s.dl)
  usaStato((s) => s.lore)
  useEffect(() => {
    void api.modelli.stato().then((l) => setVoce(l.find((x) => x.id === p.id) || null)).catch(() => undefined)
  }, [p.id, dl[voce?.nome ?? '']?.stato])
  if (!voce || voce.presente) return null
  const d = dl[voce.nome]
  const va = d?.stato === 'in corso' || d?.stato === 'verifica'
  return (
    <div className="avviso-lora">
      <div className="riga" style={{ alignItems: 'flex-start', gap: 10 }}>
        <span className="turbo-ic"><I.piu /></span>
        <div className="flex1">
          <b>{voce.nome}</b>
          <div className="piccolo tenue">{p.perche}</div>
        </div>
      </div>
      {va ? (
        <>
          <div className="barra-progresso" style={{ marginTop: 8 }}><i style={{ width: `${d?.totali ? (d.ricevuti / d.totali) * 100 : 0}%` }} /></div>
          <div className="piccolo tenue" style={{ marginTop: 4 }}>{d?.totali ? Math.round((d.ricevuti / d.totali) * 100) : 0}% · {((d?.velocita || 0) / 1e6).toFixed(1)} MB/s</div>
        </>
      ) : (
        <button className="btn piccolo" style={{ marginTop: 8 }} onClick={() => void scarica(voce)}><I.scarica /> Scarica (~{byte(voce.byte)})</button>
      )}
    </div>
  )
}
