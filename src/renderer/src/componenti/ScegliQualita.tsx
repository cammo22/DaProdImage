// La scelta della qualità: i passi cambiano col modello (Qwen ha anche il Turbo; Klein ha 8/16/24 passi, Klein Base 25/50/64).
import type { JSX } from 'react'
import { FAMIGLIE } from '@shared/tipi'
import { usaStato, type Qualita } from '../stato'
import { Segmenti } from './Controlli'
import { I } from './Icone'
import { AvvisoTurbo } from './Turbo'

export function ScegliQualita(p: {
  valore: Qualita
  cambia: (q: Qualita) => void
  /** come si chiama (e cosa dice sotto) la qualità più bassa: in Crea è la «Bozza» a metà pixel, altrove «Veloce» */
  bozza?: { nome: string; sotto?: string; titolo?: string }
  /** senza «Massima» (Laboratorio) */
  senzaMassima?: boolean
}): JSX.Element {
  const f = usaStato((s) => s.imp?.famiglia || 'qwen')
  const passi = FAMIGLIE[f].passi
  const bozza = p.bozza || { nome: 'Veloce' }
  const voci: { id: Qualita; nome: JSX.Element | string; sotto: string; titolo?: string }[] = []
  if (f === 'qwen') voci.push({ id: 'turbo', nome: <><I.fulmine /> Turbo</>, sotto: `${passi.turbo} passi`, titolo: 'LoRA Turbo8: circa 5 volte più veloce' })
  voci.push({ id: 'bozza', nome: bozza.nome, sotto: bozza.sotto || `${passi.bozza} passi`, titolo: bozza.titolo })
  voci.push({ id: 'alta', nome: 'Alta', sotto: `${passi.alta} passi` })
  if (!p.senzaMassima) voci.push({ id: 'massima', nome: 'Massima', sotto: `${passi.massima} passi` })
  // passando a Klein il Turbo non c'è più: vale come la qualità più bassa
  const valore = f !== 'qwen' && p.valore === 'turbo' ? 'bozza' : p.valore
  return (
    <div>
      <Segmenti<Qualita> valore={valore} cambia={p.cambia} voci={voci} />
      {f === 'qwen' && valore === 'turbo' && <AvvisoTurbo />}
      {f !== 'qwen' && <div className="piccolo spento" style={{ marginTop: 6 }}>{f === 'klein' ? 'Klein è già distillato: 16 passi senza CFG sono la sua qualità piena.' : 'Klein Base: 50 passi con CFG 3,5, fatto per la massima qualità (e per i LoRA futuri).'}</div>}
    </div>
  )
}
