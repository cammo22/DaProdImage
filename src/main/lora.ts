// I LoRA: i file stanno in models/loras, le note (nome, parole chiave, forza, anteprima) in lora.json.
// Si importano trascinandoli, si scaricano da un link (Hugging Face, Civitai o diretto),
// e dall'intestazione safetensors si capisce se sono per Qwen-Image 2.1.
import { shell } from 'electron'
import { copyFileSync, existsSync, openSync, readFileSync, readSync, closeSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, relative } from 'node:path'
import type { InfoLora } from '@shared/tipi'
import { DATI, assicura } from './percorsi'
import { impostazioni } from './impostazioni'
import { scarica } from './installa/scarica'
import { CATALOGO } from './installa/catalogo'

const NOTE = join(DATI, 'lora.json')
type Nota = Partial<Omit<InfoLora, 'file' | 'dimensione' | 'compatibile'>> & { compatibile?: InfoLora['compatibile']; base?: string }

const cartellaLora = (): string => join(impostazioni().cartellaModelli, 'loras')

function note(): Record<string, Nota> {
  try {
    return JSON.parse(readFileSync(NOTE, 'utf8'))
  } catch {
    return {}
  }
}
function scriviNote(n: Record<string, Nota>): void {
  assicura(DATI)
  writeFileSync(NOTE, JSON.stringify(n, null, 2))
}

/** legge l'intestazione JSON di un .safetensors (solo i primi byte) */
function intestazione(percorso: string): Record<string, unknown> | null {
  try {
    const fd = openSync(percorso, 'r')
    const b8 = Buffer.alloc(8)
    readSync(fd, b8, 0, 8, 0)
    const n = Number(b8.readBigUInt64LE(0))
    if (n <= 0 || n > 100_000_000) {
      closeSync(fd)
      return null
    }
    const b = Buffer.alloc(n)
    readSync(fd, b, 0, n, 8)
    closeSync(fd)
    return JSON.parse(b.toString('utf8'))
  } catch {
    return null
  }
}

/** Qwen-Image 2.1 è a flusso singolo (solo img_mlp); Qwen-Image 1.x ha txt_mlp/add_q_proj; SD/SDXL/Flux hanno altri nomi */
function analizza(percorso: string): { compatibile: InfoLora['compatibile']; base?: string; parole?: string; nome?: string } {
  const h = intestazione(percorso)
  if (!h) return { compatibile: '?' }
  const chiavi = Object.keys(h).filter((k) => k !== '__metadata__')
  const meta = (h.__metadata__ || {}) as Record<string, string>
  const tutte = chiavi.join('\n')
  let compatibile: InfoLora['compatibile'] = '?'
  let base: string | undefined
  if (/txt_mlp|add_q_proj|txt_mod|img_mod\./.test(tutte)) {
    compatibile = 'no'
    base = 'Qwen-Image 1.x'
  } else if (/lora_unet_|down_blocks|input_blocks|lora_te/.test(tutte)) {
    compatibile = 'no'
    base = 'Stable Diffusion / SDXL'
  } else if (/double_blocks|single_blocks/.test(tutte)) {
    compatibile = 'no'
    base = 'Flux'
  } else if (/transformer_blocks\.\d+\.(attn\.to_q|img_mlp)/.test(tutte)) {
    compatibile = 'si'
    base = 'Qwen-Image 2.1'
  }
  const archi = meta['modelspec.architecture'] || meta.ss_base_model_version || ''
  if (archi) base = base ? `${base} (${archi})` : archi
  let parole = meta['modelspec.trigger_phrase'] || ''
  if (!parole && meta.ss_tag_frequency) {
    try {
      const freq = JSON.parse(meta.ss_tag_frequency) as Record<string, Record<string, number>>
      const conti: Record<string, number> = {}
      for (const d of Object.values(freq)) for (const [t, c] of Object.entries(d)) conti[t] = (conti[t] || 0) + c
      parole = Object.entries(conti)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([t]) => t)
        .join(', ')
    } catch {
      /* niente */
    }
  }
  return { compatibile, base, parole, nome: meta['modelspec.title'] || meta.ss_output_name }
}

export function elencoLora(): InfoLora[] {
  const c = cartellaLora()
  assicura(c)
  const n = note()
  const out: InfoLora[] = []
  let cambiate = false
  const guarda = (d: string, prof: number): void => {
    for (const v of readdirSync(d)) {
      const p = join(d, v)
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        if (prof > 0) guarda(p, prof - 1)
        continue
      }
      if (!/\.(safetensors|ckpt|pt)$/i.test(v)) continue
      // ComfyUI vuole il nome relativo alla cartella loras, con le barre di Windows
      const file = relative(c, p)
      let nota = n[file]
      if (!nota || nota.compatibile === undefined) {
        const a = analizza(p)
        const delCatalogo = CATALOGO.find((x) => x.tipo === 'lora' && x.file === v)
        nota = { nome: delCatalogo?.nome || a.nome || basename(v, extname(v)), parole: a.parole || '', forza: 1, aggiunta: st.mtimeMs, ...nota, compatibile: a.compatibile, base: a.base }
        n[file] = nota
        cambiate = true
      }
      out.push({
        file,
        nome: nota.nome || basename(v, extname(v)),
        dimensione: st.size,
        parole: nota.parole || '',
        forza: nota.forza ?? 1,
        anteprima: nota.anteprima && existsSync(nota.anteprima) ? nota.anteprima : undefined,
        fonte: nota.fonte,
        note: nota.note,
        compatibile: nota.compatibile || '?',
        base: nota.base,
        aggiunta: nota.aggiunta || st.mtimeMs
      })
    }
  }
  guarda(c, 2)
  if (cambiate) scriviNote(n)
  return out.sort((a, b) => b.aggiunta - a.aggiunta)
}

export function aggiornaLora(file: string, modifiche: Partial<InfoLora>): void {
  const n = note()
  n[file] = { ...(n[file] || {}), ...modifiche }
  scriviNote(n)
}

export function importaLora(percorsi: string[]): string[] {
  const c = cartellaLora()
  assicura(c)
  const fatti: string[] = []
  for (const p of percorsi) {
    if (!/\.safetensors$/i.test(p)) continue
    const dest = join(c, basename(p))
    if (!existsSync(dest)) copyFileSync(p, dest)
    aggiornaLora(basename(p), { aggiunta: Date.now() })
    fatti.push(basename(p))
  }
  return fatti
}

export async function eliminaLora(file: string): Promise<void> {
  await shell.trashItem(join(cartellaLora(), file))
  const n = note()
  delete n[file]
  scriviNote(n)
}

/** da un link di pagina a un link di download, con quello che si sa del LoRA */
async function risolvi(link: string): Promise<{ url: string; nome?: string; file?: string; parole?: string; anteprima?: string; intestazioni: Record<string, string> }> {
  const imp = impostazioni()
  const u = new URL(link.trim())
  const intestazioni: Record<string, string> = {}
  if (u.hostname.endsWith('huggingface.co')) {
    if (imp.tokenHF) intestazioni.Authorization = 'Bearer ' + imp.tokenHF
    // /utente/repo/blob/main/file → /resolve/
    const url = u.toString().replace('/blob/', '/resolve/')
    if (!/\/resolve\//.test(url)) {
      // pagina del repo: si cerca il primo .safetensors
      const repo = u.pathname.split('/').filter(Boolean).slice(0, 2).join('/')
      const r = await fetch(`https://huggingface.co/api/models/${repo}/tree/main?recursive=true`, { headers: intestazioni })
      const files = (await r.json()) as { path: string; type: string }[]
      const st = files.find((f) => f.type === 'file' && f.path.endsWith('.safetensors'))
      if (!st) throw new Error('in quel repo non trovo un .safetensors')
      return { url: `https://huggingface.co/${repo}/resolve/main/${st.path}`, file: basename(st.path), nome: repo.split('/')[1], intestazioni }
    }
    return { url, file: basename(u.pathname), intestazioni }
  }
  if (u.hostname.endsWith('civitai.com') || u.hostname.endsWith('civitai.green')) {
    const auth = imp.tokenCivitai ? { Authorization: 'Bearer ' + imp.tokenCivitai } : undefined
    let versione = u.searchParams.get('modelVersionId')
    const mm = u.pathname.match(/\/models\/(\d+)/)
    const dl = u.pathname.match(/\/api\/download\/models\/(\d+)/)
    if (dl) versione = dl[1]
    type Versione = { name?: string; trainedWords?: string[]; images?: { url: string }[]; files?: { name: string; downloadUrl: string; primary?: boolean }[]; model?: { name?: string } }
    let info: Versione | null = null
    if (versione) {
      info = (await (await fetch(`https://civitai.com/api/v1/model-versions/${versione}`, { headers: auth })).json()) as Versione
    } else if (mm) {
      const m = (await (await fetch(`https://civitai.com/api/v1/models/${mm[1]}`, { headers: auth })).json()) as { name: string; modelVersions: Versione[] }
      info = { ...m.modelVersions[0], model: { name: m.name } }
    }
    if (!info?.files?.length) throw new Error('Civitai non mi dà il file (forse serve il token API nelle Impostazioni)')
    const f = info.files.find((x) => x.primary) || info.files[0]
    if (imp.tokenCivitai) intestazioni.Authorization = 'Bearer ' + imp.tokenCivitai
    return {
      url: f.downloadUrl,
      file: f.name,
      nome: info.model?.name || info.name,
      parole: (info.trainedWords || []).join(', '),
      anteprima: info.images?.find((i) => /\.(jpe?g|png|webp)(\?|$)/i.test(i.url))?.url,
      intestazioni
    }
  }
  return { url: u.toString(), file: basename(u.pathname) || 'lora.safetensors', intestazioni }
}

export async function scaricaLora(link: string, avanz: (r: number, t: number, v: number) => void, segnale?: AbortSignal): Promise<string> {
  const d = await risolvi(link)
  let file = (d.file || 'lora.safetensors').replace(/[<>:"/\\|?*]+/g, '_')
  if (!/\.safetensors$/i.test(file)) file += '.safetensors'
  const dest = join(cartellaLora(), file)
  await scarica({ url: d.url, destinazione: dest, intestazioni: d.intestazioni, segnale, avanzamento: avanz })
  let anteprima: string | undefined
  if (d.anteprima) {
    try {
      const ext = (d.anteprima.match(/\.(jpe?g|png|webp)/i)?.[1] || 'jpg').toLowerCase()
      anteprima = join(DATI, 'anteprime-lora', basename(file, '.safetensors') + '.' + ext)
      await scarica({ url: d.anteprima, destinazione: anteprima })
    } catch {
      anteprima = undefined
    }
  }
  aggiornaLora(file, { nome: d.nome, parole: d.parole, fonte: link, anteprima, aggiunta: Date.now() })
  return file
}
