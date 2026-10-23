// Gli URL degli asset della GUI v2 (resources/gui/**/*.webp). Vite li importa come URL: finiscono in out/renderer/assets e quindi
// nell'installer (electron-builder impacchetta out/**) senza extraResources né protocolli. I più piccoli di 4 kB diventano data: URI (CSP: img-src data:).
// La chiave è «gruppo/id» (anteprime.ts). Chi non c'è → undefined: la tessera ripiega sull'icona di prima, senza errori.
// Fuori da Vite (i test che compilano i componenti con esbuild per il rendering lato server) `import.meta.glob` non esiste: l'elenco resta vuoto.
let FILE: Record<string, string> = {}
try {
  FILE = import.meta.glob('../../../resources/gui/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
} catch {
  /* senza Vite: nessun asset, le tessere restano con le icone */
}

const URLS: Record<string, string> = {}
for (const [percorso, url] of Object.entries(FILE)) {
  const m = /resources\/gui\/(.+)\.webp$/.exec(percorso)
  if (m) URLS[m[1]] = url
}

export const urlAsset = (chiave: string | undefined): string | undefined => (chiave ? URLS[chiave] : undefined)
export const elencoAsset = (): string[] => Object.keys(URLS)
