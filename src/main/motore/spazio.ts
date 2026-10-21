// Che cosa occupa la scheda video, per la regola "una cosa alla volta in VRAM" (`fattiSpazio` in lavori.ts).
// File puro (niente Electron): lo prova `node test/spazio.mjs`.
import type { Famiglia } from '../../shared/tipi'

/** il modello che un lavoro tiene in VRAM:
 *  - `immagine:<famiglia>`: il denoiser di Qwen, di Klein veloce o di Klein Base (sono tre file diversi da 5-6 GB l'uno);
 *  - `testo:4b` / `testo:8b`: l'LLM che scrive (il Qwen3-VL 4B di Klein o l'8B di Qwen);
 *  - `cpu`: il traduttore dedicato, che sta sul processore;
 *  - `leggero`: l'ingranditore (pochi MB): non chiede spazio e non cambia quello che c'è. */
export type Occupa = 'immagine:qwen' | 'immagine:klein' | 'immagine:klein-base' | 'testo:4b' | 'testo:8b' | 'cpu' | 'leggero'

/** la chiave di un lavoro che disegna */
export const occupaImmagine = (fam: Famiglia): Occupa => (fam === 'klein' ? 'immagine:klein' : fam === 'klein-base' ? 'immagine:klein-base' : 'immagine:qwen')

/** la chiave di un lavoro che scrive: col 4B di Klein (`encoderKlein`) o con l'8B di Qwen */
export const occupaTesto = (encoderKlein?: boolean): Occupa => (encoderKlein ? 'testo:4b' : 'testo:8b')

/** chi scrive nei lavori di testo (`descrivi`): il 4B di Klein o l'encoder di Qwen.
 *  Con Klein scrive il 4B (salvo `encoderKlein: false` nella richiesta); con Qwen solo se l'impostazione `testoCon4B` è accesa (di serie è spenta).
 *  `c'è4B` = il file del 4B è sul disco: se no si resta con l'encoder della famiglia. */
export function scriveCol4B(modalita: string, fam: Famiglia, encoderKlein: boolean | undefined, testoCon4B: boolean, ce4B: boolean): boolean {
  if (modalita !== 'descrivi' || encoderKlein === false || !ce4B) return false
  return fam !== 'qwen' || testoCon4B
}

/** se fra il lavoro di prima e questo bisogna liberare la scheda (`/free`), e la chiave da ricordare dopo.
 *  Si libera ogni volta che cambia il modello grosso: da Qwen a Klein, da Klein a Klein Base, dal disegno all'LLM, dal 4B all'8B.
 *  Il traduttore e l'ingranditore non contano: non liberano niente e lasciano ricordato il modello di prima. */
export function cambioDiModello(prima: Occupa | null, ora: Occupa): { libera: boolean; ricorda: Occupa | null } {
  if (ora === 'cpu' || ora === 'leggero') return { libera: false, ricorda: prima }
  return { libera: prima !== null && prima !== ora, ricorda: ora }
}

/** che cosa dice la fase mentre si libera la scheda (il modello che esce) */
export function faseScarico(prima: Occupa | null): string {
  switch (prima) {
    case 'immagine:qwen':
      return 'Scarico Qwen-Image'
    case 'immagine:klein':
      return 'Scarico FLUX 3 Klein'
    case 'immagine:klein-base':
      return 'Scarico FLUX 3 Klein Base'
    case 'testo:4b':
    case 'testo:8b':
      return 'Scarico l\'LLM'
    default:
      return 'Libero la scheda video'
  }
}
