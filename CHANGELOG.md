# Changelog

## 0.2.0 — 2026-10-07

Più veloce, anche su 6 GB, e molto più da fare.

- **Turbo: 8 passi invece di 40** (circa 5 volte più veloce) col LoRA di distillazione Turbo8 per Qwen-Image 2.1:
  si sceglie da **Qualità** in Crea e Modifica e si scarica con un clic la prima volta (~1,4 GB). Vale anche per
  Rifinisci e Varia; per testo → immagine usa la scaletta del rumore con cui è stato allenato.
- **Profilo della scheda video** (Opzioni): Auto, **6 GB**, 8-12 GB, 16 GB+. Con poca VRAM il VAE lavora **a tessere**
  e il motore tiene un margine fisso, così niente picchi che finiscono nella RAM condivisa di Windows. Accelerazione
  fp16 (`--fast`) facoltativa.
- **Ti avvisa se va troppo piano** (molti secondi per passo) e spiega come sistemare il fallback della memoria NVIDIA,
  la causa più comune delle immagini da 10 minuti.
- **Risoluzioni da 256p al massimo**: 256p, 384p, 480p, 576p, 720p, 1K, 1080p, 1440p e MAX (4,2 MP, il 2K nativo),
  per tutti i formati (nuovi **4:5** e **5:4**). In Modifica anche aree di lavoro da 0,25 e 0,5 MP.
- **Preset a sinistra in Crea**: Foto, Ritratto, Prodotto, **Poster**, **Infografica**, **Logo** (trasparente),
  Post social, Miniatura YouTube, Copertina, Invito, Menù, **Fumetto**, Sticker, App/sito, Slide, Arte. Ognuno mette
  formato e risoluzione giusti, ha qualche campo da riempire in italiano e i suoi stili; il prompt si scrive da solo
  e si ritocca a mano. I testi da disegnare restano identici, accenti compresi.
- **Modifica di una zona: la vedi nascere al suo posto**. L'anteprima dal vivo si posa sulla foto, solo dentro la
  zona segnata (in Espandi la cornice si riempie attorno alla foto), con il riquadro di lavoro evidenziato.
- **Inpainting rifatto per bene**: maschera morbida nel latente (il bordo si fonde invece di fare uno scalino),
  **Riempi prima la zona** per rimuovere (il modello non vede più l'oggetto e non lo ridisegna), il modello sa **dove**
  sta la zona ("cambia il suo colore" ora sa di cosa parli), e i colori si **accordano** con la foto attorno
  (niente macchia dopo l'incollaggio). Nodi nuovi in `engine/custom_nodes/DaProd-Nodi`: il motore si aggiorna da solo.
- Azioni rapide sul testo: **Cambia testo**, **Traduci testo**, **Togli scritte**, **Scrivi testo** in una zona.

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
