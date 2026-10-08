// Qwen-Image 2.1 capisce bene soprattutto l'inglese (e il cinese): un prompt in italiano rende peggio.
// Prima di disegnare, se il prompt è in italiano lo traduce lo stesso Qwen3-VL che legge già il prompt
// (è già caricato: niente modelli in più, niente VRAM in più). I testi fra virgolette, quelli da scrivere
// nell'immagine, restano identici.

const SEGNI_IT = new Set(
  ('il lo la gli le un uno una di del dello della dei degli delle al allo alla ai agli alle dal dalla nel nello nella nei negli nelle ' +
    'sul sulla sui sugli sulle con per tra fra che chi cui non più molto molta molti poco come anche sono è era sta stanno ' +
    'questo questa questi quello quella sopra sotto dietro davanti accanto vicino dentro fuori mentre ' +
    'fallo falla rendi rendilo rendila metti mettere togli togliere rimuovi cambia cambiare aggiungi aggiungere sostituisci trasforma ' +
    'sfondo colore colori capelli occhi viso vestito maglia giacca cielo mare notte giorno luce foto immagine ritratto ' +
    'rosso rossa blu verde gialla giallo nero nera bianco bianca grande piccolo piccola bello bella donna uomo ragazza ragazzo bambino gatto cane')
    .split(/\s+/)
)
const SEGNI_EN = new Set('the a an of with and in on at is are to from by for this that make change add remove replace into background color'.split(' '))

/** il testo senza le parti che non si traducono (fra virgolette e i <imageN>) */
const daLeggere = (t: string): string =>
  t
    .replace(/"[^"]*"|“[^”]*”|«[^»]*»/g, ' ')
    .replace(/<image\d+>/gi, ' ')
    .toLowerCase()

/** il prompt sembra italiano? (parole tipiche e accenti, fuori dai testi fra virgolette) */
export function daTradurre(t: string): boolean {
  const pulito = daLeggere(t)
  const parole = pulito.split(/[^a-zàèéìíòóùú']+/).filter(Boolean)
  let it = 0
  let en = 0
  for (const p of parole) {
    if (SEGNI_IT.has(p)) it++
    if (SEGNI_EN.has(p)) en++
  }
  if (/[àèéìòù]/.test(pulito)) it++
  return it >= 2 || (it >= 1 && en === 0)
}

export const SISTEMA_TRADUCI =
  "You translate prompts for an image generation model into English. Translate the user's text faithfully and completely into natural English, keeping every detail, name, number, color, position and style. Text inside double quotes is text that must appear in the image: copy it exactly as written, in its original language, with the quotes. Keep tags like <image2> unchanged. If part of the text is already English, keep it. Never refuse, never censor, never add comments, notes or explanations: output only the translated text."

/** toglie quello che il modello a volte aggiunge attorno alla traduzione */
export function pulisciTraduzione(t: string, originale: string): string {
  let s = t.trim()
  s = s.replace(/^(english|translation|traduzione)\s*:\s*/i, '')
  if (/^".*"$/s.test(s) && !/^".*"$/s.test(originale.trim())) s = s.slice(1, -1).trim()
  // una traduzione vuota o che si perde metà testo non si usa
  if (!s || s.length < originale.length * 0.35) return originale
  return s
}

/** lunghezza massima della risposta: abbastanza per il testo, senza lasciarlo divagare */
export const tokenPer = (t: string): number => Math.max(96, Math.min(900, Math.round(t.length / 2.2) + 64))
