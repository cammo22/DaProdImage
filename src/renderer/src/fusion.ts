// Fusion ed Esempio: come si costruisce la richiesta dalle foto e dal testo. Sta qui (e non in Modifica.tsx) per tenere la pagina leggera.
import { perQualita, richiestaBase } from './azioni'
import { conMisura } from './componenti/Misura'
import { conParoleLora } from './componenti/SceltaLora'
import type { StatoModifica } from './stato'
import type { Richiesta } from '@shared/tipi'

/** le proporzioni della foto nuova di Fusion (senza `r`: come la prima foto) */
export const FORMATI_FUSION: { id: string; nome: string; r?: [number, number] }[] = [
  { id: 'prima', nome: 'Prima foto' },
  { id: '1:1', nome: '1:1', r: [1, 1] },
  { id: '4:5', nome: '4:5', r: [4, 5] },
  { id: '3:2', nome: '3:2', r: [3, 2] },
  { id: '16:9', nome: '16:9', r: [16, 9] },
  { id: '9:16', nome: '9:16', r: [9, 16] }
]

export type Esito = { q: Richiesta } | { errore: string }

/** Fusion: tutte le foto sono riferimenti, ne esce una immagine nuova in base al testo */
export function richiestaFusion(s: StatoModifica, turboPronto: boolean): Esito {
  if (!s.riferimenti.length) return { errore: 'Aggiungi almeno una foto' }
  if (!s.prompt.trim()) return { errore: 'Scrivi cosa deve nascere dalle foto (es. "la donna di <image1> con la giacca di <image2> in una strada di Tokyo di notte")' }
  if (s.qualita === 'turbo' && !turboPronto) return { errore: 'Per il Turbo scarica prima il suo LoRA (il pulsante sotto Qualità), o scegli Alta' }
  const mis = s.misura && s.misura.tipo === 'custom' ? s.misura : null
  const [a, b] = mis ? [mis.w, mis.h] : FORMATI_FUSION.find((f) => f.id === s.formatoFusion)?.r || [s.riferimenti[0].larghezza, s.riferimenti[0].altezza]
  const px = s.mp * 1048576
  const t = (x: number): number => Math.max(256, Math.round(x / 32) * 32)
  const w = t(Math.sqrt(px * (a / b)))
  const h = t(Math.sqrt(px / (a / b)))
  return {
    q: {
      ...richiestaBase(),
      modalita: 'crea',
      prompt: conParoleLora(s.prompt.trim()),
      larghezza: w,
      altezza: h,
      megapixel: (w * h) / 1048576,
      immagini: s.riferimenti.map((r) => r.percorso),
      ...perQualita(s.qualita),
      quante: s.quante,
      etichetta: 'Fusion · ' + s.prompt.trim().slice(0, 50),
      // la misura esatta scelta: il modello lavora ai megapixel, poi il motore porta l'immagine a quella misura
      ...(mis ? { uscita: { w: mis.w, h: mis.h } } : {})
    }
  }
}

/** Esempio: il modello rifà la foto d'esempio (<image1>) con le persone/oggetti dei riferimenti (<image2>…) */
export function richiestaEsempio(s: StatoModifica, turboPronto: boolean): Esito {
  if (!s.esempio) return { errore: 'Metti la foto di esempio: com\'è il risultato che vuoi' }
  if (!s.riferimenti.length) return { errore: 'Aggiungi almeno una foto di riferimento (la persona o l\'oggetto da usare)' }
  if (s.qualita === 'turbo' && !turboPronto) return { errore: 'Per il Turbo scarica prima il suo LoRA (il pulsante sotto Qualità), o scegli Alta' }
  const tag = s.riferimenti.map((_, i) => `<image${i + 2}>`)
  const lista = tag.length > 1 ? `${tag.slice(0, -1).join(', ')} and ${tag[tag.length - 1]}` : tag[0]
  // istruzione di modifica: l'esempio resta com'è (posa, inquadratura, luce), cambiano i soggetti
  const guida = `Recreate the photo <image1> exactly as the target: keep its composition, pose, framing, camera angle, lighting, colors and mood, but replace its people and main subjects with those from ${lista} (keep their identity, face, hair, clothes and details).`
  const note = s.prompt.trim()
  return {
    q: {
      ...richiestaBase(),
      modalita: 'modifica',
      prompt: conParoleLora(note ? `${guida} ${note}` : guida),
      immagini: [s.esempio.percorso, ...s.riferimenti.map((r) => r.percorso)],
      megapixel: s.mp,
      ...perQualita(s.qualita),
      quante: s.quante,
      etichetta: 'Esempio · ' + (note.slice(0, 50) || 'come l\'esempio'),
      ...conMisura(s.misura, s.esempio)
    }
  }
}
