// Le persone trovate in una foto: il modello risponde con un elenco JSON di riquadri, qui si legge (puro, si prova da solo).

/** una persona nella foto: il riquadro in frazioni della foto (0–1) */
export interface Persona {
  id: string
  /** x1, y1, x2, y2 */
  box: [number, number, number, number]
  /** descrizione breve dal modello (inglese: serve anche al prompt) */
  nome: string
  manuale?: boolean
}

/** legge la risposta del modello (anche se ha scritto altro attorno al JSON) */
export function leggiPersone(testo: string, w: number, h: number): Persona[] {
  const grezzi: { box: number[]; nome: string }[] = []
  try {
    const m = testo.match(/\[[\s\S]*\]/)
    const arr = m ? (JSON.parse(m[0]) as { bbox_2d?: number[]; label?: string }[]) : []
    for (const x of arr) if (Array.isArray(x.bbox_2d) && x.bbox_2d.length === 4) grezzi.push({ box: x.bbox_2d.map(Number), nome: String(x.label || '') })
  } catch {
    for (const r of testo.matchAll(/"bbox_2d"\s*:\s*\[\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\]/g)) {
      grezzi.push({ box: [Number(r[1]), Number(r[2]), Number(r[3]), Number(r[4])], nome: '' })
    }
  }
  const tetto = Math.max(0, ...grezzi.flatMap((g) => g.box))
  // di solito 0–1000; se sono più grandi, sono pixel veri
  const dx = tetto > 1000 ? w : 1000
  const dy = tetto > 1000 ? h : 1000
  return grezzi
    .map((g, i): Persona => {
      const [a, b, c, d] = g.box
      const x1 = Math.min(a, c) / dx
      const x2 = Math.max(a, c) / dx
      const y1 = Math.min(b, d) / dy
      const y2 = Math.max(b, d) / dy
      return { id: `p${i + 1}-${Math.round(x1 * 1000)}`, box: [clamp(x1), clamp(y1), clamp(x2), clamp(y2)], nome: g.nome.trim() }
    })
    .filter((p) => p.box[2] - p.box[0] > 0.02 && p.box[3] - p.box[1] > 0.04)
}
const clamp = (v: number): number => Math.max(0, Math.min(1, v))

