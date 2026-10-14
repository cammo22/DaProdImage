// I workflow del Laboratorio: cose che si fanno in più passi, già pronte. Due tipi:
//  - serie: tutti i passi partono dalla stessa foto (il personaggio in 9 pose, il soggetto in 10 stili…)
//  - catena: ogni passo parte dal risultato del precedente (restauro → colore → dettagli, la casa fra 10, 50, 100 anni…)
// Ogni passo è un lavoro normale della coda: si vede nella barra in basso, finisce in galleria con le sue impostazioni,
// e qui si raccoglie tutto in una griglia con il prima/dopo e il "foglio" unico da condividere.
import { create } from 'zustand'
import { api, urlFile } from './api'
import { ascoltatoriLavoro, usaStato, type FotoBase, type Qualita } from './stato'
import { fileLoraCamera, loraPer, perQualita, richiestaBase, fotoDaOpera } from './azioni'
import { dimensioniRis } from './util'
import { conMisura, type Misura } from './componenti/Misura'
import { usaRicette, type RicettaUtente } from './ricette'
import { SISTEMA_SORPRESA } from './azioni'
import type { ChiaveLora } from './rapide'
import type { PosizioneCamera } from './componenti/Camera'
import { immagineOmino } from './ominoImmagine'
import { controllaScheletro } from './pulisciOmino'
import { leggiPosa } from './omino'
import type { Richiesta } from '@shared/tipi'

export type Ingresso =
  | { id: string; tipo: 'testo' | 'righe'; nome: string; esempio: string; opzionale?: boolean }
  | { id: string; tipo: 'scelta'; nome: string; opzioni: { id: string; nome: string }[]; predefinita: string }
  /** il comando Camera: la posizione si muove con i cerchi; il valore è un JSON {az, el, dist} (vuoto = camera ferma) */
  | { id: string; tipo: 'camera'; nome: string }
  /** l'omino: la posa che il personaggio deve prendere (il valore è un JSON della posa; vuoto = non scelta) */
  | { id: string; tipo: 'posa'; nome: string }

export interface Ctx {
  v: Record<string, string>
  nRif: number
  /** c'è il LoRA delle angolazioni */
  camera: boolean
}

export interface PassoWf {
  etichetta: string
  prompt: string
  trasparente?: boolean
  lora?: ChiaveLora[]
  /** disegna da zero (con i riferimenti, se ci sono) invece di modificare la foto */
  crea?: { formato: string; ris?: number }
  /** usa solo il riferimento n (per i workflow dove ogni riferimento è un passo) */
  soloRif?: number
  /** il prompt lo inventa il modello al momento di partire (il passo "Sorpresa") */
  sorpresa?: boolean
  /** la posa dell'omino (JSON): si disegna come mappa di posa e va fra le immagini; nel prompt `{posa}` diventa il suo <imageN> */
  posa?: string
}

export interface Workflow {
  id: string
  nome: string
  categoria: string
  icona: string
  descrizione: string
  modo: 'serie' | 'catena'
  /** serve la foto da cambiare? se no, il workflow disegna da zero */
  foto: boolean
  /** foto di riferimento: non servono, sono facoltative, ne serve almeno una, o ogni riferimento è un passo */
  rif: 'no' | 'si' | 'serve' | 'ognuno'
  rifNome?: string
  ingressi: Ingresso[]
  passi: (c: Ctx) => PassoWf[]
  /** a cosa serve il LoRA, se ce n'è uno che aiuta */
  nota?: string
  /** una ricetta fatta da te */
  utente?: boolean
}

export const CATEGORIE_WF: { id: string; nome: string; icona: string; testo: string }[] = [
  { id: 'personaggio', nome: 'Personaggio', icona: 'ritratto', testo: 'Una foto, tutte le pose, le espressioni, le età' },
  { id: 'look', nome: 'Vestiti e look', icona: 'vestiti', testo: 'Armadio, acconciature, ruoli e costumi' },
  { id: 'camera', nome: 'Camera e angoli', icona: 'camera', testo: 'Giri attorno al soggetto, inquadrature, viste' },
  { id: 'luce', nome: 'Luce e momento', icona: 'luce', testo: 'Giorno intero, stagioni, meteo, luci da studio' },
  { id: 'whatif', nome: 'What if…?', icona: 'situazione', testo: 'E se fosse in un\'altra epoca, in un altro mondo' },
  { id: 'stili', nome: 'Stili e arte', icona: 'arte', testo: 'La stessa foto in dieci stili, giocattoli, oggetti' },
  { id: 'prodotto', nome: 'Prodotto e business', icona: 'prodotto', testo: 'Foto da catalogo, mockup, formati social' },
  { id: 'grafica', nome: 'Testi e grafica', icona: 'poster', testo: 'Poster, loghi, infografiche in tutti gli stili, testi sulle foto' },
  { id: 'sticker', nome: 'Sticker e icone', icona: 'sticker', testo: 'Sticker, emoji e icone di qualsiasi cosa: animali, cibo, oggetti, personaggi' },
  { id: 'casa', nome: 'Casa e spazi', icona: 'casa', testo: 'Ristruttura, cambia pareti, arreda' },
  { id: 'ritocco', nome: 'Ritocco e restauro', icona: 'bacchetta', testo: 'Foto vecchie, ritratti, dal disegno al render' }
]

export { WORKFLOW_BASE } from './ricetteBase'
import { E, righe, WORKFLOW_BASE } from './ricetteBase'

/** il passo che nasce dal comando Camera di una ricetta (la posizione che hai scelto muovendo i cerchi) */
export const VISTA_TUA = 'La tua vista'
/** il passo che nasce dall'omino di una ricetta */
export const POSA_TUA = 'La tua posa'

/** la posizione della camera scritta in un campo della ricetta (vuota o storta = camera ferma) */
export function leggiCamera(s: string | undefined): PosizioneCamera | null {
  if (!s) return null
  try {
    const c = JSON.parse(s) as PosizioneCamera
    return Number.isFinite(c.az) && Number.isFinite(c.el) && Number.isFinite(c.dist) ? c : null
  } catch {
    return null
  }
}

/** il passo "Sorpresa": in ogni ricetta, una variazione inventata dal modello al momento di partire */
export const SORPRESA = '🎲 Sorpresa'

/** una ricetta fatta da te come workflow: i {campi} nei prompt prendono i valori, {riga} una riga alla volta */
export function daUtente(r: RicettaUtente): Workflow {
  const metti = (t: string, v: Record<string, string>, riga?: string): string =>
    t.replace(/\{(\w+)\}/g, (m, k: string) => (k === 'riga' && riga !== undefined ? riga : k in v ? (v[k] || '').trim() : m))
  return {
    id: r.id, nome: r.nome, categoria: r.categoria, icona: r.foto ? 'ritratto' : 'bacchetta', modo: r.modo, foto: r.foto, rif: r.rif, rifNome: r.rifNome,
    descrizione: r.descrizione, ingressi: r.ingressi, utente: true,
    passi: (c) =>
      r.passi.flatMap((p): PassoWf[] => {
        const base: Partial<PassoWf> = { trasparente: p.trasparente, lora: p.lora as ChiaveLora[] | undefined, crea: p.crea }
        if (p.perRiga) {
          return righe(c.v[p.perRiga]).map((riga) => E(metti(p.etichetta, c.v, riga) || riga.slice(0, 24), metti(p.prompt, c.v, riga), base))
        }
        return [E(metti(p.etichetta, c.v), metti(p.prompt, c.v), base)]
      })
  }
}

/** una ricetta che c'è già, come ricetta tua (si può cambiare): i campi di testo diventano {segnaposto} nei prompt */
export function inUtente(w: Workflow, id = 'u-' + crypto.randomUUID().slice(0, 8)): RicettaUtente {
  const v: Record<string, string> = {}
  for (const i of w.ingressi) v[i.id] = i.tipo === 'scelta' ? i.predefinita : i.tipo === 'camera' || i.tipo === 'posa' ? '' : `{${i.id}}`
  const passi = w.passi({ v, nRif: w.rif === 'ognuno' ? 3 : 1, camera: !!fileLoraCamera() })
  return {
    id, nome: w.nome + ' (mia)', categoria: w.categoria, descrizione: w.descrizione, modo: w.modo, foto: w.foto, rif: w.rif, rifNome: w.rifNome,
    ingressi: w.ingressi.filter((i) => i.tipo !== 'scelta' && i.tipo !== 'camera' && i.tipo !== 'posa'),
    passi: passi.map((p) => ({ etichetta: p.etichetta, prompt: p.prompt, crea: p.crea, trasparente: p.trasparente, lora: p.lora })),
    da: w.id
  }
}

/** tutte le ricette che si vedono: quelle di serie (meno le nascoste) e le tue */
export function elencoWorkflow(): Workflow[] {
  const { utente, nascoste } = usaRicette.getState()
  return [...WORKFLOW_BASE.filter((w) => !nascoste.includes(w.id)), ...utente.map(daUtente)]
}

export const workflowDa = (id: string): Workflow | undefined => elencoWorkflow().find((w) => w.id === id) || WORKFLOW_BASE.find((w) => w.id === id)

/** il valore di partenza di ogni campo (gli esempi si scrivono da soli, si ritoccano) */
export function valoriIniziali(w: Workflow): Record<string, string> {
  const v: Record<string, string> = {}
  for (const i of w.ingressi) v[i.id] = i.tipo === 'scelta' ? i.predefinita : i.tipo === 'camera' || i.tipo === 'posa' ? '' : i.esempio
  return v
}

// ---------------------------------------------------------------------------------------------------------------
// l'esecuzione
// ---------------------------------------------------------------------------------------------------------------
export interface PassoRun {
  etichetta: string
  /** il prompt inventato (passo Sorpresa) */
  prompt?: string
  lavoroId?: string
  operaId?: string
  stato: 'attesa' | 'in coda' | 'fatto' | 'errore' | 'annullato'
  errore?: string
}

export interface OpzioniRun {
  qualita: Qualita
  mp: number
  /** le dimensioni dell'immagine che esce (per i passi che modificano la foto) */
  misura?: Misura
  /** i passi da fare (per etichetta): se ti serve una posa sola non le fai tutte */
  fai?: string[]
}

export interface Run {
  id: string
  wfId: string
  nome: string
  base: FotoBase | null
  rif: FotoBase[]
  passi: PassoRun[]
  definizione: PassoWf[]
  opzioni: OpzioniRun
  ctx: Ctx
  seed: number
  creato: number
  fermata?: boolean
}

interface StatoLab {
  runs: Run[]
  attiva: string | null
  vista: 'catalogo' | 'risultati'
  scelto: string | null
}

export const usaLab = create<StatoLab>(() => ({ runs: [], attiva: null, vista: 'catalogo', scelto: null }))

const aggiorna = (id: string, f: (r: Run) => void): void =>
  usaLab.setState((s) => ({ runs: s.runs.map((r) => (r.id === id ? (() => { const n = { ...r, passi: r.passi.map((p) => ({ ...p })) }; f(n); return n })() : r)) }))

/** i passi del workflow con questi ingressi (serve per contarli prima di partire) */
export function passiDi(w: Workflow, v: Record<string, string>, nRif: number): PassoWf[] {
  return conSorpresa(w.passi({ v, nRif, camera: !!fileLoraCamera() }))
}

/** ai passi della ricetta si aggiunge sempre "Sorpresa" (prende formato e sfondo trasparente dal primo passo) */
function conSorpresa(passi: PassoWf[]): PassoWf[] {
  const primo = passi[0]
  return [...passi, { etichetta: SORPRESA, prompt: '', sorpresa: true, crea: primo?.crea, trasparente: primo?.trasparente }]
}

/** il prompt del passo Sorpresa: lo inventa il Qwen3-VL restando nel tema della ricetta (stessa categoria, stesso tipo di cambiamento) */
async function inventaPrompt(run: Run, wf: Workflow | undefined): Promise<string> {
  // esempi sparsi su tutta la ricetta (non solo i primi): così si capisce bene che cosa varia da un passo all'altro
  const veri = run.definizione.filter((p) => !p.sorpresa && p.prompt)
  const n = Math.min(5, veri.length)
  const esempi = Array.from({ length: n }, (_, k) => veri[Math.floor((k * veri.length) / n)]).map((p) => `- (${p.etichetta}) ${p.prompt}`)
  const cat = CATEGORIE_WF.find((c) => c.id === wf?.categoria)
  const seed = Math.floor(Math.random() * 2 ** 31)
  const richiesta = [
    `Recipe: ${run.nome}`,
    `Theme: ${cat ? `${cat.nome} — ${cat.testo}` : 'free'}`,
    `What this recipe does: ${wf?.descrizione || run.nome}`,
    run.ctx.v && Object.keys(run.ctx.v).length ? `Settings chosen by the user: ${Object.entries(run.ctx.v).filter(([, v]) => v && v.length < 120).map(([k, v]) => `${k}=${v}`).join('; ')}` : '',
    `Example variations (the new one must be the same KIND of variation as these):\n${esempi.join('\n') || '- (none)'}`,
    `\nNew variation (random idea ${seed % 9973}):`
  ].filter(Boolean).join('\n')
  const t = await api.testo.scrivi({
    ...richiestaBase(), modalita: 'descrivi', prompt: richiesta, sistema: SISTEMA_SORPRESA, maxToken: 220, temperatura: 1.1, seed, immagini: [], etichetta: 'Idea a sorpresa'
  })
  const pulito = (t || '').trim().replace(/^["']|["']$/g, '')
  if (!pulito) throw new Error('il modello non ha trovato un\'idea: riprova')
  return pulito
}

/** il lavoro per un passo: modifica la foto (o disegna da zero con i riferimenti) */
async function richiestaPasso(run: Run, i: number, baseCorrente: FotoBase | null): Promise<Richiesta> {
  const passo = run.definizione[i]
  const wf = workflowDa(run.wfId)!
  const b = richiestaBase()
  const rif = passo.soloRif !== undefined ? [run.rif[passo.soloRif]].filter(Boolean) : run.rif
  const extra = loraPer(passo.lora).filter((x) => !b.lora.some((l) => l.file === x.file))
  const comune = {
    ...b,
    lora: [...b.lora, ...extra],
    ...perQualita(run.opzioni.qualita),
    quante: 1,
    etichetta: `${run.nome} · ${passo.etichetta}`,
    trasparente: !!passo.trasparente
  }
  const base = baseCorrente || run.base
  const immagini = passo.crea ? rif.map((r) => r.percorso) : [base!.percorso, ...rif.map((r) => r.percorso)]
  let prompt = passo.prompt
  // l'omino: la posa diventa una mappa di posa (punti chiave) e va per PRIMA, come un controllo: così il modello la segue senza
  // disegnarla sulla foto. Le altre immagini scalano di una (<image1> diventa <image2>…); `{posa}` = la mappa, `{foto}` = la foto del personaggio
  const posa = leggiPosa(passo.posa)
  if (posa) {
    const w = passo.crea ? 768 : base!.larghezza
    const h = passo.crea ? 1024 : base!.altezza
    immagini.unshift(await immagineOmino(posa, w, h))
    prompt = prompt.replace(/<image(\d+)>/g, (_m, n: string) => `<image${Number(n) + 1}>`).replace(/\{posa\}/g, '<image1>').replace(/\{foto\}/g, '<image2>')
  }
  if (passo.crea) {
    const d = dimensioniRis(passo.crea.formato, Math.round((passo.crea.ris || 1024) * Math.sqrt(run.opzioni.mp)))
    return {
      ...comune, modalita: 'crea', prompt, larghezza: d.w, altezza: d.h, megapixel: (d.w * d.h) / 1048576,
      immagini, seed: wf.id === 'formati' ? run.seed : -1
    }
  }
  return {
    ...comune, modalita: 'modifica', prompt, megapixel: run.opzioni.mp,
    immagini, origine: base?.operaId,
    ...conMisura(run.opzioni.misura, run.base)
  }
}

async function accodaPasso(runId: string, i: number, base: FotoBase | null): Promise<void> {
  const run = usaLab.getState().runs.find((r) => r.id === runId)
  if (!run || run.fermata) return
  try {
    if (run.definizione[i].sorpresa) {
      const p = await inventaPrompt(run, workflowDa(run.wfId))
      aggiorna(runId, (r) => {
        r.definizione[i] = { ...r.definizione[i], prompt: p }
        r.passi[i].prompt = p
      })
    }
    const corrente = usaLab.getState().runs.find((r) => r.id === runId)
    if (!corrente || corrente.fermata) return
    const ids = await api.lavori.accoda(await richiestaPasso(corrente, i, base))
    // con l'omino si controlla che nella foto non sia rimasto lo scheletro: se c'è, la foto ripulita prende il posto
    if (corrente.definizione[i].posa) controllaScheletro(ids[0], corrente.opzioni.qualita, (pulita) => aggiorna(runId, (r) => { r.passi[i].operaId = pulita.id }))
    aggiorna(runId, (r) => {
      r.passi[i].lavoroId = ids[0]
      r.passi[i].stato = 'in coda'
    })
  } catch (e) {
    aggiorna(runId, (r) => {
      r.passi[i].stato = 'errore'
      r.passi[i].errore = (e as Error).message
    })
  }
}

export interface IngressiRun {
  foto: FotoBase | null
  rif: FotoBase[]
  valori: Record<string, string>
  opzioni: OpzioniRun
}

/** il motivo per cui non si può partire, o null */
export function manca(w: Workflow, i: Pick<IngressiRun, 'foto' | 'rif'>): string | null {
  if (w.foto && !i.foto) return 'Scegli la foto'
  if ((w.rif === 'serve' || w.rif === 'ognuno') && i.rif.length === 0) return w.rif === 'ognuno' ? `Aggiungi ${w.rifNome || 'le foto di riferimento'}` : `Aggiungi ${w.rifNome || 'una foto di riferimento'}`
  return null
}

export async function avviaWorkflow(w: Workflow, i: IngressiRun, suffisso = ''): Promise<string | null> {
  const m = manca(w, i)
  if (m) {
    usaStato.getState().avvisa(m, 'errore')
    return null
  }
  const ctx: Ctx = { v: i.valori, nRif: i.rif.length, camera: !!fileLoraCamera() }
  const tutti = conSorpresa(w.passi(ctx))
  // senza una scelta si fanno tutti i passi tranne la sorpresa
  const fai = i.opzioni.fai ? new Set(i.opzioni.fai) : null
  const definizione = tutti.filter((p) => (fai ? fai.has(p.etichetta) : !p.sorpresa))
  if (!definizione.length) {
    usaStato.getState().avvisa('Scegli almeno un passo da fare', 'errore')
    return null
  }
  const run: Run = {
    id: crypto.randomUUID(), wfId: w.id, nome: w.nome + suffisso, base: i.foto, rif: i.rif, definizione, opzioni: i.opzioni, ctx,
    passi: definizione.map((p) => ({ etichetta: p.etichetta, stato: 'attesa' as const })), seed: Math.floor(Math.random() * 2 ** 32), creato: Date.now()
  }
  usaLab.setState((s) => ({ runs: [run, ...s.runs].slice(0, 40), attiva: run.id, vista: 'risultati' }))
  if (w.modo === 'serie') for (let n = 0; n < definizione.length; n++) await accodaPasso(run.id, n, i.foto)
  else await accodaPasso(run.id, 0, i.foto)
  return run.id
}

/** più foto insieme: la ricetta parte per ognuna, tutto in coda (una ricetta per foto nei risultati) */
export async function avviaLotto(w: Workflow, i: Omit<IngressiRun, 'foto'> & { foto: FotoBase[] }): Promise<number> {
  if (!w.foto || i.foto.length === 0) return (await avviaWorkflow(w, { ...i, foto: i.foto[0] || null })) ? 1 : 0
  let n = 0
  let primo: string | null = null
  for (let k = 0; k < i.foto.length; k++) {
    const id = await avviaWorkflow(w, { ...i, foto: i.foto[k] }, i.foto.length > 1 ? ` · foto ${k + 1}/${i.foto.length}` : '')
    if (id) {
      n++
      primo ??= id
    }
  }
  // nei risultati si vede subito la prima foto
  if (primo) usaLab.setState({ attiva: primo })
  return n
}

export async function fermaRun(id: string): Promise<void> {
  const run = usaLab.getState().runs.find((r) => r.id === id)
  if (!run) return
  aggiorna(id, (r) => {
    r.fermata = true
    for (const p of r.passi) if (p.stato === 'attesa') p.stato = 'annullato'
  })
  for (const p of run.passi) if (p.lavoroId && p.stato === 'in coda') await api.lavori.annulla(p.lavoroId)
}

// i lavori che finiscono fanno andare avanti i workflow (la catena parte col passo dopo)
ascoltatoriLavoro.push((uno) => {
  for (const run of usaLab.getState().runs) {
    const i = run.passi.findIndex((p) => p.lavoroId === uno.id)
    if (i < 0) continue
    const wf = workflowDa(run.wfId)
    if (uno.stato === 'fatto') {
      const opera = uno.risultati[0]
      aggiorna(run.id, (r) => {
        r.passi[i].stato = 'fatto'
        r.passi[i].operaId = opera
      })
      if (wf?.modo === 'catena' && i + 1 < run.passi.length && opera) {
        void api.galleria.opera(opera).then((o) => o && accodaPasso(run.id, i + 1, fotoDaOpera(o)))
      }
    } else if (uno.stato === 'errore' || uno.stato === 'annullato') {
      aggiorna(run.id, (r) => {
        r.passi[i].stato = uno.stato === 'errore' ? 'errore' : 'annullato'
        r.passi[i].errore = uno.errore
        if (wf?.modo === 'catena') for (let k = i + 1; k < r.passi.length; k++) r.passi[k].stato = 'annullato'
      })
    }
  }
})

// ---------------------------------------------------------------------------------------------------------------
// il foglio: tutti i risultati in un'immagine sola, da condividere
// ---------------------------------------------------------------------------------------------------------------
const carica = (src: string): Promise<HTMLImageElement> =>
  new Promise((ok, ko) => {
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => ok(im)
    im.onerror = () => ko(new Error('non riesco ad aprire un\'immagine del foglio'))
    im.src = src
  })

/** una griglia con l'originale e tutti i risultati, ognuno con la sua etichetta; entra in galleria come "Foglio" */
export async function creaFoglio(run: Run): Promise<void> {
  const voci: { src: string; testo: string }[] = []
  if (run.base) voci.push({ src: urlFile(run.base.percorso), testo: 'ORIGINALE' })
  for (const p of run.passi) {
    if (p.stato !== 'fatto' || !p.operaId) continue
    const o = await api.galleria.opera(p.operaId)
    if (o) voci.push({ src: urlFile(o.file), testo: p.etichetta.toUpperCase() })
  }
  if (voci.length < 2) throw new Error('Non ci sono ancora abbastanza risultati')
  const colonne = Math.min(voci.length, voci.length <= 4 ? 2 : voci.length <= 9 ? 3 : 4)
  const righe = Math.ceil(voci.length / colonne)
  const L = 560
  const barra = 46
  const gap = 14
  const marg = 28
  const titolo = 70
  const c = document.createElement('canvas')
  c.width = marg * 2 + colonne * L + (colonne - 1) * gap
  c.height = titolo + marg + righe * (L + barra) + (righe - 1) * gap
  const g = c.getContext('2d')!
  g.fillStyle = '#0d0917'
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#ffd54a'
  g.font = '900 30px Orbitron, sans-serif'
  g.fillText(run.nome.toUpperCase(), marg, 46)
  g.fillStyle = '#6f6496'
  g.font = '600 16px Rajdhani, sans-serif'
  g.textAlign = 'right'
  g.fillText('DaProd Image', c.width - marg, 46)
  g.textAlign = 'left'
  for (let n = 0; n < voci.length; n++) {
    const im = await carica(voci[n].src)
    const x = marg + (n % colonne) * (L + gap)
    const y = titolo + Math.floor(n / colonne) * (L + barra + gap)
    g.fillStyle = '#18122b'
    g.fillRect(x, y, L, L + barra)
    const s = Math.min(L / im.naturalWidth, L / im.naturalHeight)
    const w = im.naturalWidth * s
    const h = im.naturalHeight * s
    g.drawImage(im, x + (L - w) / 2, y + (L - h) / 2, w, h)
    g.fillStyle = n === 0 && run.base ? '#a99dd0' : '#efe9ff'
    g.font = '700 20px Rajdhani, sans-serif'
    g.fillText(voci[n].testo, x + 14, y + L + 30)
  }
  const percorso = await api.file.salvaTemp(c.toDataURL('image/png'))
  await api.galleria.importaFoto(percorso, `Foglio ${run.nome}`)
}
