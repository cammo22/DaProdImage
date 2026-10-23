// Da quale id (stile, controllo, genere, modo, ricetta…) all'immagine di resources/gui: SOLO le chiavi, nessun import di file,
// così si prova in Node (test/asset.mjs). Una chiave è «gruppo/id» e corrisponde a resources/gui/<gruppo>/<id>.webp.
// Gli URL veri li dà asset.ts (Vite li mette nell'installer). Se una chiave non ha il file la tessera resta con l'icona di prima.

export type ChiaveAsset = string

/** i generi che hanno la tessera in Crea (nell'ordine della spec) */
export const GENERI_TESSERA = ['foto', 'ritratto', 'prodotto', 'poster', 'infografica', 'logo', 'social', 'miniatura', 'fumetto', 'invito', 'menu']

export const chiaveStile = (id: string): ChiaveAsset => `stili/${id}`
/** «libero» è il genere senza genere: ha la sua tessera */
export const chiaveGenere = (id: string): ChiaveAsset => `generi/${id || 'libero'}`

/** i controlli di Modifica che hanno la griglia con le anteprime → la cartella degli asset (le opzioni hanno lo stesso id del file) */
export const GRUPPO_CONTROLLO: Record<string, string> = {
  animale: 'animali', costume: 'costumi', luogo: 'luoghi', meteo: 'meteo', stagione: 'meteo', espressione: 'facce'
}
/** gli id delle opzioni che nel file si chiamano in un altro modo */
const NOME_FILE: Record<string, Record<string, string>> = { espressione: { ride: 'ridere' } }

export function chiaveOpzione(controllo: string, opzione: string): ChiaveAsset | undefined {
  const g = GRUPPO_CONTROLLO[controllo]
  return g ? `${g}/${NOME_FILE[controllo]?.[opzione] ?? opzione}` : undefined
}

/** le categorie di Modifica (rapide.ts) → tessera/<file> */
const CATEGORIA_FILE: Record<string, string> = {
  persone: 'persone', vestiti: 'vestiti', situazioni: 'situazioni', prospettiva: 'prospettiva', luce: 'luce-colore', stili: 'stili', testo: 'testi', ritocco: 'ritocco'
}
export const chiaveCategoria = (id: string): ChiaveAsset | undefined => (CATEGORIA_FILE[id] ? `tessera/${CATEGORIA_FILE[id]}` : undefined)
export const CATEGORIE_CON_ASSET = Object.keys(CATEGORIA_FILE)

/** i modi dello Studio (Crea, Modifica, Box, Ricette) */
export const chiaveModo = (id: string): ChiaveAsset => `modi/${id}`
/** i modi di Modifica: Espandi e Estrai hanno la tessera, «Scrivi» usa quella di Modifica */
export const chiaveModoModifica = (id: string): ChiaveAsset => (id === 'espandi' || id === 'estrai' ? `tessera/${id}` : 'modi/modifica')

/** le sei ricette: l'id del workflow è «r-foglio»; Unisci e Come l'esempio sono le due metà di Mix */
export const RICETTE_CON_ASSET = ['foglio', 'mondi', 'mix', 'set', 'formati', 'rinnova']
export function chiaveRicetta(idWorkflow: string): ChiaveAsset | undefined {
  const id = idWorkflow === 'unisci' || idWorkflow === 'esempio' ? 'mix' : idWorkflow.replace(/^r-/, '')
  return RICETTE_CON_ASSET.includes(id) ? `ricette/${id}` : undefined
}

/** la copertina generica di un LoRA senza anteprima: «Qwen» o «Klein» dalla famiglia; se serve a più famiglie o non si capisce → niente (resta la sigla colorata) */
export function chiaveLora(l: { famiglie?: string[]; compatibile?: string }): ChiaveAsset | undefined {
  const f = new Set((l.famiglie || []).map((x) => (x === 'qwen' ? 'qwen' : 'klein')))
  if (f.size === 1) return `lora/${[...f][0]}`
  return !f.size && l.compatibile === 'si' ? 'lora/qwen' : undefined
}

export const SFONDI = { nebulosa: 'sfondi/nebulosa', calda: 'sfondi/nebulosa-calda', stelle: 'sfondi/stelle', aurora: 'sfondi/aurora', eroe: 'sfondi/hero-pianeta', setup: 'sfondi/setup-pianeta' } as const
export const MASCOTTE = { vuoto: 'mascotte/fluttua', errore: 'mascotte/cartello', setup: 'mascotte/saluta' } as const
