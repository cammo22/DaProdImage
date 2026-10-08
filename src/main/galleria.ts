// La galleria: le immagini stanno in Immagini\DaProd Image\AAAA-MM, l'indice in galleria.json,
// le miniature in una cache. Se l'indice si perde si ricostruisce dai PNG (hanno dentro le impostazioni).
import { nativeImage, shell } from 'electron'
import { existsSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync, copyFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { FiltroGalleria, Opera } from '@shared/tipi'
import { DATI, MINIATURE, assicura } from './percorsi'
import { impostazioni } from './impostazioni'
import { dimensioniPng, leggiMetadati, scriviMetadati } from './png'

const INDICE = join(DATI, 'galleria.json')
let opere: Opera[] | null = null
let timerSalva: NodeJS.Timeout | null = null
const ascoltatori = new Set<() => void>()

export const suCambioGalleria = (f: () => void): (() => void) => {
  ascoltatori.add(f)
  return () => ascoltatori.delete(f)
}
const avvisa = (): void => {
  for (const f of ascoltatori) f()
}

function carica(): Opera[] {
  if (opere) return opere
  try {
    opere = JSON.parse(readFileSync(INDICE, 'utf8')) as Opera[]
    opere = opere.filter((o) => existsSync(o.file))
  } catch {
    opere = ricostruisci()
  }
  return opere
}

function salvaPresto(): void {
  if (timerSalva) clearTimeout(timerSalva)
  timerSalva = setTimeout(() => {
    timerSalva = null
    assicura(DATI)
    writeFileSync(INDICE + '.tmp', JSON.stringify(opere))
    renameSync(INDICE + '.tmp', INDICE)
  }, 300)
}

export function salvaOra(): void {
  if (!timerSalva || !opere) return
  clearTimeout(timerSalva)
  timerSalva = null
  writeFileSync(INDICE, JSON.stringify(opere))
}

/** rilegge la cartella della galleria e ricostruisce l'indice dai PNG */
function ricostruisci(): Opera[] {
  const radice = impostazioni().cartellaGalleria
  const out: Opera[] = []
  const guarda = (c: string, prof: number): void => {
    let voci: string[] = []
    try {
      voci = readdirSync(c)
    } catch {
      return
    }
    for (const n of voci) {
      const p = join(c, n)
      if (n.toLowerCase().endsWith('.png')) {
        try {
          const buf = readFileSync(p)
          const meta = leggiMetadati(buf) as Partial<Opera> | null
          if (!meta) continue
          const dim = dimensioniPng(buf)
          out.push({
            ...(meta as Opera),
            id: meta.id || randomUUID(),
            file: p,
            miniatura: '',
            larghezza: dim?.larghezza || 0,
            altezza: dim?.altezza || 0,
            preferita: !!meta.preferita
          })
        } catch {
          /* niente */
        }
      } else if (prof > 0) {
        try {
          if (statSync(p).isDirectory()) guarda(p, prof - 1)
        } catch {
          /* niente */
        }
      }
    }
  }
  guarda(radice, 2)
  out.sort((a, b) => b.creata - a.creata)
  opere = out
  salvaPresto()
  return out
}

export function miniatura(o: Opera): string {
  const dest = join(MINIATURE, o.id + (o.trasparente ? '.png' : '.jpg'))
  if (existsSync(dest)) return dest
  try {
    assicura(MINIATURE)
    const img = nativeImage.createFromPath(o.file)
    const { width, height } = img.getSize()
    const lato = 512
    const piccola = width >= height ? img.resize({ width: Math.min(lato, width), quality: 'good' }) : img.resize({ height: Math.min(lato, height), quality: 'good' })
    writeFileSync(dest, o.trasparente ? piccola.toPNG() : piccola.toJPEG(86))
    return dest
  } catch {
    return o.file
  }
}

const due = (n: number): string => String(n).padStart(2, '0')

export function aggiungi(fileTemp: string, dati: Omit<Opera, 'id' | 'file' | 'miniatura' | 'larghezza' | 'altezza' | 'creata' | 'preferita'>): Opera {
  const lista = carica()
  const ora = new Date()
  const cartella = join(impostazioni().cartellaGalleria, `${ora.getFullYear()}-${due(ora.getMonth() + 1)}`)
  assicura(cartella)
  const nome = `DaProd_${ora.getFullYear()}${due(ora.getMonth() + 1)}${due(ora.getDate())}_${due(ora.getHours())}${due(ora.getMinutes())}${due(ora.getSeconds())}_${dati.seed}`
  let file = join(cartella, nome + '.png')
  for (let i = 2; existsSync(file); i++) file = join(cartella, `${nome}_${i}.png`)
  const opera: Opera = { ...dati, id: randomUUID(), file, miniatura: '', larghezza: 0, altezza: 0, creata: ora.getTime(), preferita: false }
  const buf = readFileSync(fileTemp)
  const dim = dimensioniPng(buf)
  opera.larghezza = dim?.larghezza || 0
  opera.altezza = dim?.altezza || 0
  const { miniatura: _m, file: _f, ...meta } = opera
  writeFileSync(file, scriviMetadati(buf, { app: 'DaProd Image', ...meta }))
  try {
    unlinkSync(fileTemp)
  } catch {
    /* niente */
  }
  opera.miniatura = miniatura(opera)
  lista.unshift(opera)
  salvaPresto()
  avvisa()
  return opera
}

export function elenco(f: FiltroGalleria = {}): Opera[] {
  let l = carica()
  if (f.modalita === 'preferite') l = l.filter((o) => o.preferita)
  else if (f.modalita === 'create') l = l.filter((o) => o.modalita === 'crea' || o.modalita === 'rifinisci' || o.modalita === 'varia')
  else if (f.modalita === 'modificate') l = l.filter((o) => ['modifica', 'zona', 'espandi', 'ingrandisci'].includes(o.modalita))
  if (f.testo?.trim()) {
    const t = f.testo.toLowerCase()
    l = l.filter((o) => o.prompt.toLowerCase().includes(t) || (o.etichetta || '').toLowerCase().includes(t) || String(o.seed) === t)
  }
  return l.map((o) => (o.miniatura && existsSync(o.miniatura) ? o : { ...o, miniatura: miniatura(o) }))
}

export const opera = (id: string): Opera | undefined => carica().find((o) => o.id === id)

export function preferita(id: string, si: boolean): void {
  const o = opera(id)
  if (!o) return
  o.preferita = si
  salvaPresto()
  avvisa()
}

export async function elimina(ids: string[]): Promise<void> {
  const lista = carica()
  for (const id of ids) {
    const i = lista.findIndex((o) => o.id === id)
    if (i < 0) continue
    const o = lista[i]
    try {
      await shell.trashItem(o.file) // nel cestino: si può recuperare
    } catch {
      /* già sparito */
    }
    try {
      if (o.miniatura && o.miniatura.startsWith(MINIATURE)) unlinkSync(o.miniatura)
    } catch {
      /* niente */
    }
    lista.splice(i, 1)
  }
  salvaPresto()
  avvisa()
}

/** importa foto da fuori nella galleria (copia, con le impostazioni se le hanno) */
/** i PNG fatti con DaProd Image tornano con le loro impostazioni; gli altri file li converte l'interfaccia (importaFoto) */
export function importa(percorsi: string[]): { importate: Opera[]; altre: string[] } {
  const nuove: Opera[] = []
  const altre: string[] = []
  for (const p of percorsi) {
    if (!p.toLowerCase().endsWith('.png')) {
      altre.push(p)
      continue
    }
    const buf = readFileSync(p)
    const meta = leggiMetadati(buf) as Partial<Opera> | null
    if (!meta) {
      altre.push(p)
      continue
    }
    const tmp = join(MINIATURE, 'imp-' + randomUUID() + '.png')
    assicura(MINIATURE)
    copyFileSync(p, tmp)
    nuove.push(
      aggiungi(tmp, {
        durata: meta.durata || 0, modalita: meta.modalita || 'crea', prompt: meta.prompt || '', negativo: meta.negativo || '',
        seed: meta.seed ?? 0, passi: meta.passi || 40, cfg: meta.cfg ?? 1, sampler: meta.sampler || 'euler', scheduler: meta.scheduler || 'simple',
        lora: meta.lora || [], modello: meta.modello || '', etichetta: meta.etichetta || basename(p)
      })
    )
  }
  return { importate: nuove, altre }
}

/** una foto qualsiasi, già convertita in PNG, entra in galleria come "Importata" */
export function importaFoto(png: string, nome: string): Opera {
  const tmp = join(MINIATURE, 'imp-' + randomUUID() + '.png')
  assicura(MINIATURE)
  copyFileSync(png, tmp)
  return aggiungi(tmp, {
    durata: 0, modalita: 'importa', prompt: '', negativo: '', seed: 0, passi: 0, cfg: 1, sampler: '', scheduler: '',
    lora: [], modello: '', etichetta: basename(nome).replace(/\.[^.]+$/, '')
  })
}

export const ricaricaGalleria = (): void => {
  opere = null
  ricostruisci()
  avvisa()
}
