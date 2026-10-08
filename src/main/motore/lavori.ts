// La coda: un lavoro alla volta al motore (così l'ordine, le stime e l'annulla sono nostri).
// Per ogni lavoro: carica le foto, costruisce il grafo, segue avanzamento e anteprime,
// e alla fine porta l'immagine in galleria con dentro le impostazioni.
import { nativeImage } from 'electron'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Lavoro, Richiesta } from '@shared/tipi'
import { USCITA } from '../percorsi'
import { impostazioni, profiloMemoria, registraTempo, stimaPasso } from '../impostazioni'
import { costruisci, type GrafoPronto, type Ingressi } from './grafi'
import { SISTEMA_TRADUCI, daTradurre, pulisciTraduzione, tokenPer } from './traduci'
import { accoda, caricaImmagine, collegato, connetti, interrompi, suAnteprima, suMessaggio, usciteDa, type MessaggioComfy } from './cliente'
import { avviaMotore, infoMotore, aggiornaVram } from './processo'
import { aggiungi } from '../galleria'

const lavori: Lavoro[] = []
let corrente: Lavoro | null = null
let promptCorrente: string | null = null
const ascoltatori = new Set<(l: Lavoro[], uno?: Lavoro) => void>()

export const elencoLavori = (): Lavoro[] => lavori
export const suCambioLavori = (f: (l: Lavoro[], uno?: Lavoro) => void): (() => void) => {
  ascoltatori.add(f)
  return () => ascoltatori.delete(f)
}

let ultimoInvio = 0
function avvisa(uno?: Lavoro, forza = true): void {
  const ora = Date.now()
  if (!forza && ora - ultimoInvio < 120) return
  ultimoInvio = ora
  for (const f of ascoltatori) f(lavori, uno)
}

const casuale = (): number => Math.floor(Math.random() * 2 ** 48)

export function accodaRichiesta(q: Richiesta): Lavoro[] {
  const quante = Math.max(1, Math.min(16, q.quante || 1))
  const base = q.seed >= 0 ? q.seed : -1
  const nuovi: Lavoro[] = []
  for (let i = 0; i < quante; i++) {
    const seed = base >= 0 ? base + i : casuale()
    const l: Lavoro = {
      id: randomUUID(),
      richiesta: { ...q, seed, quante: 1 },
      stato: 'in coda',
      indice: i + 1,
      fase: 'In coda',
      passo: 0,
      passiTotali: 0,
      creato: Date.now(),
      risultati: []
    }
    nuovi.push(l)
    lavori.push(l)
  }
  // i lavori vecchi finiti escono dalla lista (se ne tengono 60)
  const finiti = lavori.filter((l) => l.stato !== 'in coda' && l.stato !== 'in corso')
  if (finiti.length > 60) for (const f of finiti.slice(0, finiti.length - 60)) lavori.splice(lavori.indexOf(f), 1)
  avvisa()
  void prossimo()
  return nuovi
}

export async function annullaLavoro(id: string): Promise<void> {
  const l = lavori.find((x) => x.id === id)
  if (!l) return
  if (l === corrente) {
    l.fase = 'Annullo…'
    avvisa(l)
    await interrompi()
  } else if (l.stato === 'in coda') {
    l.stato = 'annullato'
    l.fase = 'Annullato'
    avvisa(l)
  }
}

export async function svuotaCoda(): Promise<void> {
  for (const l of lavori) if (l.stato === 'in coda') Object.assign(l, { stato: 'annullato', fase: 'Annullato' })
  if (corrente) await interrompi()
  avvisa()
}

export function togliFiniti(): void {
  for (let i = lavori.length - 1; i >= 0; i--) if (lavori[i].stato !== 'in coda' && lavori[i].stato !== 'in corso') lavori.splice(i, 1)
  avvisa()
}

// --- i messaggi del motore per il lavoro in corso ---
type Attesa = { ok: (m: MessaggioComfy) => void; ko: (e: Error) => void }
let attesa: Attesa | null = null
let uscitaAttesa: { nodo: string; immagini: { filename: string; subfolder: string; type: string }[]; testo?: string } | null = null
let fasiCorrenti: Record<string, string> = {}
let tempiPasso: number[] = []
let ultimoPasso = 0

suMessaggio((m) => {
  const l = corrente
  if (!l || !promptCorrente || (m.data?.prompt_id && m.data.prompt_id !== promptCorrente)) return
  switch (m.type) {
    case 'executing': {
      const nodo = m.data.node as string | null
      if (nodo && fasiCorrenti[nodo]) {
        l.fase = fasiCorrenti[nodo]
        avvisa(l)
      }
      break
    }
    case 'progress': {
      const v = m.data.value as number
      const max = m.data.max as number
      const ora = Date.now()
      if (l.fase === 'Disegno' || fasiCorrenti[m.data.node as string] === 'Disegno') {
        if (ultimoPasso && v > l.passo) tempiPasso.push((ora - ultimoPasso) / 1000 / (v - l.passo))
        ultimoPasso = ora
        const ultimi = tempiPasso.slice(-6)
        const sp = ultimi.length ? ultimi.reduce((a, b) => a + b, 0) / ultimi.length : l.stima && l.passiTotali ? l.stima / Math.max(1, l.passiTotali - l.passo) : 0
        if (sp) l.stima = Math.round(sp * (max - v) + 3)
        if (tempiPasso.length > 2) {
          const t = tempiPasso.slice(2)
          l.secondiPasso = Math.round((t.reduce((a, b) => a + b, 0) / t.length) * 100) / 100
        }
      }
      l.passo = v
      l.passiTotali = max
      avvisa(l, v === max)
      break
    }
    case 'executed': {
      const nodo = m.data.node as string
      const out = m.data.output as { images?: { filename: string; subfolder: string; type: string }[]; text?: string[] } | undefined
      if (uscitaAttesa && nodo === uscitaAttesa.nodo) {
        if (out?.images) uscitaAttesa.immagini = out.images
        if (out?.text) uscitaAttesa.testo = out.text.join('\n')
      }
      break
    }
    case 'execution_success':
      attesa?.ok(m)
      break
    case 'execution_error': {
      const d = m.data as { exception_message?: string; node_type?: string; exception_type?: string }
      let msg = (d.exception_message || 'errore del motore').trim()
      if (/out of memory|OutOfMemory|CUDA error: out of memory/i.test(msg + (d.exception_type || '')))
        msg = 'Memoria della scheda video esaurita. Prova con meno megapixel, o chiudi altri programmi che usano la GPU.'
      attesa?.ko(new Error(`${msg}${d.node_type ? ` (${d.node_type})` : ''}`))
      break
    }
    case 'execution_interrupted':
      attesa?.ko(new Error('annullato'))
      break
  }
})

let ultimaAnteprima = 0
suAnteprima((img, tipo) => {
  const l = corrente
  if (!l || !impostazioni().anteprimaLive) return
  const ora = Date.now()
  if (ora - ultimaAnteprima < 250) return
  ultimaAnteprima = ora
  l.anteprima = `data:${tipo};base64,${img.toString('base64')}`
  avvisa(l)
})

async function prepara(q: Richiesta): Promise<Ingressi> {
  const immagini: Ingressi['immagini'] = []
  for (const p of q.immagini) {
    const nome = await caricaImmagine(p)
    const sz = nativeImage.createFromPath(p).getSize()
    if (!sz.width) throw new Error('non riesco a leggere la foto ' + p)
    immagini.push({ nome, larghezza: sz.width, altezza: sz.height })
  }
  const maschera = q.maschera ? await caricaImmagine(q.maschera) : undefined
  return { immagini, maschera }
}

type Uscita = { nodo: string; immagini: { filename: string; subfolder: string; type: string }[]; testo?: string }

/** manda un grafo al motore e aspetta che finisca (le fasi e l'avanzamento arrivano dai messaggi) */
async function lancia(grafo: GrafoPronto): Promise<Uscita> {
  fasiCorrenti = grafo.fasi
  uscitaAttesa = { nodo: grafo.uscita, immagini: [] }
  const fine = new Promise<MessaggioComfy>((ok, ko) => {
    attesa = { ok, ko }
  })
  promptCorrente = randomUUID()
  await accoda(grafo.prompt, promptCorrente)
  await fine
  const uscita = uscitaAttesa as Uscita
  if (!uscita.immagini.length && !uscita.testo) {
    const h = await usciteDa(promptCorrente, grafo.uscita).catch(() => null)
    if (h) Object.assign(uscita, h)
  }
  return uscita
}

// le traduzioni già fatte (più immagini dallo stesso prompt = una traduzione sola)
const tradotti = new Map<string, string>()
const CON_PROMPT = new Set(['crea', 'modifica', 'zona', 'espandi', 'varia', 'rifinisci'])

/** il prompt in inglese per il modello: se è in italiano lo traduce Qwen3-VL (già caricato), se no resta com'è */
async function inInglese(l: Lavoro): Promise<string> {
  const q = l.richiesta
  const p = q.prompt.trim()
  if (!impostazioni().traduci || !CON_PROMPT.has(q.modalita) || !p || !daTradurre(p)) return q.prompt
  const gia = tradotti.get(p)
  if (gia) return gia
  l.fase = 'Traduco il prompt in inglese'
  avvisa(l)
  const g = costruisci({ ...q, modalita: 'descrivi', prompt: p, sistema: SISTEMA_TRADUCI, maxToken: tokenPer(p), temperatura: 0.2, seed: 0, immagini: [] }, impostazioni(), { immagini: [] }, 'traduci')
  g.fasi = Object.fromEntries(Object.keys(g.fasi).map((k) => [k, 'Traduco il prompt in inglese']))
  const u = await lancia(g)
  const t = pulisciTraduzione(u.testo || '', p)
  tradotti.set(p, t)
  if (tradotti.size > 200) tradotti.delete(tradotti.keys().next().value as string)
  l.passo = 0
  l.passiTotali = 0
  return t
}

let girando = false
async function prossimo(): Promise<void> {
  if (girando) return
  girando = true
  try {
    for (;;) {
      const l = lavori.find((x) => x.stato === 'in coda')
      if (!l) break
      await esegui(l)
    }
  } finally {
    girando = false
  }
}

async function esegui(l: Lavoro): Promise<void> {
  corrente = l
  l.stato = 'in corso'
  l.inizio = Date.now()
  l.fase = 'Preparo'
  l.passo = 0
  avvisa(l)
  tempiPasso = []
  ultimoPasso = 0
  const imp = impostazioni()
  try {
    if (infoMotore().stato !== 'pronto') {
      l.fase = 'Avvio il motore'
      avvisa(l)
      await avviaMotore()
    }
    if (!collegato()) await connetti()
    const ing = await prepara(l.richiesta)
    const inglese = await inInglese(l)
    if (inglese !== l.richiesta.prompt) l.promptInglese = inglese
    tempiPasso = []
    ultimoPasso = 0
    const grafo = costruisci({ ...l.richiesta, prompt: inglese }, imp, ing, l.id.slice(0, 8), profiloMemoria(infoMotore().vramTotale))
    l.areaAnteprima = grafo.area
    l.megapixel = grafo.megapixel || undefined
    l.passiTotali = grafo.passi
    l.stima = grafo.megapixel ? Math.round(stimaPasso(grafo.megapixel) * grafo.passi + 6) : undefined
    const uscita = await lancia(grafo)
    if (l.richiesta.modalita === 'descrivi') {
      l.testo = (uscita?.testo || '').trim()
    } else {
      if (!uscita?.immagini.length) throw new Error('il motore non ha restituito immagini')
      const durata = (Date.now() - (l.inizio || Date.now())) / 1000
      for (const im of uscita.immagini) {
        const file = join(USCITA, im.subfolder, im.filename)
        const q = l.richiesta
        const op = aggiungi(file, {
          durata,
          modalita: q.modalita,
          prompt: q.prompt,
          negativo: q.negativo,
          seed: q.seed,
          passi: grafo.passi,
          cfg: q.cfg,
          sampler: q.sampler,
          scheduler: q.scheduler,
          lora: q.lora,
          modello: imp.modello,
          forza: q.forza,
          trasparente: q.trasparente,
          origine: q.origine,
          etichetta: q.etichetta,
          promptInglese: l.promptInglese
        })
        l.risultati.push(op.id)
      }
      // misura dei secondi per passo (salta i primi due: dentro c'è il caricamento)
      if (grafo.megapixel && tempiPasso.length > 4) {
        const t = tempiPasso.slice(2)
        registraTempo(grafo.megapixel, t.reduce((a, b) => a + b, 0) / t.length)
      }
    }
    l.stato = 'fatto'
    l.fase = 'Fatto'
    l.anteprima = undefined
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'annullato') {
      l.stato = 'annullato'
      l.fase = 'Annullato'
    } else {
      l.stato = 'errore'
      l.fase = 'Errore'
      l.errore = msg
    }
    l.anteprima = undefined
  } finally {
    l.fine = Date.now()
    corrente = null
    promptCorrente = null
    attesa = null
    uscitaAttesa = null
    avvisa(l)
    void aggiornaVram()
  }
}

/** esegue subito un lavoro di testo e aspetta il risultato (migliora prompt, descrivi foto) */
export async function scriviTesto(q: Richiesta): Promise<string> {
  const [l] = accodaRichiesta({ ...q, modalita: 'descrivi', quante: 1 })
  return new Promise((ok, ko) => {
    const via = suCambioLavori(() => {
      if (l.stato === 'fatto') {
        via()
        ok(l.testo || '')
      } else if (l.stato === 'errore' || l.stato === 'annullato') {
        via()
        ko(new Error(l.errore || 'annullato'))
      }
    })
  })
}
