// Sceglie il file giusto fra quelli di un repo Hugging Face con le espressioni del catalogo (in ordine di preferenza).
// File puro (niente Electron): lo prova `node test/catalogo.mjs` con gli alberi veri dei repo.
export interface VoceHF {
  type: string
  path: string
  size?: number
  lfs?: { oid?: string; size?: number }
}

export const tronco = (p: string): string => p.split('/').pop() || p

export function scegli(files: VoceHF[], cerca: string[], escludiMmproj: boolean, ext = /\.gguf$/i): VoceHF | undefined {
  const candidati = files.filter((f) => ext.test(f.path) && (/mmproj/i.test(f.path) ? !escludiMmproj : escludiMmproj))
  for (const re of cerca) {
    const r = new RegExp(re, 'i')
    // si prova col nome del file e poi col percorso intero (alcuni repo mettono il tipo nella cartella: int8/…)
    const trovato = candidati.find((f) => r.test(tronco(f.path))) || candidati.find((f) => r.test(f.path))
    if (trovato) return trovato
  }
  return undefined
}

/** i tipi di voce i cui pesi sono .safetensors/.bin (gli altri, denoiser e encoder GGUF, sono .gguf) */
export const TIPI_SAFETENSORS = new Set<string>(['traduttore', 'klein', 'klein-te', 'klein-vae', 'sfondo', 'segmentatore', 'llm'])
