// RAM, VRAM e GPU per la barra in alto: ogni 2 secondi, solo mentre la finestra è visibile.
// La RAM la dice il sistema; scheda video, VRAM, uso e temperatura nvidia-smi (arriva col driver NVIDIA).
// Se nvidia-smi non c'è, la VRAM si prende dal motore quando è acceso.
import { execFile } from 'node:child_process'
import { freemem, totalmem } from 'node:os'
import type { Risorse } from '@shared/tipi'
import { infoMotore } from './motore/processo'

let timer: NodeJS.Timeout | null = null
let smiOk = true

function nvidiaSmi(): Promise<Partial<Risorse>> {
  return new Promise((ok) => {
    if (!smiOk) return ok({})
    execFile(
      'nvidia-smi',
      ['--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu', '--format=csv,noheader,nounits'],
      { windowsHide: true, timeout: 4000 },
      (err, out) => {
        if (err) {
          // niente driver o niente nvidia-smi: non si riprova a ogni giro
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') smiOk = false
          return ok({})
        }
        const c = String(out).split('\n')[0]?.split(',').map((x) => x.trim()) || []
        const n = (i: number): number | undefined => (c[i] !== undefined && !isNaN(Number(c[i])) ? Number(c[i]) : undefined)
        const usata = n(2)
        const totale = n(3)
        ok({
          gpu: c[0] || undefined,
          gpuUso: n(1),
          vramUsata: usata !== undefined ? usata * 1048576 : undefined,
          vramTotale: totale !== undefined ? totale * 1048576 : undefined,
          gpuTemp: n(4)
        })
      }
    )
  })
}

export async function leggiRisorse(): Promise<Risorse> {
  const r: Risorse = { ramTotale: totalmem(), ramLibera: freemem(), ...(await nvidiaSmi()) }
  if (r.vramTotale === undefined) {
    const m = infoMotore()
    if (m.vramTotale) {
      r.vramTotale = m.vramTotale
      r.vramUsata = m.vramTotale - (m.vramLibera || 0)
      r.gpu = r.gpu || m.gpu
    }
  }
  return r
}

export function seguiRisorse(manda: (r: Risorse) => void, visibile: () => boolean): void {
  if (timer) return
  let inCorso = false
  const giro = async (): Promise<void> => {
    if (inCorso || !visibile()) return
    inCorso = true
    try {
      manda(await leggiRisorse())
    } finally {
      inCorso = false
    }
  }
  void giro()
  timer = setInterval(() => void giro(), 2000)
}
