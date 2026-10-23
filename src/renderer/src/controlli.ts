// I controlli interattivi di Modifica, per categoria (GUI v2 §6.2): cursori, griglie a icona, campioni colore, quadranti.
// Ogni controllo ha un valore (stringa) e lo trasforma in una frase in inglese (`compila`): `null` = spento, non entra nel lavoro.
// Il valore sta nell'id dell'idea attiva (`ctl-<id>:<valore>`): niente stato in più, le Idee sono la fonte di verità.
// Qui sta solo il catalogo (puro: si prova senza interfaccia); i pezzi grafici sono in componenti/ControlliCategoria.tsx.
import type { ChiaveLora, Rapida } from './rapide'

export interface Opzione { id: string; nome: string; icona: string; frase: string }

/** una riga di un controllo: una griglia di icone, i campioni colore, il quadrante 3×3 o una riga di testo */
export type Parte =
  | { id: string; tipo: 'griglia' | 'colori' | 'quadrante'; nome: string; opzioni: Opzione[] }
  | { id: string; tipo: 'testo'; nome: string; esempio: string }

export interface Compilato { frase: string; lora?: ChiaveLora[] }

export type Controllo =
  | { id: string; categoria: string; tipo: 'cursore'; nome: string; icona: string; tooltip: string; min: number; max: number; neutro: number; estremi: [string, string]; etichette?: string[]; compila: (v: number) => Compilato | null }
  | { id: string; categoria: string; tipo: 'multi'; nome: string; icona: string; tooltip: string; parti: Parte[]; compila: (v: Record<string, string>) => Compilato | null }

const INVARIATO = 'Keep the identity, face, pose and everything else unchanged.'
/** [id, nome, icona, frase in inglese] */
type Voce = [string, string, string, string]
const op = (l: Voce[]): Opzione[] => l.map(([id, nome, icona, frase]) => ({ id, nome, icona, frase }))
const frase = (o: Opzione[], id: string | undefined): string => o.find((x) => x.id === id)?.frase || ''

const COLORI = op([
  ['#111111', 'Nero', '#111111', 'black'], ['#5a3a22', 'Castano', '#5a3a22', 'dark brown'], ['#e6c880', 'Biondo', '#e6c880', 'blonde'], ['#b5361f', 'Rosso', '#b5361f', 'copper red'],
  ['#aaaaaa', 'Grigio', '#aaaaaa', 'silver gray'], ['#f2f2f2', 'Bianco', '#f2f2f2', 'white'], ['#2563eb', 'Blu', '#2563eb', 'electric blue'], ['#16a34a', 'Verde', '#16a34a', 'green'],
  ['#ec4899', 'Rosa', '#ec4899', 'pink'], ['#9333ea', 'Viola', '#9333ea', 'purple']
])
const ESPRESSIONI = op([
  ['sorriso', 'Sorriso', '😊', 'a warm natural smile'], ['ride', 'Ride', '😂', 'laughing out loud'], ['serio', 'Serio', '😐', 'a serious, neutral look'],
  ['sorpreso', 'Sorpreso', '😮', 'a surprised look with wide eyes'], ['triste', 'Triste', '😢', 'a sad look'], ['occhiolino', 'Occhiolino', '😉', 'a playful wink']
])
const BARBE = op([
  ['rasata', 'Rasata', '🪒', 'a clean-shaven face, with no beard or stubble'], ['ombra', 'Ombra', '😶', 'a light stubble'], ['corta', 'Corta', '🧔‍♂️', 'a short trimmed beard'], ['folta', 'Folta', '🧔', 'a full thick beard']
])
const CAPI = op([
  ['giacca', 'Giacca', '🧥', 'a jacket'], ['abito', 'Abito', '👗', 'a dress'], ['maglia', 'Maglia', '👕', 'a sweater'], ['pantaloni', 'Pantaloni', '👖', 'trousers'],
  ['cappotto', 'Cappotto', '🧣', 'a long coat'], ['cappello', 'Cappello', '🎩', 'a hat'], ['scarpe', 'Scarpe', '👟', 'a pair of shoes']
])
const MATERIALI = op([['jeans', 'Jeans', '🔷', 'denim'], ['seta', 'Seta', '🎀', 'silk'], ['pelle', 'Pelle', '🟫', 'leather'], ['lana', 'Lana', '🧶', 'wool'], ['metallo', 'Metallo', '⚙️', 'metallic fabric']])
const OBIETTIVI = op(['14', '24', '35', '50', '85', '200'].map((n): Voce => [n, `${n}mm`, n, `${n}mm`]))
/** il quadrante 3×3 attorno al soggetto: 8 direzioni (il centro non c'è) */
const DIREZIONI = op([
  ['tl', 'Alto sinistra', '↖', 'the upper left'], ['t', 'Sopra', '↑', 'directly above'], ['tr', 'Alto destra', '↗', 'the upper right'],
  ['l', 'Sinistra', '←', 'the left side'], ['r', 'Destra', '→', 'the right side'],
  ['bl', 'Basso sinistra', '↙', 'the lower left'], ['b', 'Sotto', '↓', 'directly below'], ['br', 'Basso destra', '↘', 'the lower right']
])
const QUALITA_LUCE = op([['morbida', 'Morbida', '☁️', 'soft diffused light with gentle shadows'], ['dura', 'Dura', '☀️', 'hard direct light with crisp defined shadows']])
const LINGUE = op([
  ['en', 'Inglese', '🇬🇧', 'English'], ['es', 'Spagnolo', '🇪🇸', 'Spanish'], ['fr', 'Francese', '🇫🇷', 'French'], ['de', 'Tedesco', '🇩🇪', 'German'], ['ja', 'Giapponese', '🇯🇵', 'Japanese'], ['zh', 'Cinese', '🇨🇳', 'Simplified Chinese']
])
const POSIZIONI = op([
  ['tl', 'Alto sinistra', '◤', 'in the top left corner'], ['t', 'In alto', '▀', 'across the top'], ['tr', 'Alto destra', '◥', 'in the top right corner'],
  ['l', 'A sinistra', '▌', 'on the left side'], ['c', 'Al centro', '■', 'in the center'], ['r', 'A destra', '▐', 'on the right side'],
  ['bl', 'Basso sinistra', '◣', 'in the bottom left corner'], ['b', 'In basso', '▄', 'across the bottom'], ['br', 'Basso destra', '◢', 'in the bottom right corner']
])
const FORMATI_TESTO = op([
  ['titolo', 'Titolo', '🅰️', 'as a huge bold sans-serif headline'], ['cartello', 'Cartello', '🪧', 'on a wooden sign placed naturally in the scene'],
  ['meme', 'Meme', '😂', 'as bold white Impact-style letters with a black outline'], ['firma', 'Firma', '✍️', 'as a small elegant handwritten signature']
])
const SFONDI = op([['bianco', 'Bianco', '⬜', 'a plain pure white'], ['grigio', 'Grigio', '◻️', 'a neutral light gray studio'], ['sfumato', 'Sfumato', '🌫️', 'a soft blurred gradient']])

const ORE = ['', 'at dawn with soft pink and orange light on the horizon', 'in the bright clear morning', 'at noon under harsh overhead sun', 'at sunset with a glowing golden-red sky', 'at blue hour just after sunset, deep blue sky with warm lights', 'at night with a dark sky and artificial lights']
const EPOCHE = ['', 'ancient Rome: marble columns, togas, Mediterranean sun', 'the Middle Ages: stone buildings, period clothes, torch light', 'the 1920s: art deco style, period clothes and cars, sepia tones', 'the 1980s: neon, big hair, retro tech and film grain', 'a far future: sleek technology, holograms, silver architecture']

const griglia = (id: string, categoria: string, nome: string, icona: string, voci: Voce[], compila: (frase: string) => string, lora?: ChiaveLora[]): Controllo => {
  const opzioni = op(voci)
  return { id, categoria, nome, icona, tooltip: nome, tipo: 'multi', parti: [{ id: 'scelta', tipo: 'griglia', nome, opzioni }], compila: (v) => {
    const f = frase(opzioni, v.scelta)
    return f ? { frase: compila(f), lora } : null
  } }
}

export const CONTROLLI: Controllo[] = [
  griglia('capelli', 'persone', 'Acconciatura', '💇', [
    ['corti', 'Corti', '👨', 'short cropped hair'], ['lunghi', 'Lunghi', '👩', 'long flowing hair'], ['ricci', 'Ricci', '🧑‍🦱', 'curly hair'], ['lisci', 'Lisci', '👩‍🦰', 'straight hair'],
    ['coda', 'Coda', '🎀', 'a ponytail'], ['trecce', 'Trecce', '🪢', 'braided hair'], ['bob', 'Caschetto', '👩‍🦳', 'a bob haircut'], ['rasati', 'Rasati', '🪒', 'a shaved head']
  ], (f) => `Give the person ${f}. Keep the face, expression, clothing and everything else unchanged.`),
  griglia('animale', 'persone', 'Animale', '🐾', [
    ['cane', 'Cane', '🐕', 'a dog'], ['gatto', 'Gatto', '🐈', 'a cat'], ['cavallo', 'Cavallo', '🐎', 'a horse'], ['uccello', 'Uccello', '🐦', 'a bird'], ['drago', 'Drago', '🐉', 'a friendly dragon']
  ], (f) => `Add ${f} next to the subject, naturally integrated with matching light, shadows and scale. Keep everything else unchanged.`),
  griglia('costume', 'vestiti', 'Costume', '🎭', [
    ['astronauta', 'Astronauta', '🧑‍🚀', 'an astronaut'], ['cavaliere', 'Cavaliere', '🛡️', 'a medieval knight'], ['pirata', 'Pirata', '🏴‍☠️', 'a pirate'], ['supereroe', 'Supereroe', '🦸', 'a superhero'],
    ['samurai', 'Samurai', '⚔️', 'a samurai'], ['mago', 'Mago', '🧙', 'a wizard'], ['chef', 'Chef', '👨‍🍳', 'a chef'], ['medico', 'Medico', '🩺', 'a doctor'], ['sposa', 'Sposa', '👰', 'a bride']
  ], (f) => `Dress the person as ${f}. Keep face, hair, pose and background unchanged.`, ['vestiti']),
  griglia('luogo', 'situazioni', 'Luogo', '🌍', [
    ['citta', 'Città', '🏙️', 'a lively city street'], ['spiaggia', 'Spiaggia', '🏖️', 'a tropical beach'], ['montagna', 'Montagna', '🏔️', 'a mountain landscape'], ['bosco', 'Bosco', '🌲', 'a lush forest'], ['deserto', 'Deserto', '🏜️', 'a sandy desert'],
    ['interno', 'Interno', '🏠', 'a cozy interior'], ['studio-bianco', 'Studio', '⬜', 'a white photography studio'], ['spazio', 'Spazio', '🪐', 'outer space with stars and planets'], ['sott-acqua', 'Sott’acqua', '🐠', 'an underwater scene'], ['futuro', 'Futuro', '🛸', 'a futuristic city']
  ], (f) => `Place the subject in ${f}, matching lighting, perspective and scale. Keep the subject exactly the same.`),
  griglia('meteo', 'situazioni', 'Meteo', '🌦️', [
    ['sole', 'Sole', '☀️', 'bright sunshine'], ['nuvole', 'Nuvole', '☁️', 'an overcast sky'], ['pioggia', 'Pioggia', '🌧️', 'rain with wet reflections'], ['neve', 'Neve', '❄️', 'fresh falling snow'], ['nebbia', 'Nebbia', '🌫️', 'thick atmospheric fog'], ['temporale', 'Temporale', '⛈️', 'a dramatic thunderstorm']
  ], (f) => `Show the same scene with ${f}. Keep the composition and subjects identical.`, ['coerenza']),
  griglia('stagione', 'situazioni', 'Stagione', '🍂', [
    ['primavera', 'Primavera', '🌸', 'spring with blooming flowers'], ['estate', 'Estate', '☀️', 'summer with lush foliage'], ['autunno', 'Autunno', '🍁', 'autumn with orange leaves'], ['inverno', 'Inverno', '❄️', 'winter with bare trees and frost']
  ], (f) => `Change the season to ${f}. Keep the composition and subjects identical.`, ['coerenza']),
  griglia('inquadratura', 'prospettiva', 'Inquadratura', '📷', [
    ['dettaglio', 'Dettaglio', '🔎', 'an extreme detail close-up'], ['primo', 'Primo piano', '🙂', 'a close-up portrait'], ['busto', 'Busto', '👤', 'a waist-up portrait'], ['intera', 'Intera', '🧍', 'a full-body shot'], ['largo', 'Campo largo', '🌄', 'a wide establishing shot']
  ], (f) => `Reframe the photograph as ${f}. Keep the same subject, outfit, colors and lighting.`, ['camera']),
  griglia('mood', 'luce', 'Atmosfera luce', '💡', [
    ['studio', 'Studio', '💡', 'soft studio lighting'], ['oro', 'Ora d’oro', '🌅', 'warm golden-hour light'], ['controluce', 'Controluce', '🌞', 'strong backlight and glowing rim light'], ['neon', 'Neon', '🌃', 'magenta and cyan neon'], ['drammatica', 'Drammatica', '🎭', 'dramatic low-key lighting'], ['candela', 'Candela', '🕯️', 'warm candlelight']
  ], (f) => `Relight the photo with ${f}. Keep subject, pose and composition identical.`, ['coerenza']),
  griglia('grading', 'luce', 'Colore', '🎨', [
    ['pellicola', 'Pellicola', '🎞️', 'a soft film color grade with fine grain'], ['bn', 'B/N', '◐', 'classic black and white tones'], ['vivace', 'Vivace', '🌈', 'rich vibrant but natural colors'], ['cinema', 'Cinema', '🎬', 'a cinematic color grade'], ['colora', 'Colora', '🖌️', 'realistic natural colors instead of black and white']
  ], (f) => `Give the photo ${f}. Keep the composition and all details identical.`, ['coerenza']),
  // ---- Persone
  {
    id: 'eta', categoria: 'persone', tipo: 'cursore', nome: 'Età', icona: '⏳', tooltip: 'Più giovane o più anziano: lo zero lascia com\'è', min: -30, max: 30, neutro: 0, estremi: ['🧒', '🧓'],
    compila: (v) => (v === 0 ? null : { lora: ['coerenza'], frase: v > 0 ? `Age the person by about ${v} years: gray hair, wrinkles, same person. ${INVARIATO}` : `Make the person look about ${-v} years younger: smoother skin, fewer wrinkles, same person. ${INVARIATO}` })
  },
  {
    id: 'espressione', categoria: 'persone', tipo: 'multi', nome: 'Espressione', icona: '🙂', tooltip: 'Cambia l\'espressione del viso',
    parti: [{ id: 'esp', tipo: 'griglia', nome: 'Espressione', opzioni: ESPRESSIONI }],
    compila: (v) => (v.esp ? { lora: ['coerenza'], frase: `Change the facial expression of the person to ${frase(ESPRESSIONI, v.esp)}. ${INVARIATO}` } : null)
  },
  {
    id: 'colore-capelli', categoria: 'persone', tipo: 'multi', nome: 'Capelli', icona: '💇', tooltip: 'Colore dei capelli',
    parti: [{ id: 'col', tipo: 'colori', nome: 'Colore', opzioni: COLORI }],
    compila: (v) => (v.col ? { lora: ['coerenza'], frase: `Change the hair color to ${frase(COLORI, v.col)}. Keep the hairstyle, face and everything else unchanged.` } : null)
  },
  {
    id: 'barba', categoria: 'persone', tipo: 'multi', nome: 'Barba', icona: '🧔', tooltip: 'Barba: dalla rasatura alla barba folta',
    parti: [{ id: 'barba', tipo: 'griglia', nome: 'Barba', opzioni: BARBE }],
    compila: (v) => (v.barba ? { frase: `Give the person ${frase(BARBE, v.barba)}. Keep the face, expression and everything else unchanged.` } : null)
  },
  // ---- Vestiti
  {
    id: 'capo', categoria: 'vestiti', tipo: 'multi', nome: 'Capo su misura', icona: '👗', tooltip: 'Scegli il capo, il colore e il materiale',
    parti: [
      { id: 'capo', tipo: 'griglia', nome: 'Capo', opzioni: CAPI },
      { id: 'colore', tipo: 'colori', nome: 'Colore', opzioni: COLORI },
      { id: 'materiale', tipo: 'griglia', nome: 'Materiale', opzioni: MATERIALI }
    ],
    compila: (v) => {
      const capo = frase(CAPI, v.capo)
      if (!capo) return null
      const stoffa = [frase(COLORI, v.colore), frase(MATERIALI, v.materiale)].filter(Boolean).join(' ')
      return { lora: ['vestiti'], frase: `Dress the person in ${capo}${stoffa ? ` in ${stoffa}` : ''}. Keep their face, hair, hands, pose and the background exactly the same.` }
    }
  },
  // ---- Situazioni
  {
    id: 'ora', categoria: 'situazioni', tipo: 'cursore', nome: 'Ora del giorno', icona: '🕒', tooltip: 'Dall\'alba alla notte: la scena resta, cambia la luce del giorno', min: 0, max: 6, neutro: 0, estremi: ['🌅', '🌙'],
    etichette: ['—', 'Alba', 'Mattino', 'Mezzogiorno', 'Tramonto', 'Ora blu', 'Notte'],
    compila: (v) => (ORE[v] ? { lora: ['coerenza'], frase: `Show the exact same scene ${ORE[v]}. Keep the composition and all subjects identical; only the time of day and lighting change.` } : null)
  },
  {
    id: 'epoca', categoria: 'situazioni', tipo: 'cursore', nome: 'Epoca', icona: '📜', tooltip: 'Porta la scena in un\'altra epoca: dal passato al futuro', min: 0, max: 5, neutro: 0, estremi: ['🏛️', '🛸'],
    etichette: ['—', 'Antica Roma', 'Medioevo', 'Anni \'20', 'Anni \'80', 'Futuro'],
    compila: (v) => (EPOCHE[v] ? { frase: `Reimagine the photo in ${EPOCHE[v]}. Keep the subject's face and identity recognizable and the composition similar.` } : null)
  },
  {
    id: 'folla', categoria: 'situazioni', tipo: 'cursore', nome: 'Folla', icona: '👥', tooltip: 'Aggiunge persone sullo sfondo: poche, tante, una folla', min: 0, max: 3, neutro: 0, estremi: ['🧍', '👥'],
    etichette: ['—', 'Poche', 'Tante', 'Folla'],
    compila: (v) => (v ? { frase: `Add ${['', 'a few passers-by', 'many people', 'a dense crowd'][v]} in the background, naturally integrated with matching lighting, scale and perspective. Keep the main subject and everything else unchanged.` } : null)
  },
  // ---- Prospettiva
  {
    id: 'altezza', categoria: 'prospettiva', tipo: 'cursore', nome: 'Altezza camera', icona: '📐', tooltip: 'Da sotto in su a dall\'alto in giù', min: -2, max: 2, neutro: 0, estremi: ['⬇️', '⬆️'],
    compila: (v) => (v === 0 ? null : { lora: ['camera'], frase: `Re-shoot the photo from ${{ '-2': 'a very low angle looking steeply up', '-1': 'a low angle looking up', '1': 'a high angle looking down', '2': 'directly above, a top-down view' }[String(v)]}. Keep the same subject, outfit, colors and lighting.` })
  },
  {
    id: 'obiettivo', categoria: 'prospettiva', tipo: 'multi', nome: 'Obiettivo', icona: '🔭', tooltip: 'La lunghezza focale: grandangolo o tele',
    parti: [{ id: 'mm', tipo: 'griglia', nome: 'Obiettivo', opzioni: OBIETTIVI }],
    compila: (v) => (v.mm ? { frase: `Re-shoot the photo as if taken with a ${v.mm}mm lens: ${Number(v.mm) <= 24 ? 'wide-angle perspective with stretched depth' : Number(v.mm) >= 85 ? 'compressed telephoto perspective with a softly blurred background' : 'natural perspective'}. Keep the same subject, outfit, colors and lighting.` } : null)
  },
  // ---- Luce e colore
  {
    id: 'luce', categoria: 'luce', tipo: 'multi', nome: 'Luce su misura', icona: '💡', tooltip: 'Da dove arriva la luce, com\'è e di che colore',
    parti: [
      { id: 'dir', tipo: 'quadrante', nome: 'Direzione', opzioni: DIREZIONI },
      { id: 'qualita', tipo: 'griglia', nome: 'Qualità', opzioni: QUALITA_LUCE },
      { id: 'colore', tipo: 'colori', nome: 'Colore della luce', opzioni: COLORI }
    ],
    compila: (v) => {
      if (!v.dir && !v.qualita && !v.colore) return null
      const d = frase(DIREZIONI, v.dir)
      const q = frase(QUALITA_LUCE, v.qualita)
      const c = frase(COLORI, v.colore)
      return { lora: ['coerenza'], frase: `Relight the photo${d ? ` with the main light coming from ${d}` : ''}${q ? `, ${q}` : ''}${c ? `, with a ${c} tint on the light` : ''}. Keep the subject, pose, clothing and composition identical.` }
    }
  },
  {
    id: 'temperatura', categoria: 'luce', tipo: 'cursore', nome: 'Temperatura', icona: '🌡️', tooltip: 'Dal freddo al caldo: la striscia colore della luce', min: -2, max: 2, neutro: 0, estremi: ['🧊', '🔥'],
    compila: (v) => (v === 0 ? null : { lora: ['coerenza'], frase: `Shift the color temperature of the photo ${{ '-2': 'to a strongly cold blue tone', '-1': 'to a slightly cold tone', '1': 'to a slightly warm tone', '2': 'to a strongly warm golden-orange tone' }[String(v)]}. Keep everything else identical.` })
  },
  // ---- Testi
  {
    id: 'lingua', categoria: 'testo', tipo: 'multi', nome: 'Traduci i testi', icona: '🌐', tooltip: 'Traduce le scritte nella foto, con lo stesso stile',
    parti: [{ id: 'lingua', tipo: 'griglia', nome: 'Lingua', opzioni: LINGUE }],
    compila: (v) => (v.lingua ? { lora: ['coerenza'], frase: `Translate all the text in the photo into ${frase(LINGUE, v.lingua)}, keeping the same fonts, layout, colors and style. Change nothing else.` } : null)
  },
  {
    id: 'titolo', categoria: 'testo', tipo: 'multi', nome: 'Aggiungi un testo', icona: '🔤', tooltip: 'Scrivi il testo e scegli dove va e come',
    parti: [
      { id: 'dove', tipo: 'quadrante', nome: 'Dove', opzioni: POSIZIONI },
      { id: 'come', tipo: 'griglia', nome: 'Come', opzioni: FORMATI_TESTO },
      { id: 'testo', tipo: 'testo', nome: 'Il testo', esempio: 'BUON COMPLEANNO' }
    ],
    compila: (v) => {
      const t = (v.testo || '').trim()
      if (!t) return null
      return { frase: `Add the text "${t}" ${frase(POSIZIONI, v.dove) || 'in a natural place'}, ${frase(FORMATI_TESTO, v.come) || 'in clean readable letters'}. Spell every letter exactly as written, with good contrast. Keep the rest of the image identical.` }
    }
  },
  // ---- Ritocco
  {
    id: 'dettagli', categoria: 'ritocco', tipo: 'cursore', nome: 'Dettagli', icona: '🔎', tooltip: 'Nitidezza e dettagli fini', min: 0, max: 2, neutro: 0, estremi: ['·', '✦'], etichette: ['—', 'Nitida', 'Molto nitida'],
    compila: (v) => (v ? { lora: ['coerenza'], frase: `Enhance the image quality: ${v === 1 ? 'sharp fine details' : 'very sharp ultra-fine details'}, clean textures, no noise or compression artifacts. Keep everything identical.` } : null)
  },
  {
    id: 'pelle', categoria: 'ritocco', tipo: 'cursore', nome: 'Pelle', icona: '✨', tooltip: 'Dalla pelle naturale a quella liscia', min: 0, max: 2, neutro: 0, estremi: ['🧑', '🪞'], etichette: ['—', 'Naturale', 'Liscia'],
    compila: (v) => (v ? { lora: ['coerenza'], frase: v === 1 ? 'Retouch the skin naturally: remove blemishes but keep realistic pores and texture. Keep everything else identical.' : 'Retouch the skin to a smooth, polished beauty finish while keeping the person recognizable. Keep everything else identical.' } : null)
  },
  {
    id: 'sfondo-colore', categoria: 'ritocco', tipo: 'multi', nome: 'Cambia sfondo', icona: '🏞️', tooltip: 'Sfondo pulito: bianco, grigio, sfumato o un colore',
    parti: [
      { id: 'tipo', tipo: 'griglia', nome: 'Sfondo', opzioni: SFONDI },
      { id: 'colore', tipo: 'colori', nome: 'Oppure un colore', opzioni: COLORI }
    ],
    compila: (v) => {
      const t = v.colore ? `a plain solid ${frase(COLORI, v.colore)}` : frase(SFONDI, v.tipo)
      return t ? { frase: `Replace the background with ${t} background. Keep the subject, its edges and everything in front of the background exactly the same.` } : null
    }
  }
]

export const controlliDi = (categoria: string): Controllo[] => CONTROLLI.filter((c) => c.categoria === categoria)
/** Restano le azioni a un clic e i segnaposto foto; le varianti sono nei controlli, non in un secondo catalogo. */
const AZIONI_DIRETTE = new Set(['persona-rif', 'persona-agg', 'persona-togli', 'occhi', 'occhiali', 'prova', 'svuota', 't-cambia', 't-togli', 'sfondo-via', 'restaura', 'foto-lavoro'])
export const rapidaVisibile = (r: Rapida): boolean => AZIONI_DIRETTE.has(r.id) || r.id.startsWith('z-')
export const prefissoIdea = (id: string): string => `ctl-${id}:`

/** i valori di una riga multipla stanno in una stringa `parte=valore;parte=valore` (i valori sono codificati) */
export const scriviMulti = (v: Record<string, string>): string =>
  Object.entries(v).filter(([, x]) => x).map(([k, x]) => `${k}=${encodeURIComponent(x)}`).join(';')
export const leggiMulti = (s: string): Record<string, string> => Object.fromEntries(s.split(';').flatMap((p) => {
  const i = p.indexOf('=')
  if (i < 1) return []
  try { return [[p.slice(0, i), decodeURIComponent(p.slice(i + 1))]] } catch { return [] }
}))

/** la «voce» (idea) che un controllo produce con quel valore, o null se spento. Il valore sta nell'id: `ctl-eta:10` */
export function ideaDa(c: Controllo, valore: string): Rapida | null {
  let k: Compilato | null
  if (c.tipo === 'cursore') {
    const n = Number(valore)
    if (!Number.isInteger(n) || n < c.min || n > c.max) return null
    k = c.compila(n)
  } else {
    const valori = leggiMulti(valore)
    const validi = Object.fromEntries(c.parti.flatMap((p) => {
      const v = valori[p.id]
      return v && (p.tipo === 'testo' || p.opzioni.some((o) => o.id === v)) ? [[p.id, v]] : []
    }))
    k = c.compila(validi)
  }
  if (!k || !k.frase.trim()) return null
  return { id: prefissoIdea(c.id) + valore, nome: c.nome, prompt: k.frase, lora: k.lora }
}

/** il valore attuale di un controllo, letto dalle idee attive (il neutro se è spento) */
export function valoreDa(c: Controllo, idee: Pick<Rapida, 'id'>[]): string {
  const x = idee.find((r) => r.id.startsWith(prefissoIdea(c.id)))
  return x ? x.id.slice(prefissoIdea(c.id).length) : c.tipo === 'cursore' ? String(c.neutro) : ''
}

/** mette (o toglie, se spento) l'idea del controllo nelle idee attive */
export function conControllo<T extends Pick<Rapida, 'id'>>(idee: T[], c: Controllo, valore: string): (T | Rapida)[] {
  const senza = idee.filter((r) => !r.id.startsWith(prefissoIdea(c.id)))
  const idea = ideaDa(c, valore)
  return idea ? [...senza, idea] : senza
}
