// La coda: un lavoro alla volta al motore (così l'ordine, le stime e l'annulla sono nostri).
// Per ogni lavoro: carica le foto, costruisce il grafo, segue avanzamento e anteprime,
// e alla fine porta l'immagine in galleria con dentro le impostazioni.
import { nativeImage } from 'electron'
import { join } from 'node:path'
import { randomInt, randomUUID } from 'node:crypto'
import type { Famiglia, Impostazioni, Lavoro, Richiesta } from '@shared/tipi'
import { USCITA } from '../percorsi'
import { impostazioni, profiloMemoria, registraTempo, stimaPasso } from '../impostazioni'
import { costruisci, type GrafoPronto, type Ingressi } from './grafi'
import { SISTEMA_TRADUCI, daTradurre, pulisciTraduzione, tokenPer } from './traduci'
import { accoda, caricaImmagine, chiaviRtx, collegato, connetti, interrompi, nodiDisponibili, scaricaModelli, suAnteprima, suMessaggio, usciteDa, type MessaggioComfy } from './cliente'
import { avviaMotore, infoMotore, aggiornaVram } from './processo'
import { aggiungi } from '../galleria'
import { pulisciDidascalia, senzaTitolo } from './didascalia'
import { PUP_I2I, PUP_I2I_BREVE, PUP_T2I, PUP_T2I_BREVE } from './pup'
import { encoderKleinFile, fileKlein } from './klein'
import { cambioDiModello, faseScarico, occupaImmagine, occupaTesto, scriveCol4B, type Occupa } from './spazio'
import { elencoLora } from '../lora'
import { scaricaVoce, statoModelli } from '../installa/installatore'

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

/** i LoRA accesi si usano sempre: la loro parola chiave entra nel prompt da sola (se non c'è già), da qualsiasi pagina arrivi la richiesta */
function conParoleLora(q: Richiesta): Richiesta {
  if (q.modalita === 'descrivi' || !q.prompt?.trim() || !q.lora?.length || (q.famiglia ?? impostazioni().famiglia) !== 'qwen') return q
  let info
  try {
    info = elencoLora()
  } catch {
    return q
  }
  const extra: string[] = []
  for (const a of q.lora) {
    const p = info.find((l) => l.file === a.file)?.parole?.trim()
    if (p && !q.prompt.toLowerCase().includes(p.toLowerCase()) && !extra.includes(p)) extra.push(p)
  }
  return extra.length ? { ...q, prompt: `${extra.join(', ')}, ${q.prompt}` } : q
}

export function accodaRichiesta(q0: Richiesta): Lavoro[] {
  const q = conParoleLora(q0)
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
// i token al secondo quando scrive l'LLM: il motore manda un 'progress' per ogni token generato
let misuraToken = false
let tokT0 = 0
let tokV0 = 0

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
      if (misuraToken) {
        // il primo messaggio segna l'inizio (prima c'è la lettura del prompt e della foto, che non conta)
        if (!tokT0 || v < tokV0) {
          tokT0 = ora
          tokV0 = v
        } else if (v > tokV0 && ora - tokT0 > 400) l.tokSec = Math.round(((v - tokV0) / ((ora - tokT0) / 1000)) * 10) / 10
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

/** che cosa occupa la scheda (vedi spazio.ts): il denoiser di una famiglia, l'LLM 4B o 8B, o niente di importante */
let ultimoOccupa: Occupa | null = null

/** una cosa alla volta in VRAM: quando cambia il modello grosso (Qwen ↔ Klein ↔ Klein Base, disegno ↔ LLM, 4B ↔ 8B)
 *  si scarica quello che non serve più, così su 8 GB due modelli non si contendono VRAM e RAM */
async function fattiSpazio(occupa: Occupa, l: Lavoro | null): Promise<void> {
  const prima = ultimoOccupa
  const { libera, ricorda } = cambioDiModello(prima, occupa)
  ultimoOccupa = ricorda
  if (!libera || !impostazioni().unaCosaAllaVolta) return
  const fase = l?.fase
  if (l) {
    l.fase = faseScarico(prima)
    avvisa(l)
  }
  await scaricaModelli()
  if (l && fase) l.fase = fase
}

/** manda un grafo al motore e aspetta che finisca (le fasi e l'avanzamento arrivano dai messaggi) */
async function lancia(grafo: GrafoPronto, occupa: Occupa, l: Lavoro | null = corrente, token = false): Promise<Uscita> {
  await fattiSpazio(occupa, l)
  misuraToken = token
  tokT0 = 0
  tokV0 = 0
  if (l && !token) l.tokSec = undefined
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

/** il traduttore dedicato è sul disco? se manca lo scarica (una volta sola, ~300 MB); false se non ci riesce */
async function traduttorePronto(l: Lavoro): Promise<boolean> {
  const stato = () => statoModelli().find((v) => v.id === 'trad-it-en')?.presente
  if (stato()) return true
  try {
    l.fase = 'Scarico il traduttore'
    avvisa(l)
    await scaricaVoce('trad-it-en', (r, t) => {
      l.fase = `Scarico il traduttore${t ? ` · ${Math.round((r / t) * 100)}%` : ''}`
      avvisa(l, false)
    })
    return !!stato()
  } catch {
    return false
  }
}

// le didascalie già scritte (più immagini dallo stesso prompt = un'espansione sola)
const potenziati = new Map<string, string>()

/** Klein: espande una richiesta breve in una didascalia dettagliata (come l'upsampler ufficiale); in inglese anche se la richiesta era in italiano.
 *  Se non riesce si ripiega sulla traduzione normale.
 *  `impLavoro` sono le impostazioni del lavoro (con i file di Klein già risolti): l'upsampler usa l'encoder della famiglia,
 *  così con Klein scrive col suo Qwen3-VL 4B, che è molto più scattante del Qwen 8B. */
async function potenzia(l: Lavoro, ing: Ingressi, impLavoro: Impostazioni, fam: Famiglia): Promise<string> {
  const q = l.richiesta
  const p = q.prompt.trim()
  const conFoto = ing.immagini.length > 0
  const chiave = `${fam}|${conFoto}|${q.larghezza}x${q.altezza}|${p}`
  const gia = potenziati.get(chiave)
  if (gia) return gia
  const imp = impLavoro
  l.fase = 'Potenzio il prompt'
  avvisa(l)
  // il testo che l'upsampler vede: con foto, la richiesta di modifica; da zero, la richiesta e la forma della tela (TARGET CANVAS)
  const mcd = (a: number, b: number): number => (b ? mcd(b, a % b) : a)
  const g0 = mcd(q.larghezza || 1, q.altezza || 1)
  // il Klein 4B capisce solo i prompt di sistema brevi (con quello lungo ricopia le regole): con lui si usano quelli, e la richiesta da foto va nuda
  // (con «Reference images follow… Output the caption» risponde «user»)
  const encoderKlein = fam !== 'qwen' && !!imp.kleinEncoder
  const richiesta = p.replace(/<image(\d+)>/g, (_m, n: string) => `the image number ${n}`)
  const utente = conFoto
    ? encoderKlein
      ? richiesta
      : `Reference images follow in order (the first image, the second image, ...).\nUser request: ${richiesta}\nOutput the caption.`
    : `${q.larghezza > 0 && q.modalita === 'crea' ? `TARGET CANVAS: ${Math.round(q.larghezza / g0)}:${Math.round(q.altezza / g0)}\n` : ''}${p}`
  const sistema = conFoto ? (encoderKlein ? PUP_I2I_BREVE : PUP_I2I) : encoderKlein ? PUP_T2I_BREVE : PUP_T2I
  const g = costruisci(
    { ...q, modalita: 'descrivi', encoderKlein, prompt: utente, sistema, maxToken: conFoto ? 320 : 600, temperatura: 0.15, presenza: conFoto ? 0 : 1.5, seed: q.seed >= 0 ? q.seed : randomInt(1, 2 ** 31), immagini: [] },
    imp, { immagini: ing.immagini.slice(0, 1) }, 'pup'
  )
  g.fasi = Object.fromEntries(Object.keys(g.fasi).map((k) => [k, 'Potenzio il prompt']))
  const u = await lancia(g, occupaTesto(encoderKlein), l, true)
  const t = pulisciDidascalia(u.testo || '').replace(/^["“]+|["”]+$/g, '').replace(/^(caption|instruction)\s*:\s*/i, '')
  if (t.length < 20) throw new Error('didascalia vuota')
  potenziati.set(chiave, t)
  if (potenziati.size > 100) potenziati.delete(potenziati.keys().next().value as string)
  l.passo = 0
  l.passiTotali = 0
  return t
}

/** i lavori di testo (migliora prompt, descrivi foto, Estrai, Idee, Fusion, traduzione con l'LLM…) con una famiglia Klein scrivono col suo Qwen3-VL 4B,
 *  che sta tutto in VRAM (decine di token al secondo), invece che con l'encoder di Qwen (8B: gira quasi tutto sul processore, ~0,5 tk/s).
 *  Se il 4B non c'è, o la richiesta dice `encoderKlein: false`, tutto resta com'era. */
function conEncoderDiTesto(q: Richiesta, imp: Impostazioni): { q: Richiesta; imp: Impostazioni } {
  const fam = q.famiglia ?? imp.famiglia
  // con Qwen il 4B scrive solo se l'hai acceso in Opzioni (`testoCon4B`, di serie spento); la regola è in spazio.ts
  if (q.modalita !== 'descrivi' || q.encoderKlein === false || (fam === 'qwen' && !imp.testoCon4B)) return { q, imp }
  const enc = encoderKleinFile(imp)
  if (!scriveCol4B(q.modalita, fam, q.encoderKlein, !!imp.testoCon4B, !!enc)) return { q, imp }
  return { q: { ...q, encoderKlein: true }, imp: { ...imp, kleinEncoder: enc } }
}

/** il prompt in inglese per il modello: se è in italiano lo traduce il traduttore dedicato (o, se manca, Qwen3-VL già caricato); se no resta com'è */
async function inInglese(l: Lavoro): Promise<string> {
  const q = l.richiesta
  const p = q.prompt.trim()
  const imp = impostazioni()
  if (!imp.traduci || !CON_PROMPT.has(q.modalita) || !p || !daTradurre(p)) return q.prompt
  const gia = tradotti.get(p)
  if (gia) return gia
  l.fase = 'Traduco il prompt in inglese'
  avvisa(l)
  const dedicato = imp.traduttore === 'dedicato' && (await traduttorePronto(l))
  let t: string
  if (dedicato) {
    const g = costruisci({ ...q, modalita: 'traduci', prompt: p, immagini: [] }, imp, { immagini: [] }, 'traduci')
    const u = await lancia(g, 'cpu', l)
    t = (u.testo || '').trim() || p
  } else {
    const t4 = conEncoderDiTesto({ ...q, modalita: 'descrivi', prompt: p, sistema: SISTEMA_TRADUCI, maxToken: tokenPer(p), temperatura: 0.2, seed: 0, immagini: [] }, imp)
    const g = costruisci(t4.q, t4.imp, { immagini: [] }, 'traduci')
    g.fasi = Object.fromEntries(Object.keys(g.fasi).map((k) => [k, 'Traduco il prompt in inglese']))
    const u = await lancia(g, occupaTesto(t4.q.encoderKlein), l, true)
    t = pulisciTraduzione(u.testo || '', p)
  }
  tradotti.set(p, t)
  if (tradotti.size > 200) tradotti.delete(tradotti.keys().next().value as string)
  l.passo = 0
  l.passiTotali = 0
  return t
}

// quando non c'è niente da fare, dopo un po' i modelli escono dalla VRAM (la scheda torna libera per gli altri programmi)
let timerScarico: ReturnType<typeof setTimeout> | null = null
function programmaScarico(): void {
  if (timerScarico) clearTimeout(timerScarico)
  timerScarico = null
  const sec = impostazioni().scaricaDopo
  if (!sec || sec <= 0) return
  timerScarico = setTimeout(() => {
    timerScarico = null
    if (corrente || lavori.some((x) => x.stato === 'in coda') || infoMotore().stato !== 'pronto') return
    ultimoOccupa = null
    void scaricaModelli().then(() => aggiornaVram())
  }, sec * 1000)
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
    programmaScarico()
  }
}

async function esegui(l: Lavoro): Promise<void> {
  if (timerScarico) clearTimeout(timerScarico)
  timerScarico = null
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
    // FLUX 3 Klein: i suoi file (scelti, scaricati dall'app o messi a mano) e, se serve, il prompt espanso
    const fam = l.richiesta.famiglia ?? imp.famiglia
    let impLavoro = imp
    const usaKlein = fam !== 'qwen' && l.richiesta.modalita !== 'descrivi' && l.richiesta.modalita !== 'traduci' && l.richiesta.modalita !== 'ingrandisci'
    if (usaKlein) {
      const f = fileKlein(imp, fam)
      if (typeof f === 'string') throw new Error(f)
      // FLUX 3 vuole ComfyUI 0.41 o più: se il motore è ancora quello vecchio si dice chiaro
      const nodi = await nodiDisponibili().catch(() => ({}) as Record<string, unknown>)
      if (!nodi['EmptyFlux2LatentImage'] || !nodi['ReferenceLatent']) throw new Error('Il motore è ancora della versione vecchia e non conosce FLUX 3: chiudi e riapri l\'app, si aggiorna da solo.')
      impLavoro = { ...imp, kleinModello: f.modello, kleinBase: f.modello, kleinEncoder: f.encoder, kleinVae: f.vae }
    }
    let inglese: string
    if (usaKlein && imp.potenziaKlein && l.richiesta.potenzia && l.richiesta.prompt.trim() && (l.richiesta.modalita === 'crea' || l.richiesta.modalita === 'modifica')) {
      try {
        inglese = await potenzia(l, ing, impLavoro, fam)
      } catch (e) {
        if ((e as Error).message === 'annullato') throw e
        inglese = await inInglese(l)
      }
    } else inglese = await inInglese(l)
    if (inglese !== l.richiesta.prompt) l.promptInglese = inglese
    tempiPasso = []
    ultimoPasso = 0
    // l'ingranditore NVIDIA RTX, se il motore ce l'ha e non l'hai spento in Opzioni
    const rtx = imp.upscalerRtx ? await chiaviRtx().catch(() => null) : null
    // lavori di testo con Klein: scrivono col suo 4B (vedi conEncoderDiTesto)
    const lavoroTesto = conEncoderDiTesto(l.richiesta, impLavoro)
    impLavoro = lavoroTesto.imp
    const grafo = costruisci({ ...lavoroTesto.q, prompt: inglese }, impLavoro, ing, l.id.slice(0, 8), profiloMemoria(infoMotore().vramTotale), rtx)
    l.areaAnteprima = grafo.area
    l.megapixel = grafo.megapixel || undefined
    l.passiTotali = grafo.passi
    l.stima = grafo.megapixel ? Math.round(stimaPasso(grafo.megapixel) * grafo.passi + 6) : undefined
    const testo = l.richiesta.modalita === 'descrivi'
    // la chiave della VRAM: chi scrive (4B o 8B), chi disegna (la famiglia), o l'ingranditore che non sposta niente
    const occupa = testo ? occupaTesto(lavoroTesto.q.encoderKlein) : l.richiesta.modalita === 'ingrandisci' ? 'leggero' : occupaImmagine(fam)
    const uscita = await lancia(grafo, occupa, l, testo)
    if (testo) {
      l.testo = lavoroTesto.q.encoderKlein ? senzaTitolo(uscita?.testo || '') : (uscita?.testo || '').trim()
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
          modello: usaKlein ? (fam === 'klein-base' ? 'FLUX 3 Klein Base · ' : 'FLUX 3 Klein · ') + impLavoro.kleinModello : imp.modello,
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
