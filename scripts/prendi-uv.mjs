// Scarica uv.exe (Astral) in resources/bin: l'app lo usa per installare Python e i pacchetti del motore.
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const VERSIONE = '0.12.19'
const dest = join('resources', 'bin')
const exe = join(dest, 'uv.exe')
if (existsSync(exe)) {
  console.log('uv.exe c\'è già')
  process.exit(0)
}
mkdirSync(dest, { recursive: true })
const url = `https://github.com/astral-sh/uv/releases/download/${VERSIONE}/uv-x86_64-pc-windows-msvc.zip`
console.log('scarico', url)
const r = await fetch(url)
if (!r.ok) throw new Error('download di uv non riuscito: ' + r.status)
const zip = join(dest, 'uv.zip')
await writeFile(zip, Buffer.from(await r.arrayBuffer()))
// il tar di Windows (bsdtar) apre gli zip; quello di Git Bash no
execFileSync(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', zip, '-C', dest])
rmSync(zip)
for (const f of ['uvx.exe', 'uvw.exe']) rmSync(join(dest, f), { force: true })
console.log('uv pronto:', execFileSync(exe, ['--version']).toString().trim())
