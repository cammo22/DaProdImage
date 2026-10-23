// Gli stili della GUI v2: 28, in 4 scaffali, ognuno con un id stabile, un frammento di prompt in inglese e tre intensità.
// Le anteprime vere (immagini generate con Klein, stessa scena per tutti) arrivano con gli asset; finché non ci sono la tessera ha un gradiente e un'icona.
// Vale sia per Crea (si aggiunge al prompt) sia per Modifica (la categoria «Stili» trasforma la foto).

export type Intensita = 0 | 1 | 2
export const INTENSITA: { id: Intensita; nome: string; titolo: string }[] = [
  { id: 0, nome: 'Leggero', titolo: 'Un\'influenza lieve: la scena resta in primo piano' },
  { id: 1, nome: 'Pieno', titolo: 'Lo stile scelto, senza esagerare' },
  { id: 2, nome: 'Estremo', titolo: 'Tutto in quello stile, senza compromessi' }
]

export interface Stile {
  id: string
  nome: string
  scaffale: string
  /** in inglese: è la lingua che il modello capisce meglio */
  frammento: string
  /** gradiente di ripiego per la tessera e un'icona a emoji */
  fondo: string
  icona: string
}

const S = (id: string, nome: string, scaffale: string, frammento: string, a: string, b: string, icona: string): Stile => ({
  id, nome, scaffale, frammento, icona, fondo: `linear-gradient(135deg, ${a}, ${b})`
})

export const SCAFFALI: { id: string; nome: string }[] = [
  { id: 'foto', nome: 'Foto d\'oggi' },
  { id: 'disegnati', nome: 'Disegnati' },
  { id: '3d', nome: 'In 3D' },
  { id: 'grafica', nome: 'Grafica spaziale e oltre' }
]

export const STILI: Stile[] = [
  // --- Foto d'oggi ---
  S('cinema-anam', 'Cinema', 'foto', 'cinematic still, anamorphic lens flares, oval bokeh, rich color grade, 2.39:1 feel', '#0f2b46', '#e08a3c', '🎬'),
  S('flash-y2k', 'Flash 2000', 'foto', 'direct on-camera flash, early-2000s compact digital camera look, harsh highlights, candid party snapshot', '#2b2b2b', '#ffe9a8', '📸'),
  S('pellicola35', 'Pellicola', 'foto', 'shot on 35mm film, visible grain, soft halation, faded blacks', '#5a3b22', '#d9a066', '🎞️'),
  S('moda-editoriale', 'Moda', 'foto', 'high-fashion editorial photography, studio strobes, bold color blocking, magazine cover composition', '#6b0f3a', '#f3b0c8', '👗'),
  S('polaroid', 'Polaroid', 'foto', 'instant film photo, white frame, soft focus, washed warm tones, light leaks', '#c9a27a', '#fff2dc', '🖼️'),
  S('notte-neon', 'Notte neon', 'foto', 'night street photography, wet asphalt reflections, magenta and cyan neon signage', '#150a3a', '#ff3df2', '🌃'),
  S('documentario', 'Reportage', 'foto', 'gritty documentary photograph, available light, slightly desaturated, imperfect framing', '#3a3d40', '#9aa0a6', '📰'),
  // --- Disegnati ---
  S('anime-film', 'Anime', 'disegnati', 'high quality anime movie still, painterly backgrounds, soft cinematic lighting', '#2a6fdb', '#ffb7d5', '🌸'),
  S('acquerello-film', 'Acquerello', 'disegnati', 'hand-painted watercolor animation background, soft gradients, gentle clouds', '#7ec8e3', '#fbe7c6', '🎨'),
  S('manga-inchiostro', 'Manga', 'disegnati', 'black and white manga, screentones, dynamic inked lines', '#111111', '#e8e8e8', '✒️'),
  S('gouache', 'Gouache', 'disegnati', 'contemporary gouache illustration, flat shapes, rich matte colors, subtle paper texture', '#d1495b', '#edae49', '🖌️'),
  S('risograph', 'Risograph', 'disegnati', 'two-color risograph print, grainy overprint, misregistration, limited palette', '#ff4d8d', '#2d5bff', '🖨️'),
  S('collage', 'Collage', 'disegnati', 'cut-paper collage, layered torn paper edges, mixed textures', '#e9c46a', '#e76f51', '✂️'),
  S('linea', 'Linea unica', 'disegnati', 'minimal single continuous line drawing on white, a touch of color', '#f5f5f5', '#c9c9d6', '〰️'),
  // --- In 3D ---
  S('soft3d', '3D morbido', '3d', 'soft 3D render, rounded shapes, pastel studio light, subsurface scattering, friendly character look', '#ffb5e8', '#b5deff', '🧸'),
  S('plastilina', 'Plastilina', '3d', 'stop-motion claymation, visible fingerprints, handmade imperfections', '#f4a261', '#2a9d8f', '🧱'),
  S('vinile', 'Vinile', '3d', 'designer vinyl toy, glossy plastic, seam lines, studio product shot', '#7b2cbf', '#ff9e00', '🪀'),
  S('diorama', 'Diorama', '3d', 'isometric miniature diorama, tilt-shift, clean cube base, soft shadows', '#06d6a0', '#118ab2', '🏝️'),
  S('mattoncini', 'Mattoncini', '3d', 'scene built of interlocking plastic bricks and minifigures', '#e63946', '#ffd60a', '🧩'),
  S('vetro', 'Vetro liquido', '3d', 'liquid glass and crystal, refractive translucent material, caustics, iridescent edges', '#3fe0ff', '#b388ff', '🔮'),
  S('chrome', 'Cromo Y2K', '3d', 'chrome blobject, reflective metal, hyperreal studio HDRI, early-2000s futurism', '#8d99ae', '#edf2f4', '💿'),
  // --- Grafica spaziale e oltre ---
  S('cyberpunk', 'Cyberpunk', 'grafica', 'dense neon cityscape, holograms, rain, high contrast magenta/teal', '#00b8d4', '#d500f9', '🤖'),
  S('synthwave', 'Synthwave', 'grafica', 'retro-futuristic 80s sunset grid, chrome lettering, purple-pink gradient sky', '#ff006e', '#3a0ca3', '🌆'),
  S('aura', 'Aura', 'grafica', 'soft airbrushed aura gradients, grain, glowing blurred shapes, dreamy abstract', '#f72585', '#4cc9f0', '🫧'),
  S('pixel', 'Pixel 32-bit', 'grafica', 'detailed 32-bit pixel art, limited palette, dithering', '#2d6a4f', '#95d5b2', '👾'),
  S('spaziale60', 'Space age', 'grafica', '1960s space-age illustration, atomic shapes, retro NASA poster palette', '#e85d04', '#023e8a', '🚀'),
  S('solarpunk', 'Solarpunk', 'grafica', 'solarpunk utopia, lush green architecture, warm sunlight, art nouveau curves', '#2d9a4a', '#ffd166', '🌿'),
  S('svizzero', 'Poster svizzero', 'grafica', 'Swiss international typographic poster, strong grid, flat color, bold sans-serif', '#d00000', '#ffffff', '🔠')
]

export const stileDa = (id: string): Stile | undefined => STILI.find((s) => s.id === id)

/** la frase da aggiungere al prompt di Crea (descrive la scena, poi lo stile) */
export function fraseStileCrea(s: Stile, i: Intensita): string {
  if (i === 0) return `with a subtle ${s.frammento} influence`
  if (i === 1) return `in this style: ${s.frammento}`
  return `fully rendered as ${s.frammento}, extreme, uncompromising commitment to this style`
}

/** l'istruzione di Modifica: trasforma la foto tenendo composizione e identità */
export function frasiStileModifica(s: Stile, i: Intensita): string {
  const forza = i === 0 ? 'Apply it subtly, keeping the original look mostly intact.' : i === 1 ? 'Apply it clearly.' : 'Apply it fully and boldly, with an extreme commitment to the style.'
  return `Transform the image into this style: ${s.frammento}. Keep the composition, subjects, pose and identity unchanged. ${forza}`
}
