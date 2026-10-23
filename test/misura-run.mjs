// Esegue UN comando esplicito e registra tempo reale, esito e log, anche quando fallisce.
// Esempio: node test/misura-run.mjs node test/controlli.mjs
import { spawn } from 'node:child_process'
import { mkdirSync, appendFileSync, createWriteStream } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { resolve } from 'node:path'
const args = process.argv.slice(2)
if (!args.length) throw new Error('Indica il comando da misurare')
const vietati = ['foto', 'setup', 'modifica', 'console', 'vetrina', 'impacchettata']
if (args.some((x) => vietati.some((n) => x.replaceAll('\\', '/').endsWith(`test/${n}.mjs`)))) throw new Error('Test Electron con dati reali vietato: usa avvio-isolato.mjs')
const dir = resolve('test/.out/verifiche')
mkdirSync(dir, { recursive: true })
const inizio = new Date().toISOString()
const nome = inizio.replaceAll(/[:.]/g, '-') + '-' + args.join('-').replaceAll(/[^a-zA-Z0-9_-]/g, '_')
const log = resolve(dir, nome + '.log')
const stream = createWriteStream(log)
const prima = performance.now()
// npm.cmd è uno script di Windows: il solo wrapper npm usa cmd; gli argomenti sono limitati ai task noti.
const npm = args[0] === 'npm'
if (npm && !['run typecheck', 'run build', 'test', 'run test:gui'].includes(args.slice(1).join(' '))) throw new Error('Task npm non ammesso')
const child = spawn(npm && process.platform === 'win32' ? 'cmd.exe' : args[0], npm && process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd', ...args.slice(1)] : args.slice(1), { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
for (const s of [child.stdout, child.stderr]) s.on('data', (b) => { stream.write(b); process.stdout.write(b) })
child.on('error', (e) => stream.write(e.stack + '\n'))
child.on('close', (code, signal) => {
  const voce = { comando: args.join(' '), inizio, fine: new Date().toISOString(), wall_s: Number(((performance.now() - prima) / 1000).toFixed(3)), exit_code: code, signal, log }
  appendFileSync(resolve(dir, 'durate.jsonl'), JSON.stringify(voce) + '\n')
  stream.end()
  console.log('\nMISURA ' + JSON.stringify(voce))
  process.exitCode = code ?? 1
})
