// Verifica del gate Uncensored senza avviare browser o scaricare modelli.
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
globalThis.window = { daprod: {} }
globalThis.localStorage = { getItem: () => null, setItem() {} }
mkdirSync('test/.out', { recursive: true })
buildSync({ stdin: { contents: "export { LaboratorioUncensored } from './src/renderer/src/componenti/LaboratorioUncensored'; export { Impostazioni } from './src/renderer/src/pagine/Impostazioni'; export { usaStato } from './src/renderer/src/stato'", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react-dom'], alias: { '@shared': resolve('src/shared') }, outfile: 'test/.out/uncensored-ssr.cjs' })
const { LaboratorioUncensored, Impostazioni, usaStato } = require('./.out/uncensored-ssr.cjs')
const voce = { id: 'fixture', nome: 'Componente di prova', tipo: 'encoder', uncensored: true, licenza: 'Qwen Research', byte: 1, presente: false }
const props = { imp: {}, catalogo: [voce], download: {}, salva: async () => {}, scarica: async () => { throw Error('mai scaricare nel rendering') } }
const render = imp => renderToStaticMarkup(React.createElement(LaboratorioUncensored, { ...props, imp }))
assert.doesNotMatch(render({}), /Componente di prova/, 'catalogo nascosto di serie')
assert.doesNotMatch(render({ uncensored: true }), /Componente di prova/, 'flag senza consenso insufficiente')
assert.doesNotMatch(render({ uncensored: true, uncensoredAccettato: false }), /Componente di prova/, 'consenso obsoleto insufficiente')
const acceso = render({ uncensored: true, uncensoredAccettato: true })
assert.match(acceso, /Componente di prova/)
assert.match(acceso, /Uncensored/)
assert.match(acceso, /Qwen Research/)
assert.match(acceso, /Scarica/)
React.useSyncExternalStore = (_subscribe, getSnapshot) => getSnapshot()
usaStato.setState({ imp: { modello: '', encoder: '', vae: '', kleinModello: '', kleinBase: '', kleinEncoder: '', kleinVae: '', famiglia: 'qwen', predefiniti: { passi: 40, cfg: 1, megapixel: 1 } } })
const pagina = renderToStaticMarkup(React.createElement(Impostazioni))
assert.match(pagina, /LABORATORIO UNCENSORED/, 'laboratorio raggiungibile dalla pagina Impostazioni')
console.log('OK: laboratorio Uncensored, gate, licenza e integrazione nella pagina')
