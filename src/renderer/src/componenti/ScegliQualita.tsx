// La scelta della qualità: i passi cambiano col modello (Qwen 20/40/50, Klein 8/8/16, Klein Base 25/50/64). Il Turbo di Qwen non c'è più.
import type { JSX } from 'react'
import { FAMIGLIE } from '@shared/tipi'
import { usaStato, type Qualita } from '../stato'
import { Segmenti } from './Controlli'

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
  voci.push({ id: 'bozza', nome: bozza.nome, sotto: bozza.sotto || `${passi.bozza} passi`, titolo: bozza.titolo })
  voci.push({ id: 'alta', nome: 'Alta', sotto: `${passi.alta} passi` })
  if (!p.senzaMassima) voci.push({ id: 'massima', nome: 'Massima', sotto: `${passi.massima} passi` })
  // il Turbo di Qwen non c'è più: una qualità «turbo» rimasta da prima vale «alta»
  const valore = p.valore === 'turbo' ? 'alta' : p.valore
  return (
    <div>
      <Segmenti<Qualita> valore={valore} cambia={p.cambia} voci={voci} />
      {f !== 'qwen' && <div className="piccolo spento" style={{ marginTop: 6 }}>{f === 'klein' ? `Klein è già distillato: ${passi.alta} passi senza CFG sono la sua qualità piena.` : 'Klein Base: 50 passi con CFG 3,5, fatto per la massima qualità (e per i LoRA futuri).'}</div>}
    </div>
  )
}
