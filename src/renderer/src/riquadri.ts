// Le cose trovate in una foto (persone e oggetti): il modello risponde con un elenco JSON di riquadri, qui si legge (puro, si prova da solo).

export type TipoElemento = 'persona' | 'oggetto'

/** una cosa nella foto: il riquadro in frazioni della foto (0–1) */
export interface Elemento {
  id: string
  /** x1, y1, x2, y2 */
  box: [number, number, number, number]
  /** descrizione breve dal modello (inglese: serve anche al prompt) */
  nome: string
  tipo: TipoElemento
  manuale?: boolean
}

const PAROLE_PERSONA = /\b(person|people|man|men|woman|women|boy|girl|child|children|kid|baby|toddler|guy|lady|human|player|dancer|bride|groom)\b/i

/** legge la risposta del modello (anche se ha scritto altro attorno al JSON) */
export function leggiElementi(testo: string, w: number, h: number): Elemento[] {
  const grezzi: { box: number[]; nome: string; tipo: string }[] = []
  try {
    const m = testo.match(/\[[\s\S]*\]/)
    const arr = m ? (JSON.parse(m[0]) as { bbox_2d?: number[]; label?: string; kind?: string; type?: string }[]) : []
    for (const x of arr) if (Array.isArray(x.bbox_2d) && x.bbox_2d.length === 4) grezzi.push({ box: x.bbox_2d.map(Number), nome: String(x.label || ''), tipo: String(x.kind || x.type || '') })
  } catch {
    for (const r of testo.matchAll(/"bbox_2d"\s*:\s*\[\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\]([^{}]*)/g)) {
      const resto = r[5] || ''
      grezzi.push({ box: [Number(r[1]), Number(r[2]), Number(r[3]), Number(r[4])], nome: resto.match(/"label"\s*:\s*"([^"]*)"/)?.[1] || '', tipo: resto.match(/"kind"\s*:\s*"([^"]*)"/)?.[1] || '' })
    }
  }
  const tetto = Math.max(0, ...grezzi.flatMap((g) => g.box))
  // di solito 0–1000; se sono più grandi, sono pixel veri
  const dx = tetto > 1000 ? w : 1000
  const dy = tetto > 1000 ? h : 1000
  const fuori: Elemento[] = []
  grezzi.forEach((g, i) => {
    const [a, b, c, d] = g.box
    const x1 = Math.min(a, c) / dx
    const x2 = Math.max(a, c) / dx
    const y1 = Math.min(b, d) / dy
    const y2 = Math.max(b, d) / dy
    const box: Elemento['box'] = [clamp(x1), clamp(y1), clamp(x2), clamp(y2)]
    if (box[2] - box[0] < 0.02 || box[3] - box[1] < 0.02) return
    const nome = g.nome.trim()
    const tipo: TipoElemento = /person|people|human/i.test(g.tipo) ? 'persona' : g.tipo ? 'oggetto' : PAROLE_PERSONA.test(nome) ? 'persona' : 'oggetto'
    // due riquadri quasi uguali sono la stessa cosa: si tiene il primo
    if (fuori.some((e) => sovrapposizione(e.box, box) > 0.85)) return
    fuori.push({ id: `e${i + 1}-${Math.round(x1 * 1000)}-${Math.round(y1 * 1000)}`, box, nome, tipo })
  })
  return fuori.slice(0, 24)
}

const clamp = (v: number): number => Math.max(0, Math.min(1, v))

/** quanto due riquadri si sovrappongono (intersezione / unione) */
export function sovrapposizione(a: Elemento['box'], b: Elemento['box']): number {
  const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]))
  const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))
  const i = ix * iy
  const u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i
  return u > 0 ? i / u : 0
}
