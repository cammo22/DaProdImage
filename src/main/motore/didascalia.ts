// Pulizia del testo che scrive il Qwen3-VL 4B (prompt upsampler di Klein e altre funzioni di testo).
// File PURO: niente Electron, niente import, così lo importa anche `test/pulisci_didascalia.mjs` (Node con type stripping).

/** titolo in grassetto prima del testo («**Image Idea:** …»): il 4B lo scrive a volte, si toglie */
const TITOLO_GRASSETTO = /^\s*\*\*[^*\n]{1,40}\*\*:?\s*/

/** toglie il titolo in grassetto in testa; se non c'è, il testo resta com'è (solo ripulito agli estremi) */
export const senzaTitolo = (t: string): string => t.replace(TITOLO_GRASSETTO, '').trim()

/** il 4B, quando scrive, apre spesso con una frase di cortesia o con le regole del sistema, invece che con la didascalia:
 *  «Here’s the expanded, detailed caption for your image request:», «You're a prompt upsampler for text-to-image models…»,
 *  «Output only the caption.» e così via. Se non si toglie, quella frase finisce nel prompt del modello e gli fa male.
 *  Si taglia tutto ciò che precede la didascalia: la parte utile comincia dalla prima riga non vuota dopo il preambolo. */
export const PREAMBOLI: RegExp[] = [
  /^\s*here(?:'s|’s| is|’ is)\s+the\s+expanded\b[^\n]*/i,
  /^\s*here(?:'s|’s| is|’ is)\s+(?:your|the)\s+(?:expanded\s+)?(?:detailed\s+)?(?:caption|description|instruction|prompt)\b[^\n]*/i,
  /^\s*you(?:'re| are)\s+a\s+prompt\s+upsampler\b[^\n]*/i,
  /^\s*you(?:'re| are)\s+(?:a|the)\s+(?:helpful\s+)?(?:ai\s+)?(?:assistant|image\s+prompt)\b[^\n]*/i,
  /^\s*output\s+only\s+the\s+(?:caption|instruction|description)\b[^\n]*/i,
  /^\s*(?:sure|certainly|of\s+course|here)\b[^\n]*/i,
  /^\s*\**\s*(?:expanded\s+)?(?:caption|instruction|description)\s*\**\s*:\s*/i,
  /^\s*\d+\s*[.)]\s*(?:expanded\s+)?(?:caption|instruction)\s*:\s*/i
]

/** frasi tipiche delle regole: se il 4B le ricopia prima della didascalia, quel paragrafo non serve */
export const REGOLA =
  /\b(?:your output|you should|you must|keep it under|avoid generic|don't mention|do not mention|if you(?:'re| are) unsure|if no style|output only|one continuous block|no greetings|include sensory|add sensory|example\s*:|input\s*:|one detailed, self-contained|the exact text the image model receives|the caption the editing model receives|to expand the user|your job is|always stay faithful|make an educated assumption|the caption must include|write one continuous)/i

/** comincia una didascalia: quasi sempre «Full-color … photograph», ma anche «A », «Close-up », «Studio », «An » ecc. */
export const INIZIO_DIDASCALIA =
  /^(?:full[- ]colour|full[- ]color|a\s|an\s|the\s|close[- ]up|studio\s|outdoor\s|indoor\s|portrait\s|macro\s|wide[- ]angle|overhead\s|flat\s|lay\s|product\s|fashion\s|editorial\s|documentary\s|conceptual\s|minimalist\s|oil\s|watercolou?r\s|oil[- ]painting|photorealistic\s|realistic\s|3d\s|concept\s|illustration\s|film\s|cinematic\s|digital\s|render\s|photograph\s|photo\s|scene\s|image\s|view\s|close[- ]shot|aerial\s|isometric\s|watercolou?ristic\s|charcoal\s|pencil\s|sketch\s)/i

/** toglie il preambolo e la parte di regole: la didascalia comincia dalla prima riga che sembra contenere la didascalia */
export function pulisciDidascalia(t: string): string {
  let s = t.trim()
  // via i blocchi di regole: il 4B a volte ricopia le istruzioni prima della didascalia
  s = s.replace(/^\s*(?:you(?:'re| are)\s+a\s+prompt\s+upsampler[\s\S]*?)(?=\n\n[A-Z“"])/i, '')
  for (let i = 0; i < PREAMBOLI.length; i++) {
    const m = s.match(PREAMBOLI[i])
    if (m) {
      const resto = s.slice(m[0].length).replace(/^\s*[:\-–—]\s*/, '').trim()
      if (resto.length > 40) s = resto
    }
  }
  // resta un titolo in grassetto o un'etichetta
  s = senzaTitolo(s)
  s = s.replace(/^\s*(?:caption|instruction|description)\s*:\s*/i, '').trim()
  // se ci sono paragrafi, si cerca quello che apre la didascalia: i paragrafi di regole (che parlano del compito)
  // vengono scartati, quelli che descrivono la scena restano
  const paragrafi = s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  if (paragrafi.length > 1) {
    const iD = paragrafi.findIndex((p) => INIZIO_DIDASCALIA.test(p) && !REGOLA.test(p))
    if (iD >= 0) {
      // dalla didascalia in poi: i paragrafi che sono regole (parlano del compito) si scartano
      const buoni = paragrafi.slice(iD).filter((p) => !REGOLA.test(p))
      if (buoni.length && buoni.join('\n\n').length > 40) s = buoni.join('\n\n')
    } else {
      // nessun paragrafo sembra una didascalia: si tengono solo quelli che non sono regole
      const buoni = paragrafi.filter((p) => !REGOLA.test(p))
      if (buoni.length && buoni.join('\n\n').length > 40) s = buoni.join('\n\n')
    }
  }
  // il 4B a volte scrive solo un ESEMPIO («Example: | Input: “…” | Output: “…”»): dentro c'è la didascalia giusta
  const ex = s.match(/example\s*:\s*\n?input\s*:\s*[“"']?([\s\S]*?)[”"']?\s*\n?output\s*:\s*[“"']?([\s\S]*?)[”"']?\s*$/i)
  if (ex && ex[2] && ex[2].trim().length > 40) s = ex[2].trim()
  return s
}
