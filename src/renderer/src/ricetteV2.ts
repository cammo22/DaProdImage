// Le sei ricette della GUI v2 «Orbita»: Foglio · Mondi · Mix · Set · Formati · Rinnova.
// Ognuna sostituisce un gruppo di ricette vecchie (che restano in `WORKFLOW_BASE` solo per leggere i PNG già fatti).
// Tutto passa dai segnaposti e dalle scelte a pulsanti: niente elenchi lunghi di testo.
import { componiCamera } from './componenti/Camera'
import {
  AZIONI_STICKER, CAMERA_TUA, E, E2, EPOCHE, ESPRESSIONI, FOTO, MONDI, MOCKUP, ARMADIO, METEO, POSA_TUA_IN, POSE, STAGIONI, STILI, STILI_STICKER,
  posaTua, righe, vistaTua
} from './ricetteBase'
import type { Ctx, Ingresso, PassoWf, Workflow } from './workflow'

/** quante immagini fare: 4, 6 o 9 */
const QUANTE: Ingresso = { id: 'quante', tipo: 'scelta', nome: 'Quante', predefinita: '6', opzioni: [{ id: '4', nome: '4' }, { id: '6', nome: '6' }, { id: '9', nome: '9' }] }
const quante = (c: Ctx): number => Math.max(1, Math.min(12, Number(c.v.quante) || 6))
/** le etichette di una ricetta devono essere tutte diverse (sono le chiavi dei passi): se due coincidono, la seconda prende un numero */
const univoche = (passi: PassoWf[]): PassoWf[] => {
  const viste = new Map<string, number>()
  return passi.map((p) => {
    const n = (viste.get(p.etichetta) || 0) + 1
    viste.set(p.etichetta, n)
    return n === 1 ? p : { ...p, etichetta: `${p.etichetta} ${n}` }
  })
}
const uguale = 'Keep exactly the same face, hairstyle, outfit, colors and art style.'

// ---------------------------------------------------------------------------------------------------------------
// 1 · Foglio: da un soggetto, una serie che varia UNA dimensione
// ---------------------------------------------------------------------------------------------------------------
const VISTE_FOGLIO: [string, string][] = [
  ['Davanti', 'seen from the front'], ['Tre quarti', 'rotated 45 degrees to the right (three-quarter view)'], ['Di lato', 'in a perfect side profile view'],
  ['Tre quarti dietro', 'seen from behind and 45 degrees to the left'], ['Dietro', 'seen directly from behind'], ['Volto', 'as a close-up portrait of the face, looking at the camera'],
  ['Dall\'alto', 'seen from a high angle looking down'], ['Dal basso', 'seen from a low angle looking up'], ['Figura intera', 'full body, centered, slightly turned']
]
const ETA = [8, 20, 30, 40, 50, 60, 70, 80, 90]
const ANGOLI: [string, { az: number; el: number }][] = [
  ['45° destra', { az: 45, el: 0 }], ['90° destra', { az: 90, el: 0 }], ['135° destra', { az: 135, el: 0 }], ['Dietro', { az: 180, el: 0 }],
  ['135° sinistra', { az: -135, el: 0 }], ['90° sinistra', { az: -90, el: 0 }], ['45° sinistra', { az: -45, el: 0 }], ['Dall\'alto', { az: 0, el: 35 }], ['Dal basso', { az: 0, el: -25 }]
]
const FOGLIO_VARIA = [
  { id: 'viste', nome: 'Viste' }, { id: 'pose', nome: 'Pose' }, { id: 'emozioni', nome: 'Emozioni' }, { id: 'eta', nome: 'Età' },
  { id: 'vestiti', nome: 'Vestiti' }, { id: 'azioni', nome: 'Azioni' }, { id: 'giro', nome: 'Giro 360°' }
]
const foglio: Workflow = {
  id: 'r-foglio', nome: 'Foglio', categoria: 'ricette', icona: 'serie', modo: 'serie', foto: true, rif: 'no',
  descrizione: 'Da una foto fa una serie coerente: la stessa persona o cosa che cambia una sola dimensione (viste, pose, emozioni, età, vestiti, azioni o un giro attorno).',
  nota: 'Con i LoRA «Coerenza», «Vestiti» e «Camera» il risultato è più fedele.',
  ingressi: [{ id: 'varia', tipo: 'scelta', nome: 'Cosa cambia', predefinita: 'viste', opzioni: FOGLIO_VARIA }, QUANTE, CAMERA_TUA, POSA_TUA_IN],
  passi: (c) => {
    const n = quante(c)
    const sfondo = 'Plain white background, flat even lighting.'
    const per = (voci: [string, string][], fn: (d: string) => string, extra: Partial<PassoWf> = {}): PassoWf[] => voci.slice(0, n).map(([e, d]) => E(e, fn(d), extra))
    let base: PassoWf[]
    switch (c.v.varia || 'viste') {
      case 'pose': base = per(POSE, (d) => `Show the same character from ${FOTO} ${d}. ${uguale} The full body is visible.`); break
      case 'emozioni': base = per([...ESPRESSIONI, ['Neutro', 'a calm neutral look']], (d) => `Change the facial expression of the person in ${FOTO} to ${d}. Keep the same identity, hairstyle, clothing, pose and background.`, { lora: ['coerenza'] }); break
      case 'eta': base = ETA.slice(0, n).map((a) => E(`${a} anni`, `Show the same person from ${FOTO} as they would look at age ${a}. Keep the identity recognizable, with the same pose, framing and background, and age-appropriate hair, skin and clothes.`)); break
      case 'vestiti': base = per([...ARMADIO, ['Pigiama', 'cozy pajamas']], (d) => `Dress the person in ${FOTO} in ${d}. Keep their face, hair, hands, pose and the background exactly the same.`, { lora: ['vestiti'] }); break
      case 'azioni': base = per([...AZIONI_STICKER, ['Beve un caffè', 'enjoying a cup of coffee']], (d) => `Show the same character from ${FOTO} ${d}. ${uguale} The full body is visible.`); break
      case 'giro': base = ANGOLI.slice(0, n).map(([e, pos]) => E(e, componiCamera({ ...pos, dist: 0 }, c.camera) || `Show the subject of ${FOTO} from another angle. Keep the same subject, outfit, colors and lighting.`, { lora: c.camera ? ['camera'] : [] })); break
      default: base = per(VISTE_FOGLIO, (d) => `Show the same character from ${FOTO} in a neutral standing A-pose, ${d}. ${uguale} ${sfondo}`)
    }
    return univoche([...base, ...vistaTua(c, `Keep the same subject, outfit, colors and lighting. ${sfondo}`), ...posaTua(c, `${sfondo} Full body visible.`)])
  }
}

// ---------------------------------------------------------------------------------------------------------------
// 2 · Mondi: «E se…?» — la stessa scena in più mondi
// ---------------------------------------------------------------------------------------------------------------
const LUOGHI: [string, string][] = [...MONDI, ['Città sulle nuvole', 'in a city built on the clouds at sunset']]
const EPOCHE9: [string, string][] = [...EPOCHE, ['Preistoria', 'the Stone Age: caves, furs, a wild primeval landscape']]
const STAGIONI_METEO: [string, string][] = [...STAGIONI, ...METEO]
const CAMBIA_MONDI = [{ id: 'luogo', nome: 'Luogo' }, { id: 'epoca', nome: 'Epoca' }, { id: 'stagione', nome: 'Stagione' }, { id: 'stile', nome: 'Stile' }, { id: 'tutto', nome: 'Tutto' }]
const mondi: Workflow = {
  id: 'r-mondi', nome: 'Mondi', categoria: 'ricette', icona: 'situazione', modo: 'serie', foto: true, rif: 'no',
  descrizione: '«E se…?»: la stessa foto in più mondi: luoghi, epoche, stagioni, stili. Il soggetto resta riconoscibile. Puoi aggiungere un tuo «E se…».',
  ingressi: [
    { id: 'cambia', tipo: 'scelta', nome: 'Cosa cambia', predefinita: 'luogo', opzioni: CAMBIA_MONDI }, QUANTE,
    { id: 'efse', tipo: 'testo', nome: 'E se… (facoltativo)', esempio: 'fosse in una città costruita sulle nuvole', opzionale: true }
  ],
  passi: (c) => {
    const n = quante(c)
    const luogo = LUOGHI.map(([e, d]): PassoWf => E(e, `Place the subject of ${FOTO} ${d}. Keep the subject exactly the same, with matching light, shadows and perspective.`))
    const epoca = EPOCHE9.map(([e, d]): PassoWf => E(e, `Reimagine ${FOTO} in ${d}. Keep the subject's face and identity recognizable and the composition similar.`))
    const stagione = STAGIONI_METEO.map(([e, d]): PassoWf => E(e, `Show the exact same scene from ${FOTO} ${d}. Keep the composition and subjects identical; only the ${STAGIONI.some((s) => s[0] === e) ? 'season' : 'weather'} changes.`, { lora: ['coerenza'] }))
    const stile = STILI.map(([e, d]): PassoWf => E(e, `Transform ${FOTO} into ${d}. Keep the composition and the subject recognizable.`))
    const liste = { luogo, epoca, stagione, stile }
    const scelta = c.v.cambia || 'luogo'
    let tutti: PassoWf[]
    if (scelta === 'tutto') {
      // un po' di ognuno, a giro, finché basta
      tutti = []
      for (let k = 0; tutti.length < n && k < 12; k++) for (const l of [luogo, epoca, stagione, stile]) if (l[k] && tutti.length < n + 3) tutti.push(l[k])
    } else tutti = liste[scelta as keyof typeof liste] || luogo
    const libero = (c.v.efse || '').trim()
    const speciali = libero ? [E('E se…', `Reimagine ${FOTO} as if ${libero}. Keep the main subject recognizable.`)] : []
    return univoche([...speciali, ...tutti.slice(0, libero ? Math.max(1, n - 1) : n)])
  }
}

// ---------------------------------------------------------------------------------------------------------------
// 3 · Mix: più foto con un ruolo (si usa la tela di Modifica; i due modi sono «Unisci» e «Come l'esempio»)
// ---------------------------------------------------------------------------------------------------------------
const mix: Workflow = {
  id: 'r-mix', nome: 'Mix', categoria: 'ricette', icona: 'foto', modo: 'speciale', foto: false, rif: 'serve', rifNome: 'le foto da unire',
  descrizione: 'Unisce più foto, ognuna con il suo ruolo (base, persona, oggetto, vestito) in una immagine nuova, oppure rifà un esempio con i dettagli delle tue foto («Stile da copiare»).',
  ingressi: [],
  passi: () => [E('Foto nuova', 'Crea una immagine nuova partendo dalle foto di riferimento, unendo ognuna con il suo ruolo.')]
}

// ---------------------------------------------------------------------------------------------------------------
// 4 · Set: una serie di cose con stile coerente, sfondo trasparente di serie
// ---------------------------------------------------------------------------------------------------------------
const TIPI_SET: Record<string, string> = {
  sticker: 'A die-cut sticker of {x}, in {s}. Thick white die-cut outline, the subject centered and fully visible, no text, on a plain background.',
  icone: 'An app icon of {x}, in {s}. Centered, a single object, consistent style and palette, no text, plain background.',
  loghi: 'A clean modern logo mark for {x}, in {s}. Simple, memorable, centered, vector look, no extra text, plain background.',
  mascotte: 'A friendly mascot character of {x}, in {s}. Full body, consistent character design, centered, no extra text, plain background.'
}
const STILI_SET = [
  ...STILI_STICKER.slice(0, 6).map(([e]) => e), 'Piatto'
].filter((x, i, a) => a.indexOf(x) === i)
const descrizioneStile = (id: string): string => (id === 'Piatto' ? 'a flat design with rounded corners and a soft shadow' : STILI_STICKER.find(([e]) => e === id)?.[1] || STILI_STICKER[0][1])
const set: Workflow = {
  id: 'r-set', nome: 'Set', categoria: 'ricette', icona: 'sticker', modo: 'serie', foto: false, rif: 'si', rifNome: 'una foto di riferimento (facoltativa)',
  descrizione: 'Una serie di cose nello stesso stile, tutte con lo sfondo trasparente: sticker, icone, loghi o mascotte. Scrivi un soggetto per riga.',
  ingressi: [
    { id: 'tipo', tipo: 'scelta', nome: 'Cosa', predefinita: 'sticker', opzioni: [{ id: 'sticker', nome: 'Sticker' }, { id: 'icone', nome: 'Icone' }, { id: 'loghi', nome: 'Loghi' }, { id: 'mascotte', nome: 'Mascotte' }] },
    { id: 'stile', tipo: 'scelta', nome: 'Stile', predefinita: 'Kawaii', opzioni: STILI_SET.map((s) => ({ id: s, nome: s })) },
    { id: 'soggetti', tipo: 'righe', nome: 'Un soggetto per riga', esempio: 'una pizza\nun gatto astronauta\nuna chitarra elettrica\nun fiore di loto' }
  ],
  passi: (c) => {
    const modello = TIPI_SET[c.v.tipo || 'sticker'] || TIPI_SET.sticker
    const stile = descrizioneStile(c.v.stile || 'Kawaii')
    const coi = c.nRif > 0 ? ' Match the character and style of the reference <image1>.' : ''
    return univoche(righe(c.v.soggetti).slice(0, 40).map((r) => E2(r.slice(0, 28), modello.replace('{x}', r).replace('{s}', stile) + coi)))
  }
}

// ---------------------------------------------------------------------------------------------------------------
// 5 · Formati: un'idea → tutti i formati e i mockup
// ---------------------------------------------------------------------------------------------------------------
const FORMATI_V2: [string, string, number][] = [['1:1 Post', '1:1', 1080], ['4:5 Instagram', '4:5', 1080], ['9:16 Storia', '9:16', 1080], ['16:9 Video', '16:9', 1080], ['2:3 Pinterest', '2:3', 1080]]
const STAMPA: [string, string, number][] = [['Stampa verticale', '3:4', 1440], ['Stampa orizzontale', '4:3', 1440]]
const formati: Workflow = {
  id: 'r-formati', nome: 'Formati', categoria: 'ricette', icona: 'social', modo: 'serie', foto: false, rif: 'si', rifNome: 'il tuo logo o una foto (facoltativi)',
  descrizione: 'Un\'idea in tutti i formati (social, stampa) o su tanti oggetti: maglietta, tazza, borsa, poster, cartellone, custodia. Se aggiungi un logo, lo riporta uguale.',
  ingressi: [
    { id: 'idea', tipo: 'testo', nome: 'Cosa vuoi vedere', esempio: 'una Vespa rossa in un vicolo di Positano al tramonto' },
    { id: 'uscita', tipo: 'scelta', nome: 'Dove', predefinita: 'social', opzioni: [{ id: 'social', nome: 'Social' }, { id: 'stampa', nome: 'Stampa' }, { id: 'mockup', nome: 'Mockup' }, { id: 'tutto', nome: 'Tutto' }] }
  ],
  passi: (c) => {
    const idea = (c.v.idea || 'a beautiful scene').trim()
    const dove = c.v.uscita || 'social'
    const fmt = (l: [string, string, number][]): PassoWf[] => l.map(([e, f, ris]) => E(e, idea, { crea: { formato: f, ris } }))
    const mock = (): PassoWf[] =>
      MOCKUP.map(([e, d]) => E(`Mockup · ${e}`, c.nRif > 0
        ? `A realistic product mockup photograph: the exact design from <image1> ${d}. Reproduce the design exactly as it is, with its colors and proportions.`
        : `A realistic product mockup photograph: ${idea} ${d}. Reproduce the design exactly as described.`, { crea: { formato: '1:1', ris: 1024 } }))
    return univoche(dove === 'stampa' ? fmt(STAMPA) : dove === 'mockup' ? mock() : dove === 'tutto' ? [...fmt(FORMATI_V2), ...fmt(STAMPA), ...mock()] : fmt(FORMATI_V2))
  }
}

// ---------------------------------------------------------------------------------------------------------------
// 6 · Rinnova: una trasformazione prima/dopo, a scelta
// ---------------------------------------------------------------------------------------------------------------
const rinnova: Workflow = {
  id: 'r-rinnova', nome: 'Rinnova', categoria: 'ricette', icona: 'bacchetta', modo: 'catena', foto: true, rif: 'no',
  descrizione: 'Una foto, una trasformazione a scelta: restaura una foto vecchia, dal disegno al render, svuota e arreda una stanza, rifinisci i dettagli o colora. Ogni passo parte dal precedente.',
  ingressi: [
    { id: 'cosa', tipo: 'scelta', nome: 'Cosa', predefinita: 'restaura', opzioni: [{ id: 'restaura', nome: 'Restaura' }, { id: 'render', nome: 'Dal disegno al render' }, { id: 'arreda', nome: 'Svuota e arreda' }, { id: 'rifinisci', nome: 'Rifinisci' }, { id: 'colora', nome: 'Colora' }] },
    { id: 'stile', tipo: 'testo', nome: 'Come arredarla (solo per «Svuota e arreda»)', esempio: 'un salotto moderno con divano grigio, tappeto e piante', opzionale: true }
  ],
  passi: (c) => {
    switch (c.v.cosa || 'restaura') {
      case 'render': return [
        E('Linea pulita', `Redraw ${FOTO} as clean, confident ink line art with consistent line weight on a white background. Keep the composition and every element.`),
        E('A colori', 'Color this line art as a vibrant, polished digital illustration with soft shading. Keep the composition and every element.'),
        E('Realistico', 'Turn this illustration into a photorealistic image with natural lighting and real textures. Keep the composition and every element.')
      ]
      case 'arreda': return [
        E('Stanza vuota', `Remove all the furniture, rugs and decorations from the room in ${FOTO}, leaving an empty room with clean walls and floor. Keep the architecture, windows, doors and lighting.`),
        E('Arredata', `Furnish this empty room as ${(c.v.stile || 'a cozy modern living room').trim()}. Keep the architecture, windows, doors and lighting unchanged.`)
      ]
      case 'rifinisci': return [E('Nitida', `Enhance the image quality of ${FOTO}: sharp fine details, clean textures, natural skin, no noise or compression artifacts. Keep everything identical.`, { lora: ['coerenza'] })]
      case 'colora': return [E('A colori', `Colorize ${FOTO} with natural, realistic colors, accurate skin tones and clothes. Keep everything else identical.`, { lora: ['coerenza'] })]
      default: return [
        E('Pulita', 'Restore this old photo: remove scratches, dust, stains, noise and blur, and fix the faded contrast. Keep the people and the composition identical.', { lora: ['coerenza'] }),
        E('A colori', 'Colorize this black and white photo with natural, realistic colors, accurate skin tones and clothes. Keep everything else identical.', { lora: ['coerenza'] }),
        E('Nitida', 'Enhance the image quality: sharp fine details, clean textures, no noise or compression artifacts. Keep everything identical.', { lora: ['coerenza'] })
      ]
    }
  }
}

export const WORKFLOW_V2: Workflow[] = [foglio, mondi, mix, set, formati, rinnova]
