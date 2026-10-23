// Operazioni pure della pila: non cambiano la libreria né il modello selezionato.
import type { Famiglia, GruppoLora, InfoLora, LoraAttiva } from '@shared/tipi'

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

// Un LoRA va bene con questo modello? Dai nomi dei tensori (`famiglie`), o dallo scaffale scelto da chi l'ha caricato (`gruppo`);
// nelle librerie vecchie «si» identifica Qwen 2.1, NON tutte le architetture. Sono le stesse regole di `vaBeneCon` in `shared/loraBase.ts`
// (qui a parte perché `test/pila-lora.mjs` importa questo file da Node, senza l'alias @shared).
export function compatibilitaLora(l: Pick<InfoLora, 'compatibile'> & { famiglie?: Famiglia[]; gruppo?: GruppoLora }, famiglia: Famiglia): 'si' | 'no' | '?' {
  if (l.famiglie?.length) return l.famiglie.includes(famiglia) ? 'si' : 'no'
  if (l.gruppo) return l.gruppo === (famiglia === 'qwen' ? 'qwen' : 'flux') ? 'si' : 'no'
  if (l.compatibile === '?') return '?'
  return famiglia === 'qwen' ? l.compatibile : 'no'
}
