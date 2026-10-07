# Changelog

## 0.1.0 — 2026-10-07

La prima versione.

- **Installazione guidata**: controllo del PC, trova da sola il GGUF già scaricato e lo usa senza copiarlo,
  installa il motore (ComfyUI 0.39 + PyTorch CUDA con uv) e scarica i modelli che mancano, con sha256 e ripresa.
- **Crea**: testo → immagine con Qwen-Image 2.1 (40 passi standard, euler, CFG 1), formati da 1:1 a 21:9, fino al
  2K nativo, sfondo trasparente, più immagini in coda. **Migliora** prompt e **Da foto** con Qwen3-VL (lo stesso già caricato).
- **Bozza veloce → Rifinisci**: esplori a 20 passi e metà pixel, poi porti in alta qualità solo quella che ti piace.
- **Modifica**: tutta la foto (azioni rapide, fino a 9 riferimenti), **solo una zona** (pennello, gomma, rettangolo,
  lazo; ritaglio con più dettaglio e incollaggio sfumato: fuori dalla zona niente cambia), **Espandi**; versioni e prima/dopo.
- **Galleria** con ricerca, preferite, visore, Riusa, Varia, Rifinisci 2K, Ingrandisci 2×/4× (4x-UltraSharp);
  le impostazioni stanno dentro ogni PNG.
- **LoRA con un clic**: trascina i file o incolla un link Hugging Face/Civitai, forza, parole chiave, controllo di compatibilità.
- **VAE Texture-Fix** come predefinito (trame più pulite) e LoRA "Detail Fix" fra i consigliati.
- Coda con anteprima dal vivo, fasi e tempo stimato (misurato sulla tua scheda).
- **Aggiornamenti automatici** dalle release di GitHub (Opzioni → Aggiornamenti, o il tasto in alto quando è pronto);
  se una versione nuova cambia il motore, l'app lo aggiorna da sola al primo avvio.
