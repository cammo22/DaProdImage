// Operazioni pure della pila: non cambiano la libreria né il modello selezionato.
import type { Famiglia, InfoLora, LoraAttiva } from '@shared/tipi'

export function forzaLora(v: number): number {
  return Number.isFinite(v) ? Math.max(-2, Math.min(2, v)) : 0
}

export function spostaLora(pila: LoraAttiva[], file: string, verso: -1 | 1): LoraAttiva[] {
  const i = pila.findIndex((x) => x.file === file)
  const j = i + verso
  if (i < 0 || j < 0 || j >= pila.length) return pila
  const nuova = [...pila]
  ;[nuova[i], nuova[j]] = [nuova[j], nuova[i]]
  return nuova
}

// I metadati nuovi sono opzionali finché non è integrato il contratto engine v2.
// Nelle librerie vecchie «si» identifica Qwen 2.1, NON tutte le architetture.
export function compatibilitaLora(l: Pick<InfoLora, 'compatibile'> & { famiglie?: Famiglia[] }, famiglia: Famiglia): 'si' | 'no' | '?' {
  if (l.famiglie?.length) return l.famiglie.includes(famiglia) ? 'si' : 'no'
  if (l.compatibile === '?') return '?'
  return famiglia === 'qwen' ? l.compatibile : 'no'
}
