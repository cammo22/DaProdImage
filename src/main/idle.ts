// Quando l'app è ferma (niente in coda, niente da fare) scarica da sola i file consigliati che mancano: il LoRA Turbo,
// il traduttore… senza che tu debba pensarci. Niente modelli enormi (denoiser ed encoder li scegli tu).
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { impostazioni } from './impostazioni'
import { statoModelli } from './installa/installatore'
import { risoltoSalvato } from './installa/risolvi'

const TIPI_SALTATI = new Set(['diffusione', 'encoder'])
const SECONDI_FERMA = 60
const falliti = new Map<string, number>()

export interface PerIdle {
  /** niente lavori in coda o in corso? */
  libera: () => boolean
  /** l'app è installata e il motore pronto? */
  pronta: () => boolean
  /** scarica una voce del catalogo; true se è andata a buon fine */
  scarica: (id: string) => Promise<boolean>
}

/** i file che si scaricano da soli, nell'ordine: i più piccoli prima */
export function mancanti(): { id: string; nome: string; byte: number }[] {
  return statoModelli()
    .filter((v) => (v.consigliato || v.necessario) && !v.link && !v.presente && !TIPI_SALTATI.has(v.tipo) && (falliti.get(v.id) || 0) < 2)
    .map((v) => ({ id: v.id, nome: v.nome, byte: v.byte }))
    .sort((a, b) => a.byte - b.byte)
}

export function avviaIdle(p: PerIdle): void {
  let ferma = 0
  let occupata = false
  setInterval(() => {
    if (occupata) return
    if (!impostazioni().scaricaInIdle || !p.pronta() || !p.libera()) {
      ferma = 0
      return
    }
    ferma += 10
    if (ferma < SECONDI_FERMA) return
    const prossimo = mancanti()[0]
    if (!prossimo) return
    occupata = true
    void p
      .scarica(prossimo.id)
      .then((ok) => {
        if (!ok) falliti.set(prossimo.id, (falliti.get(prossimo.id) || 0) + 1)
      })
      .catch(() => falliti.set(prossimo.id, (falliti.get(prossimo.id) || 0) + 1))
      .finally(() => {
        occupata = false
        ferma = 0
      })
  }, 10_000)
}

/** un file nella cartella dei modelli che non serve più (o che l'app non conosce) */
export interface FileInutile {
  percorso: string
  nome: string
  cartella: string
  byte: number
  motivo: string
}

// i file che c'erano nelle versioni vecchie e ora non sono più nel catalogo
const TOLTI = ['qwen-image-2.1-UC-Q5_K_M.gguf', 'qwen3vl_8b_bf16.safetensors']

/** i file dei modelli che non sono in uso: non nelle impostazioni, non nel catalogo (o tolti dal catalogo): si possono buttare */
export function fileInutilizzati(): FileInutile[] {
  const imp = impostazioni()
  // i file di Klein (scelti a mano o scaricati dall'app) sono in uso quanto quelli di Qwen
  const klein = ['klein-int8', 'klein-bf16', 'klein-base-int8', 'klein-base-bf16', 'klein-te', 'klein-vae', 'klein4b-fp8', 'klein4b-te', 'llm-huihui-4b'].map((id) => risoltoSalvato(id)?.file || '')
  const inUso = new Set([imp.modello, imp.encoder, imp.vae, imp.upscaler, imp.loraTurbo, imp.kleinModello, imp.kleinBase, imp.kleinEncoder, imp.kleinVae, ...klein].filter(Boolean).map((x) => x.toLowerCase()))
  const noti = new Set(statoModelli().filter((v) => !v.link).map((v) => (risoltoSalvato(v.id)?.file || v.file).toLowerCase()).filter(Boolean))
  const mmproj = (n: string): boolean => /mmproj|\.mmproj\./i.test(n)
  const trovati: FileInutile[] = []
  for (const cartella of ['diffusion_models', 'unet', 'text_encoders', 'vae', 'upscale_models']) {
    let voci: string[] = []
    try {
      voci = readdirSync(join(imp.cartellaModelli, cartella))
    } catch {
      continue
    }
    for (const nome of voci) {
      if (nome.endsWith('.part')) continue
      const percorso = join(imp.cartellaModelli, cartella, nome)
      let byte = 0
      try {
        const st = statSync(percorso)
        if (!st.isFile()) continue
        byte = st.size
      } catch {
        continue
      }
      const chiave = nome.toLowerCase()
      if (inUso.has(chiave)) continue
      if (TOLTI.some((t) => t.toLowerCase() === chiave)) trovati.push({ percorso, nome, cartella, byte, motivo: 'tolto dal catalogo' })
      else if (mmproj(nome)) continue // appartiene a un encoder GGUF
      else if (!noti.has(chiave)) trovati.push({ percorso, nome, cartella, byte, motivo: 'non in uso' })
      else if (cartella !== 'upscale_models' && !inUso.has(chiave)) trovati.push({ percorso, nome, cartella, byte, motivo: 'scaricato ma non scelto' })
    }
  }
  return trovati.sort((a, b) => b.byte - a.byte)
}
