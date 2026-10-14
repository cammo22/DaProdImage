// Le azioni rapide di Modifica: persone, vestiti, situazioni, camera, luce, stili, testi, ritocco.
// Un clic mette l'istruzione giusta (in inglese: è la lingua che il modello capisce meglio); quelle che finiscono con
// "…" vanno completate, quelle con `rif` vogliono una foto di riferimento (<image2>: si chiede subito) e quelle con `lora`
// accendono da sole il LoRA giusto, se c'è.

/** i LoRA che le azioni accendono da sole (se sono nella cartella): nome logico → come si trova */
export type ChiaveLora = 'coerenza' | 'vestiti' | 'camera'

export interface Rapida {
  id: string
  nome: string
  prompt: string
  /** il prompt va finito dall'utente (c'è un "…") */
  completa?: boolean
  trasparente?: boolean
  /** quanto ridisegnare (solo per i ritocchi leggeri) */
  forza?: number
  /** quante foto di riferimento servono (la prima è <image2>) e come chiamarle quando si chiedono */
  rif?: number
  rifNome?: string
  /** i LoRA che aiutano questa azione */
  lora?: ChiaveLora[]
}

export interface CategoriaRapide {
  id: string
  nome: string
  icona: string
  /** in quali modi di Modifica compare */
  per: ('tutta' | 'zona')[]
  voci: Rapida[]
}

const R = (id: string, nome: string, prompt: string, extra: Partial<Rapida> = {}): Rapida => ({ id, nome, prompt, ...extra })

const COERENTE: Partial<Rapida> = { lora: ['coerenza'] }
const INVARIATO = 'Keep the identity, face, pose and everything else unchanged.'

export const CATEGORIE: CategoriaRapide[] = [
  {
    id: 'persone', nome: 'Persone', icona: 'ritratto', per: ['tutta', 'zona'],
    voci: [
      R('persona-rif', 'Cambia persona', 'Replace the person in <image1> with the person shown in <image2>. Keep the same pose, clothing, lighting, framing and background.', { rif: 1, rifNome: 'la persona da mettere' }),
      R('persona-agg', 'Aggiungi persona', 'Add the person from <image2> next to the subject in <image1>, standing naturally in the same scene with matching lighting, scale and perspective. Keep everything else unchanged.', { rif: 1, rifNome: 'la persona da aggiungere' }),
      R('persona-togli', 'Togli le persone', 'Remove all the people from the image and fill the space with the surrounding scene so it looks natural and untouched.'),
      R('sorriso', 'Sorriso', `Make the person smile naturally. ${INVARIATO}`, COERENTE),
      R('occhi', 'Occhi aperti', `Open the person's eyes naturally, looking at the camera. ${INVARIATO}`, COERENTE),
      R('giovane', 'Più giovane', `Make the person look about 20 years younger: smoother skin, fewer wrinkles, same person. ${INVARIATO}`, COERENTE),
      R('anziano', 'Più anziano', `Age the person by about 30 years: gray hair, wrinkles, same person. ${INVARIATO}`, COERENTE),
      R('capelli', 'Cambia acconciatura…', 'Change the hairstyle to … Keep the face, expression, clothing and everything else unchanged.', { completa: true }),
      R('capelli-col', 'Colore capelli…', 'Change the hair color to … Keep the hairstyle, face and everything else unchanged.', { completa: true, ...COERENTE }),
      R('occhiali', 'Metti gli occhiali', `Put a pair of stylish glasses on the person. ${INVARIATO}`),
      R('barba', 'Barba…', 'Give the person a … beard. Keep the face, expression and everything else unchanged.', { completa: true }),
      R('animale', 'Aggiungi un animale…', 'Add a … next to the subject, naturally integrated with matching lighting, shadows and scale. Keep everything else unchanged.', { completa: true })
    ]
  },
  {
    id: 'vestiti', nome: 'Vestiti', icona: 'vestiti', per: ['tutta', 'zona'],
    voci: [
      R('prova', 'Prova vestito', 'Dress the person in <image1> in the outfit shown in <image2>. Keep their face, hair, hands, pose and the background exactly the same.', { rif: 1, rifNome: 'la foto del vestito', lora: ['vestiti'] }),
      R('vestito', 'Cambia vestito…', 'Change the clothing to … Keep the face, hair, pose, and the background exactly the same.', { completa: true, lora: ['vestiti'] }),
      R('abito', 'Abito da sera', 'Dress the person in an elegant evening outfit. Keep their face, hair, pose and the background exactly the same.', { lora: ['vestiti'] }),
      R('elegante', 'Giacca e cravatta', 'Dress the person in a tailored dark suit with a shirt and tie. Keep their face, hair, pose and the background exactly the same.', { lora: ['vestiti'] }),
      R('casual', 'Casual', 'Dress the person in a casual outfit: jeans, a white t-shirt and sneakers. Keep their face, hair, pose and the background exactly the same.', { lora: ['vestiti'] }),
      R('invernale', 'Cappotto invernale', 'Dress the person in a warm winter coat, scarf and woolen hat. Keep their face, pose and the background exactly the same.', { lora: ['vestiti'] }),
      R('costume', 'Costume…', 'Dress the person in a … costume. Keep their face, hair, pose and the background exactly the same.', { completa: true, lora: ['vestiti'] }),
      R('divisa', 'Divisa da…', 'Dress the person in the uniform of a … Keep their face, hair, pose and the background exactly the same.', { completa: true, lora: ['vestiti'] }),
      R('armatura', 'Armatura', 'Dress the person in a detailed medieval knight armor. Keep their face, pose and the background exactly the same.', { lora: ['vestiti'] }),
      R('spazio', 'Tuta spaziale', 'Dress the person in a realistic white astronaut suit with the helmet off. Keep their face, pose and the background exactly the same.', { lora: ['vestiti'] })
    ]
  },
  {
    id: 'situazioni', nome: 'Situazioni', icona: 'situazione', per: ['tutta'],
    voci: [
      R('sfondo', 'Cambia sfondo…', 'Replace the background with … and keep the subject exactly the same, with matching light and shadows.', { completa: true }),
      R('mettilo', 'Mettilo in…', 'Place the subject in … matching the lighting, perspective and scale. Keep the subject exactly the same.', { completa: true }),
      R('notte', 'E se fosse di notte', `Turn the scene into a night scene with deep blue shadows and warm artificial lights. Keep the composition and subjects identical.`, COERENTE),
      R('pioggia', 'Sotto la pioggia', 'Make it rain: wet surfaces, raindrops, reflections and an overcast sky. Keep the composition and subjects identical.', COERENTE),
      R('neve', 'Con la neve', 'Cover the scene with fresh snow, falling snowflakes and a cold winter atmosphere. Keep the composition and subjects identical.', COERENTE),
      R('nebbia', 'Nella nebbia', 'Fill the scene with thick atmospheric fog. Keep the composition and subjects identical.', COERENTE),
      R('tramonto', 'Al tramonto', 'Change the time of day to a glowing golden sunset with a warm orange sky. Keep the composition and subjects identical.', COERENTE),
      R('primavera', 'In primavera', 'Change the season to spring with blooming flowers and fresh green leaves. Keep the composition and subjects identical.', COERENTE),
      R('autunno', 'In autunno', 'Change the season to autumn with orange and red leaves and soft golden light. Keep the composition and subjects identical.', COERENTE),
      R('sott-acqua', 'Sott\'acqua', 'Put the whole scene underwater with light rays, bubbles and a blue-green tint. Keep the subjects identical.'),
      R('spazio-sit', 'Nello spazio', 'Place the subject in outer space with planets, stars and a nebula in the background. Keep the subject exactly the same.'),
      R('anni80', 'Anni \'80', 'Turn this into a photo from the 1980s: period clothes and hairstyles, retro colors, film grain. Keep the composition.'),
      R('futuro', 'Città del futuro', 'Move the scene into a futuristic cyberpunk city with neon signs and flying vehicles. Keep the subject exactly the same.'),
      R('folla', 'Aggiungi gente', 'Add a few people in the background, naturally integrated with the scene, lighting and perspective. Keep the main subject unchanged.'),
      R('svuota', 'Svuota la scena', 'Remove every person and vehicle from the scene and fill the space naturally. Keep the background unchanged.')
    ]
  },
  {
    id: 'prospettiva', nome: 'Prospettiva', icona: 'camera', per: ['tutta'],
    voci: [
      R('alto', 'Dall\'alto', 'Show the same scene from a high angle looking down at about 45 degrees. Keep the same subject, outfit, colors and lighting.', { lora: ['camera'] }),
      R('basso', 'Dal basso', 'Show the same scene from a low angle looking up at the subject. Keep the same subject, outfit, colors and lighting.'),
      R('dall-alto-top', 'Vista a piombo', 'Show the same scene from directly above, a top-down bird\'s-eye view. Keep the same subject, outfit, colors and lighting.', { lora: ['camera'] }),
      R('primo-piano', 'Primo piano', 'Zoom in to a close-up of the subject, keeping the same details, colors and lighting.', { lora: ['camera'] }),
      R('largo', 'Campo largo', 'Zoom out to a wide shot showing much more of the surroundings. Keep the same subject, colors and lighting.'),
      R('lato', 'Visto di lato', 'Show the same subject from the side, a profile view. Keep the same subject, outfit, colors and lighting.', { lora: ['camera'] }),
      R('dietro', 'Visto da dietro', 'Show the same subject from behind. Keep the same subject, outfit, colors and lighting.', { lora: ['camera'] }),
      R('tre-quarti', 'Di tre quarti', 'Rotate the camera 45 degrees to the right around the subject. Keep the same subject, outfit, colors and lighting.', { lora: ['camera'] }),
      R('grandangolo', 'Grandangolo', 'Re-shoot the scene with a wide-angle lens, stronger perspective and a slightly closer camera. Keep the same subject, colors and lighting.'),
      R('tele', 'Teleobiettivo', 'Re-shoot the scene with a telephoto lens: compressed perspective, blurred background. Keep the same subject, colors and lighting.')
    ]
  },
  {
    id: 'luce', nome: 'Luce e colore', icona: 'luce', per: ['tutta'],
    voci: [
      R('studio', 'Luce da studio', 'Relight the photo with soft professional studio lighting and a natural color grade. Keep the subject, pose and composition identical.', COERENTE),
      R('oro', 'Ora d\'oro', 'Relight the photo with warm golden hour sunlight, long soft shadows. Keep the subject, pose and composition identical.', COERENTE),
      R('controluce', 'Controluce', 'Relight the photo with strong backlight and a glowing rim light around the subject. Keep the subject, pose and composition identical.', COERENTE),
      R('neon', 'Luci al neon', 'Relight the photo with colorful magenta and cyan neon lights. Keep the subject, pose and composition identical.', COERENTE),
      R('drammatica', 'Drammatica', 'Relight the photo with dramatic low-key lighting, deep shadows and strong contrast. Keep the subject, pose and composition identical.', COERENTE),
      R('candela', 'A lume di candela', 'Relight the photo with warm flickering candlelight, dark surroundings. Keep the subject, pose and composition identical.', COERENTE),
      R('bn-colora', 'Colora il B/N', 'Colorize this black and white photo with natural, realistic colors. Keep everything else identical.', COERENTE),
      R('bn', 'In bianco e nero', 'Convert the image to a classic high-quality black and white photograph with rich tonal range. Keep everything identical.', COERENTE),
      R('pellicola', 'Pellicola', 'Give the photo the look of Kodak Portra 400 film: soft contrast, warm tones, fine grain. Keep everything identical.', COERENTE),
      R('vivace', 'Colori vivaci', 'Make the colors richer and more vibrant with more contrast and clarity, still natural. Keep everything identical.', COERENTE)
    ]
  },
  {
    id: 'stili', nome: 'Stili', icona: 'arte', per: ['tutta'],
    voci: [
      R('anime', 'Anime', 'Transform this image into a high quality anime illustration style. Keep the composition and the subject.'),
      R('pittura-anime', 'Anime dipinto', 'Transform this image into a hand-painted anime film background style with soft watercolor skies. Keep the composition and the subject.'),
      R('acquerello', 'Acquerello', 'Transform this image into a delicate watercolor painting. Keep the composition and the subject.'),
      R('olio', 'Pittura a olio', 'Transform this image into a classical oil painting with visible brush strokes. Keep the composition and the subject.'),
      R('cartoon', '3D cartoon', 'Transform this image into a 3D animated movie style render. Keep the composition and the subject.'),
      R('lego', 'LEGO', 'Rebuild this scene as if made of LEGO bricks and minifigures. Keep the composition.'),
      R('creta', 'Pupazzo di creta', 'Transform this image into a stop-motion claymation scene made of modeling clay. Keep the composition and the subject.'),
      R('pixel', 'Pixel art', 'Transform this image into detailed 32-bit pixel art. Keep the composition and the subject.'),
      R('matita', 'Schizzo a matita', 'Transform this image into a detailed pencil sketch on paper. Keep the composition and the subject.'),
      R('fumetto', 'Fumetto', 'Transform this image into a comic book page style with bold ink lines and halftone shading. Keep the composition and the subject.'),
      R('caricatura', 'Caricatura', 'Draw a friendly caricature of the person with exaggerated features, keeping the likeness recognizable.'),
      R('foto-real', 'Foto realistica', 'Turn this into a photorealistic photograph with natural lighting and real textures. Keep the composition and the subject.'),
      R('action', 'Action figure', 'Turn the subject into a collectible action figure sealed in a toy blister pack with a printed card and accessories. Keep the likeness recognizable.')
    ]
  },
  {
    id: 'testo', nome: 'Testi', icona: 'testo', per: ['tutta', 'zona'],
    voci: [
      R('t-cambia', 'Cambia testo…', 'Replace the text "…" with "", keeping the same font, size, color, perspective and position.', { completa: true }),
      R('t-traduci', 'Traduci testo…', 'Translate all the text in the image into …, keeping the same fonts, layout, colors and style. Change nothing else.', { completa: true }),
      R('t-togli', 'Togli scritte', 'Remove all text, captions, logos and watermarks from the image, filling those areas naturally. Keep everything else identical.'),
      R('t-aggiungi', 'Aggiungi titolo…', 'Add the headline "…" in large bold lettering across the top of the image, with good contrast and a clean modern font. Keep everything else identical.', { completa: true }),
      R('t-scrivi', 'Scrivi qui…', 'Write the text "…" here, with lettering that matches the style, perspective and lighting of the image.', { completa: true }),
      R('t-cartello', 'Cartello…', 'Add a sign that reads "…" in a natural place in the scene, with matching perspective and lighting. Keep everything else identical.', { completa: true }),
      R('t-meme', 'Meme', 'Turn this into a meme: add the top caption "…" in bold white Impact-style letters with black outline, and the bottom caption "".', { completa: true })
    ]
  },
  {
    id: 'ritocco', nome: 'Ritocco', icona: 'bacchetta', per: ['tutta'],
    voci: [
      R('sfondo-via', 'Rimuovi sfondo', 'Remove the background, and output a PNG image', { trasparente: true }),
      R('sfondo-bianco', 'Sfondo bianco', 'Replace the background with a clean pure white studio background and a soft natural shadow under the subject. Keep the subject exactly the same.', COERENTE),
      R('restaura', 'Restaura foto', 'Restore this old photo: remove scratches, dust, noise and blur, sharpen the details and fix the faded colors. Keep the people and the composition identical.', COERENTE),
      R('dettagli', 'Più dettagli', 'Enhance the image quality: sharper details, cleaner textures, no noise or compression artifacts. Keep everything identical.', COERENTE),
      R('pelle', 'Pelle pulita', 'Retouch the skin naturally: remove blemishes and shine, keep the real skin texture. Keep the identity and everything else unchanged.', COERENTE),
      R('foto-lavoro', 'Foto per CV', 'Turn this into a professional headshot: neutral studio background, soft lighting, neat clothes. Keep the face and identity unchanged.')
    ]
  },
  {
    id: 'zona-base', nome: 'Zona', icona: 'zona', per: ['zona'],
    voci: [
      R('z-rimuovi', 'Rimuovi oggetto', 'Remove the object completely and fill the area with the surrounding background so it looks natural and untouched.'),
      R('z-sostituisci', 'Sostituisci con…', 'Replace it with …', { completa: true }),
      R('z-colore', 'Cambia colore…', 'Change its color to …', { completa: true, ...COERENTE }),
      R('z-aggiungi', 'Aggiungi…', 'Add … in this area, matching the lighting and perspective of the scene', { completa: true }),
      R('z-ritocca', 'Ritocca', 'Clean up and retouch this area naturally: remove blemishes and defects, keep it realistic.', { forza: 0.6, ...COERENTE }),
      R('z-oggetto', 'Metti l\'oggetto', 'Put the object shown in <image2> in this area, matching the lighting, perspective and scale of the scene.', { rif: 1, rifNome: 'l\'oggetto da inserire' }),
      R('z-persona', 'Metti la persona', 'Put the person shown in <image2> in this area, matching the lighting, perspective and scale of the scene.', { rif: 1, rifNome: 'la persona da inserire' }),
      R('z-vestito', 'Metti il vestito', 'Dress the person in this area in the outfit shown in <image2>. Keep their face, hair, hands and pose.', { rif: 1, rifNome: 'la foto del vestito', lora: ['vestiti'] }),
      R('z-sfoca', 'Sfoca', 'Blur this area with a natural soft focus, as if it were out of focus in the photo.', { forza: 0.8, ...COERENTE })
    ]
  }
]

export const categoriePer = (modo: 'tutta' | 'zona'): CategoriaRapide[] => CATEGORIE.filter((c) => c.per.includes(modo))
