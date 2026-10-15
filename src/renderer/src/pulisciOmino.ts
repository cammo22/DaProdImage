// Il modello a volte lascia nella foto un pezzo del manichino-guida (linee, puntini, parti grigie). Qui si controlla ogni foto fatta
// con l'omino: il Qwen3-VL la guarda, e se ne vede una traccia parte da sola una modifica che la toglie.
import { api } from './api'
import { perQualita, richiestaBase } from './azioni'
import { ascoltatoriLavoro, type Qualita } from './stato'
import type { Opera } from '@shared/tipi'

const SISTEMA_CONTROLLO = 'You answer only YES or NO.'
const DOMANDA =
  'Look at the image carefully. Is there ANY trace of a pose guide: a gray mannequin or doll-like featureless body or limbs, a second figure made of gray shapes, a stick-figure skeleton, thin lines or small dots drawn over, behind or beside the person (on the body, arms, hands, fingers, face, clothes or background)? Is any part of the person plain gray, smooth and featureless like a mannequin instead of real skin and clothes? Answer only YES or NO.'

export const PROMPT_PULIZIA =
  'Remove every trace of the pose guide from this image: any gray mannequin or doll-like body parts, gray featureless limbs or hands, skeleton lines and small dots, drawn over the person or beside her/him, or in the background. ' +
  'Repaint what is there naturally, as if the guide had never existed: real skin, real clothes, hands with natural fingers, the background. ' +
  'Keep the person, the pose, the clothes, the colors, the lighting, the framing and everything else exactly the same.'

/** la frase da mettere in fondo ai prompt che usano l'omino: la mappa di posa è solo una guida, non fa parte della foto */
export const SENZA_SCHELETRO =
  'The final image is an ordinary picture of the real person: it must not contain any mannequin, gray doll body, skeleton, stick figure, colored lines or dots, and the pose guide image must not appear in it at all.'

const attesi = new Map<string, { qualita: Qualita; dopo: (pulita: Opera, originale: Opera) => void }>()
const pulizie = new Map<string, { originale: Opera; dopo: (pulita: Opera, originale: Opera) => void }>()

/** da chiamare con l'id di un lavoro fatto con l'omino: a lavoro finito si controlla la foto e, se serve, si ripulisce; `dopo` riceve la foto pulita */
export function controllaScheletro(lavoroId: string, qualita: Qualita, dopo: (pulita: Opera, originale: Opera) => void): void {
  attesi.set(lavoroId, { qualita, dopo })
}

async function controlla(operaId: string, qualita: Qualita, dopo: (pulita: Opera, originale: Opera) => void): Promise<void> {
  try {
    const o = await api.galleria.opera(operaId)
    if (!o) return
    const r = await api.testo.scrivi({ ...richiestaBase(), modalita: 'descrivi', prompt: DOMANDA, immagini: [o.file], sistema: SISTEMA_CONTROLLO, maxToken: 4, temperatura: 0.1, seed: 5, etichetta: 'Controllo la guida di posa' })
    if (!/yes/i.test(r || '')) return
    const mp = Math.max(0.5, Math.min(2, (o.larghezza * o.altezza) / 1048576))
    const ids = await api.lavori.accoda({
      ...richiestaBase(),
      modalita: 'modifica',
      prompt: PROMPT_PULIZIA,
      immagini: [o.file],
      megapixel: mp,
      ...perQualita(qualita),
      quante: 1,
      origine: o.id,
      trasparente: !!o.trasparente,
      etichetta: (o.etichetta || 'Omino') + ' · senza guida'
    })
    for (const id of ids) pulizie.set(id, { originale: o, dopo })
  } catch {
    /* il controllo è un di più: se non riesce resta la foto com'è */
  }
}

ascoltatoriLavoro.push((uno) => {
  const a = attesi.get(uno.id)
  if (a && uno.stato === 'fatto' && uno.risultati[0]) {
    attesi.delete(uno.id)
    void controlla(uno.risultati[0], a.qualita, a.dopo)
    return
  }
  if (a && (uno.stato === 'errore' || uno.stato === 'annullato')) attesi.delete(uno.id)
  const p = pulizie.get(uno.id)
  if (!p) return
  if (uno.stato === 'fatto' && uno.risultati[0]) {
    pulizie.delete(uno.id)
    void api.galleria.opera(uno.risultati[0]).then((n) => n && p.dopo(n, p.originale))
  } else if (uno.stato === 'errore' || uno.stato === 'annullato') pulizie.delete(uno.id)
})
