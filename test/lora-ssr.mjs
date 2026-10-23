// Rendering React lato server: niente browser, mouse, tastiera o motore.
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { renderToStaticMarkup } = require('react-dom/server')
const React = require('react')
// Zustand usa altrimenti lo snapshot iniziale nel rendering lato server.
React.useSyncExternalStore = (_subscribe, getSnapshot) => getSnapshot()
globalThis.window = { daprod: {} }
globalThis.localStorage = { getItem: () => null, setItem() {} }
mkdirSync('test/.out', { recursive: true })
buildSync({ stdin: { contents: "export { Lora } from './src/renderer/src/pagine/Lora'; export { usaStato } from './src/renderer/src/stato'", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react-dom'], alias: { '@shared': resolve('src/shared') }, outfile: 'test/.out/lora-ssr.cjs' })
const { Lora, usaStato } = require('./.out/lora-ssr.cjs')
usaStato.setState({ lore: [{ file: 'test.safetensors', nome: 'Test Qwen', forza: 1, parole: '', dimensione: 1, compatibile: 'si', aggiunta: 0 }], loraAttive: [{ file: 'test.safetensors', forza: 0.5 }], loraPile: { qwen: [{ file: 'test.safetensors', forza: 0.5 }], flux: [] } })
usaStato.getInitialState = usaStato.getState
const html = renderToStaticMarkup(React.createElement(Lora))
assert.match(html, /Pila LoRA/, 'la pila ordinata è separata dalla libreria')
assert.match(html, /Sposta prima/)
assert.match(html, /Sposta dopo/)
assert.match(html, /Forza di Test Qwen/)
assert.match(html, /min="-2"/)
assert.match(html, /data-scheda-lora="qwen"/, 'due scaffali: Qwen e Flux')
assert.match(html, /data-scheda-lora="flux"/)
console.log('OK: gestore LoRA renderizzato con pila, ordine e pesi accessibili')
