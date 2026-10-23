// Stampa le chiavi (raggruppate) dell'intestazione di un .safetensors. Uso: node scripts/chiavi_safetensors.mjs <file> [filtro-regex]
import { openSync, readSync, closeSync } from 'node:fs'
const [, , file, filtro] = process.argv
const fd = openSync(file, 'r')
const b8 = Buffer.alloc(8)
readSync(fd, b8, 0, 8, 0)
const n = Number(b8.readBigUInt64LE(0))
const b = Buffer.alloc(n)
readSync(fd, b, 0, n, 8)
closeSync(fd)
const h = JSON.parse(b.toString('utf8'))
const chiavi = Object.keys(h).filter((k) => k !== '__metadata__')
const re = filtro ? new RegExp(filtro) : null
const gruppi = new Map()
for (const k of chiavi) {
  if (re && !re.test(k)) continue
  const g = k.replace(/\.\d+\./g, '.N.').replace(/^(\w+)\.\d+/, '$1.N')
  gruppi.set(g, (gruppi.get(g) || 0) + 1)
}
console.log('tensori:', chiavi.length, 'meta:', JSON.stringify(h.__metadata__ || {}).slice(0, 300))
for (const [g, c] of [...gruppi].slice(0, 80)) console.log(String(c).padStart(5), g, JSON.stringify(h[chiavi.find((k) => k.replace(/\.\d+\./g, '.N.').replace(/^(\w+)\.\d+/, '$1.N') === g)]?.shape))
