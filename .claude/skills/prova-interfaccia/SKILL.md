---
name: prova-interfaccia
description: Guarda l'interfaccia di DaProd Image senza Electron né motore (Chromium con un finto window.daprod), fa screenshot e stampa le richieste che l'app manderebbe al motore. Da usare dopo ogni modifica a pagine e componenti.
---

# Provare l'interfaccia senza motore

Nel container non ci sono la GPU né ComfyUI, ma l'interfaccia (`src/renderer`) gira in Chromium con un **finto `window.daprod`**
(`test/finto.js`: foto finte, un lavoro che "avanza", `testo.scrivi` che risponde con riquadri di prova).

```bash
npm run build                                              # compila renderer, main e preload in out/
python3 -m http.server 8765 --directory out/renderer &     # serve la build (se non sta già girando)
node test/interfaccia.mjs                                  # foto in test/.out/ + prompt e dimensioni delle richieste
```

- `test/interfaccia.mjs` apre Modifica → Estrai, sceglie un oggetto e una persona (con l'omino) e stampa `larghezza × altezza` e il
  `prompt` dell'ultima richiesta (`window.__ultima` è la richiesta accodata, `window.__emetti('lavoro', …)` fa finire un lavoro).
- Per provare un'altra pagina copia il file e cambia i passaggi: i selettori sono quelli dell'interfaccia (`.rotaia button:has-text("Crea")`,
  `.segmenti button:has-text("…")`, `.colonna.destra textarea`).
- Per una funzione pura (es. `src/renderer/src/omino.ts`, `riquadri.ts`) basta `npx esbuild file.ts --bundle --format=iife` e una
  pagina HTML col canvas; si guarda lo screenshot con Playwright (Chromium è in `PLAYWRIGHT_BROWSERS_PATH`, non scaricare niente).
- Le prove con l'app vera e il motore (Windows) sono `node test/setup.mjs` e `node test/foto.mjs`: non girano qui.

Non si può provare qui: la qualità delle immagini che il modello disegna. Di quella dillo chiaro nel messaggio finale.
