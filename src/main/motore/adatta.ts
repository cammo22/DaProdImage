// Dalla richiesta che manda la GUI v2 a quella che capisce il motore. File puro (niente Electron): lo prova `node test/adatta.mjs`.
//
//  - `box` (Editor box: BoxRegione con rect/tipo/rigidita/ordine) → `regioni` (riquadro + prompt, nell'ordine dell'editor; le nascoste non partono).
//    Se ci sono riquadri validi, il prompt della scena è `promptScena` (se c'è); senza riquadri il prompt resta com'è.
//  - `sfondo` → 'trasparente' = `trasparente: true`; { tinta } = una riga in più nel prompt («on a plain solid #hex background»); 'scena' = niente.
//  - la rigidità `blocca` (maschera e compositing) per ora vale come `decisa`; `rif` (foto di riferimento del box) non è ancora usato dal motore.
import type { Regione, Richiesta } from '../../shared/tipi'

const HEX = /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i

export function adattaRichiesta(q: Richiesta): Richiesta {
  let fuori = q
  if (q.box && q.box.length) {
    const visibili = q.box.filter((b) => !b.nascosta && (b.prompt || '').trim() && Array.isArray(b.rect) && b.rect.length === 4)
    const regioni: Regione[] = [...visibili].sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0)).map((b) => ({ id: b.id, box: b.rect, prompt: b.prompt }))
    if (regioni.length) {
      const scena = (q.promptScena ?? '').trim()
      fuori = { ...fuori, regioni: [...(q.regioni || []), ...regioni], prompt: scena || fuori.prompt }
    }
  }
  const s = q.sfondo
  if (s === 'trasparente') fuori = { ...fuori, trasparente: true }
  else if (s && typeof s === 'object' && typeof s.tinta === 'string' && HEX.test(s.tinta.trim())) {
    const colore = s.tinta.trim().startsWith('#') ? s.tinta.trim() : '#' + s.tinta.trim()
    fuori = { ...fuori, prompt: `${fuori.prompt.trim().replace(/[.\s]+$/, '')}, on a plain solid ${colore} background` }
  }
  return fuori
}
