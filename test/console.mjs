import { _electron as electron } from 'playwright'
const app = await electron.launch({ args: ['.'] })
app.process().stdout.on('data', (d) => process.stdout.write('[main] ' + d))
app.process().stderr.on('data', (d) => process.stdout.write('[main!] ' + d))
const win = await app.firstWindow()
win.on('console', (m) => console.log('[web]', m.type(), m.text()))
win.on('pageerror', (e) => console.log('[web err]', e.message))
await win.waitForTimeout(4000)
await app.close()
