// Le ricette del Laboratorio che ci sono di serie: pose, espressioni, vestiti, camera, luce, stili, prodotto, grafica, casa,
// restauro, sticker. Sono funzioni dei campi che compili (vedi `Workflow` in workflow.ts); le tue stanno in ricette.ts.
import { PRESET, campiCon, componiPreset } from './preset'
import { istruzionePosa, leggiPosa } from './omino'
import { componiCamera, conLora } from './componenti/Camera'
import { POSA_TUA, VISTA_TUA, leggiCamera, type Ctx, type Ingresso, type PassoWf, type Workflow } from './workflow'

export const E = (etichetta: string, prompt: string, extra: Partial<PassoWf> = {}): PassoWf => ({ etichetta, prompt, ...extra })
const FOTO = 'the photo <image1>'
/** il comando Camera dentro la ricetta: muovi i cerchi e ottieni il passo "La tua vista" */
const CAMERA_TUA: Ingresso = { id: 'vista', tipo: 'camera', nome: 'Muovi la camera: una vista tua, oltre a quelle della ricetta' }
/** il passo della camera scelta (se l'hai mossa); `intorno` è quello che resta uguale in ogni vista della ricetta */
const vistaTua = (c: Ctx, intorno: string): PassoWf[] => {
  const pos = leggiCamera(c.v.vista)
  const cam = pos && componiCamera(pos, c.camera)
  if (!pos || !cam) return []
  return [E(VISTA_TUA, `${cam} ${intorno}`, { lora: c.camera && conLora(pos) ? ['camera'] : [] })]
}
/** l'omino dentro la ricetta: lo muovi e ottieni il passo "La tua posa" (la posa è un'immagine in più, `{posa}` nel prompt) */
const POSA_TUA_IN: Ingresso = { id: 'posa', tipo: 'posa', nome: 'Muovi l\'omino: una posa tua (anche mani e dita), oltre a quelle della ricetta' }
const posaTua = (c: Ctx, intorno: string): PassoWf[] => {
  const po = leggiPosa(c.v.posa)
  if (!po) return []
  // il manichino di posa è la prima immagine ({posa}), la foto del personaggio la seconda ({foto}): vedi richiestaPasso
  return [E(POSA_TUA, `${istruzionePosa(po, '{posa}', 'the same character from {foto}')} ${intorno}`, { posa: c.v.posa })]
}
const SFONDO: Ingresso = {
  id: 'sfondo', tipo: 'scelta', nome: 'Sfondo', predefinita: 'orig',
  opzioni: [{ id: 'orig', nome: 'Come la foto' }, { id: 'bianco', nome: 'Bianco' }, { id: 'grigio', nome: 'Grigio studio' }]
}
const sfondoDi = (v: Record<string, string>): string =>
  v.sfondo === 'bianco' ? 'Use a plain pure white background.' : v.sfondo === 'grigio' ? 'Use a neutral light gray studio background.' : 'Keep a background similar to the original.'
const TESTO: Ingresso = { id: 'testo', tipo: 'testo', nome: 'Il testo', esempio: 'BUON COMPLEANNO' }
/** il testo fra virgolette, senza virgolette doppie dentro */
const t = (c: Ctx, id = 'testo', def = 'TEXT'): string => `"${(c.v[id] || def).trim().replace(/"/g, "'")}"`
export const righe = (s: string | undefined): string[] => (s || '').split('\n').map((x) => x.trim()).filter(Boolean)

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

/** a una ricetta si aggiunge l'omino: un campo per muoverlo e il passo "La tua posa" in fondo */
const conPosa = (w: Workflow, intorno: (c: Ctx) => string): Workflow => ({ ...w, ingressi: [...w.ingressi, POSA_TUA_IN], passi: (c) => [...w.passi(c), ...posaTua(c, intorno(c))] })

const SERIE = (id: string, nome: string, categoria: string, icona: string, descrizione: string, voci: [string, string][], promptDi: (d: string, c: Ctx) => string, extra: Partial<Workflow> = {}, passoExtra: Partial<PassoWf> = {}): Workflow => ({
  id, nome, categoria, icona, descrizione, modo: 'serie', foto: true, rif: 'no', ingressi: [],
  passi: (c) => voci.map(([e, d]) => E(e, promptDi(d, c), passoExtra)),
  ...extra
})

export const WORKFLOW_BASE: Workflow[] = [
  // ---- personaggio
  conPosa(SERIE('pose', 'Il personaggio in 9 pose', 'personaggio', 'ritratto', 'Una foto del personaggio e lo vedi in piedi, seduto, mentre cammina, corre, salta… sempre lo stesso volto e lo stesso vestito.', POSE,
    (d, c) => `Show the same character from ${FOTO} ${d}. Keep exactly the same face, hairstyle, outfit, colors and art style, with the full body visible. ${sfondoDi(c.v)}`, { ingressi: [SFONDO] }), (c) => `Keep exactly the same face, hairstyle, outfit, colors and art style, with the full body visible. ${sfondoDi(c.v)}`),
  {
    id: 'turnaround', nome: 'Foglio personaggio (turnaround)', categoria: 'personaggio', icona: 'serie', modo: 'serie', foto: true, rif: 'no', ingressi: [CAMERA_TUA, POSA_TUA_IN],
    descrizione: 'Il personaggio da davanti, di tre quarti, di lato, da dietro e in primo piano: il foglio che serve a disegnatori e modellatori 3D. Con il comando Camera aggiungi una vista tua, dove vuoi.',
    passi: (c) => [
      E('Davanti', `Show the same character from ${FOTO} in a neutral standing A-pose, full body, seen from the front. Keep exactly the same face, hair, outfit and colors. Plain white background, flat even lighting.`),
      E('Tre quarti', `Show the same character from ${FOTO} in a neutral standing A-pose, full body, rotated 45 degrees to the right (three-quarter view). Keep exactly the same face, hair, outfit and colors. Plain white background, flat even lighting.`),
      E('Di lato', `Show the same character from ${FOTO} in a neutral standing A-pose, full body, in a perfect side profile view. Keep exactly the same face, hair, outfit and colors. Plain white background, flat even lighting.`),
      E('Tre quarti dietro', `Show the same character from ${FOTO} in a neutral standing A-pose, full body, seen from behind and 45 degrees to the left. Keep exactly the same hair, outfit and colors. Plain white background, flat even lighting.`),
      E('Dietro', `Show the same character from ${FOTO} in a neutral standing A-pose, full body, seen directly from behind. Keep exactly the same hair, outfit and colors. Plain white background, flat even lighting.`),
      E('Volto', `Show a close-up portrait of the face of the same character from ${FOTO}, looking at the camera. Keep exactly the same face, hair and colors. Plain white background.`),
      ...vistaTua(c, `Show the same character from ${FOTO} in a neutral standing A-pose, full body. Keep exactly the same face, hair, outfit and colors. Plain white background, flat even lighting.`),
      ...posaTua(c, 'Plain white background, flat even lighting, full body visible.')
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
    id: 'giro', nome: 'Giro intorno al soggetto', categoria: 'camera', icona: 'camera', modo: 'serie', foto: true, rif: 'no', ingressi: [CAMERA_TUA],
    descrizione: 'La camera gira di 45° alla volta attorno al soggetto: 7 nuove viste, fino a vederlo da dietro. Ottimo per oggetti e personaggi.',
    nota: 'Con il LoRA "Camera: angolazioni" le viste sono molto più fedeli.',
    passi: (c) => [
      ...[45, 90, 135, 180, -135, -90, -45].map((az) =>
        E(az === 180 ? 'Dietro' : `${Math.abs(az)}° ${az > 0 ? 'destra' : 'sinistra'}`, componiCamera({ az, el: 0, dist: 0 }, c.camera), { lora: c.camera ? ['camera'] : [] })),
      ...vistaTua(c, 'Keep the same subject, outfit, colors, lighting and scene.')
    ]
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

