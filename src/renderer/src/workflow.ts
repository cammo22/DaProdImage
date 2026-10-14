// I workflow del Laboratorio: cose che si fanno in più passi, già pronte. Due tipi:
//  - serie: tutti i passi partono dalla stessa foto (il personaggio in 9 pose, il soggetto in 10 stili…)
//  - catena: ogni passo parte dal risultato del precedente (restauro → colore → dettagli, la casa fra 10, 50, 100 anni…)
// Ogni passo è un lavoro normale della coda: si vede nella barra in basso, finisce in galleria con le sue impostazioni,
// e qui si raccoglie tutto in una griglia con il prima/dopo e il "foglio" unico da condividere.
import { create } from 'zustand'
import { api, urlFile } from './api'
import { ascoltatoriLavoro, usaStato, type FotoBase, type Qualita } from './stato'
import { fileLoraCamera, loraPer, perQualita, richiestaBase, fotoDaOpera } from './azioni'
import { PRESET, campiCon, componiPreset } from './preset'
import { componiCamera } from './componenti/Camera'
import { dimensioniRis } from './util'
import { conMisura, type Misura } from './componenti/Misura'
import { usaRicette, type RicettaUtente } from './ricette'
import { SISTEMA_SORPRESA } from './azioni'
import type { ChiaveLora } from './rapide'
import type { Richiesta } from '@shared/tipi'

export type Ingresso =
  | { id: string; tipo: 'testo' | 'righe'; nome: string; esempio: string; opzionale?: boolean }
  | { id: string; tipo: 'scelta'; nome: string; opzioni: { id: string; nome: string }[]; predefinita: string }

export interface Ctx {
  v: Record<string, string>
  nRif: number
  /** c'è il LoRA delle angolazioni */
  camera: boolean
}

export interface PassoWf {
  etichetta: string
  prompt: string
  trasparente?: boolean
  lora?: ChiaveLora[]
  /** disegna da zero (con i riferimenti, se ci sono) invece di modificare la foto */
  crea?: { formato: string; ris?: number }
  /** usa solo il riferimento n (per i workflow dove ogni riferimento è un passo) */
  soloRif?: number
  /** il prompt lo inventa il modello al momento di partire (il passo "Sorpresa") */
  sorpresa?: boolean
}

export interface Workflow {
  id: string
  nome: string
  categoria: string
  icona: string
  descrizione: string
  modo: 'serie' | 'catena'
  /** serve la foto da cambiare? se no, il workflow disegna da zero */
  foto: boolean
  /** foto di riferimento: non servono, sono facoltative, ne serve almeno una, o ogni riferimento è un passo */
  rif: 'no' | 'si' | 'serve' | 'ognuno'
  rifNome?: string
  ingressi: Ingresso[]
  passi: (c: Ctx) => PassoWf[]
  /** a cosa serve il LoRA, se ce n'è uno che aiuta */
  nota?: string
  /** una ricetta fatta da te */
  utente?: boolean
}

export const CATEGORIE_WF: { id: string; nome: string; icona: string; testo: string }[] = [
  { id: 'personaggio', nome: 'Personaggio', icona: 'ritratto', testo: 'Una foto, tutte le pose, le espressioni, le età' },
  { id: 'look', nome: 'Vestiti e look', icona: 'vestiti', testo: 'Armadio, acconciature, ruoli e costumi' },
  { id: 'camera', nome: 'Camera e angoli', icona: 'camera', testo: 'Giri attorno al soggetto, inquadrature, viste' },
  { id: 'luce', nome: 'Luce e momento', icona: 'luce', testo: 'Giorno intero, stagioni, meteo, luci da studio' },
  { id: 'whatif', nome: 'What if…?', icona: 'situazione', testo: 'E se fosse in un\'altra epoca, in un altro mondo' },
  { id: 'stili', nome: 'Stili e arte', icona: 'arte', testo: 'La stessa foto in dieci stili, giocattoli, oggetti' },
  { id: 'prodotto', nome: 'Prodotto e business', icona: 'prodotto', testo: 'Foto da catalogo, mockup, formati social' },
  { id: 'grafica', nome: 'Testi e grafica', icona: 'poster', testo: 'Poster, loghi, infografiche in tutti gli stili, testi sulle foto' },
  { id: 'sticker', nome: 'Sticker e icone', icona: 'sticker', testo: 'Sticker, emoji e icone di qualsiasi cosa: animali, cibo, oggetti, personaggi' },
  { id: 'casa', nome: 'Casa e spazi', icona: 'casa', testo: 'Ristruttura, cambia pareti, arreda' },
  { id: 'ritocco', nome: 'Ritocco e restauro', icona: 'bacchetta', testo: 'Foto vecchie, ritratti, dal disegno al render' }
]

const E = (etichetta: string, prompt: string, extra: Partial<PassoWf> = {}): PassoWf => ({ etichetta, prompt, ...extra })
const FOTO = 'the photo <image1>'
const SFONDO: Ingresso = {
  id: 'sfondo', tipo: 'scelta', nome: 'Sfondo', predefinita: 'orig',
  opzioni: [{ id: 'orig', nome: 'Come la foto' }, { id: 'bianco', nome: 'Bianco' }, { id: 'grigio', nome: 'Grigio studio' }]
}
const sfondoDi = (v: Record<string, string>): string =>
  v.sfondo === 'bianco' ? 'Use a plain pure white background.' : v.sfondo === 'grigio' ? 'Use a neutral light gray studio background.' : 'Keep a background similar to the original.'
const TESTO: Ingresso = { id: 'testo', tipo: 'testo', nome: 'Il testo', esempio: 'BUON COMPLEANNO' }
/** il testo fra virgolette, senza virgolette doppie dentro */
const t = (c: Ctx, id = 'testo', def = 'TEXT'): string => `"${(c.v[id] || def).trim().replace(/"/g, "'")}"`
const righe = (s: string | undefined): string[] => (s || '').split('\n').map((x) => x.trim()).filter(Boolean)

// ---------------------------------------------------------------------------------------------------------------
// i workflow fatti a mano
// ---------------------------------------------------------------------------------------------------------------
const POSE: [string, string][] = [
  ['In piedi', 'standing straight with arms crossed, confident'],
  ['Seduto', 'sitting on a chair, relaxed'],
  ['Cammina', 'walking forward, mid-step'],
  ['Corre', 'running dynamically'],
  ['Salta', 'jumping in the air with joy'],
  ['Saluta', 'waving hello with one hand'],
  ['Di profilo', 'in a side profile view, looking ahead'],
  ['Guarda indietro', 'seen from behind, looking back over the shoulder'],
  ['Appoggiato', 'leaning casually against a wall']
]
const ESPRESSIONI: [string, string][] = [
  ['Felice', 'a warm genuine smile'], ['Ride', 'laughing out loud'], ['Triste', 'a sad, teary look'], ['Arrabbiato', 'an angry frown'],
  ['Sorpreso', 'a surprised look with wide eyes and open mouth'], ['Spaventato', 'a frightened look'], ['Pensieroso', 'a thoughtful, pensive look'], ['Occhiolino', 'a playful wink']
]
const ARMADIO: [string, string][] = [
  ['Elegante', 'a tailored dark suit with a crisp white shirt'], ['Casual', 'jeans, a white t-shirt and sneakers'], ['Sportivo', 'a modern athletic tracksuit'],
  ['Invernale', 'a warm winter coat, scarf and wool hat'], ['Estate', 'light summer clothes: linen shirt and shorts'], ['Serata', 'an elegant evening outfit'],
  ['Business', 'a smart business outfit'], ['Halloween', 'a spooky Halloween costume']
]
const CAPELLI: [string, string][] = [
  ['Biondo', 'blonde hair'], ['Rosso', 'bright copper-red hair'], ['Nero lungo', 'long straight jet-black hair'], ['Ricci', 'voluminous curly hair'],
  ['Rasato', 'a short buzz cut'], ['Caschetto', 'a sleek bob haircut'], ['Coda alta', 'a high ponytail'], ['Blu', 'electric blue dyed hair']
]
const RUOLI: [string, string][] = [
  ['Astronauta', 'an astronaut in a realistic white space suit on a spaceship deck'], ['Cavaliere', 'a medieval knight in detailed armor in a castle courtyard'],
  ['Pirata', 'a pirate captain on the deck of a ship at sea'], ['Supereroe', 'a superhero in a cape on a city rooftop at dusk'],
  ['Detective', 'a noir detective in a trench coat on a rainy street at night'], ['Chef', 'a professional chef in a busy restaurant kitchen'],
  ['Samurai', 'a samurai in traditional armor in a bamboo forest'], ['Mago', 'a wizard in a starry robe in an ancient library']
]
const INQUADRATURE: [string, string][] = [
  ['Primo piano', 'Re-frame as a tight close-up on the face'], ['Mezzo busto', 'Re-frame as a medium shot from the waist up'], ['Figura intera', 'Re-frame as a full-body shot showing the whole figure'],
  ['Grandangolo', 'Re-shoot with a wide-angle lens showing a lot of the surroundings'], ['Dall\'alto', 'Re-shoot from a high angle looking down'], ['Dal basso', 'Re-shoot from a low angle looking up']
]
const GIORNO: [string, string][] = [
  ['Alba', 'at dawn with soft pink and orange light on the horizon'], ['Mattino', 'in the bright clear morning'], ['Mezzogiorno', 'at noon under harsh overhead sun'],
  ['Tramonto', 'at sunset with a glowing golden-red sky'], ['Ora blu', 'at blue hour just after sunset, deep blue sky with warm lights'], ['Notte', 'at night with a dark sky and artificial lights']
]
const STAGIONI: [string, string][] = [
  ['Primavera', 'in spring: blooming flowers and fresh green leaves'], ['Estate', 'in summer: lush green, strong warm sunlight'],
  ['Autunno', 'in autumn: orange and red leaves, soft golden light'], ['Inverno', 'in winter: covered with snow, cold blue light']
]
const METEO: [string, string][] = [
  ['Sole', 'on a perfect sunny day'], ['Nuvoloso', 'under a heavy overcast sky'], ['Pioggia', 'in steady rain with wet surfaces and reflections'],
  ['Neve', 'in falling snow'], ['Nebbia', 'in thick atmospheric fog'], ['Temporale', 'during a dramatic thunderstorm with dark clouds and lightning']
]
const LUCI: [string, string][] = [
  ['Studio morbido', 'soft professional studio lighting'], ['Rembrandt', 'Rembrandt lighting with a triangle of light on the cheek'], ['Controluce', 'strong backlight with a glowing rim light'],
  ['Neon', 'colorful magenta and cyan neon lights'], ['Candela', 'warm flickering candlelight in a dark room'], ['Drammatica', 'dramatic low-key lighting with deep shadows']
]
const EPOCHE: [string, string][] = [
  ['Anni \'20', 'the 1920s: art deco style, period clothes and cars, sepia tones'], ['Anni \'50', 'the 1950s: retro diner era, period clothes, pastel colors'],
  ['Anni \'80', 'the 1980s: neon, big hair, retro tech and film grain'], ['Medioevo', 'the Middle Ages: stone buildings, period clothes, torch light'],
  ['Antica Roma', 'ancient Rome: marble columns, togas, Mediterranean sun'], ['Western', 'the Wild West: dusty frontier town, cowboy clothes'],
  ['Steampunk', 'a steampunk world: brass gears, airships, Victorian clothes'], ['Futuro lontano', 'a far future: sleek technology, holograms, silver architecture']
]
const MONDI: [string, string][] = [
  ['Sott\'acqua', 'underwater with light rays, bubbles and coral'], ['Nello spazio', 'in outer space with planets and a nebula'], ['Deserto', 'in a vast desert with dunes at golden hour'],
  ['Giungla', 'in a dense tropical jungle with mist'], ['Cyberpunk', 'in a rainy cyberpunk city full of neon signs'], ['Post-apocalisse', 'in a ruined post-apocalyptic world overgrown with plants'],
  ['Nel ghiaccio', 'in a frozen arctic landscape with ice and aurora'], ['Fantasy', 'in an epic high-fantasy world with floating islands']
]
const STILI: [string, string][] = [
  ['Anime', 'a high quality anime illustration'], ['Acquerello', 'a delicate watercolor painting'], ['Olio', 'a classical oil painting with visible brush strokes'],
  ['3D cartoon', 'a 3D animated movie render'], ['LEGO', 'a scene built of LEGO bricks and minifigures'], ['Creta', 'a stop-motion claymation scene made of modeling clay'],
  ['Pixel art', 'detailed 32-bit pixel art'], ['Matita', 'a detailed pencil sketch on paper'], ['Fumetto', 'a comic book illustration with bold ink and halftone shading'],
  ['Stampa giapponese', 'a Japanese ukiyo-e woodblock print'], ['Vetrata', 'a stained glass window'], ['Poster retrò', 'a vintage screen-printed travel poster']
]
const GIOCATTOLI: [string, string][] = [
  ['Action figure', 'a collectible action figure sealed in a toy blister pack with a printed card and tiny accessories'],
  ['Pupazzo vinile', 'a cute collectible vinyl pop figure with a big head, on a shelf'],
  ['Peluche', 'a soft plush toy on a bed'], ['Minifigure', 'a LEGO-style minifigure standing on a baseplate'], ['Statuina', 'a hand-painted ceramic figurine on a wooden shelf'],
  ['Diorama', 'a miniature diorama in a glass dome with tilt-shift photography']
]
const OGGETTI: [string, string][] = [
  ['Polaroid', 'an instant Polaroid photo held between two fingers'], ['Francobollo', 'a postage stamp with a perforated border and a postmark'], ['Moneta', 'a golden coin engraved with the portrait in relief'],
  ['Copertina disco', 'a vinyl record album cover, shown as a sleeve on a table'], ['Carta da gioco', 'a vintage playing card with ornate borders'], ['Poster cinema', 'a classic movie poster with dramatic lighting']
]
const PRODOTTO: [string, string][] = [
  ['Sfondo bianco', 'on a clean pure white studio background with a soft natural shadow'], ['Sfondo colorato', 'on a bold pastel colored seamless backdrop, studio lighting'],
  ['Lifestyle', 'in a cozy lifestyle scene on a wooden table with warm morning light and props'], ['Marmo', 'on a white marble slab with soft reflections, luxury look'],
  ['In mano', 'held in a hand, natural light, shallow depth of field'], ['Flat lay', 'in a top-down flat lay with complementary props on a textured surface']
]
const MOCKUP: [string, string][] = [
  ['Maglietta', 'printed on the chest of a white cotton t-shirt, worn by a model, studio photo'], ['Tazza', 'printed on a white ceramic mug on a wooden table, soft light'],
  ['Borsa', 'printed on a natural canvas tote bag hanging on a hook'], ['Poster', 'as a framed poster on a bright living room wall'],
  ['Cartellone', 'on a large city billboard at dusk'], ['Custodia', 'printed on a phone case held in a hand']
]
const FORMATI_SOCIAL: [string, string, number][] = [['1:1 Post', '1:1', 1080], ['4:5 Instagram', '4:5', 1080], ['9:16 Storia', '9:16', 1080], ['16:9 Video', '16:9', 1080], ['2:3 Pinterest', '2:3', 1080]]
const STILI_TESTO: [string, string][] = [
  ['Titolo in alto', 'as a huge bold sans-serif headline across the top'], ['Neon', 'as a glowing neon sign effect'], ['Lettere 3D', 'as big 3D chrome letters'],
  ['Calligrafia', 'in elegant hand-drawn brush calligraphy'], ['Giornale', 'as a newspaper headline'], ['Adesivo', 'as a cute handwritten sticker label']
]
const LINGUE: [string, string][] = [['Inglese', 'English'], ['Spagnolo', 'Spanish'], ['Francese', 'French'], ['Tedesco', 'German'], ['Giapponese', 'Japanese'], ['Cinese', 'Simplified Chinese']]
const ARREDO: [string, string][] = [
  ['Scandinavo', 'Scandinavian style: light wood, white walls, cozy textiles'], ['Industriale', 'industrial loft style: exposed brick, black metal, leather'],
  ['Boho', 'bohemian style: rattan, plants, warm earthy colors'], ['Giapponese', 'minimal Japandi style: low furniture, natural materials'],
  ['Classico', 'classic elegant style: moldings, rich fabrics, chandelier'], ['Moderno lusso', 'modern luxury style: marble, brass, velvet']
]
const PARETI: [string, string][] = [
  ['Bianco', 'warm white'], ['Verde salvia', 'sage green'], ['Blu notte', 'deep navy blue'], ['Terracotta', 'warm terracotta'], ['Grigio', 'soft light gray'], ['Giallo', 'sunny mustard yellow']
]
const RITRATTI: [string, string][] = [
  ['Professionale', 'a professional corporate headshot: neutral studio background, soft lighting, neat clothes'],
  ['Studio grigio', 'a classic studio portrait on a mid-gray backdrop with soft Rembrandt lighting'],
  ['All\'aperto', 'a natural outdoor portrait with a softly blurred green background and golden light'],
  ['Bianco e nero', 'a timeless black and white fine-art portrait with rich tones']
]

const SERIE = (id: string, nome: string, categoria: string, icona: string, descrizione: string, voci: [string, string][], promptDi: (d: string, c: Ctx) => string, extra: Partial<Workflow> = {}, passoExtra: Partial<PassoWf> = {}): Workflow => ({
  id, nome, categoria, icona, descrizione, modo: 'serie', foto: true, rif: 'no', ingressi: [],
  passi: (c) => voci.map(([e, d]) => E(e, promptDi(d, c), passoExtra)),
  ...extra
})

export const WORKFLOW_BASE: Workflow[] = [
  // ---- personaggio
  SERIE('pose', 'Il personaggio in 9 pose', 'personaggio', 'ritratto', 'Una foto del personaggio e lo vedi in piedi, seduto, mentre cammina, corre, salta… sempre lo stesso volto e lo stesso vestito.', POSE,
    (d, c) => `Show the same character from ${FOTO} ${d}. Keep exactly the same face, hairstyle, outfit, colors and art style, with the full body visible. ${sfondoDi(c.v)}`, { ingressi: [SFONDO] }),
  {
    id: 'turnaround', nome: 'Foglio personaggio (turnaround)', categoria: 'personaggio', icona: 'serie', modo: 'serie', foto: true, rif: 'no', ingressi: [],
    descrizione: 'Il personaggio da davanti, di tre quarti, di lato, da dietro e in primo piano: il foglio che serve a disegnatori e modellatori 3D.',
    passi: () => [
      E('Davanti', `Show the same character from ${FOTO} in a neutral standing A-pose, full body, seen from the front. Keep exactly the same face, hair, outfit and colors. Plain white background, flat even lighting.`),
      E('Tre quarti', `Show the same character from ${FOTO} in a neutral standing A-pose, full body, rotated 45 degrees to the right (three-quarter view). Keep exactly the same face, hair, outfit and colors. Plain white background, flat even lighting.`),
      E('Di lato', `Show the same character from ${FOTO} in a neutral standing A-pose, full body, in a perfect side profile view. Keep exactly the same face, hair, outfit and colors. Plain white background, flat even lighting.`),
      E('Tre quarti dietro', `Show the same character from ${FOTO} in a neutral standing A-pose, full body, seen from behind and 45 degrees to the left. Keep exactly the same hair, outfit and colors. Plain white background, flat even lighting.`),
      E('Dietro', `Show the same character from ${FOTO} in a neutral standing A-pose, full body, seen directly from behind. Keep exactly the same hair, outfit and colors. Plain white background, flat even lighting.`),
      E('Volto', `Show a close-up portrait of the face of the same character from ${FOTO}, looking at the camera. Keep exactly the same face, hair and colors. Plain white background.`)
    ]
  },
  SERIE('espressioni', 'Tutte le espressioni', 'personaggio', 'ritratto', 'Felice, ride, triste, arrabbiato, sorpreso, spaventato, pensieroso, occhiolino: lo stesso volto con 8 espressioni.', ESPRESSIONI,
    (d) => `Change the facial expression of the person in ${FOTO} to ${d}. Keep the same identity, hairstyle, clothing, pose and background.`, {}, { lora: ['coerenza'] }),
  {
    id: 'eta', nome: 'A ogni età', categoria: 'personaggio', icona: 'ritratto', modo: 'serie', foto: true, rif: 'no', ingressi: [],
    descrizione: 'La stessa persona a 8, 20, 40, 60 e 80 anni.',
    passi: () => [8, 20, 40, 60, 80].map((n) => E(`${n} anni`, `Show the same person from ${FOTO} as they would look at age ${n}. Keep the identity recognizable, with the same pose, framing and background, and age-appropriate hair, skin and clothes.`))
  },
  {
    id: 'sticker', nome: 'Sticker dal tuo personaggio (emozioni)', categoria: 'sticker', icona: 'sticker', modo: 'serie', foto: true, rif: 'no', ingressi: [],
    descrizione: 'Il tuo personaggio come sticker da chat: 8 emozioni, con il bordo bianco e lo sfondo trasparente.',
    passi: () => ['happy', 'laughing', 'sad crying', 'angry', 'surprised', 'in love with heart eyes', 'sleepy', 'thumbs up'].map((e, i) =>
      E(['Felice', 'Ride', 'Piange', 'Arrabbiato', 'Sorpreso', 'Innamorato', 'Assonnato', 'Pollice su'][i], `Turn the subject of ${FOTO} into a cute chibi die-cut sticker expressing: ${e}. Thick white outline, flat colors, clean vector look, centered. Remove the background, and output a PNG image`, { trasparente: true }))
  },
  // ---- vestiti e look
  {
    id: 'prova', nome: 'Prova i vestiti', categoria: 'look', icona: 'vestiti', modo: 'serie', foto: true, rif: 'ognuno', rifNome: 'le foto dei vestiti (una per ogni capo)', ingressi: [],
    descrizione: 'Una foto della persona e le foto di quanti vestiti vuoi: ti mostra la persona con ognuno. Volto, pose e sfondo non cambiano.',
    nota: 'Con il LoRA "Cambio vestito" la resa è molto migliore.',
    passi: (c) => Array.from({ length: c.nRif }, (_, i) => E(`Vestito ${i + 1}`, `Dress the person in <image1> in the outfit shown in <image2>. Keep their face, hair, hands, pose and the background exactly the same.`, { soloRif: i, lora: ['vestiti'] }))
  },
  SERIE('armadio', 'L\'armadio', 'look', 'vestiti', 'La stessa persona con 8 look diversi: elegante, casual, sportivo, invernale, estate, serata, business, Halloween.', ARMADIO,
    (d) => `Dress the person in ${FOTO} in ${d}. Keep their face, hair, hands, pose and the background exactly the same.`, {}, { lora: ['vestiti'] }),
  SERIE('capelli', 'Nuovo taglio e colore', 'look', 'ritratto', 'Biondo, rosso, nero lungo, ricci, rasato, caschetto, coda alta, blu: 8 acconciature.', CAPELLI,
    (d) => `Change the person's hair in ${FOTO} to ${d}. Keep the face, expression, clothing, pose and background exactly the same.`, {}, { lora: ['coerenza'] }),
  SERIE('ruoli', 'Costumi e ruoli', 'look', 'situazione', 'Astronauta, cavaliere, pirata, supereroe, detective, chef, samurai, mago: la persona in 8 mondi, riconoscibile.', RUOLI,
    (d) => `Show the person from ${FOTO} as ${d}. Keep the face and identity clearly recognizable, with a natural pose, cinematic lighting and a realistic photographic look.`),
  // ---- camera
  {
    id: 'giro', nome: 'Giro intorno al soggetto', categoria: 'camera', icona: 'camera', modo: 'serie', foto: true, rif: 'no', ingressi: [],
    descrizione: 'La camera gira di 45° alla volta attorno al soggetto: 7 nuove viste, fino a vederlo da dietro. Ottimo per oggetti e personaggi.',
    nota: 'Con il LoRA "Camera: angolazioni" le viste sono molto più fedeli.',
    passi: (c) => [45, 90, 135, 180, -135, -90, -45].map((az) =>
      E(az === 180 ? 'Dietro' : `${Math.abs(az)}° ${az > 0 ? 'destra' : 'sinistra'}`, componiCamera({ az, el: 0, dist: 0 }, c.camera), { lora: c.camera ? ['camera'] : [] }))
  },
  SERIE('inquadrature', 'Tutte le inquadrature', 'camera', 'camera', 'Primo piano, mezzo busto, figura intera, grandangolo, dall\'alto, dal basso.', INQUADRATURE,
    (d) => `${d} of ${FOTO}. Keep the same subject, outfit, colors and lighting.`),
  {
    id: 'viste', nome: 'Le quattro viste', categoria: 'camera', icona: 'serie', modo: 'serie', foto: true, rif: 'no', ingressi: [],
    descrizione: 'Davanti, lato, dietro e dall\'alto: per prodotti e oggetti.',
    passi: (c) => [
      E('Davanti', 'Show the same object from the front, centered, on a plain light background. Keep the exact same design, colors and materials.'),
      E('Di lato', c.camera ? '<mva> right side view, eye-level shot' : 'Show the same object from the right side. Keep the exact same design, colors and materials.', { lora: c.camera ? ['camera'] : [] }),
      E('Dietro', c.camera ? '<mva> back view, eye-level shot' : 'Show the same object from behind. Keep the exact same design, colors and materials.', { lora: c.camera ? ['camera'] : [] }),
      E('Dall\'alto', c.camera ? '<mva> front view, top-down shot' : 'Show the same object from directly above, a top-down view. Keep the exact same design, colors and materials.', { lora: c.camera ? ['camera'] : [] })
    ]
  },
  // ---- luce e momento
  SERIE('giorno', 'Un giorno intero', 'luce', 'luce', 'Alba, mattino, mezzogiorno, tramonto, ora blu, notte: la stessa scena a sei ore diverse.', GIORNO,
    (d) => `Show the exact same scene from ${FOTO} ${d}. Keep the composition and all subjects identical; only the time of day and lighting change.`, {}, { lora: ['coerenza'] }),
  SERIE('stagioni', 'Le quattro stagioni', 'luce', 'situazione', 'Primavera, estate, autunno, inverno.', STAGIONI,
    (d) => `Show the exact same scene from ${FOTO} ${d}. Keep the composition and subjects identical; only the season changes.`, {}, { lora: ['coerenza'] }),
  SERIE('meteo', 'Che tempo fa?', 'luce', 'luce', 'Sole, nuvoloso, pioggia, neve, nebbia, temporale.', METEO,
    (d) => `Show the exact same scene from ${FOTO} ${d}. Keep the composition and subjects identical; only the weather changes.`, {}, { lora: ['coerenza'] }),
  SERIE('luci', 'Sei luci da studio', 'luce', 'luce', 'Morbida, Rembrandt, controluce, neon, candela, drammatica: per ritratti e prodotti.', LUCI,
    (d) => `Relight ${FOTO} with ${d}. Keep the subject, pose, clothing and composition identical.`, {}, { lora: ['coerenza'] }),
  // ---- what if
  SERIE('epoche', 'E se fosse un\'altra epoca?', 'whatif', 'situazione', 'Anni \'20, \'50, \'80, medioevo, antica Roma, western, steampunk, futuro lontano.', EPOCHE,
    (d) => `Reimagine ${FOTO} in ${d}. Keep the subject's face and identity recognizable and the composition similar.`),
  SERIE('mondi', 'E se fosse in un altro mondo?', 'whatif', 'situazione', 'Sott\'acqua, nello spazio, nel deserto, nella giungla, cyberpunk, post-apocalisse, nel ghiaccio, fantasy.', MONDI,
    (d) => `Place the subject of ${FOTO} ${d}. Keep the subject exactly the same, with matching light, shadows and perspective.`),
  {
    id: 'sefosse', nome: 'E se…? (libero)', categoria: 'whatif', icona: 'bacchetta', modo: 'serie', foto: true, rif: 'no',
    ingressi: [{ id: 'testo', tipo: 'testo', nome: 'E se…', esempio: 'fosse in una città costruita sulle nuvole' }],
    descrizione: 'Scrivi un "E se…" e ne vedi 4 versioni diverse della stessa foto.',
    passi: (c) => [1, 2, 3, 4].map((n) => E(`Versione ${n}`, `Reimagine ${FOTO} as if ${(c.v.testo || 'it were in a magical place').trim()}. Keep the main subject recognizable.`))
  },
  {
    id: 'tempo', nome: 'Il tempo che passa', categoria: 'whatif', icona: 'catena', modo: 'catena', foto: true, rif: 'no', ingressi: [],
    descrizione: 'Il luogo fra 10, 30, 60 e 100 anni senza nessuno che se ne occupi: ogni passo parte dal precedente.',
    passi: () => [10, 30, 60, 100].map((n, i) => E(`Dopo ${i === 0 ? '10' : n} anni`, `Show how this place would look ${i === 0 ? 'ten' : `${n - [0, 10, 30, 60][i]} more`} years later if abandoned: ${i === 0 ? 'peeling paint, dust, a few cracks and overgrown weeds' : 'much more decay, vegetation taking over, broken windows, collapsed parts'}. Keep the same viewpoint and composition.`))
  },
  // ---- stili e arte
  SERIE('stili', 'Lo stesso soggetto in 12 stili', 'stili', 'arte', 'Anime, acquerello, olio, 3D, LEGO, creta, pixel art, matita, fumetto, stampa giapponese, vetrata, poster retrò.', STILI,
    (d) => `Transform ${FOTO} into ${d}. Keep the composition and the subject recognizable.`),
  SERIE('giocattoli', 'Diventa un giocattolo', 'stili', 'sticker', 'Action figure nel blister, pupazzo di vinile, peluche, minifigure, statuina, diorama.', GIOCATTOLI,
    (d) => `Turn the subject of ${FOTO} into ${d}. Keep the likeness and the main colors recognizable.`),
  SERIE('oggetti', 'Diventa un oggetto', 'stili', 'serie', 'Polaroid, francobollo, moneta, copertina di un disco, carta da gioco, poster del cinema.', OGGETTI,
    (d) => `Show ${FOTO} as ${d}. Keep the image content recognizable.`),
  // ---- prodotto e business
  SERIE('catalogo', 'Foto da catalogo', 'prodotto', 'prodotto', 'Un prodotto, sei ambientazioni: bianco, colorato, lifestyle, marmo, in mano, flat lay.', PRODOTTO,
    (d) => `Show the exact same product from ${FOTO} ${d}. Keep the product's shape, colors, logo and details exactly the same. Professional commercial photograph.`, {}, { lora: ['coerenza'] }),
  {
    id: 'mockup', nome: 'Mockup del tuo logo', categoria: 'prodotto', icona: 'logo', modo: 'serie', foto: false, rif: 'serve', rifNome: 'il tuo logo o disegno', ingressi: [],
    descrizione: 'Carichi il logo o il disegno e lo vedi su una maglietta, una tazza, una borsa, un poster, un cartellone, una custodia.',
    passi: () => MOCKUP.map(([e, d]) => E(e, `A realistic product mockup photograph: the exact design from <image1> ${d}. Reproduce the design exactly as it is, with its colors and proportions.`, { crea: { formato: '1:1', ris: 1024 } }))
  },
  {
    id: 'formati', nome: 'Un\'idea, tutti i formati', categoria: 'prodotto', icona: 'social', modo: 'serie', foto: false, rif: 'si', rifNome: 'foto di riferimento (facoltative)',
    ingressi: [{ id: 'testo', tipo: 'testo', nome: 'Cosa vuoi vedere', esempio: 'una Vespa rossa in un vicolo di Positano al tramonto' }],
    descrizione: 'La stessa immagine in 5 formati (quadrato, Instagram, storia, video, Pinterest): con lo stesso seed, la composizione resta simile.',
    passi: (c) => FORMATI_SOCIAL.map(([e, f, ris]) => E(e, (c.v.testo || 'a beautiful scene').trim(), { crea: { formato: f, ris } }))
  },
  // ---- testi e grafica sulle foto
  {
    id: 'testo-foto', nome: 'Aggiungi un testo alla foto', categoria: 'grafica', icona: 'testo', modo: 'serie', foto: true, rif: 'no', ingressi: [TESTO],
    descrizione: 'Scrivi un testo e lo vedi sulla foto in 6 modi: titolo in alto, neon, lettere 3D, calligrafia, giornale, adesivo.',
    passi: (c) => STILI_TESTO.map(([e, d]) => E(e, `Add the text ${t(c)} to ${FOTO} ${d}. Spell every letter exactly as written, with good contrast and a natural placement. Keep the rest of the image identical.`, { lora: ['coerenza'] }))
  },
  {
    id: 'meme', nome: 'Meme e citazioni', categoria: 'grafica', icona: 'testo', modo: 'serie', foto: true, rif: 'no',
    ingressi: [{ id: 'alto', tipo: 'testo', nome: 'Testo in alto', esempio: 'QUANDO È LUNEDÌ' }, { id: 'basso', tipo: 'testo', nome: 'Testo in basso', esempio: 'MA HAI GIÀ FINITO IL CAFFÈ', opzionale: true }],
    descrizione: 'La foto come meme classico, come citazione elegante e come cartello.',
    passi: (c) => [
      E('Meme', `Turn ${FOTO} into a meme: the top caption ${t(c, 'alto')} and the bottom caption ${t(c, 'basso', '')} in bold white Impact-style letters with a black outline. Keep the photo identical.`),
      E('Citazione', `Turn ${FOTO} into an elegant quote graphic: darken the image slightly and write ${t(c, 'alto')} in a refined serif typeface, centered. Keep the photo recognizable.`),
      E('Cartello', `Add a wooden sign that reads ${t(c, 'alto')} in a natural place in the scene of ${FOTO}, with matching perspective and lighting. Keep everything else identical.`)
    ]
  },
  {
    id: 'lingue', nome: 'Traduci i testi in 6 lingue', categoria: 'grafica', icona: 'testo', modo: 'serie', foto: true, rif: 'no', ingressi: [],
    descrizione: 'Una foto con dei testi (cartelli, locandine, etichette) tradotta in inglese, spagnolo, francese, tedesco, giapponese e cinese, con lo stesso stile.',
    passi: () => LINGUE.map(([e, l]) => E(e, `Translate all the text in ${FOTO} into ${l}, keeping the same fonts, layout, colors and style. Change nothing else.`, { lora: ['coerenza'] }))
  },
  {
    id: 'auguri', nome: 'Biglietti di auguri', categoria: 'grafica', icona: 'invito', modo: 'serie', foto: true, rif: 'no',
    ingressi: [{ id: 'testo', tipo: 'testo', nome: 'Il messaggio', esempio: 'Tanti auguri!' }],
    descrizione: 'La tua foto come biglietto: compleanno, Natale, laurea, anniversario.',
    passi: (c) => [
      ['Compleanno', 'a festive birthday card with balloons, confetti and party decorations'], ['Natale', 'a warm Christmas card with snow, pine branches, lights and ornaments'],
      ['Laurea', 'a graduation card with a graduation cap, laurel leaves and gold accents'], ['Anniversario', 'an elegant anniversary card with roses and gold foil details']
    ].map(([e, d]) => E(e, `Turn ${FOTO} into ${d}: keep the photo as the main picture, framed nicely, and write ${t(c)} in beautiful lettering. Spell every letter exactly as written.`))
  },
  // ---- casa e spazi
  SERIE('arredo', 'Ristruttura la stanza', 'casa', 'casa', 'Scandinavo, industriale, boho, giapponese, classico, moderno lusso: la stanza con sei stili d\'arredo.', ARREDO,
    (d) => `Redesign the interior in ${FOTO} in ${d}. Keep the room's architecture, windows, doors, perspective and layout unchanged; only change furniture, materials, decor and colors.`),
  SERIE('pareti', 'Colori alle pareti', 'casa', 'casa', 'Bianco, verde salvia, blu notte, terracotta, grigio, giallo.', PARETI,
    (d) => `Repaint the walls in ${FOTO} in ${d}. Keep the furniture, floor, lighting and everything else unchanged.`, {}, { lora: ['coerenza'] }),
  {
    id: 'arreda', nome: 'Svuota e arreda', categoria: 'casa', icona: 'catena', modo: 'catena', foto: true, rif: 'no',
    ingressi: [{ id: 'stile', tipo: 'testo', nome: 'Come arredarla', esempio: 'un salotto moderno con divano grigio, tappeto e piante' }],
    descrizione: 'Prima toglie tutti i mobili, poi arreda la stanza vuota come vuoi tu.',
    passi: (c) => [
      E('Stanza vuota', `Remove all the furniture, rugs and decorations from the room in ${FOTO}, leaving an empty room with clean walls and floor. Keep the architecture, windows, doors and lighting.`),
      E('Arredata', `Furnish this empty room as ${(c.v.stile || 'a cozy modern living room').trim()}. Keep the architecture, windows, doors and lighting unchanged.`)
    ]
  },
  // ---- ritocco e restauro
  {
    id: 'restauro', nome: 'Restauro completo', categoria: 'ritocco', icona: 'bacchetta', modo: 'catena', foto: true, rif: 'no', ingressi: [],
    descrizione: 'Una foto vecchia in tre passi: toglie graffi e polvere, la colora, poi la porta a dettagli moderni.',
    passi: () => [
      E('Pulita', `Restore this old photo: remove scratches, dust, stains, noise and blur, and fix the faded contrast. Keep the people and the composition identical.`, { lora: ['coerenza'] }),
      E('A colori', `Colorize this black and white photo with natural, realistic colors, accurate skin tones and clothes. Keep everything else identical.`, { lora: ['coerenza'] }),
      E('Nitida', `Enhance the image quality: sharp fine details, clean textures, no noise or compression artifacts. Keep everything identical.`, { lora: ['coerenza'] })
    ]
  },
  SERIE('ritratti', 'Ritratti professionali', 'ritocco', 'ritratto', 'Professionale, studio grigio, all\'aperto, bianco e nero.', RITRATTI,
    (d) => `Turn ${FOTO} into ${d}. Keep the face, identity and expression unchanged.`),
  {
    id: 'disegno', nome: 'Dal disegno al render', categoria: 'ritocco', icona: 'catena', modo: 'catena', foto: true, rif: 'no', ingressi: [],
    descrizione: 'Uno schizzo diventa linea pulita, poi illustrazione a colori, poi immagine realistica: ogni passo parte dal precedente.',
    passi: () => [
      E('Linea pulita', `Redraw ${FOTO} as clean, confident ink line art with consistent line weight on a white background. Keep the composition and every element.`),
      E('A colori', `Color this line art as a vibrant, polished digital illustration with soft shading. Keep the composition and every element.`),
      E('Realistico', `Turn this illustration into a photorealistic image with natural lighting and real textures. Keep the composition and every element.`)
    ]
  }
]


// ---- sticker e icone di qualsiasi cosa (non solo persone)
const STILI_STICKER: [string, string][] = [
  ['Kawaii', 'a cute kawaii chibi style with big shiny eyes and soft pastel colors'], ['Fumetto', 'a bold cartoon style with thick black outlines and flat bright colors'],
  ['Vettoriale', 'a clean flat vector illustration with simple geometric shapes'], ['Acquerello', 'a delicate watercolor style with soft bleeding colors'],
  ['Pixel art', 'a detailed 32-bit pixel art style'], ['Creta 3D', 'a cute 3D clay render with soft lighting'],
  ['Retro anni \'70', 'a retro 1970s style with warm earthy colors and rounded shapes'], ['Neon', 'a glowing neon line style on dark colors']
]
const AZIONI_STICKER: [string, string][] = [
  ['Saluta', 'waving hello with a big smile'], ['Dorme', 'sleeping peacefully with little "z" bubbles'], ['Festeggia', 'celebrating with confetti and a party hat'],
  ['Corre', 'running fast with motion lines'], ['Mangia', 'happily eating a snack'], ['Cuore', 'holding a big red heart'],
  ['Occhiali da sole', 'wearing cool sunglasses, looking confident'], ['Arrabbiato', 'looking grumpy and angry with a little storm cloud']
]
const E2 = (etichetta: string, prompt: string): PassoWf => E(etichetta, prompt, { crea: { formato: '1:1', ris: 1024 }, trasparente: true })
WORKFLOW_BASE.push(
  {
    id: 'sticker-tutto', nome: 'Sticker di qualsiasi cosa', categoria: 'sticker', icona: 'sticker', modo: 'serie', foto: false, rif: 'si', rifNome: 'una foto di riferimento (facoltativa)',
    ingressi: [{ id: 'soggetto', tipo: 'testo', nome: 'Cosa raffigura', esempio: 'un gatto arancione con un cappello da cuoco' }],
    descrizione: 'Scrivi cosa vuoi (un animale, un cibo, un oggetto, un personaggio…) e ottieni lo sticker in 8 stili: kawaii, fumetto, vettoriale, acquerello, pixel art, creta 3D, retrò, neon. Sfondo trasparente.',
    passi: (c) => STILI_STICKER.map(([e, d]) => E2(e, `A die-cut sticker of ${(c.v.soggetto || 'a cute animal').trim()}, in ${d}. Thick white die-cut outline, the subject centered and fully visible, no text, on a plain background.`))
  },
  {
    id: 'sticker-azioni', nome: 'Sticker: stessa cosa, tante azioni', categoria: 'sticker', icona: 'sticker', modo: 'serie', foto: false, rif: 'si', rifNome: 'una foto di riferimento (facoltativa)',
    ingressi: [{ id: 'soggetto', tipo: 'testo', nome: 'Il soggetto', esempio: 'una pizza margherita con occhi e braccia' }],
    descrizione: 'Un soggetto qualsiasi (non solo persone) che saluta, dorme, festeggia, corre, mangia, regge un cuore, ha gli occhiali da sole o è arrabbiato: un pacchetto per le chat.',
    passi: (c) => AZIONI_STICKER.map(([e, d]) => E2(e, `A cute die-cut sticker of ${(c.v.soggetto || 'a friendly mascot').trim()} ${d}. Consistent character design, thick white die-cut outline, flat colors, centered, no extra text.`))
  },
  {
    id: 'sticker-lista', nome: 'Sticker da una lista', categoria: 'sticker', icona: 'sticker', modo: 'serie', foto: false, rif: 'no',
    ingressi: [
      { id: 'soggetti', tipo: 'righe', nome: 'Un soggetto per riga', esempio: 'una pizza\nun gatto astronauta\nuna chitarra elettrica\nun fiore di loto' },
      { id: 'stile', tipo: 'scelta', nome: 'Stile', predefinita: 'kawaii', opzioni: [{ id: 'kawaii', nome: 'Kawaii' }, { id: 'fumetto', nome: 'Fumetto' }, { id: 'vettoriale', nome: 'Vettoriale' }, { id: 'acquerello', nome: 'Acquerello' }] }
    ],
    descrizione: 'Scrivi una cosa per riga (anche venti): ognuna diventa uno sticker nello stesso stile, con lo sfondo trasparente.',
    passi: (c) => {
      const stile = { kawaii: 'a cute kawaii chibi style', fumetto: 'a bold cartoon style with thick outlines', vettoriale: 'a clean flat vector style', acquerello: 'a soft watercolor style' }[c.v.stile || 'kawaii'] || 'a cute kawaii chibi style'
      return righe(c.v.soggetti).slice(0, 40).map((r) => E2(r.slice(0, 28), `A die-cut sticker of ${r}, in ${stile}. Thick white die-cut outline, centered, fully visible, no text.`))
    }
  },
  {
    id: 'icone-set', nome: 'Set di icone coerenti', categoria: 'sticker', icona: 'app', modo: 'serie', foto: false, rif: 'no',
    ingressi: [
      { id: 'icone', tipo: 'righe', nome: 'Un\'icona per riga', esempio: 'una casa\nuna lente d\'ingrandimento\nun carrello della spesa\nuna campana' },
      { id: 'stile', tipo: 'testo', nome: 'Lo stile', esempio: 'flat design colorato con angoli arrotondati e un\'ombra morbida' }
    ],
    descrizione: 'Un set di icone (app, sito, presentazioni) tutte nello stesso stile, su fondo trasparente.',
    passi: (c) => righe(c.v.icone).slice(0, 40).map((r) => E2(r.slice(0, 28), `An app icon of ${r}, ${(c.v.stile || 'flat colorful design with rounded corners').trim()}. Centered, a single object, consistent style and palette, no text, plain background.`))
  }
)

// ---------------------------------------------------------------------------------------------------------------
// la grafica: ogni preset di Crea in tutti i suoi stili (poster, loghi, infografiche, menù…)
// ---------------------------------------------------------------------------------------------------------------
const DA_PRESET = ['poster', 'infografica', 'logo', 'social', 'miniatura', 'copertina', 'invito', 'menu', 'sticker', 'app', 'slide']
for (const id of DA_PRESET) {
  const p = PRESET.find((x) => x.id === id)
  if (!p || p.stili.length < 2) continue
  WORKFLOW_BASE.push({
    id: 'preset-' + p.id, nome: `${p.nome} in ${p.stili.length} stili`, categoria: 'grafica', icona: p.icona, modo: 'serie', foto: false, rif: 'no',
    descrizione: `${p.descrizione}: compili i campi una volta e ottieni ${p.stili.length} versioni, una per stile (${p.stili.map((s) => s.nome.toLowerCase()).join(', ')}).`,
    ingressi: p.campi.map((c): Ingresso => ({ id: c.id, tipo: c.tipo === 'righe' ? 'righe' : 'testo', nome: c.nome, esempio: c.esempio, opzionale: false })),
    passi: (c) => p.stili.map((s) => E(s.nome, componiPreset(p, campiCon(p, c.v), s.id), { crea: { formato: p.formato, ris: p.ris }, trasparente: p.trasparente }))
  })
}

/** il passo "Sorpresa": in ogni ricetta, una variazione inventata dal modello al momento di partire */
export const SORPRESA = '🎲 Sorpresa'

/** una ricetta fatta da te come workflow: i {campi} nei prompt prendono i valori, {riga} una riga alla volta */
export function daUtente(r: RicettaUtente): Workflow {
  const metti = (t: string, v: Record<string, string>, riga?: string): string =>
    t.replace(/\{(\w+)\}/g, (m, k: string) => (k === 'riga' && riga !== undefined ? riga : k in v ? (v[k] || '').trim() : m))
  return {
    id: r.id, nome: r.nome, categoria: r.categoria, icona: r.foto ? 'ritratto' : 'bacchetta', modo: r.modo, foto: r.foto, rif: r.rif, rifNome: r.rifNome,
    descrizione: r.descrizione, ingressi: r.ingressi, utente: true,
    passi: (c) =>
      r.passi.flatMap((p): PassoWf[] => {
        const base: Partial<PassoWf> = { trasparente: p.trasparente, lora: p.lora as ChiaveLora[] | undefined, crea: p.crea }
        if (p.perRiga) {
          return righe(c.v[p.perRiga]).map((riga) => E(metti(p.etichetta, c.v, riga) || riga.slice(0, 24), metti(p.prompt, c.v, riga), base))
        }
        return [E(metti(p.etichetta, c.v), metti(p.prompt, c.v), base)]
      })
  }
}

/** una ricetta che c'è già, come ricetta tua (si può cambiare): i campi di testo diventano {segnaposto} nei prompt */
export function inUtente(w: Workflow, id = 'u-' + crypto.randomUUID().slice(0, 8)): RicettaUtente {
  const v: Record<string, string> = {}
  for (const i of w.ingressi) v[i.id] = i.tipo === 'scelta' ? i.predefinita : `{${i.id}}`
  const passi = w.passi({ v, nRif: w.rif === 'ognuno' ? 3 : 1, camera: !!fileLoraCamera() })
  return {
    id, nome: w.nome + ' (mia)', categoria: w.categoria, descrizione: w.descrizione, modo: w.modo, foto: w.foto, rif: w.rif, rifNome: w.rifNome,
    ingressi: w.ingressi.filter((i) => i.tipo !== 'scelta'),
    passi: passi.map((p) => ({ etichetta: p.etichetta, prompt: p.prompt, crea: p.crea, trasparente: p.trasparente, lora: p.lora })),
    da: w.id
  }
}

/** tutte le ricette che si vedono: quelle di serie (meno le nascoste) e le tue */
export function elencoWorkflow(): Workflow[] {
  const { utente, nascoste } = usaRicette.getState()
  return [...WORKFLOW_BASE.filter((w) => !nascoste.includes(w.id)), ...utente.map(daUtente)]
}

export const workflowDa = (id: string): Workflow | undefined => elencoWorkflow().find((w) => w.id === id) || WORKFLOW_BASE.find((w) => w.id === id)

/** il valore di partenza di ogni campo (gli esempi si scrivono da soli, si ritoccano) */
export function valoriIniziali(w: Workflow): Record<string, string> {
  const v: Record<string, string> = {}
  for (const i of w.ingressi) v[i.id] = i.tipo === 'scelta' ? i.predefinita : i.esempio
  return v
}

// ---------------------------------------------------------------------------------------------------------------
// l'esecuzione
// ---------------------------------------------------------------------------------------------------------------
export interface PassoRun {
  etichetta: string
  /** il prompt inventato (passo Sorpresa) */
  prompt?: string
  lavoroId?: string
  operaId?: string
  stato: 'attesa' | 'in coda' | 'fatto' | 'errore' | 'annullato'
  errore?: string
}

export interface OpzioniRun {
  qualita: Qualita
  mp: number
  /** le dimensioni dell'immagine che esce (per i passi che modificano la foto) */
  misura?: Misura
  /** i passi da fare (per etichetta): se ti serve una posa sola non le fai tutte */
  fai?: string[]
}

export interface Run {
  id: string
  wfId: string
  nome: string
  base: FotoBase | null
  rif: FotoBase[]
  passi: PassoRun[]
  definizione: PassoWf[]
  opzioni: OpzioniRun
  ctx: Ctx
  seed: number
  creato: number
  fermata?: boolean
}

interface StatoLab {
  runs: Run[]
  attiva: string | null
  vista: 'catalogo' | 'risultati'
  scelto: string | null
}

export const usaLab = create<StatoLab>(() => ({ runs: [], attiva: null, vista: 'catalogo', scelto: null }))

const aggiorna = (id: string, f: (r: Run) => void): void =>
  usaLab.setState((s) => ({ runs: s.runs.map((r) => (r.id === id ? (() => { const n = { ...r, passi: r.passi.map((p) => ({ ...p })) }; f(n); return n })() : r)) }))

/** i passi del workflow con questi ingressi (serve per contarli prima di partire) */
export function passiDi(w: Workflow, v: Record<string, string>, nRif: number): PassoWf[] {
  return conSorpresa(w.passi({ v, nRif, camera: !!fileLoraCamera() }))
}

/** ai passi della ricetta si aggiunge sempre "Sorpresa" (prende formato e sfondo trasparente dal primo passo) */
function conSorpresa(passi: PassoWf[]): PassoWf[] {
  const primo = passi[0]
  return [...passi, { etichetta: SORPRESA, prompt: '', sorpresa: true, crea: primo?.crea, trasparente: primo?.trasparente }]
}

/** il prompt del passo Sorpresa: lo inventa il Qwen3-VL guardando la ricetta e qualche esempio */
async function inventaPrompt(run: Run, wf: Workflow | undefined): Promise<string> {
  const esempi = run.definizione.filter((p) => !p.sorpresa && p.prompt).slice(0, 4).map((p) => `- ${p.prompt}`)
  const seed = Math.floor(Math.random() * 2 ** 31)
  const richiesta = `Recipe: ${run.nome}\nDescription: ${wf?.descrizione || run.nome}\nExample prompts:\n${esempi.join('\n') || '- (none)'}\n\nNew variation (random idea ${seed % 9973}):`
  const t = await api.testo.scrivi({
    ...richiestaBase(), modalita: 'descrivi', prompt: richiesta, sistema: SISTEMA_SORPRESA, maxToken: 220, temperatura: 1.1, seed, immagini: [], etichetta: 'Idea a sorpresa'
  })
  const pulito = (t || '').trim().replace(/^["']|["']$/g, '')
  if (!pulito) throw new Error('il modello non ha trovato un\'idea: riprova')
  return pulito
}

/** il lavoro per un passo: modifica la foto (o disegna da zero con i riferimenti) */
function richiestaPasso(run: Run, i: number, baseCorrente: FotoBase | null): Richiesta {
  const passo = run.definizione[i]
  const wf = workflowDa(run.wfId)!
  const b = richiestaBase()
  const rif = passo.soloRif !== undefined ? [run.rif[passo.soloRif]].filter(Boolean) : run.rif
  const extra = loraPer(passo.lora).filter((x) => !b.lora.some((l) => l.file === x.file))
  const comune = {
    ...b,
    lora: [...b.lora, ...extra],
    ...perQualita(run.opzioni.qualita),
    quante: 1,
    etichetta: `${run.nome} · ${passo.etichetta}`,
    trasparente: !!passo.trasparente
  }
  if (passo.crea) {
    const d = dimensioniRis(passo.crea.formato, Math.round((passo.crea.ris || 1024) * Math.sqrt(run.opzioni.mp)))
    return {
      ...comune, modalita: 'crea', prompt: passo.prompt, larghezza: d.w, altezza: d.h, megapixel: (d.w * d.h) / 1048576,
      immagini: rif.map((r) => r.percorso), seed: wf.id === 'formati' ? run.seed : -1
    }
  }
  const base = baseCorrente || run.base
  return {
    ...comune, modalita: 'modifica', prompt: passo.prompt, megapixel: run.opzioni.mp,
    immagini: [base!.percorso, ...rif.map((r) => r.percorso)], origine: base?.operaId,
    ...conMisura(run.opzioni.misura, run.base)
  }
}

async function accodaPasso(runId: string, i: number, base: FotoBase | null): Promise<void> {
  const run = usaLab.getState().runs.find((r) => r.id === runId)
  if (!run || run.fermata) return
  try {
    if (run.definizione[i].sorpresa) {
      const p = await inventaPrompt(run, workflowDa(run.wfId))
      aggiorna(runId, (r) => {
        r.definizione[i] = { ...r.definizione[i], prompt: p }
        r.passi[i].prompt = p
      })
    }
    const corrente = usaLab.getState().runs.find((r) => r.id === runId)
    if (!corrente || corrente.fermata) return
    const ids = await api.lavori.accoda(richiestaPasso(corrente, i, base))
    aggiorna(runId, (r) => {
      r.passi[i].lavoroId = ids[0]
      r.passi[i].stato = 'in coda'
    })
  } catch (e) {
    aggiorna(runId, (r) => {
      r.passi[i].stato = 'errore'
      r.passi[i].errore = (e as Error).message
    })
  }
}

export interface IngressiRun {
  foto: FotoBase | null
  rif: FotoBase[]
  valori: Record<string, string>
  opzioni: OpzioniRun
}

/** il motivo per cui non si può partire, o null */
export function manca(w: Workflow, i: Pick<IngressiRun, 'foto' | 'rif'>): string | null {
  if (w.foto && !i.foto) return 'Scegli la foto'
  if ((w.rif === 'serve' || w.rif === 'ognuno') && i.rif.length === 0) return w.rif === 'ognuno' ? `Aggiungi ${w.rifNome || 'le foto di riferimento'}` : `Aggiungi ${w.rifNome || 'una foto di riferimento'}`
  return null
}

export async function avviaWorkflow(w: Workflow, i: IngressiRun, suffisso = ''): Promise<string | null> {
  const m = manca(w, i)
  if (m) {
    usaStato.getState().avvisa(m, 'errore')
    return null
  }
  const ctx: Ctx = { v: i.valori, nRif: i.rif.length, camera: !!fileLoraCamera() }
  const tutti = conSorpresa(w.passi(ctx))
  // senza una scelta si fanno tutti i passi tranne la sorpresa
  const fai = i.opzioni.fai ? new Set(i.opzioni.fai) : null
  const definizione = tutti.filter((p) => (fai ? fai.has(p.etichetta) : !p.sorpresa))
  if (!definizione.length) {
    usaStato.getState().avvisa('Scegli almeno un passo da fare', 'errore')
    return null
  }
  const run: Run = {
    id: crypto.randomUUID(), wfId: w.id, nome: w.nome + suffisso, base: i.foto, rif: i.rif, definizione, opzioni: i.opzioni, ctx,
    passi: definizione.map((p) => ({ etichetta: p.etichetta, stato: 'attesa' as const })), seed: Math.floor(Math.random() * 2 ** 32), creato: Date.now()
  }
  usaLab.setState((s) => ({ runs: [run, ...s.runs].slice(0, 40), attiva: run.id, vista: 'risultati' }))
  if (w.modo === 'serie') for (let n = 0; n < definizione.length; n++) await accodaPasso(run.id, n, i.foto)
  else await accodaPasso(run.id, 0, i.foto)
  return run.id
}

/** più foto insieme: la ricetta parte per ognuna, tutto in coda (una ricetta per foto nei risultati) */
export async function avviaLotto(w: Workflow, i: Omit<IngressiRun, 'foto'> & { foto: FotoBase[] }): Promise<number> {
  if (!w.foto || i.foto.length === 0) return (await avviaWorkflow(w, { ...i, foto: i.foto[0] || null })) ? 1 : 0
  let n = 0
  let primo: string | null = null
  for (let k = 0; k < i.foto.length; k++) {
    const id = await avviaWorkflow(w, { ...i, foto: i.foto[k] }, i.foto.length > 1 ? ` · foto ${k + 1}/${i.foto.length}` : '')
    if (id) {
      n++
      primo ??= id
    }
  }
  // nei risultati si vede subito la prima foto
  if (primo) usaLab.setState({ attiva: primo })
  return n
}

export async function fermaRun(id: string): Promise<void> {
  const run = usaLab.getState().runs.find((r) => r.id === id)
  if (!run) return
  aggiorna(id, (r) => {
    r.fermata = true
    for (const p of r.passi) if (p.stato === 'attesa') p.stato = 'annullato'
  })
  for (const p of run.passi) if (p.lavoroId && p.stato === 'in coda') await api.lavori.annulla(p.lavoroId)
}

// i lavori che finiscono fanno andare avanti i workflow (la catena parte col passo dopo)
ascoltatoriLavoro.push((uno) => {
  for (const run of usaLab.getState().runs) {
    const i = run.passi.findIndex((p) => p.lavoroId === uno.id)
    if (i < 0) continue
    const wf = workflowDa(run.wfId)
    if (uno.stato === 'fatto') {
      const opera = uno.risultati[0]
      aggiorna(run.id, (r) => {
        r.passi[i].stato = 'fatto'
        r.passi[i].operaId = opera
      })
      if (wf?.modo === 'catena' && i + 1 < run.passi.length && opera) {
        void api.galleria.opera(opera).then((o) => o && accodaPasso(run.id, i + 1, fotoDaOpera(o)))
      }
    } else if (uno.stato === 'errore' || uno.stato === 'annullato') {
      aggiorna(run.id, (r) => {
        r.passi[i].stato = uno.stato === 'errore' ? 'errore' : 'annullato'
        r.passi[i].errore = uno.errore
        if (wf?.modo === 'catena') for (let k = i + 1; k < r.passi.length; k++) r.passi[k].stato = 'annullato'
      })
    }
  }
})

// ---------------------------------------------------------------------------------------------------------------
// il foglio: tutti i risultati in un'immagine sola, da condividere
// ---------------------------------------------------------------------------------------------------------------
const carica = (src: string): Promise<HTMLImageElement> =>
  new Promise((ok, ko) => {
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => ok(im)
    im.onerror = () => ko(new Error('non riesco ad aprire un\'immagine del foglio'))
    im.src = src
  })

/** una griglia con l'originale e tutti i risultati, ognuno con la sua etichetta; entra in galleria come "Foglio" */
export async function creaFoglio(run: Run): Promise<void> {
  const voci: { src: string; testo: string }[] = []
  if (run.base) voci.push({ src: urlFile(run.base.percorso), testo: 'ORIGINALE' })
  for (const p of run.passi) {
    if (p.stato !== 'fatto' || !p.operaId) continue
    const o = await api.galleria.opera(p.operaId)
    if (o) voci.push({ src: urlFile(o.file), testo: p.etichetta.toUpperCase() })
  }
  if (voci.length < 2) throw new Error('Non ci sono ancora abbastanza risultati')
  const colonne = Math.min(voci.length, voci.length <= 4 ? 2 : voci.length <= 9 ? 3 : 4)
  const righe = Math.ceil(voci.length / colonne)
  const L = 560
  const barra = 46
  const gap = 14
  const marg = 28
  const titolo = 70
  const c = document.createElement('canvas')
  c.width = marg * 2 + colonne * L + (colonne - 1) * gap
  c.height = titolo + marg + righe * (L + barra) + (righe - 1) * gap
  const g = c.getContext('2d')!
  g.fillStyle = '#0d0917'
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#ffd54a'
  g.font = '900 30px Orbitron, sans-serif'
  g.fillText(run.nome.toUpperCase(), marg, 46)
  g.fillStyle = '#6f6496'
  g.font = '600 16px Rajdhani, sans-serif'
  g.textAlign = 'right'
  g.fillText('DaProd Image', c.width - marg, 46)
  g.textAlign = 'left'
  for (let n = 0; n < voci.length; n++) {
    const im = await carica(voci[n].src)
    const x = marg + (n % colonne) * (L + gap)
    const y = titolo + Math.floor(n / colonne) * (L + barra + gap)
    g.fillStyle = '#18122b'
    g.fillRect(x, y, L, L + barra)
    const s = Math.min(L / im.naturalWidth, L / im.naturalHeight)
    const w = im.naturalWidth * s
    const h = im.naturalHeight * s
    g.drawImage(im, x + (L - w) / 2, y + (L - h) / 2, w, h)
    g.fillStyle = n === 0 && run.base ? '#a99dd0' : '#efe9ff'
    g.font = '700 20px Rajdhani, sans-serif'
    g.fillText(voci[n].testo, x + 14, y + L + 30)
  }
  const percorso = await api.file.salvaTemp(c.toDataURL('image/png'))
  await api.galleria.importaFoto(percorso, `Foglio ${run.nome}`)
}
