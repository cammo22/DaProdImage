// I preset di Crea (la barra a sinistra): ognuno sceglie formato, risoluzione e sfondo, e ha qualche
// campo da riempire in italiano; il prompt in inglese si scrive da solo e si può ritoccare a mano.
// I testi che devono comparire nell'immagine restano come li scrivi, fra virgolette: Qwen-Image 2.1
// li disegna lettera per lettera (anche gli accenti), meglio a 1440p se sono piccoli.

export interface CampoPreset {
  id: string
  nome: string
  /** 'righe' = un elemento per riga (punti, piatti, battute) */
  tipo?: 'testo' | 'righe'
  esempio: string
}

export interface StilePreset {
  id: string
  nome: string
  testo: string
}

export interface Preset {
  id: string
  nome: string
  icona: string
  descrizione: string
  formato: string
  ris: number
  trasparente?: boolean
  campi: CampoPreset[]
  stili: StilePreset[]
  componi: (c: Record<string, string>, stile: string) => string
}

/** le righe di un campo "righe", senza quelle vuote */
const righe = (t: string | undefined): string[] => (t || '').split('\n').map((x) => x.trim()).filter(Boolean)
/** un testo fra virgolette, senza le virgolette doppie dentro (romperebbero il prompt) */
const q = (t: string | undefined): string => `"${(t || '').trim().replace(/"/g, "'")}"`
const v = (t: string | undefined, riserva: string): string => (t || '').trim() || riserva
const elenco = (xs: string[]): string => xs.map((x, i) => `${i + 1}. ${q(x)}`).join(' ')

const TESTO_PULITO = 'Every word is spelled exactly as written, with crisp, perfectly legible typography and no extra text.'

export const PRESET: Preset[] = [
  {
    id: 'foto', nome: 'Foto', icona: 'foto', descrizione: 'Fotografia realistica', formato: '3:2', ris: 1024,
    campi: [{ id: 'soggetto', nome: 'Cosa c\'è nella foto', esempio: 'una barca di legno ormeggiata in una caletta di Procida, acqua trasparente' }],
    stili: [
      { id: 'naturale', nome: 'Luce naturale', testo: 'soft natural daylight, true-to-life colors' },
      { id: 'oro', nome: 'Ora d\'oro', testo: 'warm golden hour sunlight, long soft shadows, gentle haze' },
      { id: 'notte', nome: 'Notte', testo: 'at night, glowing street lights and neon reflections, rich deep shadows' },
      { id: 'pellicola', nome: 'Pellicola', testo: 'shot on Kodak Portra 400 film, fine grain, nostalgic tones' }
    ],
    componi: (c, s) =>
      `A photorealistic photograph of ${v(c.soggetto, 'a quiet street')}, ${s}. Shot on a full-frame camera with a 35mm lens, realistic textures, fine detail, subtle depth of field, natural composition.`
  },
  {
    id: 'ritratto', nome: 'Ritratto', icona: 'ritratto', descrizione: 'Persone, primi piani', formato: '3:4', ris: 1024,
    campi: [{ id: 'persona', nome: 'Chi', esempio: 'una ragazza con i capelli ricci rossi e le lentiggini, maglione di lana' }],
    stili: [
      { id: 'finestra', nome: 'Finestra', testo: 'soft window light from the side, calm expression, muted background' },
      { id: 'studio', nome: 'Studio', testo: 'Rembrandt studio lighting, dark seamless backdrop, editorial look' },
      { id: 'strada', nome: 'Strada', testo: 'candid street portrait at dusk, city lights bokeh behind' },
      { id: 'bn', nome: 'Bianco e nero', testo: 'black and white, high contrast, classic fine-art portrait' }
    ],
    componi: (c, s) =>
      `A close-up portrait photograph of ${v(c.persona, 'a person')}, ${s}. Natural skin texture with pores, sharp eyes, 85mm lens, shallow depth of field, realistic and flattering.`
  },
  {
    id: 'prodotto', nome: 'Prodotto', icona: 'prodotto', descrizione: 'Foto da catalogo e pubblicità', formato: '1:1', ris: 1024,
    campi: [
      { id: 'prodotto', nome: 'Prodotto', esempio: 'una bottiglia di profumo in vetro ambrato con tappo dorato' },
      { id: 'sfondo', nome: 'Dove', esempio: 'su una lastra di marmo bianco con rametti di eucalipto' }
    ],
    stili: [
      { id: 'studio', nome: 'Studio pulito', testo: 'clean studio packshot, softbox lighting, soft reflection, minimal' },
      { id: 'lifestyle', nome: 'Lifestyle', testo: 'lifestyle scene, warm morning light, styled props, cozy mood' },
      { id: 'splash', nome: 'Dinamico', testo: 'dynamic advertising shot with water splashes frozen in motion, dramatic rim light' },
      { id: 'lusso', nome: 'Lusso', testo: 'luxury advertising, dark background, golden accents, glossy highlights' }
    ],
    componi: (c, s) =>
      `A professional product photograph of ${v(c.prodotto, 'a product')} ${v(c.sfondo, 'on a clean surface')}, ${s}. Sharp focus on the product, accurate materials and labels, high-end commercial quality.`
  },
  {
    id: 'poster', nome: 'Poster', icona: 'poster', descrizione: 'Locandine ed eventi', formato: '2:3', ris: 1440,
    campi: [
      { id: 'titolo', nome: 'Titolo', esempio: 'NOTTE BIANCA' },
      { id: 'sotto', nome: 'Sottotitolo', esempio: 'Musica, arte e cibo di strada fino all\'alba' },
      { id: 'info', nome: 'Data e luogo', esempio: 'Napoli · 14 giugno · Lungomare Caracciolo' },
      { id: 'tema', nome: 'Immagine', esempio: 'la luna piena sul golfo e il Vesuvio illuminato' }
    ],
    stili: [
      { id: 'svizzero', nome: 'Svizzero', testo: 'Swiss international typographic style, bold grid, flat colors, big sans-serif headline' },
      { id: 'retro', nome: 'Anni 70', testo: 'retro 1970s screen-print style, warm grainy colors, rounded groovy lettering' },
      { id: 'cinema', nome: 'Cinema', testo: 'cinematic movie poster, dramatic lighting, metallic title lettering' },
      { id: 'mano', nome: 'Illustrato', testo: 'hand-drawn illustration with gouache textures and hand-lettered title' }
    ],
    componi: (c, s) =>
      `A professionally designed event poster. Large bold headline at the top: ${q(v(c.titolo, 'TITLE'))}. Below it, the subtitle ${q(c.sotto)}. At the bottom, in smaller text: ${q(c.info)}. Main artwork: ${v(c.tema, 'an abstract composition')}. Style: ${s}. Strong visual hierarchy and generous margins. ${TESTO_PULITO}`
  },
  {
    id: 'infografica', nome: 'Infografica', icona: 'infografica', descrizione: 'Passaggi, dati, spiegazioni', formato: '3:4', ris: 1440,
    campi: [
      { id: 'titolo', nome: 'Titolo', esempio: 'Il caffè perfetto con la moka' },
      { id: 'punti', nome: 'Punti (uno per riga)', tipo: 'righe', esempio: 'Acqua fino alla valvola\nCaffè nel filtro senza pressare\nFuoco basso\nVia dal fuoco quando gorgoglia' }
    ],
    stili: [
      { id: 'piatto', nome: 'Piatto', testo: 'modern flat design, friendly vector icons, soft pastel palette on an off-white background' },
      { id: 'iso', nome: 'Isometrico', testo: 'isometric 3D illustrations, clean shadows, vibrant colors' },
      { id: 'lavagna', nome: 'Lavagna', testo: 'chalkboard style with hand-drawn chalk icons and lettering' },
      { id: 'scuro', nome: 'Scuro', testo: 'dark navy background, neon accent colors, sleek tech look' }
    ],
    componi: (c, s) => {
      const p = righe(c.punti)
      return `A clean, well-organized infographic. Title at the top: ${q(v(c.titolo, 'Infographic'))}. Below, ${p.length || 3} numbered sections arranged vertically, each with a simple illustrated icon and a short caption: ${elenco(p)}. Style: ${s}. Consistent icons, clear layout with plenty of white space. ${TESTO_PULITO}`
    }
  },
  {
    id: 'logo', nome: 'Logo', icona: 'logo', descrizione: 'Marchi su sfondo trasparente', formato: '1:1', ris: 1024, trasparente: true,
    campi: [
      { id: 'nome', nome: 'Nome', esempio: 'Pasticceria Aurora' },
      { id: 'settore', nome: 'Di cosa si occupa', esempio: 'dolci artigianali napoletani' }
    ],
    stili: [
      { id: 'minimal', nome: 'Minimal', testo: 'minimal geometric mark, two colors, modern sans-serif wordmark' },
      { id: 'vintage', nome: 'Emblema', testo: 'vintage circular emblem badge, engraved details, serif lettering' },
      { id: 'mascotte', nome: 'Mascotte', testo: 'friendly cartoon mascot character next to a playful rounded wordmark' },
      { id: 'monogramma', nome: 'Monogramma', testo: 'elegant monogram of the initials in gold, luxury serif wordmark below' }
    ],
    componi: (c, s) =>
      `A professional logo for ${q(v(c.nome, 'Brand'))}, a brand of ${v(c.settore, 'quality products')}. ${s}. The name ${q(v(c.nome, 'Brand'))} written in clean, well-kerned lettering. Flat vector design, balanced and centered, no mockup. ${TESTO_PULITO}`
  },
  {
    id: 'social', nome: 'Post social', icona: 'social', descrizione: 'Instagram, promo, annunci', formato: '4:5', ris: 1080,
    campi: [
      { id: 'testo', nome: 'Testo grande', esempio: 'SALDI -50%' },
      { id: 'sotto', nome: 'Testo piccolo', esempio: 'Solo questo weekend · negozio e online' },
      { id: 'tema', nome: 'Immagine', esempio: 'scarpe da ginnastica colorate che fluttuano' }
    ],
    stili: [
      { id: 'pop', nome: 'Pop', testo: 'bold pop-art colors, playful shapes, high energy' },
      { id: 'elegante', nome: 'Elegante', testo: 'elegant editorial layout, beige and black, refined serif type' },
      { id: 'neon', nome: 'Neon', testo: 'dark background with glowing neon gradients and 3D type' }
    ],
    componi: (c, s) =>
      `An eye-catching social media post graphic. Huge headline text: ${q(v(c.testo, 'NEW'))}. Smaller text below: ${q(c.sotto)}. Visual: ${v(c.tema, 'a striking product shot')}. Style: ${s}. Balanced composition for a phone screen. ${TESTO_PULITO}`
  },
  {
    id: 'miniatura', nome: 'Miniatura', icona: 'video', descrizione: 'Copertine per YouTube', formato: '16:9', ris: 1080,
    campi: [
      { id: 'titolo', nome: 'Scritta', esempio: '7 GIORNI SENZA TELEFONO' },
      { id: 'soggetto', nome: 'Soggetto', esempio: 'un ragazzo stupito che tiene in mano uno smartphone rotto' }
    ],
    stili: [
      { id: 'esplosiva', nome: 'Esplosiva', testo: 'very saturated colors, thick outlined text, glowing rim light, high contrast' },
      { id: 'pulita', nome: 'Pulita', testo: 'clean minimal layout, soft gradient background, modern bold type' },
      { id: 'mistero', nome: 'Mistero', testo: 'dark moody lighting, red accents, intriguing atmosphere' }
    ],
    componi: (c, s) =>
      `A YouTube video thumbnail. ${v(c.soggetto, 'A surprised person')} on one side, and on the other side large bold text: ${q(v(c.titolo, 'WOW'))}. Style: ${s}. Readable even when small. ${TESTO_PULITO}`
  },
  {
    id: 'copertina', nome: 'Copertina', icona: 'libro', descrizione: 'Libri, album, podcast', formato: '2:3', ris: 1440,
    campi: [
      { id: 'titolo', nome: 'Titolo', esempio: 'Il mare d\'inverno' },
      { id: 'autore', nome: 'Autore', esempio: 'Giulia Esposito' },
      { id: 'scena', nome: 'Atmosfera', esempio: 'un faro solitario sotto la neve, colori freddi e una luce calda alla finestra' }
    ],
    stili: [
      { id: 'romanzo', nome: 'Romanzo', testo: 'literary fiction cover, painterly illustration, elegant serif title' },
      { id: 'thriller', nome: 'Thriller', testo: 'thriller cover, high contrast photo, distressed bold title' },
      { id: 'fantasy', nome: 'Fantasy', testo: 'epic fantasy cover art, ornate gold title lettering' },
      { id: 'album', nome: 'Album', testo: 'music album cover, artistic and bold, modern typography' }
    ],
    componi: (c, s) =>
      `A book cover. Title ${q(v(c.titolo, 'Title'))} prominently at the top, author name ${q(c.autore)} at the bottom. Artwork: ${v(c.scena, 'an evocative scene')}. Style: ${s}. ${TESTO_PULITO}`
  },
  {
    id: 'invito', nome: 'Invito', icona: 'invito', descrizione: 'Matrimoni, feste, compleanni', formato: '3:4', ris: 1440,
    campi: [
      { id: 'evento', nome: 'Evento', esempio: 'Anna & Luca si sposano' },
      { id: 'quando', nome: 'Quando', esempio: 'Sabato 12 settembre 2026 · ore 16:00' },
      { id: 'dove', nome: 'Dove', esempio: 'Villa Rufolo, Ravello' }
    ],
    stili: [
      { id: 'acquerello', nome: 'Acquerello', testo: 'delicate watercolor flowers and lemons framing the text, cream paper texture' },
      { id: 'oro', nome: 'Oro', testo: 'elegant black card with gold foil lettering and fine art deco lines' },
      { id: 'moderno', nome: 'Moderno', testo: 'modern minimal layout, lots of white space, thin sans-serif type' }
    ],
    componi: (c, s) =>
      `An invitation card design, flat front view. Main text: ${q(v(c.evento, 'You are invited'))}. Below: ${q(c.quando)}. Then: ${q(c.dove)}. Style: ${s}. Centered, harmonious layout. ${TESTO_PULITO}`
  },
  {
    id: 'menu', nome: 'Menù', icona: 'menu', descrizione: 'Ristoranti, bar, listini', formato: '2:3', ris: 1440,
    campi: [
      { id: 'locale', nome: 'Locale', esempio: 'Trattoria da Nennella' },
      { id: 'piatti', nome: 'Piatti (uno per riga)', tipo: 'righe', esempio: 'Spaghetti alle vongole — 14€\nParmigiana di melanzane — 10€\nFrittura di paranza — 16€\nBabà al rum — 6€' }
    ],
    stili: [
      { id: 'lavagna', nome: 'Lavagna', testo: 'chalkboard menu with hand-drawn chalk illustrations' },
      { id: 'vintage', nome: 'Carta vintage', testo: 'vintage paper menu, classic Italian typography, small food sketches' },
      { id: 'moderno', nome: 'Moderno', testo: 'modern minimal menu, generous spacing, one accent color' }
    ],
    componi: (c, s) => {
      const p = righe(c.piatti)
      return `A restaurant menu design, flat front view. Header: ${q(v(c.locale, 'Menu'))}. A list of dishes with prices, one per line: ${elenco(p)}. Style: ${s}. Neatly aligned prices. ${TESTO_PULITO}`
    }
  },
  {
    id: 'fumetto', nome: 'Fumetto', icona: 'fumetto', descrizione: 'Vignette con i dialoghi', formato: '3:4', ris: 1440,
    campi: [
      { id: 'storia', nome: 'La storia', esempio: 'un gatto arancione prova a rubare un cornetto al bancone di un bar' },
      { id: 'battute', nome: 'Battute (una per vignetta)', tipo: 'righe', esempio: 'Buongiorno! Un caffè?\nMiao...\nEhi! Il mio cornetto!\nMiao. (soddisfatto)' }
    ],
    stili: [
      { id: 'italiano', nome: 'Fumetto', testo: 'Italian comic book style, clean ink lines, flat colors' },
      { id: 'manga', nome: 'Manga', testo: 'black and white manga style with screentones' },
      { id: 'strip', nome: 'Strip', testo: 'newspaper comic strip style, bold outlines, bright colors' }
    ],
    componi: (c, s) => {
      const p = righe(c.battute)
      const n = Math.max(2, Math.min(6, p.length || 4))
      return `A comic page with ${n} panels telling a short story: ${v(c.storia, 'a funny everyday scene')}. Speech bubbles, in order: ${elenco(p)}. Style: ${s}. Consistent characters across panels, clear panel borders. ${TESTO_PULITO}`
    }
  },
  {
    id: 'sticker', nome: 'Sticker', icona: 'sticker', descrizione: 'Adesivi ed emoji, sfondo trasparente', formato: '1:1', ris: 1024, trasparente: true,
    campi: [{ id: 'soggetto', nome: 'Soggetto', esempio: 'un pomodoro felice con gli occhiali da sole' }],
    stili: [
      { id: 'kawaii', nome: 'Kawaii', testo: 'cute kawaii style, big shiny eyes, pastel colors' },
      { id: 'cartoon', nome: 'Cartoon', testo: 'bold cartoon style, thick outlines, vibrant colors' },
      { id: 'pixel', nome: 'Pixel', testo: '16-bit pixel art style' }
    ],
    componi: (c, s) => `A die-cut sticker of ${v(c.soggetto, 'a cute character')}, ${s}, with a thick white border around the shape, centered, no background.`
  },
  {
    id: 'app', nome: 'App / sito', icona: 'app', descrizione: 'Schermate e mockup', formato: '9:16', ris: 1080,
    campi: [
      { id: 'app', nome: 'App', esempio: 'Padel Go, app per prenotare i campi da padel' },
      { id: 'schermata', nome: 'Schermata', esempio: 'la home con le partite di oggi e il pulsante Prenota' }
    ],
    stili: [
      { id: 'chiaro', nome: 'Chiaro', testo: 'light theme, soft shadows, rounded cards, modern iOS look' },
      { id: 'scuro', nome: 'Scuro', testo: 'dark theme with vivid green accents, sleek and sporty' },
      { id: 'vetro', nome: 'Vetro', testo: 'glassmorphism, blurred colorful gradients, translucent panels' }
    ],
    componi: (c, s) =>
      `A high-fidelity mobile app UI screen for ${v(c.app, 'an app')}, showing ${v(c.schermata, 'the home screen')}. ${s}. Realistic interface with icons, buttons and short labels, flat screenshot without a phone frame. ${TESTO_PULITO}`
  },
  {
    id: 'slide', nome: 'Slide', icona: 'slide', descrizione: 'Presentazioni', formato: '16:9', ris: 1080,
    campi: [
      { id: 'titolo', nome: 'Titolo', esempio: 'Risultati del terzo trimestre' },
      { id: 'punti', nome: 'Punti (uno per riga)', tipo: 'righe', esempio: 'Vendite +18%\nTre nuovi negozi\nClienti soddisfatti al 94%' }
    ],
    stili: [
      { id: 'aziendale', nome: 'Aziendale', testo: 'corporate style, white background, navy and teal accents, simple chart' },
      { id: 'creativo', nome: 'Creativo', testo: 'creative bold colors, big shapes, playful icons' },
      { id: 'scuro', nome: 'Scuro', testo: 'dark elegant theme, gold accents, minimal icons' }
    ],
    componi: (c, s) => {
      const p = righe(c.punti)
      return `A presentation slide. Title: ${q(v(c.titolo, 'Title'))}. Bullet points: ${elenco(p)}. ${s}. Clean layout with a small supporting illustration. ${TESTO_PULITO}`
    }
  },
  {
    id: 'arte', nome: 'Arte', icona: 'arte', descrizione: 'Illustrazione e pittura', formato: '1:1', ris: 1024,
    campi: [{ id: 'soggetto', nome: 'Soggetto', esempio: 'una volpe che legge un libro sotto un albero di limoni' }],
    stili: [
      { id: 'acquerello', nome: 'Acquerello', testo: 'delicate watercolor painting, soft washes, paper texture' },
      { id: 'olio', nome: 'Olio', testo: 'classical oil painting with visible brush strokes, rich colors' },
      { id: 'anime', nome: 'Anime', testo: 'high quality anime illustration, cel shading, vivid sky' },
      { id: '3d', nome: '3D', testo: '3D animated movie style render, soft global illumination' },
      { id: 'pixel', nome: 'Pixel art', testo: 'detailed 32-bit pixel art' },
      { id: 'inchiostro', nome: 'Inchiostro', testo: 'Japanese ink wash painting, sumi-e, minimal' }
    ],
    componi: (c, s) => `${v(c.soggetto, 'A dreamy landscape')}, ${s}. Beautiful composition, harmonious colors, high detail.`
  }
]

export const presetDa = (id: string): Preset | undefined => PRESET.find((p) => p.id === id)

/** i campi coi loro esempi (quelli che l'utente non ha ancora scritto) */
export function campiCon(p: Preset, campi: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of p.campi) out[c.id] = campi[c.id] ?? c.esempio
  return out
}

export function componiPreset(p: Preset, campi: Record<string, string>, stile: string): string {
  const s = p.stili.find((x) => x.id === stile) || p.stili[0]
  return p.componi(campiCon(p, campi), s?.testo || '')
}
