// Test della mappa dei modelli (src/shared/modelli.ts): tre voci (qwen-base, klein, klein-base), niente Turbo di Qwen.
// Controlla la mappa, le migrazioni delle impostazioni e delle qualità vecchie, i PNG vecchi e «Rifai in qualità piena».
//
// Esecuzione: node test/modelli.mjs
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const QUI = dirname(fileURLToPath(import.meta.url))

// il codice vero, non una copia (Node con type stripping)
const M = await import(pathToFileURL(join(QUI, '..', 'src', 'shared', 'modelli.ts')).href)

let falliti = 0
let fatti = 0
function uguale(nome, avuto, atteso) {
  fatti++
  const a = JSON.stringify(avuto)
  const b = JSON.stringify(atteso)
  if (a === b) return
  falliti++
  console.log(`NO  ${nome}\n    avuto:  ${a}\n    atteso: ${b}`)
}

// la mappa
uguale('quattro modelli, in ordine (niente Klein 4B dalla 1.2.1)', M.ORDINE_MODELLI, ['qwen-base', 'qwen-veloce', 'klein', 'klein-base'])
uguale('le chiavi della mappa', Object.keys(M.MODELLI).sort(), ['klein', 'klein-base', 'qwen-base', 'qwen-veloce'])
uguale('qwen-base', [M.MODELLI['qwen-base'].famiglia, M.MODELLI['qwen-base'].passi, M.MODELLI['qwen-base'].turbo, M.MODELLI['qwen-base'].lora], ['qwen', 25, false, true])
uguale('qwen-veloce: Lightning, 4 passi', [M.MODELLI['qwen-veloce'].famiglia, M.MODELLI['qwen-veloce'].passi, M.MODELLI['qwen-veloce'].turbo, M.MODELLI['qwen-veloce'].lora], ['qwen', 4, true, true])
uguale('klein', [M.MODELLI.klein.famiglia, M.MODELLI.klein.passi, M.MODELLI.klein.cfg, M.MODELLI.klein.veloce], ['klein', 16, 1, true])
uguale('klein-base', [M.MODELLI['klein-base'].famiglia, M.MODELLI['klein-base'].passi, M.MODELLI['klein-base'].cfg], ['klein-base', 50, 3.5])
uguale('solo qwen-veloce ha il LoRA Lightning', Object.values(M.MODELLI).filter((m) => m.turbo).map((m) => m.id), ['qwen-veloce'])
for (const id of M.ORDINE_MODELLI) uguale(`id dentro la voce ${id}`, M.MODELLI[id].id, id)
uguale('predefinito', M.MODELLO_PREDEFINITO, 'qwen-base')

// dalla famiglia (e dal vecchio Turbo) al modello
uguale('qwen → qwen-base', M.modelloDa('qwen'), 'qwen-base')
uguale('qwen + turbo → qwen-base', M.modelloDa('qwen', true), 'qwen-base')
uguale('klein → klein', M.modelloDa('klein'), 'klein')
uguale('klein-base → klein-base', M.modelloDa('klein-base'), 'klein-base')
uguale('sconosciuta → qwen-base', M.modelloDa('sdxl'), 'qwen-base')
uguale('klein4b (tolto) → qwen-base', M.modelloDa('klein4b'), 'qwen-base')
uguale('impostazioni con klein4b salvato → qwen-base', M.modelloDaImpostazioni({ modelloScelto: 'klein4b', famiglia: 'klein4b' }), 'qwen-base')
uguale('un\'opera fatta con Klein 4B → qwen-base', M.modelloDaOpera({ modello: 'FLUX.2 Klein 4B · flux-2-klein-4b-fp8.safetensors' }), 'qwen-base')
uguale('niente → qwen-base', M.modelloDa(undefined), 'qwen-base')

// migrazione delle impostazioni (file vecchi, senza modelloScelto)
uguale('imp 1.0 qwen', M.modelloDaImpostazioni({ famiglia: 'qwen' }), 'qwen-base')
uguale('imp 1.0 klein', M.modelloDaImpostazioni({ famiglia: 'klein' }), 'klein')
uguale('imp 1.0 klein-base', M.modelloDaImpostazioni({ famiglia: 'klein-base' }), 'klein-base')
uguale('imp 0.x senza famiglia', M.modelloDaImpostazioni({}), 'qwen-base')
uguale('imp nulle', M.modelloDaImpostazioni(null), 'qwen-base')
uguale('imp 1.1: vince modelloScelto', M.modelloDaImpostazioni({ famiglia: 'qwen', modelloScelto: 'klein' }), 'klein')
uguale('imp con modelloScelto rovinato', M.modelloDaImpostazioni({ famiglia: 'klein-base', modelloScelto: 'sdxl' }), 'klein-base')
uguale('imp con qwen-veloce', M.modelloDaImpostazioni({ famiglia: 'qwen', modelloScelto: 'qwen-veloce' }), 'qwen-veloce')

// salvataggio: modelloScelto e famiglia restano d'accordo
uguale('salva modelloScelto', M.allineaScelta({ modelloScelto: 'klein' }), { modelloScelto: 'klein', famiglia: 'klein' })
uguale('salva famiglia (ScegliModello di oggi)', M.allineaScelta({ famiglia: 'klein-base' }), { modelloScelto: 'klein-base', famiglia: 'klein-base' })
uguale('salva tutti e due: vince il modello', M.allineaScelta({ modelloScelto: 'qwen-base', famiglia: 'klein' }), { modelloScelto: 'qwen-base', famiglia: 'qwen' })
uguale('salva altro: non tocca', M.allineaScelta({ porta: 8818 }), {})

// i PNG e le opere vecchie si riaprono
uguale('opera Klein Base', M.modelloDaOpera({ modello: 'FLUX 3 Klein Base · flux-3-klein-base-int8.safetensors' }), 'klein-base')
uguale('opera Klein', M.modelloDaOpera({ modello: 'FLUX 3 Klein · flux-3-klein-int8.safetensors' }), 'klein')
uguale('opera Qwen UC', M.modelloDaOpera({ modello: 'qwen-image-2.1-UC-Q4_K_M.gguf' }), 'qwen-base')
uguale('opera Qwen Turbo GGUF', M.modelloDaOpera({ modello: 'Qwen-Image-2.1-Turbo-Q4_K_M.gguf' }), 'qwen-base')
uguale('opera senza modello (PNG da fuori)', M.modelloDaOpera({ modello: '' }), 'qwen-base')
uguale('opera nulla', M.modelloDaOpera(undefined), 'qwen-base')

// quello che va nella Richiesta
uguale('parametri qwen-base', M.parametriModello('qwen-base'), { famiglia: 'qwen', passi: 25, turbo: false })
uguale('parametri qwen-veloce', M.parametriModello('qwen-veloce'), { famiglia: 'qwen', passi: 4, turbo: true })
uguale('parametri klein', M.parametriModello('klein'), { famiglia: 'klein', passi: 16, turbo: false })
uguale('parametri klein-base', M.parametriModello('klein-base'), { famiglia: 'klein-base', passi: 50, turbo: false })

// Rifai in qualità piena
uguale('piena da klein', M.inQualitaPiena('klein'), ['klein-base', 'qwen-base'])
uguale('piena da qwen-base', M.inQualitaPiena('qwen-base'), [])
uguale('piena da qwen-veloce', M.inQualitaPiena('qwen-veloce'), ['qwen-base'])

// il LoRA Lightning e l'interruttore «l'LLM legge il prompt»
uguale('shift Lightning', M.shiftDi(M.LIGHTNING_FILE), 0.9)
uguale('shift Turbo8 (PNG vecchi)', M.shiftDi('turbo8_lora_step2500.safetensors'), 0.6935)
uguale('LLM: Klein di serie acceso', M.potenziaPer({}, 'klein'), true)
uguale('LLM: Qwen di serie spento', M.potenziaPer({}, 'qwen'), false)
uguale('LLM: Qwen acceso a mano', M.potenziaPer({ potenziaQwen: true }, 'qwen'), true)
uguale('LLM: Klein spento a mano', M.potenziaPer({ potenziaKlein: false }, 'klein-base'), false)
uguale('piena da klein-base', M.inQualitaPiena('klein-base'), [])

// le qualità salvate (localStorage, ricette)
uguale('turbo → alta', M.senzaTurbo('turbo'), 'alta')
for (const q of ['bozza', 'alta', 'massima']) uguale(`${q} resta`, M.senzaTurbo(q), q)

// il denoiser Turbo GGUF torna a quello pieno
const presenti = ['qwen-image-2.1-UC-Q4_K_M.gguf', 'qwen-image-2.1-UC-Q8_0.gguf', 'Qwen-Image-2.1-Turbo-Q6_K.gguf', 'flux-3-klein-int8.safetensors']
uguale('UC: niente da cambiare', M.denoiserSenzaTurbo('qwen-image-2.1-UC-Q4_K_M.gguf', presenti), null)
uguale('Turbo Q8 → UC Q8', M.denoiserSenzaTurbo('Qwen-Image-2.1-Turbo-Q8_0.gguf', presenti), 'qwen-image-2.1-UC-Q8_0.gguf')
uguale('Turbo Q6 senza UC Q6 → il primo UC', M.denoiserSenzaTurbo('Qwen-Image-2.1-Turbo-Q6_K.gguf', presenti), 'qwen-image-2.1-UC-Q4_K_M.gguf')
uguale('Turbo senza UC sul disco → resta', M.denoiserSenzaTurbo('Qwen-Image-2.1-Turbo-Q4_K_M.gguf', ['Qwen-Image-2.1-Turbo-Q4_K_M.gguf']), null)

// FAMIGLIE (tipi.ts) prende i passi dalla mappa: si controlla leggendo il sorgente, perché tipi.ts importa './modelli' senza estensione (lo risolve Vite, Node no)
const { readFileSync } = await import('node:fs')
const tipi = readFileSync(join(QUI, '..', 'src', 'shared', 'tipi.ts'), 'utf8')
uguale('FAMIGLIE viene da MODELLI', /qwen: famiglia\('qwen-base'/.test(tipi) && /klein: famiglia\('klein'/.test(tipi) && /'klein-base': famiglia\('klein-base'/.test(tipi), true)

console.log(falliti ? `\n${falliti} su ${fatti} NON vanno` : `TUTTI OK (${fatti} controlli)`)
process.exit(falliti ? 1 : 0)
