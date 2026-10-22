// Stampa il grafo dei nodi di un template ComfyUI (workflow JSON dell'interfaccia): tipo, valori dei widget, collegamenti. Uso: node scripts/leggi_template.mjs <file.json>
import { readFileSync } from 'node:fs'
const j = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const nodi = (j.nodes || j.definitions?.subgraphs?.[0]?.nodes || [])
const sub = j.definitions?.subgraphs || []
const stampa = (lista, pref = '') => {
  for (const n of lista) {
    console.log(`${pref}${n.id} ${n.type}${n.title ? ' «' + n.title + '»' : ''} ${JSON.stringify(n.widgets_values ?? '')}`)
  }
}
stampa(j.nodes || [])
for (const s of sub) {
  console.log('--- sottografo', s.name)
  stampa(s.nodes || [], '  ')
}
