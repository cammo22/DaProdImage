// Prova l'app impacchettata (dist/win-unpacked): parte, motore pronto, stato degli aggiornamenti.
import { _electron as electron } from 'playwright'
const app = await electron.launch({ executablePath: 'dist/win-unpacked/DaProd Image.exe' })
const win = await app.firstWindow()
win.on('pageerror', (e) => console.log('[errore pagina]', e.message))
for (let i = 0; i < 120 && !(await win.locator('.pillola.pronto').count()); i++) await win.waitForTimeout(1000)
console.log('motore:', await win.locator('.barra-titolo .pillola').first().innerText().catch(() => '?'))
await win.waitForTimeout(12000) // il primo controllo degli aggiornamenti parte dopo 8 s
await win.click('.rotaia button:has-text("Opzioni")')
await win.waitForTimeout(800)
await win.locator('h2:has-text("AGGIORNAMENTI")').scrollIntoViewIfNeeded()
console.log('aggiornamenti:', (await win.locator('.gruppo:has(h2:has-text("AGGIORNAMENTI"))').innerText()).replace(/\s+/g, ' ').slice(0, 300))
await win.screenshot({ path: 'test/.out/42-impacchettata-aggiornamenti.png' })
await app.close()
