# DaProd Image — leggi questo per primo

App desktop (Electron + React + TypeScript) per **Qwen-Image-2.1** (e **FLUX 3 Klein**) in locale su una NVIDIA da 6-8 GB: crea, modifica
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
  (foto della pagina di installazione, `--installa` la fa davvero) e `node test/foto.mjs` (foto delle pagine in `test/.out/`). Senza Electron né motore (qui nel container): `node test/interfaccia.mjs` (Chromium + finto `window.daprod` in `test/finto.js`), vedi `.claude/skills/prova-interfaccia`.
  Per preparare una versione c'è la skill `.claude/skills/rilascio`.

## Il motore (src/main/installa, src/main/motore)
- **Versioni fissate** in `engine/versioni.json` (ora **ComfyUI 0.41.2**, motore 7): ComfyUI a un commit preciso (zip da codeload, estratto col `tar.exe`
  di Windows: il tar di Git non apre gli zip), Python 3.13 e PyTorch cu130 via **uv** (`resources/bin/uv.exe`,
  `npm run prendi-uv`). Tutto in `%LOCALAPPDATA%\DaProdImage\engine`; `stato.json` lì dentro dice quali passi sono fatti.
- **ComfyUI-GGUF è copiato in `engine/custom_nodes/ComfyUI-GGUF`** (fork di leejet al commit `373048b`, l'unico che
  conosce l'architettura `qwen_image21`) **con una correzione nostra** in `ops.py` (più `comfy_force_forward = True` per 0.41): da ComfyUI 0.39 la Linear riceve
  `input_act`/`residual`, senza la correzione il KSampler si ferma. Vedi `DAPROD.md` lì dentro. Se si alza ComfyUI,
  si riprova una generazione vera prima di pubblicare.
- I modelli (catalogo con sha256 in `src/main/installa/catalogo.ts`) stanno in `%LOCALAPPDATA%\DaProdImage\models`
  (cartella cambiabile). Un GGUF già scaricato si porta dentro con un **collegamento fisso** (stesso disco, niente copia).
  VAE predefinito: **Texture-Fix** di madebyollin (trame più pulite). Le voci con `circa: true` (es. il Turbo, senza sha256
  pubblicato) contano come presenti se il file c'è, non per dimensione esatta.
- **DaProd-Nodi** (`engine/custom_nodes/DaProd-Nodi/__init__.py`, solo torch): `DaProdRiempiZona` (push-pull: riempie la
  zona coi colori attorno) e `DaProdAccordaColori` (toglie lo scarto di colore del VAE misurandolo in un anello fuori
  dalla zona). Si provano senza ComfyUI importando il file con un torch CPU qualsiasi.
- **Anteprime**: `--preview-method taesd` col decoder `taeqi2_1_decoder.pth` (madebyollin/taesd, voce `tae` del catalogo,
  in `models/vae_approx`): nitide a ogni passo. "auto" in ComfyUI vuol dire latent2rgb, a 1/16 della risoluzione.
- **Profilo memoria** (`impostazioni.memoria`, `profiloMemoria()`): auto dalla VRAM (`vramMB` ricordata da `system_stats`);
  `bassa` (< 7 GB) = VAE a tessere da 0,6 MP e `--reserve-vram 0.6`; `normale` = tessere oltre 2,2 MP; `alta` = mai.
- `processo.ts` lancia `main.py` con `--models-directory`, `--output-directory` ecc. sulla porta 8818 (o la prima libera)
  e lo chiude con `taskkill /T`. `cliente.ts`: HTTP + WebSocket; il `prompt_id` lo sceglie l'app, così i messaggi che
  arrivano prima della risposta non si perdono. Anteprime binarie tipo 1 e 4.
- **Traduzione** (`motore/traduci.ts`, `impostazioni.traduci` e `impostazioni.traduttore`): se il prompt sembra italiano
  (`daTradurre`, parole chiave) lo porta in inglese, prima del disegno, il **traduttore dedicato** Opus-MT it→en
  (`models/translate/opus-mt-it-en`, voce `trad-it-en` con `repo` + `accanto`: pesi e tokenizer; si scarica da solo al primo
  uso in `lavori.ts`) col nodo `DaProdTraduci` (`engine/custom_nodes/DaProd-Nodi/traduzione.py`, transformers sul processore,
  una frase alla volta; testi fra virgolette e `<imageN>` passano intatti). Con `traduttore: 'llm'`, o se il download fallisce,
  si usa un `TextGenerate` con lo stesso Qwen3-VL. In cache per prompt. Il grafo riceve l'inglese, in galleria resta il prompt
  originale più `promptInglese`.
- `lavori.ts` è **la coda**: un lavoro alla volta al motore, fasi dai nodi (`fasi` del grafo), stima dai secondi per
  passo misurati (`impostazioni.tempi`), risultato spostato in galleria.

## FLUX 3 Klein (famiglie di modelli)
- `Famiglia = 'qwen' | 'klein' | 'klein-base'` (`shared/tipi.ts`, `FAMIGLIE` = passi per qualità), `Richiesta.famiglia`, `impostazioni.famiglia`.
  Il selettore è `componenti/ScegliModello.tsx` (3 schede, "da scaricare", download di modello + `klein-te` + `klein-vae`), la qualità `ScegliQualita.tsx`.
- Catalogo: `klein-int8/bf16`, `klein-base-int8/bf16`, `klein-te` (Qwen3-VL 4B), `klein-vae` dal repo `black-forest-labs/flux-3-image-klein-comfy`
  (`repo` + `cerca` regex, risolti a runtime da `installa/risolvi.ts`: **i nomi vengono dai template ufficiali, vanno confermati con i file veri**).
  `motore/klein.ts` (`fileKlein`) trova i file (impostazioni → `risolti.json` → scansione cartelle, int8 prima di bf16) o dà un errore in italiano.
- Grafo (`grafi.ts`, `condiziona`/`latenteVuota`/`campiona`): `UNETLoader` + `CLIPLoader` tipo `flux3` + `VAELoader`, `CLIPTextEncode`, foto di riferimento
  `VAEEncode` → `ReferenceLatent` (positivo e negativo, in catena), `EmptyFlux2LatentImage`, KSampler euler/simple (distillato cfg 1, base cfg 3,5).
  Niente LoRA, Turbo, cache KV; i tag `<imageN>` diventano ordinali. **I grafi Qwen non devono cambiare**: si controlla con un confronto sul grafo vecchio prima di ogni modifica.
- `motore/pup.ts` = i prompt upsampler ufficiali; `lavori.ts` `potenzia()` li manda al Qwen3-VL prima del disegno (`impostazioni.potenziaKlein`, cache per prompt).
- Non provato con la GPU qui: qualità, INT8 su 6-8 GB, `ReferenceLatent` in catena (alternativa `ReferenceMultiLatent`).

## I grafi (src/main/motore/grafi.ts)
- Pipeline ufficiale: `UnetLoaderGGUF` → LoRA (`LoraLoaderModelOnly`) → `QwenImage21Cache`; `CLIPLoader` tipo `qwen_image`
  (Qwen3-VL 8B); `TextEncodeQwenImage21`; KSampler **euler/simple, CFG 1, 40 passi** (quelli "standard").
- **Modelli (solo Q4/Q6/Q8)**: `catalogo.ts` ha il denoiser UC (abenzerps, sha256 noti) e il **Turbo di AtomicChat**
  (`turbo-q4/q6/q8`, `repo` + `cerca`: il nome del file lo chiede `installa/risolvi.ts` all'API di Hugging Face al primo
  download e lo ricorda in `risolti.json`, con lo sha256 dal `lfs.oid`). Un modello con "turbo" nel nome (`modelloTurbo`)
  è già distillato: 8 passi, niente LoRA Turbo8 né `ModelSamplingFlux`. Gli **encoder GGUF** (AtomicChat, mradermacher)
  usano `CLIPLoaderGGUF` (senza `device`) e vogliono nella stessa cartella un `.gguf` con "mmproj" e il nome dell'encoder
  senza quantizzazione: `risolvi.ts` lo scarica con quel nome. L'encoder di default resta il safetensors int8 (provato).
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
  Il modello vede **sempre la foto intera**: l'ultima immagine è tutta la foto (≤ 1 MP) con la zona evidenziata in rosso
  (velo al 45% + bordo pieno) e il prompt dice di cambiare solo lì (e dove sta nel ritaglio, `doveNelRiquadro`).
  Nessuna impostazione nell'interfaccia: contesto 0,8, bordo e sfumatura proporzionati alla zona, riempimento
  automatico se l'istruzione dice di togliere (`RIMUOVI`). Maschera **morbida** nel latente, `DaProdAccordaColori`
  dopo il VAE. `GrafoPronto.area` dice dove posare l'anteprima.
- **Espandi**: `ImagePadForOutpaint` per la tela e la maschera, ma l'image_1 è la **foto originale** (senza bande
  grigie: il modello di modifica le "conserva") con l'istruzione "zoom out and extend"; il centro resta bloccato dalla
  maschera del latente. Provato anche il riempimento testo→immagine con descrizione automatica: giunture peggiori.
- Con denoise < 1 il KSampler farebbe comunque tutti i passi: `passiPer` ne usa `passi × forza`.
- **Descrivi** (Migliora prompt, Foto → prompt): `TextGenerate` con lo stesso Qwen3-VL già caricato, niente modelli in più.

## Interfaccia (src/renderer)
- **Modifica** ha 6 modi: tutta la foto, zona, espandi, **Fusion**, **Esempio** e **Estrai** (vedi sotto) (`componenti/Fusion.tsx`, richieste in `fusion.ts`: nessuna base, `m.riferimenti` sono le foto;
  Fusion = `modalita: 'crea'` con `images.image_N`, Esempio = `modalita: 'modifica'` con l'esempio come `image_1`; i risultati stanno nel
  componente, non diventano versioni; il confronto prima/dopo usa sempre `versioni[0]`);
  `★ base` scambia base e riferimento. **Dimensioni** (`componenti/Misura.tsx`, `Richiesta.uscita`): auto / come l'originale / misura
  tua; `allaMisura()` in `grafi.ts` porta il risultato alla misura esatta (ingranditore se serve > 1,5×, taglio al centro). **Laboratorio** (`workflow.ts` = esecuzione, `ricetteBase.ts` = le ricette di serie, `ricette.ts` = le tue e i preset in localStorage,
  `EditorRicetta.tsx`, viste in `LabVista.tsx`) accoda catene di lavori, anche su più foto (`avviaLotto`); ogni ricetta ha il passo
  `SORPRESA` (il prompt lo inventa il Qwen3-VL in `inventaPrompt`) e di partenza non c'è niente di segnato (`OpzioniRun.fai`); la **barra di stato** (`BarraStato`, clic = apre la coda) mostra il lavoro in corso; la **coda** (`Coda.tsx`) è un menu a tessere con anteprime;
  nel Laboratorio si segnano i passi da fare (`OpzioniRun.escludi`); **Camera** e azioni rapide (`rapide.ts`) accendono i LoRA.
- **Ingranditore**: `impostazioni.upscalerRtx` → nodo `RTXVideoSuperResolution` (Comfy-Org/Nvidia_RTX_Nodes_ComfyUI al commit di
  `versioni.json`, pacchetto `nvidia-vfx`, installati dal passo 4b di `installatore.ts` in modo facoltativo); le chiavi del nodo si leggono da
  `object_info` (`chiaviRtx` in `cliente.ts`) e `ingrandisciImg()` in `grafi.ts` ripiega su 4x-UltraSharp. DLSS 5 (`ComfyUI-DLSS5-NR`) è
  una cosa diversa (rendering neurale, interfaccia NVIDIA non documentata, serve una DLL tua): non c'è.
- **LoRA e parole chiave**: `accodaRichiesta` (`motore/lavori.ts`, `conParoleLora`) aggiunge al prompt la parola chiave di ogni LoRA acceso nella richiesta,
  qualunque pagina la mandi (il `conParoleLora` del renderer fa la stessa cosa, non raddoppia). **Esempio** (`fusion.ts`): `pianificaEsempio` fa un foglio con l'esempio (image 1) e i riferimenti numerati e lo dà al Qwen3-VL (`descrivi`, `SISTEMA_PIANO`), che scrive l'istruzione di modifica decidendo da solo cosa sostituire con cosa (niente regole per persone o altro); il piano sta in `pianoEsempio` (con `chiaveEsempio`: foto + nota), si corregge nell'interfaccia, e `richiestaEsempio` lo manda come prompt con l'esempio come `image_1`. **Galleria**: tasto destro
  (`MenuContestuale`), `galleria:elimina` con `definitivo`, `galleria:copia` con più id = file negli appunti con PowerShell `Set-Clipboard`. **Laboratorio**:
  un `Ingresso` di tipo `camera` mostra il comando Camera (valore JSON, `leggiCamera`) e le ricette aggiungono il passo `VISTA_TUA`.
- **Una cosa alla volta in VRAM** (`lavori.ts`, `fattiSpazio` + `cliente.scaricaModelli`, `impostazioni.unaCosaAllaVolta`): ogni lavoro è `immagine`, `testo` (LLM) o `cpu` (traduttore); quando cambia
  si manda `/free` e si aspetta che `torch_vram_total` scenda (il motore scarica a coda ferma: senza l'attesa lo farebbe dopo il lavoro successivo). **Token/s**: il TextGenerate manda un `progress` per token,
  `lavori.ts` ne ricava `Lavoro.tokSec` (media dal primo messaggio) e `BarraStato` lo mostra.
- **Casella** (`componenti/Casella.tsx`): la textarea dei prompt (cresce col testo, cestino); il tasto destro nei campi di testo è nel main (`index.ts`, evento `context-menu`).
  **Risoluzioni**: `Misura.tsx` ha `dimMp()` (le stesse misure del motore), `ScegliMp` (megapixel con i pixel sotto) e `Uscita` (la riga «La foto esce a…»).
- **Omino** (`omino.ts` puro + `componenti/Omino.tsx`, `ominoImmagine.ts`): scheletro di 15 giunti in un riquadro 280×300 (`Dx`/`Sx` sono della persona: la destra sta a sinistra dello schermo);
  `trascina()` ruota l'osso attorno al genitore (lunghezze fisse, si porta dietro i discendenti; il bacino sposta tutto); mani = 5 dita con piegamento 0–1 + divaricazione + polso
  (`geometriaMano`); `Posa.viso` (gira/su/inclina) è la testa; `disegnaManichino()` fa la guida di posa (manichino grigio pieno su fondo chiaro: niente linee da copiare) e `descriviPosa()` la posa in inglese. In **Estrai** posa `omino` (manichino come `<image1>`, ritaglio come `<image2>`); nel **Laboratorio** un `Ingresso` di tipo `posa` (JSON) e il passo `POSA_TUA` con `PassoWf.posa`: `richiestaPasso` (async) mette lo scheletro ultima immagine e sostituisce `{posa}` con il suo `<imageN>`.
  `pulisciOmino.ts`: `controllaScheletro(lavoroId…)` — a lavoro finito il Qwen3-VL risponde YES/NO se resta lo scheletro, e se sì parte una modifica (`PROMPT_PULIZIA`) che lo toglie; `SENZA_SCHELETRO` chiude i prompt che usano l'omino.
  **Idee** (`regista.ts`): le azioni rapide di Modifica sono idee a toggle (`idee`); `pianificaIdee` (Qwen3-VL, `SISTEMA_IDEE`, foto + eventuale foglio con i riferimenti) le mescola in un'istruzione sola
  (`fantasia`: temperatura), piano in `pianoIdee` (con chiave). **Esempio**: il piano è JSON `{instruction, crops}` (attributi a parole + riquadri 0–1000 sul foglio, `leggiPiano`, `riquadroNellaFoto`,
  `ritagliaFoto` in `foglio.ts`); `pianoEsempio.ritagli` sostituiscono i riferimenti.
- **Idle** (`src/main/idle.ts`): dopo 60 s senza lavori scarica i file `consigliato` mancanti (non denoiser né encoder); `fileInutilizzati()`
  elenca i file dei modelli che non servono (Opzioni → File inutilizzati, Cestino).
- Stato in `stato.ts` (zustand); le scelte di Crea/Modifica e i LoRA accesi restano in localStorage.
- Crea: **risoluzione = lato corto** (`RISOLUZIONI`, `dimensioniRis`: multipli di 16, al massimo 4,2 MP e 2688 px di lato);
  **preset** in `preset.ts` (campi in italiano → prompt in inglese, i testi da disegnare fra virgolette e identici).
- Modifica: durante un lavoro la tela resta montata e mostra l'anteprima **sulla foto** (`TelaMaschera.anteprima`: dentro
  la maschera con `mask-mode: luminance`, sotto la foto per Espandi).
- Le pagine Crea e Modifica **restano montate** (la maschera disegnata non si perde cambiando pagina): i tasti
  controllano `pagina` prima di agire.
- Le immagini si mostrano col protocollo `daprod://f/<percorso>` che serve **solo** le cartelle dell'app (con CORS: le
  `<img>` che finiscono su un canvas hanno `crossOrigin`, se no il canvas si "sporca"). Ogni foto da fuori diventa PNG:
  `file:portaDentro` (copia in temp; HEIC/RAW/TIFF/JXL subito con WIC, `src/main/converti.ts`, come DaP-Convertitore)
  e `normalizza` (Chromium + EXIF, se non ce la fa `file:inPng` con WIC; max 24 MP).
- `VistaZoom`: foto con rotella/trascina/doppio clic (Crea, visore). Galleria a righe giustificate. Barra del titolo
  sempre bianca (`titleBarOverlay` chiaro) con RAM/VRAM/GPU da `src/main/risorse.ts` (nvidia-smi ogni 2 s).
- **Album** (`pagine/Album.tsx` compone `src/renderer/src/album/viste/`: `Foto` (colonna sinistra, foto illuminate = quelle dello spread), `Palco`
  (canvas: trascina foto ed elementi), `PannelloLayout/Stile/Elementi`, `Esporta`, `Formato`, `Avvio`, `Miniatura`; `src/main/album.ts`): progetto JSON in
  `DATI/album/<id>/album.json` + foto (JPEG 6000 px e miniature 800 px, create dall'interfaccia da qualsiasi formato: `album:prepara`
  porta dentro il file, i RAW passano da WIC a 6500 px; data di scatto da `exif.ts`). Tutto in **mm**. Uno spread ha `modello` (un id di
  `modelli.ts`: ~100 layout a mano in frazioni dell'area, `vivo` = parte dal bordo del foglio; `piazze` è già nell'ordine delle celle: `abbina()`
  riordina per orientamento con una DP a maschere) oppure, senza modello, i tagli automatici di `layout.ts` (alberi di tagli fino a 8 foto).
  `proposte.ts` dà i layout di uno spread già pronti (anteprime vere); `riproponi()` in `stato.ts` li rimette quando cambia il numero di foto o il foglio.
  `temi.ts` = 12 stili (`applicaTema`); `Spread.elementi` = testi e forme (frazioni dello spread, `rettElemento()` per hit-test e maniglia);
  il vecchio `testo` del titolo si trasforma in elemento in `vecchioInNuovo()`. `costruisci.ts` raggruppa (densità aerea/normale/fitta) e sceglie
  un modello fra i primi senza ripetere; `disegna.ts` disegna su canvas (schermo e stampa: cornice, ombra, z, elementi); `esporta.ts` JPEG/PDF
  (`pdf.ts`, senza librerie). Le foto grandi non restano in cache.
- **Estrai** (modo di Modifica, `componenti/Estrai.tsx` + `estrai.ts` + `riquadri.ts`): a foto caricata `trovaElementi` chiede al Qwen3-VL (`descrivi` con la foto intera)
  un JSON `{bbox_2d 0–1000, label, kind: person|object}` (`leggiElementi`, tollera fence e JSON troncato, toglie i riquadri doppi). La ricerca parte **solo col pulsante** e la fa il Qwen3-VL (`descrivi`, `SISTEMA_ELEMENTI`, `maxToken 800`; niente rilevatore a parte: Florence è stato provato e tolto). Si sceglie con un clic (più clic = il riquadro più grande
  che contiene il punto) o riquadrando a mano; il tipo (persona/oggetto) si corregge. `richiestaEstrai` ritaglia la cosa (+12%) in un temp e fa una **Crea** con quella come `<image1>`:
  **persona** = inquadratura (intera/vita/volto) + posa (T/A/in piedi/come/omino: manichino `<image1>`, ritaglio `<image2>`); **oggetto** = vista (come/davanti/¾/alto/lato), completa le parti coperte.
  Proporzioni (`proporzioniEstrai`, auto = dal riquadro per gli oggetti) e `dimensioniEstrai` sono le stesse cifre che l'interfaccia mostra. I risultati stanno in `usaEstrai` (non nelle versioni).
- Le impostazioni di ogni immagine stanno **dentro il PNG** (chunk iTXt `daprod`, `src/main/png.ts`): la galleria si
  ricostruisce dai file e un PNG trascinato in Galleria torna con prompt, seed e LoRA.
- LoRA: dall'intestazione safetensors si capisce se sono per Qwen 2.1 (`transformer_blocks.N.attn.to_q`/`img_mlp`)
  o per altro (txt_mlp = Qwen 1.x, lora_unet = SD/SDXL, double_blocks = Flux). Link Hugging Face e Civitai.

## Robustezza (1.0.0)
- Zip in `installatore.ts` `estraiZip` (cartella di lavoro, rename con tentativi poi copia); `percorsi.ts` `scriviAtomico` per impostazioni, indice galleria, album (+`.bak`).
- `index.ts`: istanza unica, `errori.log` in DATI, pulizia dei temp vecchi; `processo.ts`: `motore.pid` + `chiudiOrfano`, log a rotazione. `impostazioni.scaricaDopo` = secondi di quiete prima di liberare la VRAM.
- Renderer: `main.tsx` ha il `Salvagente` (ErrorBoundary) e il gestore `unhandledrejection`; `leggiLocale`/`leggiLista` tollerano localStorage rovinato.
- `test/finto.js` deve avere gli stessi campi del vero main (es. `modelli.file` con `klein*`): se mancano, l'avviso di errore compare e si vede.
