// Da una Richiesta al grafo di ComfyUI (formato API). Ogni modalità usa gli stessi pezzi:
//   modello GGUF → (Turbo) → LoRA → cache KV di Qwen-Image 2.1 · text encoder Qwen3-VL · VAE
// e i parametri della pipeline ufficiale (euler/simple, cfg 1, 40 passi; 8 col Turbo).
import { modelloTurbo } from '@shared/tipi'
import type { Famiglia, Impostazioni, Richiesta, Riquadro } from '@shared/tipi'
import type { ChiaviRtx } from './cliente'

/** il profilo di memoria: con poca VRAM il VAE lavora a tessere (niente picchi che finiscono nella RAM condivisa) */
export type Memoria = 'bassa' | 'normale' | 'alta'

type Rif = [string, number]
type Nodo = { class_type: string; inputs: Record<string, unknown> }

export interface GrafoPronto {
  prompt: Record<string, Nodo>
  /** nodo che salva l'immagine finale (o che restituisce il testo) */
  uscita: string
  /** per i messaggi "executing": nodo → fase da mostrare */
  fasi: Record<string, string>
  /** megapixel su cui lavora il campionatore (per stimare i tempi) */
  megapixel: number
  passi: number
  /** dove va l'anteprima dal vivo, in pixel della foto di partenza (zona, espandi, modifica) */
  area?: Riquadro
}

/** foto già passate al motore: percorso su disco → nome per LoadImage, più le dimensioni */
export interface Ingressi {
  immagini: { nome: string; larghezza: number; altezza: number }[]
  maschera?: string
}

class Grafo {
  constructor(readonly memoria: Memoria = 'normale') {}
  nodi: Record<string, Nodo> = {}
  fasi: Record<string, string> = {}
  private n = 0
  add(tipo: string, inputs: Record<string, unknown>, fase?: string): string {
    const id = String(++this.n)
    this.nodi[id] = { class_type: tipo, inputs }
    if (fase) this.fasi[id] = fase
    return id
  }
}

const r = (id: string, slot = 0): Rif => [id, slot]
const m32 = (x: number): number => Math.max(256, Math.round(x / 32) * 32)

export const AVVOLGI_TRASPARENTE = (s: string): string =>
  `This is an RGBA format image with transparency. ${s.trim().replace(/\.$/, '')}. The image has an alpha channel and a transparent background.`

/** dimensioni con quei megapixel e quelle proporzioni, a multipli di 32 */
export function dimensioniPer(mp: number, larghezza: number, altezza: number): { w: number; h: number } {
  const px = mp * 1024 * 1024
  const s = Math.sqrt(px / (larghezza * altezza))
  return { w: m32(larghezza * s), h: m32(altezza * s) }
}

/** il Turbo è acceso e il suo LoRA c'è? */
const conTurbo = (q: Richiesta, imp: Impostazioni): boolean => !!q.turbo && (modelloTurbo(imp.modello) || !!imp.loraTurbo)

/** il text encoder: safetensors col CLIPLoader, GGUF (Q4/Q6/Q8) col suo loader, che trova da solo l'mmproj accanto */
function caricaClip(g: Grafo, imp: Impostazioni): Rif {
  const titolo = 'Carico il text encoder'
  if (imp.encoder.toLowerCase().endsWith('.gguf')) return r(g.add('CLIPLoaderGGUF', { clip_name: imp.encoder, type: 'qwen_image' }, titolo))
  return r(g.add('CLIPLoader', { clip_name: imp.encoder, type: 'qwen_image', device: imp.encoderSuCpu ? 'cpu' : 'default' }, titolo))
}

/** il text encoder che SCRIVE TESTO (upsampler, migliora prompt, descrivi foto…) per la famiglia: con Klein si usa il suo Qwen3-VL 4B
 *  (sta tutto nella VRAM: decine di token al secondo, contro lo 0,5 dell'8B di Qwen-Image che gira quasi tutto sul processore).
 *  Va caricato con il tipo `krea2` (lo stesso Qwen3-VL 4B completo, con il suo generatore) e NON con `flux3`: il tokenizer di `flux3`
 *  riempie il prompt con fino a 79 token di riempimento (serve al disegno, non alla scrittura) e il modello risponde «#» o «Assistant:».
 *  Se il file manca si torna all'encoder generale. */
function caricaClipPerTesto(g: Grafo, imp: Impostazioni, kleinEncoder: boolean | undefined): Rif {
  if (!kleinEncoder || !imp.kleinEncoder) return caricaClip(g, imp)
  return r(g.add('CLIPLoader', { clip_name: imp.kleinEncoder, type: 'krea2', device: imp.encoderSuCpu ? 'cpu' : 'default' }, 'Carico il text encoder'))
}

/** il modello che disegna questa richiesta */
export const famigliaDi = (q: Richiesta, imp: Impostazioni): Famiglia => q.famiglia ?? imp.famiglia ?? 'qwen'

/** FLUX 3 Klein: UNETLoader (i pesi INT8/BF16 li riconosce da soli ComfyUI), text encoder Qwen3-VL 4B di tipo flux3, VAE di Klein. Niente LoRA né cache KV. */
function baseKlein(g: Grafo, imp: Impostazioni, fam: Famiglia): { model: Rif; clip: Rif; vae: Rif } {
  const file = fam === 'klein-base' ? imp.kleinBase : imp.kleinModello
  const model = r(g.add('UNETLoader', { unet_name: file, weight_dtype: 'default' }, 'Carico il modello'))
  const clip = r(g.add('CLIPLoader', { clip_name: imp.kleinEncoder, type: 'flux3', device: imp.encoderSuCpu ? 'cpu' : 'default' }, 'Carico il text encoder'))
  const vae = r(g.add('VAELoader', { vae_name: imp.kleinVae }, 'Carico il VAE'))
  return { model, clip, vae }
}

function base(g: Grafo, q: Richiesta, imp: Impostazioni): { model: Rif; clip: Rif; vae: Rif } {
  const fam = famigliaDi(q, imp)
  if (fam !== 'qwen') return baseKlein(g, imp, fam)
  const carico = 'Carico il modello'
  const unet = imp.modello.toLowerCase().endsWith('.gguf')
    ? g.add('UnetLoaderGGUF', { unet_name: imp.modello }, carico)
    : g.add('UNETLoader', { unet_name: imp.modello, weight_dtype: 'default' }, carico)
  let model = r(unet)
  const turbo = conTurbo(q, imp)
  const nativo = modelloTurbo(imp.modello)
  if (turbo && !nativo) model = r(g.add('LoraLoaderModelOnly', { model, lora_name: imp.loraTurbo, strength_model: 1 }, 'Accendo il Turbo'))
  for (const l of q.lora) {
    if (!l.file || !l.forza || (turbo && l.file === imp.loraTurbo)) continue
    model = r(g.add('LoraLoaderModelOnly', { model, lora_name: l.file, strength_model: l.forza }, 'Applico i LoRA'))
  }
  model = r(g.add('QwenImage21Cache', { model, device: imp.cacheKV, dtype: imp.cacheTipo }))
  const clip = caricaClip(g, imp)
  const vae = r(g.add('VAELoader', { vae_name: imp.vae }, 'Carico il VAE'))
  return { model, clip, vae }
}

/** il testo e le foto di riferimento per il modello, nella forma che ognuno vuole: Qwen li legge tutti col suo encoder (che dà anche la latente
 *  della foto da modificare); Klein codifica il testo e mette ogni foto come riferimento (VAEEncode → ReferenceLatent). */
interface Condizioni {
  pos: Rif
  neg: Rif
  /** la latente da cui partire, se il modello la dà (Qwen in modifica) */
  lat?: Rif
}

const ORDINALI = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']

function condiziona(
  g: Grafo,
  fam: Famiglia,
  ctx: { clip: Rif; vae: Rif },
  o: {
    prompt: string
    neg: string
    /** Qwen: lato di lavoro per le foto (0 = come il latente) */
    resolution: number
    /** Qwen: passa il VAE (serve se ci sono foto) */
    conVae: boolean
    /** le foto (già caricate): <image1> è la prima */
    immagini: Rif[]
    /** Klein: la prima foto si porta a questa misura (è la foto che si modifica); le altre stanno sotto 1 MP */
    misuraPrima?: { w: number; h: number }
    /** Qwen: le foto dall'indice `scalaDa` in poi si portano a questo numero di megapixel prima di darle all'encoder (se manca, vanno com'è) */
    mpRiferimenti?: number
    scalaDa?: number
    fase: string
  }
): Condizioni {
  if (fam === 'qwen') {
    const inputs: Record<string, unknown> = { clip: ctx.clip, prompt: o.prompt, negative_prompt: o.neg, resolution: o.resolution }
    if (o.conVae) inputs.vae = ctx.vae
    o.immagini.forEach((im, i) => {
      inputs[`images.image_${i + 1}`] = o.mpRiferimenti !== undefined && i >= (o.scalaDa ?? 1) ? r(g.add('ImageScaleToTotalPixels', { image: im, upscale_method: 'lanczos', megapixels: o.mpRiferimenti, resolution_steps: 32 })) : im
    })
    const enc = g.add('TextEncodeQwenImage21', inputs, o.fase)
    return { pos: r(enc, 0), neg: r(enc, 1), lat: r(enc, 2) }
  }
  // Klein non ha i tag <imageN>: le foto si citano a parole («the second image»), come fa il suo prompt upsampler. Il negativo è il testo vuoto, o quello scritto
  const parole = o.prompt.replace(/<image(\d+)>/g, (_m, n: string) => `the ${ORDINALI[Number(n) - 1] || 'last'} image`)
  let pos = r(g.add('CLIPTextEncode', { clip: ctx.clip, text: parole }, o.fase))
  let neg = r(g.add('CLIPTextEncode', { clip: ctx.clip, text: o.neg || '' }))
  o.immagini.slice(0, 10).forEach((im, i) => {
    const pronta =
      i === 0 && o.misuraPrima
        ? r(g.add('ImageScale', { image: im, upscale_method: 'lanczos', width: o.misuraPrima.w, height: o.misuraPrima.h, crop: 'center' }))
        : r(g.add('ImageScaleToTotalPixels', { image: im, upscale_method: 'lanczos', megapixels: 1, resolution_steps: 16 }))
    const lat = r(g.add('VAEEncode', { pixels: pronta, vae: ctx.vae }, i === 0 ? 'Preparo le foto' : undefined))
    pos = r(g.add('ReferenceLatent', { conditioning: pos, latent: lat }))
    neg = r(g.add('ReferenceLatent', { conditioning: neg, latent: lat }))
  })
  return { pos, neg }
}

/** la latente vuota per disegnare da zero a quella misura */
function latenteVuota(g: Grafo, fam: Famiglia, w: number, h: number): Rif {
  return r(g.add(fam === 'qwen' ? 'EmptyLatentImage' : 'EmptyFlux2LatentImage', { width: w, height: h, batch_size: 1 }))
}

function campiona(g: Grafo, q: Richiesta, fam: Famiglia, model: Rif, c: Condizioni, latente: Rif, passi: number, denoise = 1): Rif {
  // Klein veloce è distillato (16 passi, senza CFG); Klein Base vuole CFG 3,5; sampler e scheduler sono quelli del riferimento (euler, e la scaletta del modello)
  const cfg = fam === 'qwen' ? q.cfg : fam === 'klein' ? 1 : q.cfg > 1 ? q.cfg : 3.5
  return r(
    g.add(
      'KSampler',
      {
        model,
        seed: q.seed,
        steps: passi,
        cfg,
        sampler_name: fam === 'qwen' ? q.sampler : 'euler',
        scheduler: fam === 'qwen' ? q.scheduler : 'simple',
        positive: c.pos,
        negative: c.neg,
        latent_image: latente,
        denoise
      },
      'Disegno'
    )
  )
}

/** VAE a tessere? Con 6 GB già da ~0,6 MP, con 8-12 GB solo oltre i 2 MP, con tanta VRAM mai */
function aTessere(g: Grafo, mp: number): boolean {
  return g.memoria === 'bassa' ? mp > 0.6 : g.memoria === 'normale' ? mp > 2.2 : false
}
const TESSERE = { tile_size: 512, overlap: 64, temporal_size: 64, temporal_overlap: 8 }

/** decodifica e (se non trasparente) toglie il canale alfa: il VAE di Qwen 2.1 esce sempre RGBA */
function sviluppa(g: Grafo, q: Richiesta, lat: Rif, vae: Rif, mp: number): Rif {
  const fase = 'Sviluppo l\'immagine'
  const dec = aTessere(g, mp) ? g.add('VAEDecodeTiled', { samples: lat, vae, ...TESSERE }, fase) : g.add('VAEDecode', { samples: lat, vae }, fase)
  if (q.trasparente) return r(dec)
  return r(g.add('SplitImageWithAlpha', { image: r(dec) }), 0)
}

/** dalla foto al latente (a tessere se la memoria è poca) */
function codifica(g: Grafo, pixels: Rif, vae: Rif, mp: number): Rif {
  const fase = 'Preparo la foto'
  return r(aTessere(g, mp) ? g.add('VAEEncodeTiled', { pixels, vae, ...TESSERE }, fase) : g.add('VAEEncode', { pixels, vae }, fase))
}

/** l'istruzione chiede di togliere qualcosa? (allora la zona si riempie prima, così l'oggetto non torna) */
export const RIMUOVI = /\b(rimuov|togli|elimin|cancell|leva|levare|sparire|remove|erase|delete|get rid|take out|clean ?up)/i

/** in che parte del riquadro sta la zona, a parole (il modello non vede la maschera: così sa di cosa si parla) */
export function doveNelRiquadro(zona: Riquadro, box: { x: number; y: number; w: number; h: number }): string | null {
  if ((zona.w * zona.h) / (box.w * box.h) > 0.55) return null
  const fx = (zona.x + zona.w / 2 - box.x) / box.w
  const fy = (zona.y + zona.h / 2 - box.y) / box.h
  const o = fx < 0.36 ? 'left' : fx > 0.64 ? 'right' : ''
  const v = fy < 0.36 ? 'top' : fy > 0.64 ? 'bottom' : ''
  return o || v ? `the ${[v, o].filter(Boolean).join(' ')} part` : 'the center'
}

/** ingrandisce di circa `fattore` volte: con l'ingranditore NVIDIA RTX (se il motore lo ha) o col modello (4x-UltraSharp, 4×) */
function ingrandisciImg(g: Grafo, imp: Impostazioni, rtx: ChiaviRtx | null | undefined, img: Rif, fattore: number): Rif {
  if (rtx && imp.upscalerRtx) {
    const inputs: Record<string, unknown> = { images: img, resize_type: rtx.scala, 'resize_type.scale': Math.max(1, Math.min(4, fattore)), quality: rtx.quality, strength: 1 }
    if (rtx.codifica) inputs.image_encoding = rtx.codifica
    return r(g.add('RTXVideoSuperResolution', inputs, 'Ingrandisco (NVIDIA RTX)'))
  }
  const um = r(g.add('UpscaleModelLoader', { model_name: imp.upscaler }, 'Carico l\'ingranditore'))
  return r(g.add('ImageUpscaleWithModel', { upscale_model: um, image: img }, 'Ingrandisco'))
}

/** porta l'immagine (grande w × h) alla misura esatta chiesta in `q.uscita`: riduce, o con l'ingranditore se serve molto di più;
 *  con proporzioni diverse taglia al centro */
function allaMisura(g: Grafo, q: Richiesta, imp: Impostazioni, img: Rif, w: number, h: number, rtx?: ChiaviRtx | null): Rif {
  const u = q.uscita
  if (!u || (Math.abs(u.w - w) < 2 && Math.abs(u.h - h) < 2)) return img
  let x = img
  if (Math.max(u.w / w, u.h / h) > 1.5 && imp.upscaler && !q.trasparente) {
    x = ingrandisciImg(g, imp, rtx, x, Math.max(u.w / w, u.h / h))
  }
  return r(g.add('ImageScale', { image: x, upscale_method: 'lanczos', width: u.w, height: u.h, crop: 'center' }, 'Porto alla misura'))
}

function salva(g: Grafo, img: Rif, prefisso: string): string {
  return g.add('SaveImage', { images: img, filename_prefix: `daprod/${prefisso}` }, 'Salvo')
}

/** con la denoise < 1 il KSampler fa comunque tutti i passi: se ne fanno quanti ne servono a quella forza
 *  (col Turbo bastano 4: il KSampler li prende dalla fine della scaletta da 8) */
const passiPer = (passi: number, forza: number, minimo = 8): number => (forza >= 0.999 ? passi : Math.max(Math.min(minimo, passi), Math.round(passi * forza)))

/** riquadro di lavoro attorno alla zona: contesto, proporzioni, grandezza per il modello */
export function riquadroLavoro(
  W: number,
  H: number,
  zona: Riquadro | undefined,
  contesto: number,
  mp: number,
  ritaglia: boolean
): { x: number; y: number; w: number; h: number; tw: number; th: number } {
  let x = 0
  let y = 0
  let w = W
  let h = H
  if (ritaglia && zona && zona.w > 0 && zona.h > 0) {
    const pad = Math.max(zona.w, zona.h) * contesto + 24
    let x0 = Math.max(0, Math.floor(zona.x - pad))
    let y0 = Math.max(0, Math.floor(zona.y - pad))
    let x1 = Math.min(W, Math.ceil(zona.x + zona.w + pad))
    let y1 = Math.min(H, Math.ceil(zona.y + zona.h + pad))
    // almeno 384 px per lato (se la foto lo permette): il modello ha bisogno di vedere attorno
    const minimo = Math.min(384, W, H)
    if (x1 - x0 < minimo) {
      const c = (x0 + x1) / 2
      x0 = Math.max(0, Math.min(W - minimo, Math.round(c - minimo / 2)))
      x1 = x0 + minimo
    }
    if (y1 - y0 < minimo) {
      const c = (y0 + y1) / 2
      y0 = Math.max(0, Math.min(H - minimo, Math.round(c - minimo / 2)))
      y1 = y0 + minimo
    }
    // se il ritaglio è quasi tutta la foto, si lavora su tutta
    if ((x1 - x0) * (y1 - y0) < W * H * 0.7) {
      x = x0
      y = y0
      w = x1 - x0
      h = y1 - y0
    }
  }
  const target = mp * 1024 * 1024
  // le zone piccole si ingrandiscono (fino a 4x) per avere più dettaglio, quelle grandi si riducono
  const s = Math.min(4, Math.sqrt(target / (w * h)))
  return { x, y, w, h, tw: m32(w * s), th: m32(h * s) }
}

export function costruisci(q: Richiesta, imp: Impostazioni, ing: Ingressi, prefisso: string, memoria: Memoria = 'normale', rtx?: ChiaviRtx | null): GrafoPronto {
  const g = new Grafo(memoria)
  const neg = q.negativo || ''
  const minimo = conTurbo(q, imp) ? 4 : 8

  // il traduttore dedicato: un nodo solo, sul processore; il motore non carica né Qwen né il VAE
  if (q.modalita === 'traduci') {
    const uscita = g.add('DaProdTraduci', { testo: q.prompt, modello: 'opus-mt-it-en' }, 'Traduco il prompt in inglese')
    return { prompt: g.nodi, uscita, fasi: g.fasi, megapixel: 0, passi: 1 }
  }

  if (q.modalita === 'descrivi') {
    // l'upsampler di Klein scrive la didascalia col suo encoder 4B (decine di tk/s); tutto il resto, come sempre, con quello di Qwen
    const clip = caricaClipPerTesto(g, imp, q.encoderKlein)
    const inputs: Record<string, unknown> = {
      clip,
      prompt: q.prompt,
      max_length: q.maxToken || 400,
      sampling_mode: 'on',
      'sampling_mode.temperature': q.temperatura ?? 0.7,
      'sampling_mode.top_k': 20,
      'sampling_mode.top_p': 0.9,
      'sampling_mode.min_p': 0,
      'sampling_mode.repetition_penalty': 1.05,
      'sampling_mode.seed': Math.max(0, q.seed),
      thinking: false,
      use_default_template: true,
      system_prompt: q.sistema || ''
    }
    if (q.presenza !== undefined) inputs['sampling_mode.presence_penalty'] = q.presenza
    if (ing.immagini[0]) inputs.image = r(g.add('LoadImage', { image: ing.immagini[0].nome }, 'Guardo la foto'))
    const gen = g.add('TextGenerate', inputs, 'Scrivo')
    const uscita = g.add('PreviewAny', { source: r(gen, 0) })
    return { prompt: g.nodi, uscita, fasi: g.fasi, megapixel: 0, passi: q.maxToken || 400 }
  }

  if (q.modalita === 'ingrandisci') {
    const img = r(g.add('LoadImage', { image: ing.immagini[0].nome }, 'Carico la foto'))
    const f = q.fattore || 2
    const su = ingrandisciImg(g, imp, rtx, img, f)
    const W = Math.round(ing.immagini[0].larghezza * f)
    const H = Math.round(ing.immagini[0].altezza * f)
    const fin = r(g.add('ImageScale', { image: su, upscale_method: 'lanczos', width: W, height: H, crop: 'disabled' }, 'Rifinisco'))
    const uscita = salva(g, fin, prefisso)
    return { prompt: g.nodi, uscita, fasi: g.fasi, megapixel: 0, passi: 1 }
  }

  const { model, clip, vae } = base(g, q, imp)
  const fam = famigliaDi(q, imp)
  const leggo = 'Leggo il prompt e le foto'

  if (q.modalita === 'crea') {
    const testo = q.trasparente && fam === 'qwen' ? AVVOLGI_TRASPARENTE(q.prompt) : q.prompt
    // con dei riferimenti (<image1>…) il modello li guarda mentre disegna da zero: persone, vestiti, oggetti, stili
    const caricate = ing.immagini.slice(0, fam === 'qwen' ? 16 : 10).map((im) => r(g.add('LoadImage', { image: im.nome }, 'Carico i riferimenti')))
    const cond = condiziona(g, fam, { clip, vae }, { prompt: testo, neg, resolution: 1024, conVae: caricate.length > 0, immagini: caricate, mpRiferimenti: 1, scalaDa: 0, fase: leggo })
    const lat = latenteVuota(g, fam, q.larghezza, q.altezza)
    // il Turbo è stato allenato con la scaletta del rumore che dipende dalla grandezza (come nel suo workflow)
    const m = fam === 'qwen' && conTurbo(q, imp) && !modelloTurbo(imp.modello)
      ? r(g.add('ModelSamplingFlux', { model, max_shift: 0.6935, base_shift: 0.5, width: q.larghezza, height: q.altezza }))
      : model
    const ks = campiona(g, q, fam, m, cond, lat, q.passi)
    const mp = (q.larghezza * q.altezza) / 1048576
    const uscita = salva(g, allaMisura(g, q, imp, sviluppa(g, q, ks, vae, mp), q.larghezza, q.altezza, rtx), prefisso)
    return { prompt: g.nodi, uscita, fasi: g.fasi, megapixel: mp, passi: q.passi }
  }

  if (q.modalita === 'modifica') {
    // tutta la foto: image_1 è la foto, le altre sono riferimenti (<image2>…); il latente segue image_1
    const res = Math.round((Math.sqrt(q.megapixel) * 1024) / 32) * 32
    const d = dimensioniPer(q.megapixel, ing.immagini[0].larghezza, ing.immagini[0].altezza)
    const caricate = ing.immagini.slice(0, fam === 'qwen' ? 16 : 10).map((im) => r(g.add('LoadImage', { image: im.nome }, 'Carico le foto')))
    const cond = condiziona(g, fam, { clip, vae }, { prompt: q.prompt, neg, resolution: res, conVae: true, immagini: caricate, misuraPrima: d, fase: leggo })
    const lat = cond.lat ?? latenteVuota(g, fam, d.w, d.h)
    const ks = campiona(g, q, fam, model, cond, lat, q.passi)
    const mp = (d.w * d.h) / 1048576
    const uscita = salva(g, allaMisura(g, q, imp, sviluppa(g, q, ks, vae, mp), d.w, d.h, rtx), prefisso)
    const area = { x: 0, y: 0, w: ing.immagini[0].larghezza, h: ing.immagini[0].altezza }
    return { prompt: g.nodi, uscita, fasi: g.fasi, megapixel: mp, passi: q.passi, area }
  }

  if (q.modalita === 'varia' || q.modalita === 'rifinisci') {
    // img2img: la foto (ingrandita se serve) diventa il punto di partenza, il prompt la guida
    const im = ing.immagini[0]
    const f = q.modalita === 'rifinisci' ? q.fattore || 2 : 1
    let W = m32(im.larghezza * f)
    let H = m32(im.altezza * f)
    // oltre ~4.2 MP (il 2K nativo) su 8 GB non conviene
    const max = 2048 * 2048
    if (W * H > max) {
      const s = Math.sqrt(max / (W * H))
      W = m32(W * s)
      H = m32(H * s)
    }
    let img = r(g.add('LoadImage', { image: im.nome }, 'Carico la foto'))
    if (f > 1) {
      img = ingrandisciImg(g, imp, rtx, img, f)
    }
    img = r(g.add('ImageScale', { image: img, upscale_method: 'lanczos', width: W, height: H, crop: 'disabled' }))
    const testo = q.trasparente && fam === 'qwen' ? AVVOLGI_TRASPARENTE(q.prompt) : q.prompt
    const cond = condiziona(g, fam, { clip, vae }, { prompt: testo, neg, resolution: 1024, conVae: false, immagini: [], fase: leggo })
    const mp = (W * H) / 1048576
    const lat = codifica(g, img, vae, mp)
    const forza = q.forza ?? (q.modalita === 'rifinisci' ? 0.45 : 0.65)
    const passi = passiPer(q.passi, forza, minimo)
    const ks = campiona(g, q, fam, model, cond, lat, passi, forza)
    const uscita = salva(g, allaMisura(g, q, imp, sviluppa(g, q, ks, vae, mp), W, H, rtx), prefisso)
    return { prompt: g.nodi, uscita, fasi: g.fasi, megapixel: mp, passi }
  }

  // ---- zona ed espandi: si lavora su un riquadro, si ridisegna solo dentro la maschera,
  //      e alla fine si incolla sulla foto originale con il bordo sfumato (fuori resta identica al pixel)
  const im = ing.immagini[0]
  let W = im.larghezza
  let H = im.altezza
  let foto = r(g.add('LoadImage', { image: im.nome }, 'Carico la foto'))
  const originale = foto
  let maschera: Rif
  let zona = q.riquadro
  if (q.modalita === 'espandi') {
    const b = q.bordi || { sinistra: 0, sopra: 0, destra: 0, sotto: 0 }
    const pad = g.add('ImagePadForOutpaint', { image: foto, left: b.sinistra, top: b.sopra, right: b.destra, bottom: b.sotto, feathering: 0 }, 'Allargo la tela')
    foto = r(pad, 0)
    maschera = r(pad, 1)
    W += b.sinistra + b.destra
    H += b.sopra + b.sotto
    zona = undefined
  } else {
    if (!ing.maschera) throw new Error('manca la zona da modificare')
    maschera = r(g.add('LoadImageMask', { image: ing.maschera, channel: 'red' }, 'Carico la zona'))
  }
  const ritaglia = q.modalita === 'zona' ? q.ritaglia !== false : false
  const box = riquadroLavoro(W, H, zona, q.contesto ?? 0.8, q.megapixel, ritaglia)
  // bordi proporzionati alla zona (niente cursori da regolare): più grande la zona, più largo e morbido il bordo
  const lato0 = zona ? Math.min(zona.w, zona.h) : 0
  const allargaDef = q.modalita === 'espandi' ? 24 : Math.max(6, Math.min(28, Math.round(lato0 * 0.05)))
  const sfumaDef = q.modalita === 'espandi' ? 24 : Math.max(8, Math.min(24, Math.round(lato0 * 0.06)))
  const tutta = box.x === 0 && box.y === 0 && box.w === W && box.h === H
  const ritaglio = tutta ? foto : r(g.add('ImageCrop', { image: foto, width: box.w, height: box.h, x: box.x, y: box.y }))
  const mRit = tutta ? maschera : r(g.add('CropMask', { mask: maschera, x: box.x, y: box.y, width: box.w, height: box.h }))
  const grande = r(g.add('ImageScale', { image: ritaglio, upscale_method: 'lanczos', width: box.tw, height: box.th, crop: 'disabled' }))
  const mImg = r(g.add('MaskToImage', { mask: mRit }))
  const mGrandeImg = r(g.add('ImageScale', { image: mImg, upscale_method: 'bilinear', width: box.tw, height: box.th, crop: 'disabled' }))
  const mGrande = r(g.add('ImageToMask', { image: mGrandeImg, channel: 'red' }))
  const scala = box.tw / box.w
  const allarga = Math.round((q.allarga ?? allargaDef) * scala)
  // la zona "dura" (allargata): quella che si riempie, si ridisegna di sicuro e su cui si accordano i colori
  const mDura = allarga > 0 ? r(g.add('GrowMask', { mask: mGrande, expand: allarga, tapered_corners: true })) : mGrande
  // nel latente la maschera è morbida: con la DifferentialDiffusion il bordo si ridisegna solo negli ultimi
  // passi e si fonde con quello che c'è attorno, invece di fare uno scalino
  const morbido = Math.max(0, Math.min(31, Math.round((q.modalita === 'espandi' ? 16 : (q.sfuma ?? sfumaDef) * 0.6) * scala)))
  let mLatente = mDura
  if (morbido >= 2) {
    const a = r(g.add('MaskToImage', { mask: mDura }))
    const b = r(g.add('ImageBlur', { image: a, blur_radius: morbido, sigma: Math.min(10, Math.max(1, morbido / 2)) }))
    mLatente = r(g.add('ImageToMask', { image: b, channel: 'red' }))
  }

  // "rimuovi": la zona si riempie prima coi colori attorno, così il modello non vede più l'oggetto da togliere
  const riempi = q.modalita === 'zona' && (q.riempi ?? RIMUOVI.test(q.prompt))
  const sorgente = riempi ? r(g.add('DaProdRiempiZona', { image: grande, mask: mDura }, 'Riempio la zona')) : grande

  // cosa vede il modello: image_1 è il pezzo su cui si lavora (grande come il latente)
  let vista = sorgente
  let prompt = q.prompt
  // resolution 0: image_1 resta esattamente box.tw×box.th come il latente (se no la modifica si sposta)
  let risoluzione = 0
  if (q.modalita === 'espandi') {
    // Espandi: il modello vede la foto ORIGINALE (senza bande grigie, che altrimenti "conserva")
    // e l'istruzione di allargare l'inquadratura; il centro resta bloccato dalla maschera del latente
    const b = q.bordi || { sinistra: 0, sopra: 0, destra: 0, sotto: 0 }
    const oriz = b.sinistra > 0 || b.destra > 0
    const vert = b.sopra > 0 || b.sotto > 0
    const lato = (a: number, c: number, na: string, nc: string): string => (a > 0 && c > 0 ? `${na} and ${nc}` : a > 0 ? na : nc)
    const dove = oriz && vert ? 'on all sides' : oriz ? 'on the ' + lato(b.sinistra, b.destra, 'left', 'right') : lato(b.sopra, b.sotto, 'above', 'below')
    prompt = `Zoom out and extend <image1> into a wider frame: reveal more of the surroundings ${dove}, continuing the scene naturally with matching perspective, lighting and depth of field. Keep everything already visible exactly the same.${q.prompt.trim() ? ' ' + q.prompt.trim() : ''}`
    vista = originale
    risoluzione = Math.round((Math.sqrt(Math.min(q.megapixel, (im.larghezza * im.altezza) / 1048576)) * 1024) / 32) * 32
  }
  // i riferimenti li porto io a ~1 MP
  const riferimenti = ing.immagini.slice(1, 15)
  const fotoEncoder: Rif[] = [vista]
  riferimenti.forEach((ri) => {
    const caricata = r(g.add('LoadImage', { image: ri.nome }, 'Carico i riferimenti'))
    fotoEncoder.push(r(g.add('ImageScaleToTotalPixels', { image: caricata, upscale_method: 'lanczos', megapixels: Math.min(1, q.megapixel), resolution_steps: 32 })))
  })
  if (q.modalita === 'zona') {
    // Il modello guarda SEMPRE la foto intera: come ultima immagine riceve tutta la foto con la zona evidenziata in
    // rosso (velo trasparente + bordo pieno), così capisce il contesto e sa esattamente dove lavorare. Il latente
    // resta bloccato fuori dalla maschera: anche se sbagliasse, fuori dalla zona non cambia niente.
    const pd = dimensioniPer(Math.min(1, (W * H) / 1048576), W, H)
    let fotoP = r(g.add('ImageScale', { image: foto, upscale_method: 'lanczos', width: pd.w, height: pd.h, crop: 'disabled' }))
    const mP = r(g.add('ImageToMask', { image: r(g.add('ImageScale', { image: r(g.add('MaskToImage', { mask: maschera })), upscale_method: 'bilinear', width: pd.w, height: pd.h, crop: 'disabled' })), channel: 'red' }))
    if (riempi) fotoP = r(g.add('DaProdRiempiZona', { image: fotoP, mask: mP }))
    const velo = r(g.add('MaskComposite', { destination: mP, source: r(g.add('SolidMask', { value: 0.45, width: pd.w, height: pd.h })), x: 0, y: 0, operation: 'multiply' }))
    const fuori = r(g.add('GrowMask', { mask: mP, expand: Math.max(3, Math.round(Math.max(pd.w, pd.h) / 220)), tapered_corners: true }))
    const bordo = r(g.add('MaskComposite', { destination: fuori, source: mP, x: 0, y: 0, operation: 'subtract' }))
    const rosso = r(g.add('EmptyImage', { width: pd.w, height: pd.h, batch_size: 1, color: 0xff0000 }))
    const conVelo = r(g.add('ImageCompositeMasked', { destination: fotoP, source: rosso, x: 0, y: 0, resize_source: false, mask: velo }))
    const panoramica = r(g.add('ImageCompositeMasked', { destination: conVelo, source: rosso, x: 0, y: 0, resize_source: false, mask: bordo }, 'Guardo tutta la foto'))
    const n = riferimenti.length + 2
    fotoEncoder.push(panoramica)
    const dove = zona && !tutta ? doveNelRiquadro(zona, box) : null
    const istruzione = q.prompt.trim().replace(/[.\s]+$/, '')
    const nomeFoto = (k: number): string => (fam === 'qwen' ? `<image${k}>` : `the ${ORDINALI[k - 1] || 'last'} image`)
    prompt =
      `${istruzione}. Make this change only inside the area highlighted in red in ${nomeFoto(n)}, which shows the whole photo` +
      (tutta ? `; ${nomeFoto(1)} is that same photo.` : `; ${nomeFoto(1)} is a close-up of that part of the photo${dove ? `, with the area in ${dove}` : ''}.`) +
      ' Keep everything outside that area exactly the same, and do not add any red tint or outline.' +
      (riempi ? ` The smudged, blurry patch in ${nomeFoto(1)} is only a placeholder: redraw it sharp and natural, matching the perspective, lighting and texture of the surroundings.` : '')
  }
  const cond = condiziona(g, fam, { clip, vae }, { prompt, neg, resolution: risoluzione, conVae: true, immagini: fotoEncoder, misuraPrima: { w: box.tw, h: box.th }, fase: leggo })
  const mp = (box.tw * box.th) / 1048576
  const lat0 = codifica(g, sorgente, vae, mp)
  const lat = r(g.add('SetLatentNoiseMask', { samples: lat0, mask: mLatente }))
  const dd = r(g.add('DifferentialDiffusion', { model, strength: 1 }))
  const forza = q.forza ?? 1
  const passi = passiPer(q.passi, forza, minimo)
  const ks = campiona(g, q, fam, dd, cond, lat, passi, forza)
  // il doppio passaggio nel VAE sposta un filo i colori: si misurano appena fuori dalla zona e si rimettono a posto
  const fatto = r(g.add('DaProdAccordaColori', { image: sviluppa(g, { ...q, trasparente: false }, ks, vae, mp), reference: grande, mask: mDura, strength: 1 }))
  const indietro = r(g.add('ImageScale', { image: fatto, upscale_method: 'lanczos', width: box.w, height: box.h, crop: 'disabled' }, 'Incollo'))
  // bordo morbido alla grandezza originale
  const sfuma = Math.max(0, Math.min(31, Math.round(q.sfuma ?? sfumaDef)))
  const allargaOrig = Math.round(q.allarga ?? allargaDef)
  let mFin = mRit
  if (allargaOrig > 0) mFin = r(g.add('GrowMask', { mask: mFin, expand: Math.round(allargaOrig * 0.75), tapered_corners: true }))
  if (sfuma > 0) {
    const a = r(g.add('MaskToImage', { mask: mFin }))
    // ImageBlur accetta sigma fino a 10
    const b = r(g.add('ImageBlur', { image: a, blur_radius: sfuma, sigma: Math.min(10, Math.max(1, sfuma / 2)) }))
    mFin = r(g.add('ImageToMask', { image: b, channel: 'red' }))
  }
  const finale = r(g.add('ImageCompositeMasked', { destination: foto, source: indietro, x: box.x, y: box.y, resize_source: false, mask: mFin }))
  const uscita = salva(g, allaMisura(g, q, imp, finale, W, H, rtx), prefisso)
  // l'anteprima si posa sulla foto di partenza: per Espandi la tela comincia prima dei bordi
  const b0 = q.modalita === 'espandi' ? q.bordi || { sinistra: 0, sopra: 0, destra: 0, sotto: 0 } : { sinistra: 0, sopra: 0 }
  const area = { x: box.x - b0.sinistra, y: box.y - b0.sopra, w: box.w, h: box.h }
  return { prompt: g.nodi, uscita, fasi: g.fasi, megapixel: mp, passi, area }
}
