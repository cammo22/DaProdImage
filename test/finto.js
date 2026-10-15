// finto window.daprod per vedere l'interfaccia nel browser senza motore (lo carica test/interfaccia.mjs). testo.scrivi risponde con un elenco di riquadri (e ricorda l'ultima richiesta in window.__testo)
(() => {
  const mappa = (window.__mappa = {})
  const disegna = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); return c.toDataURL('image/png') }
  const foto = disegna(1200, 800, (g, w, h) => {
    const cielo = g.createLinearGradient(0, 0, 0, h * 0.6); cielo.addColorStop(0, '#3b6fb6'); cielo.addColorStop(1, '#f2b880'); g.fillStyle = cielo; g.fillRect(0, 0, w, h)
    g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(860, 300, 70, 0, 7); g.fill()
    g.fillStyle = '#2f5d3a'; g.fillRect(0, h * 0.62, w, h); g.fillStyle = '#7a4b2a'; g.fillRect(380, 360, 220, 200); g.fillStyle = '#b33'; g.beginPath(); g.moveTo(360, 365); g.lineTo(490, 270); g.lineTo(620, 365); g.fill()
  })
  const prev = disegna(320, 320, (g, w, h) => { const r = g.createRadialGradient(160, 160, 10, 160, 160, 200); r.addColorStop(0, '#ff3df2'); r.addColorStop(1, '#4cc9ff'); g.fillStyle = r; g.fillRect(0, 0, w, h); g.fillStyle = '#fff8'; g.font = 'bold 40px sans-serif'; g.fillText('ANTEPRIMA', 40, 170) })
  mappa['/foto.png'] = foto
  const tinte = ['#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#8a2cff', '#ff3df2', '#4cc9ff']
  const opere = [[1024, 1536], [1536, 1024], [1024, 1024], [1820, 1024], [1024, 1280], [768, 1365], [1024, 1024], [2048, 878], [1536, 1024], [1024, 1536]].map(([w, h], i) => {
    const f = '/g' + i + '.png'
    mappa[f] = disegna(Math.round(w / 8), Math.round(h / 8), (g, W, H) => { g.fillStyle = tinte[i % 7]; g.fillRect(0, 0, W, H); g.fillStyle = '#fff6'; g.beginPath(); g.arc(W / 2, H / 2, Math.min(W, H) / 3, 0, 7); g.fill() })
    return { id: 'o' + i, file: f, miniatura: f, larghezza: w, altezza: h, creata: Date.now() - i * 3e6 - (i > 6 ? 864e5 : 0), durata: 30, modalita: i % 3 ? 'crea' : 'zona', prompt: 'prova ' + i, negativo: '', seed: i, passi: 8, cfg: 1, sampler: 'euler', scheduler: 'simple', lora: [], modello: 'q', preferita: i === 2, etichetta: i === 4 ? 'Bozza' : undefined, promptInglese: i === 1 ? 'a test in english' : undefined }
  })
  const traduci = (u) => { if (typeof u !== 'string' || !u.startsWith('daprod://f/')) return u; const p = decodeURIComponent(u.slice(11).split('?')[0]); return mappa[p] || foto }
  const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
  Object.defineProperty(HTMLImageElement.prototype, 'src', { set(v) { d.set.call(this, traduci(v)) }, get() { return d.get.call(this) } })
  const sa = Element.prototype.setAttribute
  Element.prototype.setAttribute = function (n, v) { if (n === 'src') v = traduci(v); return sa.call(this, n, v) }
  new MutationObserver((ms) => { for (const m of ms) for (const el of [m.target, ...(m.addedNodes || [])]) { if (!(el instanceof HTMLElement)) continue; for (const e of [el, ...el.querySelectorAll('[style*="daprod"]')]) { const mi = e.style.maskImage; if (mi && mi.includes('daprod://')) e.style.maskImage = mi.replace(/daprod:\/\/f\/[^")]+/, (x) => traduci(x)) } } })
    .observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] })

  const asc = {}
  const su = new Proxy({}, { get: (_, k) => (f) => { (asc[k] ||= []).push(f); return () => {} } })
  const emetti = (k, ...a) => (asc[k] || []).forEach((f) => f(...a))
  const imp = { cartellaModelli: 'C:\\m', cartellaGalleria: 'C:\\g', modello: 'qwen-image-2.1-UC-Q4_K_M.gguf', encoder: 'qwen3vl_8b_int8_convrot.safetensors', vae: 'texture_fix.safetensors', upscaler: '4x-UltraSharp.pth', porta: 8818, cacheKV: 'auto', cacheTipo: 'default', encoderSuCpu: false, anteprimaLive: true, riservaVram: 0, argomentiExtra: '', predefiniti: { passi: 40, cfg: 1, sampler: 'euler', scheduler: 'simple', megapixel: 1 }, installato: true, tokenCivitai: '', tokenHF: '', tempi: { '1.00': 3.1 }, loraTurbo: 'turbo8_lora_step2500.safetensors', memoria: 'auto', vramMB: 6144, veloce: false }
  let n = 0
  const v = (x) => async () => x
  window.daprod = {
    impostazioni: { leggi: v(imp), salva: async (m) => Object.assign(imp, m) },
    sistema: { controllo: v({}) },
    setup: { cerca: v([]), stato: v({ installato: true, motore: true, modelli: [] }), avvia: v(true), annulla: v() },
    modelli: { stato: v([]), file: v({ diffusione: [imp.modello], encoder: [imp.encoder], vae: [imp.vae], upscaler: [imp.upscaler] }), scarica: v({ stato: 'errore', errore: 'finto' }), annulla: v() },
    motore: { info: v({ stato: 'pronto', porta: 8818, vramTotale: 6442450944, vramLibera: 1500000000, gpu: 'NVIDIA GeForce RTX 3060 Laptop GPU', versione: '0.39.0' }), avvia: v(), riavvia: v(), ferma: v(), log: v(['motore pronto']), libera: v(), apriComfy: v() },
    lavori: {
      elenco: v([]), annulla: v(), svuota: v(), pulisci: v(),
      accoda: async (q) => {
        const id = 'l' + ++n
        window.__ultima = q
        window.__ultimoId = id
        const l = { id, richiesta: q, stato: 'in corso', indice: 1, fase: 'Disegno', passo: 5, passiTotali: 8, creato: Date.now(), inizio: Date.now(), stima: 21, risultati: [], megapixel: 1, secondiPasso: 2.6 }
        if (q.modalita === 'zona') l.areaAnteprima = { x: q.riquadro.x - 120, y: q.riquadro.y - 120, w: q.riquadro.w + 240, h: q.riquadro.h + 240 }
        if (q.modalita === 'espandi') l.areaAnteprima = { x: -q.bordi.sinistra, y: -q.bordi.sopra, w: 1200 + q.bordi.sinistra + q.bordi.destra, h: 800 + q.bordi.sopra + q.bordi.sotto }
        setTimeout(() => emetti('lavoro', { ...l, anteprima: prev }), 150)
        return [id]
      }
    },
    testo: { scrivi: async (q) => { window.__testo = q; return JSON.stringify([{bbox_2d:[300,380,640,880],label:'red-roofed brown wooden hut',kind:'object'},{bbox_2d:[780,180,940,340],label:'bright yellow sun',kind:'object'},{bbox_2d:[40,500,260,990],label:'woman in a green jacket, standing',kind:'person'}]) } },
    galleria: { elenco: v(opere), opera: async (id) => opere.find((o) => o.id === id), importaFoto: v({}), preferita: v(), elimina: v(), mostra: v(), apriCartella: v(), copia: v(), esporta: v(), importa: v({ importate: [], altre: [] }), meta: v(null) },
    lora: { elenco: v([]), aggiorna: v(), importa: v([]), elimina: v(), scarica: v({}), apriCartella: v() },
    file: {
      scegliImmagini: v(['/foto.png']), scegli: v(null), scegliCartella: v(null),
      salvaTemp: async (dataUrl) => { const p = '/tmp/t' + ++n + '.png'; mappa[p] = dataUrl; return p },
      info: v(null), portaDentro: async (ps) => ps, inPng: v({ percorso: '/foto.png', larghezza: 1200, altezza: 800 }), percorso: () => '/foto.png'
    },
    app: { apriLink: v(), versione: v('0.2.0'), apriCartella: v() },
    aggiornamento: { stato: v({ stato: 'aggiornato', attuale: '0.2.0' }), controlla: v({ stato: 'aggiornato', attuale: '0.2.0' }), installa: v() },
    trascina: () => {},
    su
  }
  setInterval(() => emetti('risorse', { ramTotale: 34359738368, ramLibera: 9e9 + Math.random() * 1e9, vramTotale: 8589934592, vramUsata: 7.1e9, gpu: 'NVIDIA GeForce RTX 4060', gpuUso: 96, gpuTemp: 71 }), 500)
  window.__emetti = emetti
})()
