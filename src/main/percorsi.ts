// Dove sta ogni cosa. Il motore (Python, ComfyUI, pacchetti) vive in %LOCALAPPDATA%\DaProdImage,
// i modelli di partenza accanto (la cartella si può cambiare), la galleria in Immagini\DaProd Image.
import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

const locale = process.env.LOCALAPPDATA || join(app.getPath('home'), 'AppData', 'Local')

export const RADICE = join(locale, 'DaProdImage')
export const MOTORE = join(RADICE, 'engine')
export const COMFY = join(MOTORE, 'ComfyUI')
export const VENV = join(MOTORE, 'venv')
export const PYTHON = join(VENV, 'Scripts', 'python.exe')
export const UV_PYTHON = join(MOTORE, 'python')
export const UV_CACHE = join(MOTORE, 'uv-cache')
export const ENTRATA = join(MOTORE, 'input')
export const USCITA = join(MOTORE, 'output')
export const UTENTE_COMFY = join(MOTORE, 'user')
export const TEMP = join(RADICE, 'temp')
export const MINIATURE = join(RADICE, 'miniature')
export const LOG = join(RADICE, 'log')
export const MODELLI_PREDEFINITI = join(RADICE, 'models')
export const GALLERIA_PREDEFINITA = join(app.getPath('pictures'), 'DaProd Image')
/** dati dell'app (impostazioni, indice della galleria, note sui LoRA) */
export const DATI = app.getPath('userData')

/** risorse che viaggiano con l'app: uv.exe e i nodi del motore */
// (in sviluppo app.getAppPath() è la cartella del progetto)
const BASE = app.isPackaged ? process.resourcesPath : app.getAppPath()
export const UV = join(BASE, app.isPackaged ? 'bin' : join('resources', 'bin'), 'uv.exe')
export const NODI = join(BASE, 'engine', 'custom_nodes')
export const VERSIONI = join(BASE, 'engine', 'versioni.json')

export function assicura(...cartelle: string[]): void {
  for (const c of cartelle) mkdirSync(c, { recursive: true })
}
