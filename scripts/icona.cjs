// Disegna build/icon.png (512) e build/icon.ico (256…16, PNG dentro) da src/renderer/public/icona.svg.
// Uso: npx electron scripts/icona.cjs
const { app, BrowserWindow, nativeImage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'public', 'icona.svg'), 'utf8')
  const w = new BrowserWindow({ width: 512, height: 512, show: false, transparent: true, frame: false, webPreferences: { offscreen: true } })
  const html = `<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="512" height="512"></body></html>`
  await w.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'))
  await new Promise((r) => setTimeout(r, 500))
  const img = await w.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 })
  const base = img.resize({ width: 512, height: 512, quality: 'best' })
  const dir = path.join(__dirname, '..', 'build')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'icon.png'), base.toPNG())
  const lati = [256, 128, 64, 48, 32, 16]
  const pngs = lati.map((l) => base.resize({ width: l, height: l, quality: 'best' }).toPNG())
  const testa = Buffer.alloc(6)
  testa.writeUInt16LE(0, 0); testa.writeUInt16LE(1, 2); testa.writeUInt16LE(lati.length, 4)
  const voci = []
  let off = 6 + 16 * lati.length
  lati.forEach((l, i) => {
    const v = Buffer.alloc(16)
    v.writeUInt8(l >= 256 ? 0 : l, 0); v.writeUInt8(l >= 256 ? 0 : l, 1)
    v.writeUInt16LE(1, 4); v.writeUInt16LE(32, 6)
    v.writeUInt32LE(pngs[i].length, 8); v.writeUInt32LE(off, 12)
    off += pngs[i].length
    voci.push(v)
  })
  fs.writeFileSync(path.join(dir, 'icon.ico'), Buffer.concat([testa, ...voci, ...pngs]))
  console.log('icone pronte')
  app.quit()
})
