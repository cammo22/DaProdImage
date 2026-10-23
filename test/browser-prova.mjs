// Harness locale: serve SOLO la build, su una porta libera, e chiude Chromium/server anche se una prova fallisce.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { chromium } from 'playwright'
export async function serverBuild() {
  const root = resolve('out/renderer')
  const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' }
  const server = createServer(async (req, res) => {
    try {
      const file = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname))
      if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return }
      const data = await readFile(file)
      res.writeHead(200, { 'Content-Type': tipi[extname(file)] || 'application/octet-stream' }).end(data)
    } catch { res.writeHead(404).end() }
  })
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
  return { url: `http://127.0.0.1:${server.address().port}/index.html`, close: () => new Promise((ok) => server.close(ok)) }
}
export async function provaBrowser(fn, init) {
  const server = await serverBuild()
  let browser
  try {
    browser = await chromium.launch()
    const pg = await browser.newPage({ viewport: { width: 1480, height: 1000 }, reducedMotion: 'reduce' })
    pg.setDefaultTimeout(8000)
    const errori = []
    pg.on('pageerror', (e) => errori.push(e.message))
    await pg.addInitScript(await readFile('test/finto.js', 'utf8'))
    if (init) await pg.addInitScript(init)
    await pg.goto(server.url)
    await pg.locator('.strip-modi').waitFor()
    await fn(pg)
    if (errori.length) throw Error('Errori pagina: ' + errori.join('\n'))
  } finally { await browser?.close(); await server.close() }
}
