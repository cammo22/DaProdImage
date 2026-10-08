// Da una Richiesta al grafo di ComfyUI (formato API). Ogni modalità usa gli stessi pezzi:
//   modello GGUF → (Turbo) → LoRA → cache KV di Qwen-Image 2.1 · text encoder Qwen3-VL · VAE
// e i parametri della pipeline ufficiale (euler/simple, cfg 1, 40 passi; 8 col Turbo).
import type { Impostazioni, Richiesta, Riquadro } from '@shared/tipi'

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
const conTurbo = (q: Richiesta, imp: Impostazioni): boolean => !!q.turbo && !!imp.loraTurbo

function base(g: Grafo, q: Richiesta, imp: Impostazioni): { model: Rif; clip: Rif; vae: Rif } {
  const carico = 'Carico il modello'
  const unet = imp.modello.toLowerCase().endsWith('.gguf')
    ? g.add('UnetLoaderGGUF', { unet_name: imp.modello }, carico)
    : g.add('UNETLoader', { unet_name: imp.modello, weight_dtype: 'default' }, carico)
  let model = r(unet)
  const turbo = conTurbo(q, imp)
  if (turbo) model = r(g.add('LoraLoaderModelOnly', { model, lora_name: imp.loraTurbo, strength_model: 1 }, 'Accendo il Turbo'))
  for (const l of q.lora) {
    if (!l.file || !l.forza || (turbo && l.file === imp.loraTurbo)) continue
    model = r(g.add('LoraLoaderModelOnly', { model, lora_name: l.file, strength_model: l.forza }, 'Applico i LoRA'))
  }
  model = r(g.add('QwenImage21Cache', { model, device: imp.cacheKV, dtype: imp.cacheTipo }))
  const clip = r(g.add('CLIPLoader', { clip_name: imp.encoder, type: 'qwen_image', device: imp.encoderSuCpu ? 'cpu' : 'default' }, 'Carico il text encoder'))
  const vae = r(g.add('VAELoader', { vae_name: imp.vae }, 'Carico il VAE'))
  return { model, clip, vae }
}

function campiona(g: Grafo, q: Richiesta, model: Rif, enc: string, latente: Rif, passi: number, denoise = 1): Rif {
  return r(
    g.add(
      'KSampler',
      {
        model,
        seed: q.seed,
        steps: passi,
        cfg: q.cfg,
        sampler_name: q.sampler,
        scheduler: q.scheduler,
        positive: r(enc, 0),
        negative: r(enc, 1),
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

export function costruisci(q: Richiesta, imp: Impostazioni, ing: Ingressi, prefisso: string, memoria: Memoria = 'normale'): GrafoPronto {
  const g = new Grafo(memoria)
  const neg = q.negativo || ''
  const minimo = conTurbo(q, imp) ? 4 : 8

  if (q.modalita === 'descrivi') {
    const clip = r(g.add('CLIPLoader', { clip_name: imp.encoder, type: 'qwen_image', device: imp.encoderSuCpu ? 'cpu' : 'default' }, 'Carico il text encoder'))
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
    if (ing.immagini[0]) inputs.image = r(g.add('LoadImage', { image: ing.immagini[0].nome }, 'Guardo la foto'))
    const gen = g.add('TextGenerate', inputs, 'Scrivo')
    const uscita = g.add('PreviewAny', { source: r(gen, 0) })
    return { prompt: g.nodi, uscita, fasi: g.fasi, megapixel: 0, passi: q.maxToken || 400 }
  }

  if (q.modalita === 'ingrandisci') {
    const img = r(g.add('LoadImage', { image: ing.immagini[0].nome }, 'Carico la foto'))
    const um = r(g.add('UpscaleModelLoader', { model_name: imp.upscaler }, 'Carico l\'ingranditore'))
    const su = r(g.add('ImageUpscaleWithModel', { upscale_model: um, image: img }, 'Ingrandisco'))
    const f = q.fattore || 2
    const W = Math.round(ing.immagini[0].larghezza * f)
    const H = Math.round(ing.immagini[0].altezza * f)
    const fin = r(g.add('ImageScale', { image: su, upscale_method: 'lanczos', width: W, height: H, crop: 'disabled' }, 'Rifinisco'))
    const uscita = salva(g, fin, prefisso)
    return { prompt: g.nodi, uscita, fasi: g.fasi, megapixel: 0, passi: 1 }
  }

  const { model, clip, vae } = base(g, q, imp)
  const leggo = 'Leggo il prompt e le foto'

  if (q.modalita === 'crea') {
    const testo = q.trasparente ? AVVOLGI_TRASPARENTE(q.prompt) : q.prompt
    const enc = g.add('TextEncodeQwenImage21', { clip, prompt: testo, negative_prompt: neg, resolution: 1024 }, leggo)
    const lat = r(g.add('EmptyLatentImage', { width: q.larghezza, height: q.altezza, batch_size: 1 }))
    // il Turbo è stato allenato con la scaletta del rumore che dipende dalla grandezza (come nel suo workflow)
    const m = conTurbo(q, imp)
      ? r(g.add('ModelSamplingFlux', { model, max_shift: 0.6935, base_shift: 0.5, width: q.larghezza, height: q.altezza }))
      : model
    const ks = campiona(g, q, m, enc, lat, q.passi)
    const mp = (q.larghezza * q.altezza) / 1048576
    const uscita = salva(g, sviluppa(g, q, ks, vae, mp), prefisso)
    return { prompt: g.nodi, uscita, fasi: g.fasi, megapixel: mp, passi: q.passi }
  }

  if (q.modalita === 'modifica') {
    // tutta la foto: image_1 è la foto, le altre sono riferimenti (<image2>…); il latente segue image_1
    const res = Math.round((Math.sqrt(q.megapixel) * 1024) / 32) * 32
    const inputs: Record<string, unknown> = { clip, prompt: q.prompt, negative_prompt: neg, resolution: res, vae }
    ing.immagini.slice(0, 16).forEach((im, i) => {
      inputs[`images.image_${i + 1}`] = r(g.add('LoadImage', { image: im.nome }, 'Carico le foto'))
    })
    const enc = g.add('TextEncodeQwenImage21', inputs, leggo)
    const ks = campiona(g, q, model, enc, r(enc, 2), q.passi)
    const d = dimensioniPer(q.megapixel, ing.immagini[0].larghezza, ing.immagini[0].altezza)
    const mp = (d.w * d.h) / 1048576
    const uscita = salva(g, sviluppa(g, q, ks, vae, mp), prefisso)
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
      const um = r(g.add('UpscaleModelLoader', { model_name: imp.upscaler }, 'Carico l\'ingranditore'))
      img = r(g.add('ImageUpscaleWithModel', { upscale_model: um, image: img }, 'Ingrandisco'))
    }
    img = r(g.add('ImageScale', { image: img, upscale_method: 'lanczos', width: W, height: H, crop: 'disabled' }))
    const testo = q.trasparente ? AVVOLGI_TRASPARENTE(q.prompt) : q.prompt
    const enc = g.add('TextEncodeQwenImage21', { clip, prompt: testo, negative_prompt: neg, resolution: 1024 }, leggo)
    const mp = (W * H) / 1048576
    const lat = codifica(g, img, vae, mp)
    const forza = q.forza ?? (q.modalita === 'rifinisci' ? 0.45 : 0.65)
    const passi = passiPer(q.passi, forza, minimo)
    const ks = campiona(g, q, model, enc, lat, passi, forza)
    const uscita = salva(g, sviluppa(g, q, ks, vae, mp), prefisso)
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
  const inputs: Record<string, unknown> = { clip, prompt, negative_prompt: neg, resolution: risoluzione, vae, 'images.image_1': vista }
  const riferimenti = ing.immagini.slice(1, 15)
  riferimenti.forEach((ri, i) => {
    const caricata = r(g.add('LoadImage', { image: ri.nome }, 'Carico i riferimenti'))
    inputs[`images.image_${i + 2}`] = r(g.add('ImageScaleToTotalPixels', { image: caricata, upscale_method: 'lanczos', megapixels: Math.min(1, q.megapixel), resolution_steps: 32 }))
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
    inputs[`images.image_${n}`] = panoramica
    const dove = zona && !tutta ? doveNelRiquadro(zona, box) : null
    const istruzione = q.prompt.trim().replace(/[.\s]+$/, '')
    inputs.prompt =
      `${istruzione}. Make this change only inside the area highlighted in red in <image${n}>, which shows the whole photo` +
      (tutta ? '; <image1> is that same photo.' : `; <image1> is a close-up of that part of the photo${dove ? `, with the area in ${dove}` : ''}.`) +
      ' Keep everything outside that area exactly the same, and do not add any red tint or outline.' +
      (riempi ? ' The smudged, blurry patch in <image1> is only a placeholder: redraw it sharp and natural, matching the perspective, lighting and texture of the surroundings.' : '')
  }
  const enc = g.add('TextEncodeQwenImage21', inputs, leggo)
  const mp = (box.tw * box.th) / 1048576
  const lat0 = codifica(g, sorgente, vae, mp)
  const lat = r(g.add('SetLatentNoiseMask', { samples: lat0, mask: mLatente }))
  const dd = r(g.add('DifferentialDiffusion', { model, strength: 1 }))
  const forza = q.forza ?? 1
  const passi = passiPer(q.passi, forza, minimo)
  const ks = campiona(g, q, dd, enc, lat, passi, forza)
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
  const uscita = salva(g, finale, prefisso)
  // l'anteprima si posa sulla foto di partenza: per Espandi la tela comincia prima dei bordi
  const b0 = q.modalita === 'espandi' ? q.bordi || { sinistra: 0, sopra: 0, destra: 0, sotto: 0 } : { sinistra: 0, sopra: 0 }
  const area = { x: box.x - b0.sinistra, y: box.y - b0.sopra, w: box.w, h: box.h }
  return { prompt: g.nodi, uscita, fasi: g.fasi, megapixel: mp, passi, area }
}
