// Come chiavi_safetensors.mjs ma da un URL (Range): legge solo l'intestazione. Uso: node scripts/chiavi_safetensors_url.mjs <url>
const url = process.argv[2]
const r8 = await fetch(url, { headers: { Range: 'bytes=0-7' }, redirect: 'follow' })
const n = Number(Buffer.from(await r8.arrayBuffer()).readBigUInt64LE(0))
const r = await fetch(url, { headers: { Range: `bytes=8-${8 + n - 1}` }, redirect: 'follow' })
const h = JSON.parse(Buffer.from(await r.arrayBuffer()).toString('utf8'))
const chiavi = Object.keys(h).filter((k) => k !== '__metadata__')
const gruppi = new Map()
for (const k of chiavi) {
  const g = k.replace(/\.\d+\./g, '.N.').replace(/^(\w+)\.\d+/, '$1.N')
  if (!gruppi.has(g)) gruppi.set(g, { c: 0, forma: JSON.stringify(h[k].shape), dtype: h[k].dtype })
  gruppi.get(g).c++
}
console.log('tensori:', chiavi.length, JSON.stringify(h.__metadata__ || {}).slice(0, 200))
for (const [g, v] of [...gruppi].slice(0, 60)) console.log(String(v.c).padStart(5), g, v.forma, v.dtype)
