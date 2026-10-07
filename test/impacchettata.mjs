// Prova l'app impacchettata (dist/win-unpacked): parte, trova il motore installato, motore pronto, foto.
import { _electron as electron } from 'playwright'
const app = await electron.launch({ executablePath: 'dist/win-unpacked/DaProd Image.exe' })
const win = await app.firstWindow()
win.on('pageerror', (e) => console.log('[errore pagina]', e.message))
for (let i = 0; i < 120 && !(await win.locator('.pillola.pronto').count()); i++) await win.waitForTimeout(1000)
console.log('motore:', await win.locator('.barra-titolo .pillola').innerText().catch(() => '?'))
await win.screenshot({ path: 'test/.out/40-impacchettata.png' })
await win.click('.rotaia button:has-text("LoRA")')
await win.waitForTimeout(1200)
await win.screenshot({ path: 'test/.out/41-impacchettata-lora.png' })
await app.close()
