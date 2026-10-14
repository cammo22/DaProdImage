// Gli album: ogni album è una cartella in DATI/album/<id> con album.json (il progetto), le foto (JPEG grande per la
// stampa e una miniatura per lavorare svelti). Le foto entrano da qualsiasi formato (anche RAW): la conversione la fa
// l'interfaccia, qui si salva, si leggono le date di scatto e si scrive il PDF.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DATI, TEMP, assicura } from './percorsi'
import { SOLO_WIC, pngConWic } from './converti'
import { dataFoto } from './exif'
import { scriviPdf, type PaginaPdf } from './pdf'

const ALBUM = join(DATI, 'album')

export interface RiassuntoAlbum {
  id: string
  nome: string
  aggiornato: number
  spread: number
  foto: number
  copertina?: string
}

const cartella = (id: string): string => join(ALBUM, id.replace(/[^\w-]/g, ''))

export function elencoAlbum(): RiassuntoAlbum[] {
  assicura(ALBUM)
  const out: RiassuntoAlbum[] = []
  for (const id of readdirSync(ALBUM)) {
    try {
      const a = JSON.parse(readFileSync(join(ALBUM, id, 'album.json'), 'utf8'))
      out.push({ id: a.id, nome: a.nome, aggiornato: a.aggiornato, spread: a.spreads?.length || 0, foto: a.foto?.length || 0, copertina: a.foto?.[0]?.mini })
    } catch {
      /* una cartella senza progetto */
    }
  }
  return out.sort((x, y) => y.aggiornato - x.aggiornato)
}

export function caricaAlbum(id: string): unknown {
  try {
    return JSON.parse(readFileSync(join(cartella(id), 'album.json'), 'utf8'))
  } catch {
    return null
  }
}

export function salvaAlbum(a: { id: string }): void {
  const c = cartella(a.id)
  assicura(c)
  // si scrive in un file a parte e poi lo si rinomina: un'interruzione non rovina il progetto
  const tmp = join(c, 'album.json.tmp')
  writeFileSync(tmp, JSON.stringify(a))
  copyFileSync(tmp, join(c, 'album.json'))
  rmSync(tmp, { force: true })
}

export function eliminaAlbum(id: string): void {
  rmSync(cartella(id), { recursive: true, force: true })
}

/** una foto da fuori → qualcosa che l'interfaccia sa aprire (RAW, HEIC, TIFF: PNG con WIC, a 6500 px al massimo) + la data di scatto */
export async function preparaFoto(percorso: string): Promise<{ percorso: string; nome: string; data: number }> {
  assicura(TEMP)
  const data = dataFoto(percorso)
  const nome = basename(percorso).replace(/\.[^.]+$/, '')
  if (SOLO_WIC.test(percorso)) return { percorso: (await pngConWic(percorso, 6500)).percorso, nome, data }
  const dest = join(TEMP, `${randomUUID().slice(0, 8)}-${basename(percorso).replace(/[^\w.-]+/g, '_')}`)
  copyFileSync(percorso, dest)
  return { percorso: dest, nome, data }
}

function dataUrlInFile(dataUrl: string, dest: string): void {
  const m = /^data:image\/\w+;base64,(.*)$/.exec(dataUrl)
  if (!m) throw new Error('immagine non valida')
  writeFileSync(dest, Buffer.from(m[1], 'base64'))
}

/** salva una foto dell'album: la grande (per la stampa) e la miniatura */
export function salvaFotoAlbum(idAlbum: string, idFoto: string, grande: string, mini: string): { grande: string; mini: string } {
  const c = join(cartella(idAlbum), 'foto')
  assicura(c)
  const id = idFoto.replace(/[^\w-]/g, '')
  const g = join(c, `${id}.jpg`)
  const m = join(c, `${id}.mini.jpg`)
  dataUrlInFile(grande, g)
  dataUrlInFile(mini, m)
  return { grande: g, mini: m }
}

/** un'immagine esportata (una pagina o un doppia pagina) */
export function salvaEsportata(cartellaDest: string, nome: string, dataUrl: string): string {
  mkdirSync(cartellaDest, { recursive: true })
  const dest = join(cartellaDest, nome.replace(/[\\/:*?"<>|]+/g, '_'))
  dataUrlInFile(dataUrl, dest)
  return dest
}

export function creaPdf(dest: string, pagine: PaginaPdf[]): string {
  scriviPdf(dest, pagine)
  return dest
}

export const dimensioneFile = (p: string): number => {
  try {
    return statSync(p).size
  } catch {
    return 0
  }
}
export const esiste = existsSync
