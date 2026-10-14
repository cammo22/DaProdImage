# Prompt per le immagini delle ricette del Laboratorio

Per ognuna delle 51 ricette ci sono due prompt:

- **Sfondo**: l'immagine grande dietro la card, formato 16:9. Generala a **1344 × 768** (in Crea: risoluzione = lato corto **768**).
- **Miniatura**: l'immagine piccola quadrata, formato 1:1. Generala a **512 × 512** (in Crea: risoluzione **512**).

Tutti i prompt sono in inglese, come li vuole Qwen-Image: il testo è dentro il prompt, quindi non serve passarlo dal traduttore.

Ogni prompt dice già di non mettere testo, lettere o loghi leggibili. Lo sfondo ha il soggetto a destra e la parte sinistra più scura e morbida, perché sopra ci va il nome e la descrizione della card. La miniatura ha un soggetto solo, centrato e con contrasto forte, leggibile anche a 40 px.

**Nome file suggerito** (sostituisci `<id>` con l'id della ricetta): `sfondo-<id>.png` e `mini-<id>.png`. L'id è scritto accanto al titolo di ogni ricetta.

---

## Personaggio

### 1. Il personaggio in 9 pose · `pose`

**Sfondo** (`sfondo-pose.png`, 1344 × 768)
```
Wide 16:9 illustration of one stylized character shown in a row of nine poses: standing, sitting, walking, running, jumping, waving, side profile, looking back, leaning on a wall. Dark moody purple-navy palette with warm gold highlights, subject on the right two-thirds, left side softer and darker. Cinematic lighting, high detail. No text, no letters, no logos.
```

**Miniatura** (`mini-pose.png`, 512 × 512)
```
Square icon-style image of one stylized character jumping in the air with joy, single centered subject, bold simple composition, dark purple background with a gold accent, strong contrast, readable when small. No text, no letters, no logos.
```

### 2. Foglio personaggio (turnaround) · `turnaround`

**Sfondo** (`sfondo-turnaround.png`, 1344 × 768)
```
Wide 16:9 character model sheet of one character: front view, three-quarter view, side view and back view in a row, plus a close-up of the head, on a neutral studio backdrop. Dark moody purple-navy palette with warm gold highlights, subject on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-turnaround.png`, 512 × 512)
```
Square icon-style image of a character turnaround sheet: a single figure seen from the front and the side, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 3. Tutte le espressioni · `espressioni`

**Sfondo** (`sfondo-espressioni.png`, 1344 × 768)
```
Wide 16:9 grid of eight close-up faces of the same person, each with a different expression: happy, laughing, sad, angry, surprised, scared, thoughtful, winking. Dark moody purple-navy palette with warm gold highlights, the grid on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-espressioni.png`, 512 × 512)
```
Square icon-style image of one close-up face with a big laughing expression, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 4. A ogni età · `eta`

**Sfondo** (`sfondo-eta.png`, 1344 × 768)
```
Wide 16:9 image of the same person shown at five ages side by side, from child to elderly, soft warm light, the same pose and framing in each. Dark moody purple-navy palette with warm gold highlights, subjects on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-eta.png`, 512 × 512)
```
Square icon-style portrait split in two halves, a young face on one side and an elderly face on the other, centered, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 5. Sticker dal tuo personaggio (emozioni) · `sticker`

**Sfondo** (`sfondo-sticker.png`, 1344 × 768)
```
Wide 16:9 row of eight cute chibi die-cut stickers of one character, each showing a different emotion: happy, laughing, crying, angry, surprised, in love, sleepy, thumbs up. Thick white outlines, flat colors. Dark moody purple-navy background with warm gold highlights, stickers on the right two-thirds, left side softer and darker. No text, no letters, no logos.
```

**Miniatura** (`mini-sticker.png`, 512 × 512)
```
Square icon-style image of one cute chibi die-cut sticker of a smiling character, thick white outline, flat colors, centered, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

---

## Vestiti e look

### 6. Prova i vestiti · `prova`

**Sfondo** (`sfondo-prova.png`, 1344 × 768)
```
Wide 16:9 fashion scene: one person standing in front of a clothes rack, with a dress, a shirt and a jacket on hangers floating beside them, soft studio light. Dark moody purple-navy palette with warm gold highlights, subject on the right two-thirds, left side softer and darker. Photorealistic, high detail. No text, no letters, no logos.
```

**Miniatura** (`mini-prova.png`, 512 × 512)
```
Square icon-style image of one colorful shirt on a wooden hanger, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 7. L'armadio · `armadio`

**Sfondo** (`sfondo-armadio.png`, 1344 × 768)
```
Wide 16:9 image of eight outfits on mannequins in a row: tailored dark suit, casual jeans and white t-shirt, sporty tracksuit, winter coat with scarf, light summer linen, elegant evening outfit, smart business look, spooky Halloween costume. Dark moody purple-navy palette with warm gold highlights, mannequins on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-armadio.png`, 512 × 512)
```
Square icon-style image of one tailored dark suit on a hanger with a white shirt, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 8. Nuovo taglio e colore · `capelli`

**Sfondo** (`sfondo-capelli.png`, 1344 × 768)
```
Wide 16:9 portrait of one model surrounded by eight hairstyles in small panels: blonde, bright copper-red, long jet-black, voluminous curls, buzz cut, sleek bob, high ponytail, electric blue. Dark moody purple-navy palette with warm gold highlights, portrait on the right two-thirds, left side softer and darker. Photorealistic, high detail. No text, no letters, no logos.
```

**Miniatura** (`mini-capelli.png`, 512 × 512)
```
Square icon-style portrait of one model with voluminous curly electric blue hair, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 9. Costumi e ruoli · `ruoli`

**Sfondo** (`sfondo-ruoli.png`, 1344 × 768)
```
Wide 16:9 cinematic grid of one person in eight roles: astronaut in a space suit, medieval knight, pirate captain, superhero in a cape, noir detective in a trench coat, chef in a kitchen, samurai in armor, wizard in a starry robe. Dark moody purple-navy palette with warm gold highlights, grid on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-ruoli.png`, 512 × 512)
```
Square icon-style image of a medieval knight in detailed armor with a plumed helmet, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

---

## Camera

### 10. Giro intorno al soggetto · `giro`

**Sfondo** (`sfondo-giro.png`, 1344 × 768)
```
Wide 16:9 3D studio scene: a glowing product sculpture in the center with a dotted curved path of camera positions orbiting around it in arcs, showing it from many angles. Dark moody purple-navy palette with warm gold highlights, object on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-giro.png`, 512 × 512)
```
Square icon-style image of a small glowing object on a turntable with a circular orbit arrow around it, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 11. Tutte le inquadrature · `inquadrature`

**Sfondo** (`sfondo-inquadrature.png`, 1344 × 768)
```
Wide 16:9 film-style sequence of one portrait in six framings: extreme close-up on the face, medium shot from the waist up, full-body shot, wide-angle shot with surroundings, high angle from above, low angle from below. Dark moody purple-navy palette with warm gold highlights, sequence on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-inquadrature.png`, 512 × 512)
```
Square icon-style image of a face in a tight close-up, framed by viewfinder corner marks, centered, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 12. Le quattro viste · `viste`

**Sfondo** (`sfondo-viste.png`, 1344 × 768)
```
Wide 16:9 product photo set: one ceramic coffee mug shown from four sides in a row: front, right side, back, and from directly above on a clean studio table. Same design, colors and materials in every view. Dark moody purple-navy palette with warm gold highlights, mugs on the right two-thirds, left side softer and darker. Professional product photography. No text, no letters, no logos.
```

**Miniatura** (`mini-viste.png`, 512 × 512)
```
Square icon-style image of a ceramic coffee mug seen from directly above, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

---

## Luce e momento

### 13. Un giorno intero · `giorno`

**Sfondo** (`sfondo-giorno.png`, 1344 × 768)
```
Wide 16:9 image of the same lakeside house and landscape in six panels from left to right: dawn with soft pink light, bright morning, harsh noon sun, golden sunset, blue hour with warm windows, night with a starry sky. Dark moody purple-navy palette with warm gold highlights, scene on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-giorno.png`, 512 × 512)
```
Square icon-style image of a sun rising over a horizon with pink and orange light, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 14. Le quattro stagioni · `stagioni`

**Sfondo** (`sfondo-stagioni.png`, 1344 × 768)
```
Wide 16:9 image of the same tree and small house in four panels: spring with blossoms, summer with lush green, autumn with orange and red leaves, winter covered in snow. Dark moody purple-navy palette with warm gold highlights, panels on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-stagioni.png`, 512 × 512)
```
Square icon-style image of a single tree with orange autumn leaves, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 15. Che tempo fa? · `meteo`

**Sfondo** (`sfondo-meteo.png`, 1344 × 768)
```
Wide 16:9 image of the same street in six panels: sunny day, overcast sky, steady rain with wet reflections, falling snow, thick fog, thunderstorm with lightning. Dark moody purple-navy palette with warm gold highlights, panels on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-meteo.png`, 512 × 512)
```
Square icon-style image of a dark storm cloud with a lightning bolt beside a small sun, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 16. Sei luci da studio · `luci`

**Sfondo** (`sfondo-luci.png`, 1344 × 768)
```
Wide 16:9 portrait of the same person lit in six ways in a row: soft studio light, Rembrandt triangle light on the cheek, strong backlight with a glowing rim, neon magenta and cyan, warm candlelight, dramatic low-key shadows. Dark moody purple-navy palette with warm gold highlights, portraits on the right two-thirds, left side softer and darker. Photorealistic. No text, no letters, no logos.
```

**Miniatura** (`mini-luci.png`, 512 × 512)
```
Square icon-style portrait of a face half in shadow with Rembrandt lighting, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

---

## E se…?

### 17. E se fosse un'altra epoca? · `epoche`

**Sfondo** (`sfondo-epoche.png`, 1344 × 768)
```
Wide 16:9 grid of the same person in eight eras: 1920s art deco, 1950s diner, 1980s, medieval, ancient Rome, wild west, steampunk, far future. Each panel with its period clothes and setting, sepia and rich colors. Dark moody purple-navy palette with warm gold highlights, grid on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-epoche.png`, 512 × 512)
```
Square icon-style image of a vintage 1920s camera in sepia tones, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 18. E se fosse in un altro mondo? · `mondi`

**Sfondo** (`sfondo-mondi.png`, 1344 × 768)
```
Wide 16:9 grid of one character placed in eight worlds: underwater reef, outer space, desert dunes, jungle, neon cyberpunk city, post-apocalyptic ruins, ice cave, fantasy castle. Matching light and perspective in each. Dark moody purple-navy palette with warm gold highlights, grid on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-mondi.png`, 512 × 512)
```
Square icon-style image of an astronaut helmet floating in space in front of a planet, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 19. E se…? (libero) · `sefosse`

**Sfondo** (`sfondo-sefosse.png`, 1344 × 768)
```
Wide 16:9 image of a city street that turns into a dreamy floating city among the clouds, shown as four different imaginative versions side by side. Dark moody purple-navy palette with warm gold highlights, scenes on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-sefosse.png`, 512 × 512)
```
Square icon-style image of a city floating on clouds with a glowing gold light, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 20. Il tempo che passa · `tempo`

**Sfondo** (`sfondo-tempo.png`, 1344 × 768)
```
Wide 16:9 sequence of the same abandoned house in four panels from left to right: after 10 years with peeling paint and dust, after 30 years with vines on the walls, after 60 years with a broken roof, after 100 years reduced to ruins in a forest. Dark moody purple-navy palette with warm gold highlights, sequence on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-tempo.png`, 512 × 512)
```
Square icon-style image of a crumbling abandoned house overgrown with green vines, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

---

## Stili e arte

### 21. Lo stesso soggetto in 12 stili · `stili`

**Sfondo** (`sfondo-stili.png`, 1344 × 768)
```
Wide 16:9 grid of one red fox drawn in twelve art styles: anime, watercolor, oil painting, 3D render, LEGO, clay, pixel art, pencil sketch, comic book, Japanese woodblock print, stained glass, retro poster. Dark moody purple-navy palette with warm gold highlights, grid on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-stili.png`, 512 × 512)
```
Square icon-style image of a red fox in pixel art style, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 22. Diventa un giocattolo · `giocattoli`

**Sfondo** (`sfondo-giocattoli.png`, 1344 × 768)
```
Wide 16:9 shelf display of one person turned into collectible toys: action figure in a blister pack, vinyl toy, plush toy, minifigure, small statue, and a diorama scene. Dark moody purple-navy palette with warm gold highlights, shelf on the right two-thirds, left side softer and darker. Photorealistic product shot, high detail. No text, no letters, no logos.
```

**Miniatura** (`mini-giocattoli.png`, 512 × 512)
```
Square icon-style image of a vinyl toy figure with a big head and a small body, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 23. Diventa un oggetto · `oggetti`

**Sfondo** (`sfondo-oggetti.png`, 1344 × 768)
```
Wide 16:9 still life on a wooden table: one image shown as a Polaroid photo, a postage stamp, a coin, a vinyl record sleeve, a playing card, and a vintage cinema poster. Dark moody purple-navy palette with warm gold highlights, objects on the right two-thirds, left side softer and darker. Photorealistic, high detail. No text, no letters, no logos.
```

**Miniatura** (`mini-oggetti.png`, 512 × 512)
```
Square icon-style image of a Polaroid photo frame lying on a table, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

---

## Prodotto e business

### 24. Foto da catalogo · `catalogo`

**Sfondo** (`sfondo-catalogo.png`, 1344 × 768)
```
Wide 16:9 product photo set of one perfume bottle in six settings: on white, on a colorful backdrop, lifestyle setting, on marble, held in a hand, flat lay from above. Same product in every shot. Dark moody purple-navy palette with warm gold highlights, bottles on the right two-thirds, left side softer and darker. Professional commercial photography. No text, no letters, no logos.
```

**Miniatura** (`mini-catalogo.png`, 512 × 512)
```
Square icon-style image of one perfume bottle on white marble, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 25. Mockup del tuo logo · `mockup`

**Sfondo** (`sfondo-mockup.png`, 1344 × 768)
```
Wide 16:9 row of realistic product mockups of a blank emblem design: on a t-shirt, a mug, a tote bag, a poster on a wall, a billboard, a phone case. Clean and professional. Dark moody purple-navy palette with warm gold highlights, mockups on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-mockup.png`, 512 × 512)
```
Square icon-style image of a folded white t-shirt mockup on a table, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 26. Un'idea, tutti i formati · `formati`

**Sfondo** (`sfondo-formati.png`, 1344 × 768)
```
Wide 16:9 image of one scene shown in five social formats: square post, tall story, widescreen video frame, tall Pinterest pin, arranged as device-like frames. Same scene and composition in each. Dark moody purple-navy palette with warm gold highlights, frames on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-formati.png`, 512 × 512)
```
Square icon-style image of a phone showing a tall vertical story with a sunset scene, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

---

## Testi e grafica sulle foto

### 27. Aggiungi un testo alla foto · `testo-foto`

**Sfondo** (`sfondo-testo-foto.png`, 1344 × 768)
```
Wide 16:9 photo of a mountain lake at dusk with decorative typography effects around it: glowing neon tube shapes, chunky 3D blocks, brush calligraphy strokes, torn newspaper paper, a sticker with a peeled corner. Abstract letter-like shapes only, no readable text. Dark moody purple-navy palette with warm gold highlights, effects on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-testo-foto.png`, 512 × 512)
```
Square icon-style image of one glowing neon letter-like shape on a dark background, centered, bold simple composition, purple and gold colors, strong contrast. No readable text, no letters, no logos.
```

### 28. Meme e citazioni · `meme`

**Sfondo** (`sfondo-meme.png`, 1344 × 768)
```
Wide 16:9 three-panel image: a funny meme-style photo of a surprised cat, an elegant quote card with a serif frame and dark vignette, and a wooden street sign in a city scene. Abstract shapes instead of readable text. Dark moody purple-navy palette with warm gold highlights, panels on the right two-thirds, left side softer and darker. High detail. No readable text, no letters, no logos.
```

**Miniatura** (`mini-meme.png`, 512 × 512)
```
Square icon-style image of a wooden street sign on a post, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No readable text, no letters, no logos.
```

### 29. Traduci i testi in 6 lingue · `lingue`

**Sfondo** (`sfondo-lingue.png`, 1344 × 768)
```
Wide 16:9 city street with six blurred shop signs and posters in a row, representing six languages: English, Spanish, French, German, Japanese, Chinese. Blurred signboards without readable text. Dark moody purple-navy palette with warm gold highlights, signs on the right two-thirds, left side softer and darker. High detail. No readable text, no letters, no logos.
```

**Miniatura** (`mini-lingue.png`, 512 × 512)
```
Square icon-style image of a shop sign with a globe icon, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No readable text, no letters, no logos.
```

### 30. Biglietti di auguri · `auguri`

**Sfondo** (`sfondo-auguri.png`, 1344 × 768)
```
Wide 16:9 row of four greeting cards, each with a photo as the main picture: birthday card with balloons and confetti, Christmas card with snow and pine branches, graduation card with a cap and laurel leaves, anniversary card with roses and gold foil. Dark moody purple-navy palette with warm gold highlights, cards on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-auguri.png`, 512 × 512)
```
Square icon-style image of a birthday card with colorful balloons and confetti, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

---

## Casa e spazi

### 31. Ristruttura la stanza · `arredo`

**Sfondo** (`sfondo-arredo.png`, 1344 × 768)
```
Wide 16:9 row of six interior panels of the same room, each furnished in a different style: Scandinavian, industrial loft, boho, Japanese minimal, classic, modern luxury. Same architecture and windows. Dark moody purple-navy palette with warm gold highlights, panels on the right two-thirds, left side softer and darker. Interior photography, high detail. No text, no letters, no logos.
```

**Miniatura** (`mini-arredo.png`, 512 × 512)
```
Square icon-style image of a cozy armchair in a bright living room, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 32. Colori alle pareti · `pareti`

**Sfondo** (`sfondo-pareti.png`, 1344 × 768)
```
Wide 16:9 row of six panels of the same room with walls painted in six colors: white, sage green, navy blue, terracotta, gray, yellow. Same furniture and lighting. Dark moody purple-navy palette with warm gold highlights, panels on the right two-thirds, left side softer and darker. Interior photography, high detail. No text, no letters, no logos.
```

**Miniatura** (`mini-pareti.png`, 512 × 512)
```
Square icon-style image of a paint roller over a sage green wall, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 33. Svuota e arreda · `arreda`

**Sfondo** (`sfondo-arreda.png`, 1344 × 768)
```
Wide 16:9 before and after split of one room: on the left an empty bare room with clean walls and floor, on the right the same room furnished as a cozy living room with a gray sofa, a rug and plants. Same architecture and windows. Dark moody purple-navy palette with warm gold highlights, right side brighter, left side softer and darker. Interior photography, high detail. No text, no letters, no logos.
```

**Miniatura** (`mini-arreda.png`, 512 × 512)
```
Square icon-style image of a gray sofa with a plant in a bright living room, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

---

## Ritocco e restauro

### 34. Restauro completo · `restauro`

**Sfondo** (`sfondo-restauro.png`, 1344 × 768)
```
Wide 16:9 three-stage restoration of one vintage family portrait, left to right: a scratched, faded, sepia black and white photo; the same photo colorized with natural skin tones; the same photo sharp and clean with modern detail. Dark moody purple-navy palette with warm gold highlights, portraits on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-restauro.png`, 512 × 512)
```
Square icon-style image of a restored colorful vintage portrait photo, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 35. Ritratti professionali · `ritratti`

**Sfondo** (`sfondo-ritratti.png`, 1344 × 768)
```
Wide 16:9 row of four professional portraits of the same person: studio gray backdrop, soft outdoor light, classic black and white, corporate headshot. Dark moody purple-navy palette with warm gold highlights, portraits on the right two-thirds, left side softer and darker. Photorealistic, high detail. No text, no letters, no logos.
```

**Miniatura** (`mini-ritratti.png`, 512 × 512)
```
Square icon-style professional headshot with soft light, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 36. Dal disegno al render · `disegno`

**Sfondo** (`sfondo-disegno.png`, 1344 × 768)
```
Wide 16:9 three-stage progression of one sports car, left to right: a pencil sketch, clean ink line art on white, a vibrant digital illustration with soft shading, and a photorealistic render with real textures. Dark moody purple-navy palette with warm gold highlights, car on the right two-thirds, left side softer and darker. High detail. No text, no letters, no logos.
```

**Miniatura** (`mini-disegno.png`, 512 × 512)
```
Square icon-style image of a photorealistic sports car render, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

---

## Sticker e icone

### 37. Sticker di qualsiasi cosa · `sticker-tutto`

**Sfondo** (`sfondo-sticker-tutto.png`, 1344 × 768)
```
Wide 16:9 grid of eight die-cut stickers of one orange cat in eight styles: kawaii, bold comic, flat vector, watercolor, pixel art, clay 3D, retro 1970s, neon glow. Thick white outlines. Dark moody purple-navy palette with warm gold highlights, grid on the right two-thirds, left side softer and darker. No text, no letters, no logos.
```

**Miniatura** (`mini-sticker-tutto.png`, 512 × 512)
```
Square icon-style image of one cute orange cat die-cut sticker with a thick white outline, centered, flat colors, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 38. Sticker: stessa cosa, tante azioni · `sticker-azioni`

**Sfondo** (`sfondo-sticker-azioni.png`, 1344 × 768)
```
Wide 16:9 row of eight die-cut stickers of one friendly mascot doing different actions: waving, sleeping with little z bubbles, celebrating with confetti, running with motion lines, eating a snack, holding a big red heart, wearing sunglasses, looking grumpy. Consistent character design, thick white outlines. Dark moody purple-navy palette with warm gold highlights, stickers on the right two-thirds, left side softer and darker. No text, no letters, no logos.
```

**Miniatura** (`mini-sticker-azioni.png`, 512 × 512)
```
Square icon-style image of a friendly mascot holding a big red heart, thick white die-cut outline, centered, flat colors, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 39. Sticker da una lista · `sticker-lista`

**Sfondo** (`sfondo-sticker-lista.png`, 1344 × 768)
```
Wide 16:9 sheet of many small die-cut stickers in one consistent cute kawaii style: a pizza, an astronaut cat, an electric guitar, a lotus flower, a cup of tea, a rocket, a cactus, a moon. Thick white outlines. Dark moody purple-navy palette with warm gold highlights, sheet on the right two-thirds, left side softer and darker. No text, no letters, no logos.
```

**Miniatura** (`mini-sticker-lista.png`, 512 × 512)
```
Square icon-style image of one kawaii pizza slice die-cut sticker with a thick white outline, centered, flat colors, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 40. Set di icone coerenti · `icone-set`

**Sfondo** (`sfondo-icone-set.png`, 1344 × 768)
```
Wide 16:9 grid of flat colorful app icons in one consistent style: house, magnifying glass, shopping cart, bell, heart, gear, each with rounded corners and a soft shadow. Dark moody purple-navy background with warm gold highlights, grid on the right two-thirds, left side softer and darker. No text, no letters, no logos.
```

**Miniatura** (`mini-icone-set.png`, 512 × 512)
```
Square icon-style image of one flat colorful house app icon with rounded corners and a soft shadow, centered, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

---

## Grafica (preset di Crea, più stili)

### 41. Poster in 4 stili · `preset-poster`

**Sfondo** (`sfondo-preset-poster.png`, 1344 × 768)
```
Wide 16:9 row of four event posters in different styles: Swiss grid with bold sans-serif shapes, 1970s psychedelic, vintage cinema, illustrated. Abstract shapes instead of readable text. Dark moody purple-navy palette with warm gold highlights, posters on the right two-thirds, left side softer and darker. No readable text, no letters, no logos.
```

**Miniatura** (`mini-preset-poster.png`, 512 × 512)
```
Square icon-style image of a minimal Swiss-style poster with bold geometric shapes, centered, dark purple background with a gold accent, strong contrast. No readable text, no letters, no logos.
```

### 42. Infografica in 4 stili · `preset-infografica`

**Sfondo** (`sfondo-preset-infografica.png`, 1344 × 768)
```
Wide 16:9 row of four infographic panels: flat icons with numbered steps, isometric diagram, chalkboard drawings, dark dashboard with charts. Abstract shapes instead of readable text. Dark moody purple-navy palette with warm gold highlights, panels on the right two-thirds, left side softer and darker. High detail. No readable text, no letters, no logos.
```

**Miniatura** (`mini-preset-infografica.png`, 512 × 512)
```
Square icon-style image of a small bar chart and pie chart, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No readable text, no letters, no logos.
```

### 43. Logo in 4 stili · `preset-logo`

**Sfondo** (`sfondo-preset-logo.png`, 1344 × 768)
```
Wide 16:9 row of four logo marks: minimal geometric shape, emblem badge, cute mascot, monogram letter shape, on a dark background. No readable letters. Dark moody purple-navy palette with warm gold highlights, marks on the right two-thirds, left side softer and darker. High detail. No text, no logos with names.
```

**Miniatura** (`mini-preset-logo.png`, 512 × 512)
```
Square icon-style image of one minimal geometric logo mark in gold, centered, bold simple composition, dark purple background, strong contrast. No text, no letters.
```

### 44. Post social in 3 stili · `preset-social`

**Sfondo** (`sfondo-preset-social.png`, 1344 × 768)
```
Wide 16:9 row of three social media post designs with a product in the center: pop art bright colors, elegant minimal, neon glow. Abstract shapes instead of readable text. Dark moody purple-navy palette with warm gold highlights, posts on the right two-thirds, left side softer and darker. High detail. No readable text, no letters, no logos.
```

**Miniatura** (`mini-preset-social.png`, 512 × 512)
```
Square icon-style image of a bright pop art social post with a bold burst shape, centered, dark purple background with a gold accent, strong contrast. No readable text, no letters, no logos.
```

### 45. Miniatura in 3 stili · `preset-miniatura`

**Sfondo** (`sfondo-preset-miniatura.png`, 1344 × 768)
```
Wide 16:9 row of three video thumbnails: explosive bold colors with an arrow and a shocked face, clean minimal with a single subject, mysterious dark silhouette. Abstract shapes instead of readable text. Dark moody purple-navy palette with warm gold highlights, thumbnails on the right two-thirds, left side softer and darker. High detail. No readable text, no letters, no logos.
```

**Miniatura** (`mini-preset-miniatura.png`, 512 × 512)
```
Square icon-style image of an explosive video thumbnail with a shocked face and a red arrow, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No readable text, no letters, no logos.
```

### 46. Copertina in 4 stili · `preset-copertina`

**Sfondo** (`sfondo-preset-copertina.png`, 1344 × 768)
```
Wide 16:9 row of four book and album covers: romance with a soft portrait, dark thriller with a silhouette, fantasy with a castle, abstract music album art. Abstract shapes instead of readable titles. Dark moody purple-navy palette with warm gold highlights, covers on the right two-thirds, left side softer and darker. High detail. No readable text, no letters, no logos.
```

**Miniatura** (`mini-preset-copertina.png`, 512 × 512)
```
Square icon-style image of a dark thriller book cover with a lone silhouette, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No readable text, no letters, no logos.
```

### 47. Invito in 3 stili · `preset-invito`

**Sfondo** (`sfondo-preset-invito.png`, 1344 × 768)
```
Wide 16:9 row of three wedding invitation cards: soft watercolor florals, gold foil geometric pattern, modern minimal. Abstract shapes instead of readable text. Dark moody purple-navy palette with warm gold highlights, cards on the right two-thirds, left side softer and darker. High detail. No readable text, no letters, no logos.
```

**Miniatura** (`mini-preset-invito.png`, 512 × 512)
```
Square icon-style image of a gold foil invitation card with a ring, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No readable text, no letters, no logos.
```

### 48. Menù in 3 stili · `preset-menu`

**Sfondo** (`sfondo-preset-menu.png`, 1344 × 768)
```
Wide 16:9 row of three restaurant menus with a plate of food: chalkboard style, vintage paper style, modern minimal style. Abstract lines instead of readable text. Dark moody purple-navy palette with warm gold highlights, menus on the right two-thirds, left side softer and darker. High detail. No readable text, no letters, no logos.
```

**Miniatura** (`mini-preset-menu.png`, 512 × 512)
```
Square icon-style image of a plate of food on a chalkboard, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No readable text, no letters, no logos.
```

### 49. Sticker in 3 stili · `preset-sticker`

**Sfondo** (`sfondo-preset-sticker.png`, 1344 × 768)
```
Wide 16:9 row of three emoji sticker sets of one smiling face: kawaii pastel, cartoon bold outlines, pixel art. Thick white outlines. Dark moody purple-navy palette with warm gold highlights, stickers on the right two-thirds, left side softer and darker. No text, no letters, no logos.
```

**Miniatura** (`mini-preset-sticker.png`, 512 × 512)
```
Square icon-style image of one kawaii smiling emoji sticker with a thick white outline, centered, flat colors, dark purple background with a gold accent, strong contrast. No text, no letters, no logos.
```

### 50. App / sito in 3 stili · `preset-app`

**Sfondo** (`sfondo-preset-app.png`, 1344 × 768)
```
Wide 16:9 row of three phone app screen mockups: light theme, dark theme, frosted glass theme. Abstract interface shapes instead of readable text. Dark moody purple-navy palette with warm gold highlights, phones on the right two-thirds, left side softer and darker. Clean product render, high detail. No readable text, no letters, no logos.
```

**Miniatura** (`mini-preset-app.png`, 512 × 512)
```
Square icon-style image of a phone with a frosted glass app screen, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No readable text, no letters, no logos.
```

### 51. Slide in 3 stili · `preset-slide`

**Sfondo** (`sfondo-preset-slide.png`, 1344 × 768)
```
Wide 16:9 row of three presentation slides: corporate blue with a clean layout, creative colorful shapes, dark elegant with a gold line. Abstract shapes instead of readable text. Dark moody purple-navy palette with warm gold highlights, slides on the right two-thirds, left side softer and darker. High detail. No readable text, no letters, no logos.
```

**Miniatura** (`mini-preset-slide.png`, 512 × 512)
```
Square icon-style image of a presentation slide with a simple gold bar chart, centered, bold simple composition, dark purple background with a gold accent, strong contrast. No readable text, no letters, no logos.
```
