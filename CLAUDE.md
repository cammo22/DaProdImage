# DaProd Image — leggi questo per primo

App desktop (Electron + React + TypeScript) per **Qwen-Image-2.1** in locale su una NVIDIA da 6-8 GB: crea, modifica
tutta la foto o solo una zona, espande, rifinisce, LoRA con un clic, galleria. Il motore è **ComfyUI senza la sua
interfaccia**, installato e guidato dall'app.

- **Si scrive in italiano parlato**: commenti, CHANGELOG, README, messaggi dell'interfaccia. Nomi tecnici in inglese dove serve.
- **Una versione = `version` in `package.json` + voce in `CHANGELOG.md`.** Unita su `main`, la CI (`.github/workflows/app.yml`)
  compila l'installer e pubblica da sola la release vX.Y.Z con `DaProd-Image-Setup-X.Y.Z.exe`, il `.blockmap` e `latest.yml`.
  Le app installate se ne accorgono (`src/main/aggiornamenti.ts`, electron-updater: all'avvio e ogni 6 ore), scaricano
  solo i pezzi cambiati e propongono **Riavvia e aggiorna** (prima si ferma il motore). `npm run dist` fa l'installer in locale.
- **Se cambia il motore** (commit di ComfyUI, pacchetti, i nostri nodi in `engine/`), si alza `motore` (e/o il commit) in
  `engine/versioni.json`: al primo avvio dopo l'aggiornamento l'app vede che il motore non è alla versione giusta e lo
  aggiorna da sola (pagina di setup in modo "aggiorna", `mantieniModello`: niente scelta del modello, niente download).
- **Prima di consegnare**: `npm run typecheck` e `npm run build`. Le prove con l'app vera: `node test/setup.mjs`
  (foto della pagina di installazione, `--installa` la fa davvero) e `node test/foto.mjs` (foto delle pagine in `test/.out/`).

## Il motore (src/main/installa, src/main/motore)
- **Versioni fissate** in `engine/versioni.json`: ComfyUI a un commit preciso (zip da codeload, estratto col `tar.exe`
  di Windows: il tar di Git non apre gli zip), Python 3.13 e PyTorch cu130 via **uv** (`resources/bin/uv.exe`,
  `npm run prendi-uv`). Tutto in `%LOCALAPPDATA%\DaProdImage\engine`; `stato.json` lì dentro dice quali passi sono fatti.
- **ComfyUI-GGUF è copiato in `engine/custom_nodes/ComfyUI-GGUF`** (fork di leejet al commit `373048b`, l'unico che
  conosce l'architettura `qwen_image21`) **con una correzione nostra** in `ops.py`: da ComfyUI 0.39 la Linear riceve
  `input_act`/`residual`, senza la correzione il KSampler si ferma. Vedi `DAPROD.md` lì dentro. Se si alza ComfyUI,
  si riprova una generazione vera prima di pubblicare.
- I modelli (catalogo con sha256 in `src/main/installa/catalogo.ts`) stanno in `%LOCALAPPDATA%\DaProdImage\models`
  (cartella cambiabile). Un GGUF già scaricato si porta dentro con un **collegamento fisso** (stesso disco, niente copia).
  VAE predefinito: **Texture-Fix** di madebyollin (trame più pulite). Le voci con `circa: true` (es. il Turbo, senza sha256
  pubblicato) contano come presenti se il file c'è, non per dimensione esatta.
- **DaProd-Nodi** (`engine/custom_nodes/DaProd-Nodi/__init__.py`, solo torch): `DaProdRiempiZona` (push-pull: riempie la
  zona coi colori attorno) e `DaProdAccordaColori` (toglie lo scarto di colore del VAE misurandolo in un anello fuori
  dalla zona). Si provano senza ComfyUI importando il file con un torch CPU qualsiasi.
- **Profilo memoria** (`impostazioni.memoria`, `profiloMemoria()`): auto dalla VRAM (`vramMB` ricordata da `system_stats`);
  `bassa` (< 7 GB) = VAE a tessere da 0,6 MP e `--reserve-vram 0.6`; `normale` = tessere oltre 2,2 MP; `alta` = mai.
- `processo.ts` lancia `main.py` con `--models-directory`, `--output-directory` ecc. sulla porta 8818 (o la prima libera)
  e lo chiude con `taskkill /T`. `cliente.ts`: HTTP + WebSocket; il `prompt_id` lo sceglie l'app, così i messaggi che
  arrivano prima della risposta non si perdono. Anteprime binarie tipo 1 e 4.
- `lavori.ts` è **la coda**: un lavoro alla volta al motore, fasi dai nodi (`fasi` del grafo), stima dai secondi per
  passo misurati (`impostazioni.tempi`), risultato spostato in galleria.

## I grafi (src/main/motore/grafi.ts)
- Pipeline ufficiale: `UnetLoaderGGUF` → LoRA (`LoraLoaderModelOnly`) → `QwenImage21Cache`; `CLIPLoader` tipo `qwen_image`
  (Qwen3-VL 8B); `TextEncodeQwenImage21`; KSampler **euler/simple, CFG 1, 40 passi** (quelli "standard").
- **Turbo** (`q.turbo`): il LoRA `imp.loraTurbo` (Turbo8 di chriswritescode, `turbo8_lora_step2500.safetensors`) a forza 1 prima
  degli altri, 8 passi, CFG 1, euler/simple; in Crea anche `ModelSamplingFlux` (max_shift 0.6935, base_shift 0.5, come il
  suo workflow). Con denoise < 1 bastano 4 passi (presi dalla fine della scaletta da 8). Non compare fra i LoRA da accendere.
- **Il VAE di Qwen 2.1 esce sempre RGBA** (alfa ~251-255 anche sulle foto piene): se non è trasparente si passa da
  `SplitImageWithAlpha` e si tiene l'RGB.
- **Zona**: riquadro attorno alla maschera (`riquadroLavoro`: contesto, minimo 384 px, zone piccole ingrandite fino a 4×
  per il dettaglio), `TextEncodeQwenImage21` con `resolution 0` (image_1 deve restare grande come il latente, se no la
  modifica si sposta), `VAEEncode` + `SetLatentNoiseMask` + `DifferentialDiffusion`, poi si rimpicciolisce e si incolla
  con `ImageCompositeMasked` e bordo sfumato: **fuori dalla zona la foto resta identica al pixel**.
  "Mostra la zona al modello" disegna un contorno rosso sull'image_1 (sperimentale).
  Nel latente la maschera è **morbida** (sfocata), con "Riempi prima" (`q.riempi`, acceso da "Rimuovi oggetto") l'image_1 e
  il latente partono dalla zona riempita, senza contorno rosso il prompt dice **dove** sta la zona (`doveNelRiquadro`),
  e dopo il VAE `DaProdAccordaColori` rimette i colori a posto. `GrafoPronto.area` dice dove posare l'anteprima.
- **Espandi**: `ImagePadForOutpaint` per la tela e la maschera, ma l'image_1 è la **foto originale** (senza bande
  grigie: il modello di modifica le "conserva") con l'istruzione "zoom out and extend"; il centro resta bloccato dalla
  maschera del latente. Provato anche il riempimento testo→immagine con descrizione automatica: giunture peggiori.
- Con denoise < 1 il KSampler farebbe comunque tutti i passi: `passiPer` ne usa `passi × forza`.
- **Descrivi** (Migliora prompt, Foto → prompt): `TextGenerate` con lo stesso Qwen3-VL già caricato, niente modelli in più.

## Interfaccia (src/renderer)
- Stato in `stato.ts` (zustand); le scelte di Crea/Modifica e i LoRA accesi restano in localStorage.
- Crea: **risoluzione = lato corto** (`RISOLUZIONI`, `dimensioniRis`: multipli di 16, al massimo 4,2 MP e 2688 px di lato);
  **preset** in `preset.ts` (campi in italiano → prompt in inglese, i testi da disegnare fra virgolette e identici).
- Modifica: durante un lavoro la tela resta montata e mostra l'anteprima **sulla foto** (`TelaMaschera.anteprima`: dentro
  la maschera con `mask-mode: luminance`, sotto la foto per Espandi).
- Le pagine Crea e Modifica **restano montate** (la maschera disegnata non si perde cambiando pagina): i tasti
  controllano `pagina` prima di agire.
- Le immagini si mostrano col protocollo `daprod://f/<percorso>` che serve **solo** le cartelle dell'app: le foto
  scelte da fuori passano da `file:portaDentro` (copia in temp) e `normalizza` (PNG pulito, rotazione EXIF applicata,
  max 24 MP) così maschera e motore combaciano al pixel.
- Le impostazioni di ogni immagine stanno **dentro il PNG** (chunk iTXt `daprod`, `src/main/png.ts`): la galleria si
  ricostruisce dai file e un PNG trascinato in Galleria torna con prompt, seed e LoRA.
- LoRA: dall'intestazione safetensors si capisce se sono per Qwen 2.1 (`transformer_blocks.N.attn.to_q`/`img_mlp`)
  o per altro (txt_mlp = Qwen 1.x, lora_unet = SD/SDXL, double_blocks = Flux). Link Hugging Face e Civitai.
