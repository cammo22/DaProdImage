// Il filo con ComfyUI: HTTP per accodare e caricare le foto, WebSocket per avanzamento e anteprime.
import { readFileSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import { indirizzo } from './processo'

export interface MessaggioComfy {
  type: string
  data: Record<string, unknown> & { prompt_id?: string; node?: string | null }
}

type Ascoltatore = (m: MessaggioComfy) => void
type AscoltatoreAnteprima = (jpeg: Buffer, tipo: string) => void

const idCliente = 'daprod-' + randomUUID()
let ws: WebSocket | null = null
let chiuso = true
const ascoltatori = new Set<Ascoltatore>()
const ascoltatoriAnteprima = new Set<AscoltatoreAnteprima>()

export const suMessaggio = (f: Ascoltatore): (() => void) => {
  ascoltatori.add(f)
  return () => ascoltatori.delete(f)
}
export const suAnteprima = (f: AscoltatoreAnteprima): (() => void) => {
  ascoltatoriAnteprima.add(f)
  return () => ascoltatoriAnteprima.delete(f)
}

export function connetti(): Promise<void> {
  chiuso = false
  return new Promise((ok, ko) => {
    const s = new WebSocket(`ws://${indirizzo()}/ws?clientId=${idCliente}`)
    s.binaryType = 'arraybuffer'
    let aperto = false
    s.onopen = () => {
      aperto = true
      ws = s
      ok()
    }
    s.onerror = () => {
      if (!aperto) ko(new Error('non riesco a collegarmi al motore'))
    }
    s.onclose = () => {
      if (ws === s) ws = null
      if (!chiuso) setTimeout(() => connetti().catch(() => undefined), 1500)
    }
    s.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        let m: MessaggioComfy
        try {
          m = JSON.parse(ev.data)
        } catch {
          return
        }
        for (const f of ascoltatori) f(m)
        return
      }
      // binario: [u32 tipo][...]. 1 = anteprima (u32 formato, immagine), 4 = anteprima con metadati
      const b = Buffer.from(ev.data as ArrayBuffer)
      if (b.length < 8) return
      const tipo = b.readUInt32BE(0)
      if (tipo === 1) {
        const formato = b.readUInt32BE(4) === 2 ? 'image/png' : 'image/jpeg'
        for (const f of ascoltatoriAnteprima) f(b.subarray(8), formato)
      } else if (tipo === 4) {
        const lung = b.readUInt32BE(4)
        let formato = 'image/jpeg'
        try {
          const meta = JSON.parse(b.subarray(8, 8 + lung).toString('utf8'))
          if (meta.image_type) formato = meta.image_type
        } catch {
          /* niente */
        }
        for (const f of ascoltatoriAnteprima) f(b.subarray(8 + lung), formato)
      }
    }
  })
}

export function scollega(): void {
  chiuso = true
  ws?.close()
  ws = null
}

export const collegato = (): boolean => !!ws && ws.readyState === WebSocket.OPEN

/** trasforma gli errori di validazione di ComfyUI in una frase leggibile */
function erroreLeggibile(j: Record<string, unknown>): string {
  const err = j.error as { message?: string; details?: string } | undefined
  const nodi = j.node_errors as Record<string, { class_type: string; errors: { message: string; details: string }[] }> | undefined
  const pezzi: string[] = []
  if (err?.message) pezzi.push(err.message)
  if (nodi)
    for (const [id, n] of Object.entries(nodi))
      for (const e of n.errors) pezzi.push(`${n.class_type} (#${id}): ${e.message}${e.details ? ' — ' + e.details : ''}`)
  return pezzi.join('\n') || 'il motore ha rifiutato il lavoro'
}

/** l'id lo scegliamo noi, così i messaggi che arrivano prima della risposta non si perdono */
export async function accoda(prompt: Record<string, unknown>, promptId: string): Promise<string> {
  const r = await fetch(`http://${indirizzo()}/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, client_id: idCliente, prompt_id: promptId })
  })
  const j = (await r.json()) as Record<string, unknown>
  if (!r.ok) throw new Error(erroreLeggibile(j))
  return j.prompt_id as string
}

const caricati = new Map<string, string>()

/** carica una foto nella cartella input del motore; ricorda quelle già caricate */
export async function caricaImmagine(percorso: string): Promise<string> {
  const st = statSync(percorso)
  const chiave = `${percorso}|${st.size}|${st.mtimeMs}`
  const gia = caricati.get(chiave)
  if (gia) return gia
  const dati = readFileSync(percorso)
  const form = new FormData()
  const nome = `${Date.now().toString(36)}-${basename(percorso).replace(/[^\w.-]+/g, '_')}`
  form.append('image', new Blob([dati]), nome)
  form.append('subfolder', 'daprod')
  form.append('type', 'input')
  form.append('overwrite', 'true')
  const r = await fetch(`http://${indirizzo()}/upload/image`, { method: 'POST', body: form })
  if (!r.ok) throw new Error('non riesco a passare la foto al motore (' + r.status + ')')
  const j = (await r.json()) as { name: string; subfolder: string }
  const rif = j.subfolder ? `${j.subfolder}/${j.name}` : j.name
  caricati.set(chiave, rif)
  return rif
}

/** le uscite di un lavoro dalla cronologia del motore (se il WebSocket non le ha portate, es. risultato in cache) */
export async function usciteDa(promptId: string, nodo: string): Promise<{ immagini: { filename: string; subfolder: string; type: string }[]; testo?: string }> {
  const r = await fetch(`http://${indirizzo()}/history/${promptId}`)
  const j = (await r.json()) as Record<string, { outputs?: Record<string, { images?: { filename: string; subfolder: string; type: string }[]; text?: string[] }> }>
  const o = j[promptId]?.outputs?.[nodo]
  return { immagini: o?.images || [], testo: o?.text?.join('\n') }
}

export async function interrompi(): Promise<void> {
  await fetch(`http://${indirizzo()}/interrupt`, { method: 'POST' }).catch(() => undefined)
}

/** libera la VRAM (scarica i modelli) */
export async function liberaMemoria(): Promise<void> {
  await fetch(`http://${indirizzo()}/free`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ unload_models: true, free_memory: true })
  }).catch(() => undefined)
}

let nodiCache: Record<string, unknown> | null = null
export async function nodiDisponibili(): Promise<Record<string, unknown>> {
  if (nodiCache) return nodiCache
  const r = await fetch(`http://${indirizzo()}/object_info`)
  nodiCache = (await r.json()) as Record<string, unknown>
  return nodiCache
}
export const dimenticaNodi = (): void => {
  nodiCache = null
}
