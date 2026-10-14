// I modelli di terzi (Turbo di AtomicChat, encoder GGUF) hanno nomi di file che non conosciamo in anticipo:
// si chiede a Hugging Face l'elenco del repo e si sceglie il file giusto (Q4 / Q6 / Q8) con le espressioni del catalogo.
// La scelta si ricorda in `risolti.json`, così si sa cosa c'è sul disco anche senza rete.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { VoceCatalogo } from '@shared/tipi'
import { DATI } from '../percorsi'
import { impostazioni } from '../impostazioni'

export interface FileRisolto {
  file: string
  url: string
  byte: number
  sha256?: string
}

export interface Risolto extends FileRisolto {
  /** l'mmproj del Qwen3-VL (serve alla vista): sta nella stessa cartella, col nome che il nodo GGUF si aspetta */
  mmproj?: FileRisolto
}

const FILE = join(DATI, 'risolti.json')

function leggi(): Record<string, Risolto> {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'))
  } catch {
    return {}
  }
}

export const risoltoSalvato = (id: string): Risolto | undefined => leggi()[id]

function ricorda(id: string, r: Risolto): void {
  writeFileSync(FILE, JSON.stringify({ ...leggi(), [id]: r }, null, 2))
}

/** il nome senza la quantizzazione, come lo toglie ComfyUI-GGUF (`strip_quant_suffix`) per cercare l'mmproj */
export function senzaQuant(nome: string): string {
  const base = nome.replace(/\.gguf$/i, '').toLowerCase()
  return base.replace(/[-_]?(?:ud-)?i?q[0-9]_[a-z0-9_-]{1,8}$/i, '')
}

interface VoceHF {
  type: string
  path: string
  size?: number
  lfs?: { oid?: string; size?: number }
}

const tronco = (p: string): string => p.split('/').pop() || p

async function elenco(repo: string): Promise<VoceHF[]> {
  const imp = impostazioni()
  const intestazioni: Record<string, string> = {}
  if (imp.tokenHF) intestazioni.Authorization = 'Bearer ' + imp.tokenHF
  const r = await fetch(`https://huggingface.co/api/models/${repo}/tree/main?recursive=true`, { headers: intestazioni })
  if (!r.ok) throw new Error(`Hugging Face non risponde per ${repo} (${r.status})`)
  return ((await r.json()) as VoceHF[]).filter((f) => f.type === 'file' && f.path.toLowerCase().endsWith('.gguf'))
}

function scegli(files: VoceHF[], cerca: string[], escludiMmproj: boolean): VoceHF | undefined {
  const candidati = files.filter((f) => (/mmproj/i.test(f.path) ? !escludiMmproj : escludiMmproj))
  for (const re of cerca) {
    const r = new RegExp(re, 'i')
    const trovato = candidati.find((f) => r.test(tronco(f.path)))
    if (trovato) return trovato
  }
  return undefined
}

const aFile = (repo: string, f: VoceHF, nome: string): FileRisolto => ({
  file: nome,
  url: `https://huggingface.co/${repo}/resolve/main/${f.path}`,
  byte: f.lfs?.size ?? f.size ?? 0,
  sha256: f.lfs?.oid
})

/** sceglie i file di una voce del catalogo (con `repo`) e se li ricorda; serve la rete */
export async function risolviVoce(v: VoceCatalogo): Promise<Risolto> {
  if (!v.repo || !v.cerca) throw new Error(`${v.nome}: non è una voce da cercare`)
  const files = await elenco(v.repo)
  const principale = scegli(files, v.cerca, true)
  if (!principale) throw new Error(`Nel repo ${v.repo} non trovo il file ${v.quant || ''} (${v.cerca.join(' / ')})`)
  const nome = tronco(principale.path)
  const r: Risolto = aFile(v.repo, principale, nome)
  if (v.cercaMmproj) {
    const m = scegli(await elenco(v.mmprojRepo || v.repo), v.cercaMmproj, false)
    if (!m) throw new Error(`Nel repo ${v.mmprojRepo || v.repo} non trovo l'mmproj (la parte che fa guardare le foto)`)
    // il nodo cerca nella cartella un .gguf con "mmproj" e il nome dell'encoder senza quantizzazione: gli diamo proprio quello
    const b = senzaQuant(nome)
    r.mmproj = aFile(v.mmprojRepo || v.repo, m, `${b}${/[-_.]$/.test(b) ? '' : '.'}mmproj.gguf`)
  }
  ricorda(v.id, r)
  return r
}

/** la voce com'è sul disco adesso (nome vero, dimensione vera), se è stata già scelta */
export function conRisolto(v: VoceCatalogo): VoceCatalogo & { daCercare?: boolean } {
  if (!v.repo) return v
  const r = risoltoSalvato(v.id)
  if (!r) return { ...v, daCercare: true }
  return { ...v, file: r.file, url: r.url, byte: r.byte, sha256: r.sha256, circa: false }
}

/** i file di una voce sono tutti sul disco? */
export function presenteRisolto(v: VoceCatalogo, cartella: string): boolean {
  const r = risoltoSalvato(v.id)
  if (!r) return false
  const ok = (f: FileRisolto): boolean => {
    const p = join(cartella, v.cartella, f.file)
    try {
      return existsSync(p) && (!f.byte || statSync(p).size === f.byte)
    } catch {
      return false
    }
  }
  return ok(r) && (!r.mmproj || ok(r.mmproj))
}
