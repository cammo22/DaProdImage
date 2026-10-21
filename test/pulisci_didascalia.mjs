// Test della pulizia della didascalia del prompt upsampler di Klein (Qwen3-VL 4B).
// Il 4B, quando scrive, apre spesso con una frase di cortesia o con le regole del sistema invece che con la didascalia
// («Here’s the expanded, detailed caption for your image request:», «You're a prompt upsampler for text-to-image models…»):
// se non si toglie, quella frase finisce nel prompt del modello e gli fa male. Qui si verifica che venga tolta.
//
// Esecuzione: node test/pulisci_didascalia.mjs
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const QUI = dirname(fileURLToPath(import.meta.url))

// il codice vero, non una copia (Node con type stripping)
const { pulisciDidascalia, REGOLA } = await import(
  pathToFileURL(join(QUI, '..', 'src', 'main', 'motore', 'didascalia.ts')).href
)

// [nome, testo, deve iniziare con, non deve contenere]
const casi = [
  [
    'preambolo "Here’s the expanded…"',
    "Here’s the expanded, detailed caption for your image request:\n\nFull-color outdoor photograph capturing a tranquil, narrow alleyway in Naples during the soft golden hour of dusk, where the ambient light casts long, gentle shadows across cobblestone pavement.",
    'Full-color outdoor photograph',
    'expanded, detailed caption'
  ],
  [
    'regole ricopiate',
    "You're a prompt upsampler for text-to-image models. Your job is to expand short, vague prompts into detailed, self-contained captions that the model can use to generate high-quality images.\n\nYour output should be exactly one continuous block of prose — no greetings.\n\nFull-color indoor photograph of a kitchen bathed in soft daylight, a woman in a yellow sweater holding a white mug near a large window.",
    'Full-color indoor photograph',
    'prompt upsampler'
  ],
  [
    'titolo in grassetto',
    '**Image Idea:** Full-color outdoor photograph of a cat asleep on an old book, candlelight flickering across the fur.',
    'Full-color outdoor photograph',
    'Image Idea'
  ],
  [
    'gia pulita (non deve cambiare)',
    'Full-color outdoor photograph of a quiet alley in Naples at dusk, laundry hanging between balconies, a scooter parked in front.',
    'Full-color outdoor photograph of a quiet alley',
    ''
  ],
  [
    'etichetta Caption:',
    'Caption: Full-color studio photograph of a glass vase on a wooden table, soft diffused light from the left.',
    'Full-color studio photograph',
    'Caption:'
  ],
  [
    'preambolo lungo',
    'Here is your expanded detailed caption:\n\nFull-color outdoor photograph of a mountain range at sunrise, layered peaks in blue and grey haze, a small cabin in the foreground.',
    'Full-color outdoor photograph',
    'expanded detailed caption'
  ],
  ['troppo corto (non deve mangiare)', '#', '#', ''],
  [
    'istruzione etichettata',
    'Instruction: Remove the red car from the street and replace it with a bicycle, keeping the wet asphalt reflections consistent with the overcast evening light.',
    'Remove the red car',
    'Instruction:'
  ],
  [
    'didascalia con 2 paragrafi buoni (non deve perderli)',
    'Full-color outdoor photograph of a quiet alley in Naples at dusk, laundry hanging between balconies, a scooter parked in front.\n\nThe cobblestones are slick with recent rain and reflect the warm glow of a single streetlamp above the doorway.',
    'Full-color outdoor photograph',
    ''
  ],
  [
    'didascalia con un paragrafo di regole in mezzo',
    'Full-color outdoor photograph of a quiet alley in Naples at dusk, laundry hanging between balconies, a scooter parked in front.\n\nYour output should be exactly one continuous block of prose with no greetings.\n\nThe cobblestones are slick with recent rain and reflect the warm glow of a single streetlamp above the doorway.',
    'Full-color outdoor photograph',
    'one continuous block'
  ]
]

let falliti = 0
for (const [nome, testo, deve, nonDeve] of casi) {
  const out = pulisciDidascalia(testo)
  const parti = []
  if (!out.startsWith(deve)) parti.push(`inizia con ${JSON.stringify(deve)} invece di ${JSON.stringify(out.slice(0, 60))}`)
  if (nonDeve && out.includes(nonDeve)) parti.push(`contiene ancora ${JSON.stringify(nonDeve)}`)
  if (parti.length) falliti++
  console.log(`${parti.length ? 'FAIL' : 'OK  '} | ${nome}`)
  for (const p of parti) console.log(`       ${p}`)
  console.log(`     -> ${JSON.stringify(out.slice(0, 100))}`)
}

// i testi veri usciti dal motore Klein 4B (salvati dal bench)
for (const f of ['out_39b7554f.txt', 'out_da7d436a.txt']) {
  const p = join(QUI, 'campioni-pup', f)
  if (!existsSync(p)) continue
  const testo = readFileSync(p, 'utf8')
  const out = pulisciDidascalia(testo)
  const male = /^(here|you(?:'re| are)|output only|sure|certainly|of course)/i.test(out) || REGOLA.test(out)
  if (male) falliti++
  console.log(`${male ? 'FAIL' : 'OK  '} | reale ${f} (${testo.length} -> ${out.length} caratteri)`)
  console.log(`     -> ${JSON.stringify(out.slice(0, 150))}`)
}

console.log(falliti === 0 ? '\nTUTTI OK' : `\n${falliti} FALLITI`)
process.exit(falliti === 0 ? 0 : 1)
