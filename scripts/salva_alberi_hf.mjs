// Salva gli alberi dei repo Hugging Face usati dal catalogo (solo percorso e dimensione) in test/campioni-hf/, per provare `scegli` senza rete.
// Uso: node scripts/salva_alberi_hf.mjs        (rete)
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const QUI = dirname(fileURLToPath(import.meta.url))
const { CATALOGO } = await import(pathToFileURL(join(QUI, '..', 'src', 'main', 'installa', 'catalogo.ts')).href)
const dest = join(QUI, '..', 'test', 'campioni-hf')
mkdirSync(dest, { recursive: true })
const visti = new Set()
for (const v of CATALOGO) {
  if (!v.repo) continue
  const chiave = `${v.repo}@${v.revisione || 'main'}`
  if (visti.has(chiave)) continue
  visti.add(chiave)
  const r = await fetch(`https://huggingface.co/api/models/${v.repo}/tree/${v.revisione || 'main'}?recursive=true`)
  if (!r.ok) {
    console.log('NO', chiave, r.status)
    continue
  }
  const albero = (await r.json()).filter((f) => f.type === 'file').map((f) => ({ type: 'file', path: f.path, size: f.size, lfs: f.lfs ? { size: f.lfs.size } : undefined }))
  writeFileSync(join(dest, v.repo.replace('/', '__') + '.json'), JSON.stringify({ repo: v.repo, revisione: v.revisione || 'main', file: albero }, null, 1))
  console.log('ok', chiave, albero.length, 'file')
}
