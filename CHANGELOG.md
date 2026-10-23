# Changelog

## 1.2.1 — 2026-10-23

Tre correzioni dell'interfaccia Orbita e una semplificazione: i modelli si scelgono dalla barra in alto e sono due (Qwen e Klein 3), l'Editor box non si blocca più dopo qualche riquadro, e i LoRA hanno due scaffali, Qwen e Flux, che ora funzionano anche con Klein.

### Modelli

- **La scelta del modello sta nella barra in alto** dell'app (quella bianca, con RAM e VRAM), visibile da qualsiasi pagina: **Qwen**, **Klein 3** (8 passi) e **Klein 3 Base** (50 passi). Spariscono le tessere «Motore» dai pannelli di Crea, Modifica e Box. Se i file di Klein non ci sono, la pillola ha il puntino e il pannellino per scaricarli.
- **FLUX.2 Klein 4B è tolto**: via dal selettore, dal catalogo (modello e text encoder), dai grafi, dal riconoscimento dei LoRA. Le impostazioni salvate con Klein 4B passano da sole a Qwen; una foto fatta con lui si apre come Qwen. I suoi file già scaricati compaiono in Opzioni → File inutilizzati («tolto dal catalogo») e non vengono più scambiati per quelli di Klein 3.

### Editor box

- **Più di tre riquadri, e riquadri dentro i riquadri.** Un riquadro grande si prendeva tutto il mouse, quindi non si poteva più disegnare niente sopra; col terzo o quarto riquadro la tela era già piena. Ora lo strumento **Disegna** (di serie) fa nascere un riquadro nuovo ovunque, anche dentro un altro; il **numero** del riquadro lo sposta, le maniglie lo ridimensionano. Lo strumento **Sposta** afferra il riquadro dal corpo come prima. Un clic su un punto sceglie il riquadro più piccolo che lo contiene. Il tetto passa da 8 a **16**, come nel motore.

### LoRA

- **Due scaffali: Qwen e Flux (Klein 3).** La pagina LoRA ha una scheda per scaffale, ognuna con la sua zona per trascinare i file o incollare un link, la sua pila (ordine e forza) e le sue carte. I file vanno in `loras/qwen` e `loras/flux`; i nomi dei tensori decidono lo scaffale anche se carichi dalla scheda sbagliata (l'app lo dice). I LoRA che non si riconoscono restano nello scaffale della scheda da cui li hai caricati; quelli fatti per altri modelli (SD, SDXL, FLUX.1, FLUX.2) stanno in «Altri», dove si può scegliere a mano per quale modello usarli.
- **Perché i LoRA non funzionavano con Klein:** l'elenco dei LoRA non mandava all'interfaccia per quali modelli erano fatti, e ogni LoRA di Klein risultava «non compatibile» con Klein; inoltre la richiesta con Klein non portava nessun LoRA e le azioni rapide accendevano LoRA di Qwen. Ora la richiesta porta la pila del modello scelto; Klein veloce e Klein Base usano la stessa. Cambiando modello la pila dell'altro scaffale resta lì, ma non parte.
- Le azioni rapide, Camera e gli avvisi «LoRA consigliato» accendono solo LoRA che vanno col modello scelto (sono LoRA di Qwen: con Klein si va col modello da solo). Una rete di sicurezza nel motore toglie dalla richiesta i LoRA dell'altro scaffale.
- Non ancora provato con la GPU: il risultato di un LoRA vero su Klein (il motore li carica come per Qwen, ComfyUI ha la mappatura dei nomi di Klein).

### Prove

- Nuovi: `test/lora-scaffali.mjs` (importazione nei due scaffali con file safetensors finti, famiglie nell'elenco, note vecchie), `test/box-lora-ui.mjs` (barra dei modelli, sei riquadri e uno dentro l'altro, schede dei LoRA, pannellino di download). Aggiornati i test dei modelli, del catalogo, dello spazio, dei LoRA e dei grafi.

## 1.2.0 — 2026-10-23

L'app cambia faccia e il motore impara cose nuove: l'**interfaccia Orbita** con il pannello dei controlli a sinistra, un quarto modello veloce (FLUX.2 Klein 4B), più LoRA insieme, l'editor a box, «senza sfondo» ed Estrai con SAM 2. Il motore passa alla versione 9: al primo avvio l'app lo aggiorna da sola (i modelli già scaricati restano dove sono).

### Interfaccia Orbita

- **Studio**: Crea e Modifica nella stessa schermata, pannello dei controlli a sinistra, pulsante CREA fisso in fondo, risoluzione finale sempre visibile (HUD).
- **Crea a pulsanti** (tessere al posto dei menu a tendina) e **28 stili** con icona in 4 scaffali.
- **Editor box** con un prompt per riquadro (va al motore come regioni), **Estrai in due clic** (SAM 2), opzione **senza sfondo**.
- **Gestore LoRA**: pila con ordine e pesi. **Sei ricette** (Foglio, Mondi, Mix, Set, Formati, Rinnova) al posto del catalogo lungo.
- **Modelli uncensored**: interruttore spento di serie, avviso da accettare, etichetta sulle voci.
- **Asset** in `resources/gui` (111 WebP, con manifest: prompt, seed, modello). 60 sono scontornati per colore, da rifare con BiRefNet.
- **Asset nelle tessere**: le 111 immagini ora si vedono. Anteprime degli stili (28), generi, categorie di Modifica, luoghi, meteo e stagioni, costumi, animali, espressioni, locandine delle ricette, copertine dei LoRA senza anteprima, modi dello Studio, mascotte e sfondi (nebulosa, pianeta, aurora). Passano da Vite (`src/renderer/src/asset.ts`) e finiscono nell'installer dentro `app.asar`. Se un file manca o non si carica la tessera resta con l'icona. Prove: `test/asset.mjs` (in `npm test`) e `test/asset-ui.mjs`.
- Non ancora provati con la GPU: qualità di SAM 2 e BiRefNet, riquadri dal vivo, LoRA su Klein.

### Motore

- **FLUX.2 Klein 4B** (Apache-2.0, 4 passi) come quarto modello. Misurato su RTX 4060: Crea 5,4 s contro 6,4 s di Klein 3, zona 21 s contro 25 s, Modifica 9,6 s contro 11,5 s (`docs/bench-engine-v2.md`). Non è il predefinito.
- **LoRA multipli con pesi** su tutti i modelli (Qwen e Klein): in fila, forza da −2 a 2. Il riconoscimento dai nomi dei tensori dice per quale modello è fatto un LoRA (`src/shared/loraBase.ts`); nuovo IPC `lora.compatibili(famiglia)`.
- **Senza sfondo** (BiRefNet, MIT) e **estrai fedele** (SAM 2.1, Apache-2.0): ritagliano dai pixel della tua foto, senza ridisegnarla; i modelli si scaricano al primo uso e girano a parte. Con Klein, «sfondo trasparente» in Crea = disegno + BiRefNet.
- **Riquadri nell'Editor box** (regional prompting): Klein 3 li legge nel suo formato (JSON con le coordinate), Qwen e Klein 4B a parole. Nuovo adattatore dalla richiesta della GUI (`box`, `promptScena`, `sfondo`).
- **Catalogo con licenza e ruolo**, modelli «uncensored» marcati e scaricabili solo su richiesta: interruttore acceso, avviso accettato e licenza valida (Apache, MIT, BSD, CC-BY o Qwen Research con avviso; mai FLUX Kommunity). Un LLM uncensored (Qwen3-VL 4B abliterated) per i testi.
- Correzioni: Klein 4B ha la sua chiave VRAM nella regola «una cosa alla volta»; le parole chiave dei LoRA entrano nel prompt anche con Klein.
- Prove: `npm test` (modelli, catalogo, spazio, lora, regioni, adatta, grafi v2, grafi Qwen identici).

### Misure e prove

- **Klein 4B (4 passi) contro Klein 3 veloce (8 passi), a caldo, RTX 4060 8 GB, 1024×1024** (mediana di 3 giri, seme 1000–1002): Crea 5,4 s contro 6,4 s (−16 %), Modifica 9,6 s contro 11,5 s (−17 %), zona 21,3 s contro 24,9 s (−15 %). A pari passi (8) il 4B è più lento (Crea 8,5 s contro 6,4 s): il vantaggio viene dai passi in meno. I tempi vengono dal benchmark registrato (`docs/bench-engine-v2.md`); il json grezzo non è nel repo.
- Il rilascio è stato provato con typecheck, `npm test`, build e installer: l'app impacchettata parte con una cartella dati separata. Le prove con la GPU vera restano a parte.


## 1.1.0 — 2026-10-21

Un'app più semplice da usare: tre modelli al posto delle «qualità», una sola scheda per scrivere cosa cambiare (tutta la foto o solo una zona), le ricette dentro Modifica e il testo scritto dal Qwen3-VL 4B anche con Qwen. Il motore passa a ComfyUI 0.42.3.

- **Tre modelli, scelti in alto.** In barra ci sono tre pillole: **Qwen base** (40 passi), **Klein veloce** (8 passi) e **Klein Base** (50 passi, CFG 3,5). Il selettore «Qualità» (bozza, alta, massima, Turbo) è sparito da Crea, Modifica e dalle ricette:
  i passi li decide il modello. Il **Turbo di Qwen non c'è più** (né il LoRA Turbo8 né i GGUF Turbo nel Setup); resta per chi li ha già e per aprire i PNG vecchi. La scelta di prima si migra da sola
  (un Turbo GGUF diventa il denoiser normale della stessa quantizzazione, una qualità «turbo» salvata vale «alta»). La mappa dei modelli sta in `src/shared/modelli.ts`, provata da `test/modelli.mjs`.
- **Klein veloce passa da 16 a 8 passi.** Misurato in Modifica e in zona (rosso lucido su una teiera, 8, 12 e 16 passi): il risultato è lo stesso a occhio, e 8 passi costano circa un terzo in meno (zona 26 s contro 41 s, Modifica 14 s contro 21 s).
- **Rifai in qualità piena.** Dal risultato di Crea o dalla Galleria, una foto fatta con Klein veloce si rifà con **Klein Base** (stesso prompt, stesso seme). C'è anche **Rifai con Qwen** (non promette la stessa immagine). Sostituiscono il vecchio Turbo e i suoi avvisi.
- **Crea essenziale.** Via «Qualità» e le opzioni avanzate: gli stili stanno in un menu, «Quante» è 1, 2 o 4, e **Altro** (chiuso) raccoglie seme, megapixel, misura e sfondo.
- **Modifica: una scheda «Scrivi» al posto di «Tutta la foto» e «Solo una zona».** Se sulla tela hai disegnato una zona, il cambiamento resta lì dentro; se no, vale tutta la foto. **Espandi** ha la sua scheda, **Estrai** resta com'era.
- **Il Laboratorio è dentro Modifica come scheda «Ricette»**: stesso catalogo (e le tue ricette, i preset, il lotto su più foto), ma nella stessa pagina della tela. **Unisci foto** (prima «Fusion») e **Come l'esempio** sono due ricette
  che usano la tela e la colonna di destra di Modifica. Le impostazioni salvate dei vecchi modi si portano da sole alla scheda giusta. Nella rotaia a sinistra ci sono quattro voci: Crea, Modifica, Galleria, Album. I **LoRA** si gestiscono da Opzioni.
- **Il testo si scrive col Qwen3-VL 4B anche con Qwen** (impostazione `testoCon4B`, accesa di serie, interruttore in Opzioni): Migliora prompt, Foto → prompt, Idee, Estrai e il resto sono più rapidi e occupano meno VRAM. Se il file del 4B non c'è,
  si usa l'encoder di Qwen come prima, senza errori. Misurato su una RTX 4060 da 8 GB: **Migliora prompt + Crea** con Qwen passa da 186 a **134 secondi** (con l'encoder GGUF di questa macchina da 446 a 150), 46-47 token al secondo contro 3,3 dell'8B int8 e 0,55 dell'8B GGUF.
- **Una cosa alla volta in VRAM, più precisa.** Il motore scarica i modelli (`/free`) anche passando da Qwen a Klein, da Klein a Klein Base e dal 4B all'8B, non solo fra disegno e testo (`src/main/motore/spazio.ts`, `test/spazio.mjs`).
  Se dopo lo scarico la VRAM non scende compare un avviso **«VRAM non liberata»** con il pulsante **Libera**.
- **ComfyUI 0.42.3 (motore 8).** Al primo avvio dopo l'aggiornamento il motore si aggiorna da solo. Provato con un disegno vero: Qwen GGUF (con la nostra correzione di `ops.py`), Klein a 8 e 16 passi, zona, Modifica e Klein Base a 50 passi danno
  immagini **identiche al pixel** a quelle della 0.41.2, alla stessa velocità, senza errori nel log.
- **Misure su RTX 4060 8 GB, 1 MP** (`docs/misure-1.1.0.md`): Klein veloce 8 passi in 16 s a freddo e 7 s a caldo (picco 6,9 GB), in zona 26 s; Klein Base 50 passi 60 s in Crea (picco 6,9 GB) e 3,2 minuti in zona (picco 7,3 GB: entra negli 8 GB);
  Qwen base 40 passi 166 s. Il nodo `ReferenceMultiLatent` dà la stessa immagine e lo stesso tempo della catena di `ReferenceLatent`: il grafo di Klein non cambia.
- **I grafi di Qwen non sono cambiati.** `test/confronta_grafi.mjs` costruisce Crea, Modifica in zona ed Espandi (bozza, alta, massima) con il codice della 1.0.3 e con questo: 9 casi su 9 identici.
- **Testi.** «Fusion» diventa «Unisci foto»; le descrizioni di Klein dicono 8 passi; l'avviso sulla VRAM non nomina più il Turbo.
- **Prove.** `test/foto.mjs` (app vera a motore spento: Crea, Modifica, Galleria, Album, Opzioni) segue la nuova rotaia; `test/ricette.mjs` prova le ricette in Chromium con il finto `window.daprod`; `scripts/misure_gpu.mjs` ripete le misure.

## 1.0.3 — 2026-10-21

Il potenziamento del prompt di Klein non ricopia più le frasi di cortesia e le regole del 4B, e ogni volta scrive una didascalia diversa.

- **Pulizia della didascalia.** Il Qwen3-VL 4B apre spesso con «Here’s the expanded, detailed caption for your image request:», con le regole del sistema ricopiate («You're a prompt upsampler…») o con un esempio «Input / Output»:
  quella frase finiva nel prompt del modello e gli faceva male. `pulisciDidascalia` (ora in `src/main/motore/didascalia.ts`, file puro senza Electron) toglie preambolo, regole, etichette e titolo in grassetto e tiene la didascalia vera.
  Lo stesso file ha `senzaTitolo`, che usano anche le altre funzioni di testo con Klein.
- **Seme casuale nel potenziamento.** Prima era sempre 0, quindi lo stesso prompt dava sempre la stessa didascalia anche cambiando seme; ora, se il seme è casuale, ne esce una nuova (la cache per prompt resta: finché l'app è aperta, lo stesso prompt dà la stessa didascalia).
- **Prove.** `test/pulisci_didascalia.mjs` importa il codice vero (non ne ricopia più la logica) e prova dieci casi più due risposte vere del 4B in `test/campioni-pup/`.
  `scripts/bench_upsampler.mjs` misura tok/s, VRAM e RAM del potenziamento caricando il 4B come `krea2` e con `thinking: true`, come fa l'app.

## 1.0.2 — 2026-10-21

Con Klein anche tutto il resto del testo (Migliora prompt, Foto → prompt, Idee, Estrai, Fusion, Esempio, Sorpresa) lo scrive il Qwen3-VL 4B: da circa 0,4 token al secondo a **15-40**.

- **Tutte le funzioni di testo usano il 4B di Klein.** Nella 1.0.1 ci arrivava solo il potenziamento del prompt; Migliora prompt, Foto → prompt, «Sorprendimi», Idee, Estrai, Fusion/Esempio, Sorpresa del Laboratorio,
  il controllo della guida di posa e la traduzione con l'LLM continuavano a usare l'encoder di Qwen (l'8B, quasi tutto sul processore). Ora, se la famiglia scelta è Klein o Klein Base e il file del 4B c'è, scrive lui
  (lo decide il motore dell'app, `conEncoderDiTesto` in `lavori.ts`: le pagine restano uguali). Con Qwen-Image tutto resta com'era; se il 4B non si trova si ripiega sull'encoder di Qwen.
- **Il 4B non risponde più «user», «assistant» o niente.** Il nodo `TextGenerate` con `thinking: false` aggiunge in fondo al prompt un blocco `<think></think>` vuoto e il 4B si confondeva (foto + richiesta breve → risposta vuota,
  traduzione → «user», Sorpresa → «assistant …»). Col 4B ora si manda `thinking: true`: il blocco non c'è, risponde subito e non ragiona (nessun token in più). Questo vale anche per il potenziamento della 1.0.1.
- Se il 4B mette un titolo in grassetto prima del testo («**Image Idea:** …») l'app lo toglie.
- Misurato sul motore vero (ComfyUI 0.41.2, RTX 4060 8 GB), stessi prompt e stessa foto: Migliora prompt 75 token in 214 s con l'8B (0,35 tk/s) contro 190 token in 11 s col 4B (17 tk/s);
  Foto → prompt 76 token in 256 s (0,3 tk/s) contro 181 token in 7,6 s (24 tk/s); Estrai (7 riquadri giusti, JSON valido) 9 s; Idee 5 s; piano di Fusion/Esempio (JSON con istruzione e ritagli) 4,5 s; potenziamento 39 tk/s.
  Con `thinking: true` anche i prompt di sistema lunghi dell'upsampler ufficiale funzionano sul 4B (i brevi della 1.0.1 restano).

## 1.0.1 — 2026-10-21

Klein non è più lento nel potenziare il prompt: da 0,5 token al secondo a **circa 49**.

- **Il prompt potenziato di Klein si scrive col suo Qwen3-VL 4B.** Prima il potenziamento usava l'encoder di Qwen-Image (l'8B, o il GGUF scelto in Opzioni): 8,9 GB non entrano
  nella VRAM da 8 GB e il modello girava quasi tutto sul processore, a **0,55 token/s** (150 token in 290 secondi, una didascalia intera oltre 10 minuti). Ora scrive il 4B di Klein,
  che sta tutto in VRAM: **49 token/s**, una didascalia intera in circa 8 secondi (carico del modello compreso).
- **Caricato come `krea2`, non come `flux3`.** Il tokenizer `flux3` serve al disegno e riempie il prompt di token di riempimento (fino a 79): per *scrivere* il modello
  rispondeva solo «#». Lo stesso file caricato come `krea2` (Qwen3-VL 4B completo) scrive bene. Il disegno di Klein continua a usare `flux3`.
- **Prompt di sistema brevi per il 4B** (`PUP_T2I_BREVE`, `PUP_I2I_BREVE`): con quelli ufficiali lunghi il 4B ricopia le regole invece di applicarle. Con la foto, la richiesta va
  nuda (con «Reference images follow… Output the caption» rispondeva «user»). Con Qwen come prima, i prompt ufficiali.
- Migliora prompt, Foto → prompt, Estrai, Idee e Fusion continuano a usare l'encoder di Qwen (hanno i loro prompt di sistema, pensati per l'8B).
- Misurato sul motore vero (ComfyUI 0.41.2, RTX 4060 8 GB): potenziamento 0,55 → 49 token/s; Klein 1024², 16 passi: 0,55 s/passo, 16,5 s a freddo (Qwen-Image 2.1: 5,6 s/passo, 40 passi).

## 1.0.0 — 2026-10-16

La versione fine: **FLUX 3 Klein**, meno sorprese ovunque, e tutto quello che era rimasto trascurato messo a posto. Niente funzioni nuove oltre a Klein: solo cose che già c'erano, più solide.

- **FLUX 3 Klein** accanto a Qwen: in cima a Crea, Modifica ed Estrai c'è il selettore **Modello che disegna** con tre schede, **Qwen-Image 2.1** (40 passi, LoRA),
  **Klein** (la versione veloce, distillata: 16 passi) e **Klein Base** (quella normale: 50 passi e CFG). Le schede dicono quali sono già scaricate; se manca qualcosa,
  un clic scarica il modello, il suo text encoder (Qwen3-VL 4B) e il VAE. Con Klein le foto di riferimento entrano come immagini di riferimento, il prompt viene
  **potenziato** dal Qwen3-VL (come consiglia BFL; si spegne in Opzioni) e la qualità (Bozza → Massima) sceglie i passi della famiglia. Klein non usa i LoRA di Qwen
  né il Turbo: l'app li nasconde. Il **motore passa alla versione 7** con **ComfyUI 0.41.2**: al primo avvio si aggiorna da solo.
- **Estrai col Qwen3-VL**: il rilevatore piccolo (Florence) è tolto, a identificare persone e oggetti torna il Qwen3-VL (di nuovo con solo il pulsante).
- **Crea: i LoRA si aggiungono**, non solo si tolgono: il selettore completo è sempre sotto il prompt (con Qwen).
- **Megapixel e misura finale separati ovunque**: puoi lavorare a 4 MP e far uscire la foto a 480p (o all'inverso), in Crea, Modifica, Estrai, Fusion, Laboratorio.
  Sotto il selettore si legge sempre «La foto esce a…».
- **Ingranditore NVIDIA RTX**: l'installazione non fallisce più con «ENOENT… rename»: lo zip si estrae in una cartella di lavoro, si prende la cartella giusta e si
  sposta con più tentativi (e, se Windows la tiene occupata, si copia). Stesso metodo per ComfyUI.
- **Modelli scaricati quando non servono**: dopo 120 secondi senza lavori (Opzioni → Prestazioni, cambiabile) l'app libera la VRAM; il lavoro dopo li riporta su.
- **Più robusta, in tutto**: una sola finestra dell'app alla volta; un errore in una pagina non lascia la finestra bianca (si vede cosa è successo e si ricarica);
  gli errori nascosti diventano avvisi in italiano; file di impostazioni, indice della galleria e album scritti in modo atomico (con copia di riserva dell'album);
  la galleria si ricostruisce dai PNG senza perdere i preferiti; il motore non resta orfano se l'app si chiude male; log del motore a rotazione; download che non
  si pestano i piedi (e con messaggi chiari su spazio, permessi e 401/403/404); rete con timeout; localStorage rovinato che non blocca più l'avvio; ricette tue
  senza foto che creano davvero; esportazione album fermata che dice «Fermato»; Fusion che mostra sempre l'ultimo risultato; file che non sono foto rifiutati subito.
- **Galleria e interfaccia**: miniature generate a gruppi (non blocca), selezione che segue i filtri, plurali giusti, storia della maschera con un tetto di memoria,
  Spazio per spostare solo in Modifica, album con più di 8 foto per spread a griglia.

## 0.11.0 — 2026-10-15

Estrai senza partenze a sorpresa e molto più veloce, una cosa alla volta in VRAM, i token al secondo, i megapixel ovunque.

- **Estrai parte solo quando premi**: mettendo una foto non succede niente; premi **Trova persone e oggetti** (o riquadri a mano trascinando).
- **Il rilevatore piccolo**: persone e oggetti li trova ora **Florence-2** (0,23 miliardi di parametri, ~460 MB, si scarica da solo al
  primo uso) invece del Qwen3-VL da 8 miliardi: meno di un secondo invece di mezzo minuto. In Opzioni puoi tornare al Qwen3-VL; se il
  rilevatore non risponde, l'app ripiega da sola sul Qwen3-VL (con meno oggetti e etichette più corte, quindi più veloce di prima).
  Per questo il **motore passa alla versione 6**: al primo avvio dopo l'aggiornamento l'app aggiorna il motore da sola.
- **Una cosa alla volta in VRAM** (Opzioni → Prestazioni, acceso di serie): quando passi dal modello immagine all'LLM (migliora prompt,
  descrivi foto, Idee, Esempio, Estrai…) o viceversa, l'app **scarica quello che non serve** e aspetta che la VRAM sia davvero libera
  prima di far partire il lavoro dopo. Nella barra in basso si legge «Scarico il modello immagine» / «Scarico l'LLM».
- **Token al secondo**: mentre scrive l'LLM, nella barra in basso compare **N tok/s** (e i token fatti); a lavoro finito resta nella riga dell'ultimo risultato.
- **Megapixel ovunque**: il selettore (0,25 / 0,5 / 1 / 2 / **4 MP**, con la misura in pixel sotto ogni voce) c'è in Modifica (anche con «Originale» o
  «Misura mia»: lavora a 4 MP e poi porta alla misura), Fusion, Esempio, Espandi, Laboratorio, Estrai e **Crea** («Oppure scegli per megapixel»).
- **Crea: i LoRA attivi si vedono sempre**, in tutte le categorie: una riga di chip sotto il prompt (con la forza, la ✕ li spegne) e il
  numero sulla testata della sezione LoRA anche quando è chiusa.

## 0.10.0 — 2026-10-15

Estrai persone **e oggetti**, una casella di testo come si deve, la testa dell'omino e le risoluzioni sempre in vista.

- **Estrai** (era «Personaggio»): il modello guarda **tutta la foto** e trova da solo persone e oggetti; clicchi quello che vuoi (si
  illumina, il resto si abbassa; cliccando ancora nello stesso punto passi a quello più grande che lo contiene) o lo riquadri tu
  trascinando. Niente più camera: la schermata è molto più pulita, con tre passi: **cosa estrarre**, **come lo vuoi**, **dimensioni e qualità**.
  - Se è una **persona**: inquadratura (figura intera, fino alla vita, solo il volto) e posa (T-pose, A-pose, in piedi, come nella foto, disegnata con l'omino).
  - Se è un **oggetto**: vista (come nella foto, davanti, ¾, dall'alto, di lato); se una parte è coperta o tagliata il modello la completa.
  - Sfondo (bianco, grigio, trasparente, come la foto), ombra sul pavimento, note, e il pulsante «È una persona / È un oggetto» se il modello si sbaglia.
- **La casella dei prompt**: **tasto destro** con Incolla, Copia, Taglia, Annulla e Seleziona tutto in tutte le caselle di testo; il
  **cestino** cancella tutto il testo in un colpo; la casella **si allarga da sola** col testo, senza barra di scorrimento (Crea,
  Modifica, Laboratorio, editor delle ricette, preset, piani del modello).
- **L'omino**: la **testa** si regola (gira a sinistra/destra fino al profilo, su/giù, inclinata, con modi pronti) e va nel prompt a parole.
  E la guida di posa non è più uno scheletro a linee (che il modello a volte lasciava nella foto): è un **manichino grigio pieno**, come
  quello di legno degli artisti, con mani e dita; il prompt dice che è solo un riferimento da sostituire con la persona vera. Il
  controllo automatico cerca anche tracce del manichino (parti grigie lisce) e, se le trova, le toglie. Un pulsante mostra il
  manichino che vede il modello.
- **Le risoluzioni si vedono sempre**: in Modifica, Fusion, Esempio, Laboratorio ed Estrai c'è la riga «La foto esce a **1024 × 1376 px**»,
  le scelte dei megapixel mostrano la misura vera in pixel sotto ogni voce (e non sono più nascoste in «Avanzate»), il pulsante
  principale dice a che misura esce, Crea mostra larghezza × altezza accanto alla risoluzione. In «Solo una zona» dice che la foto resta com'è.
- **Skill di progetto** per chi sviluppa (`.claude/skills/`): `rilascio` (come si prepara una versione) e `prova-interfaccia` (come
  vedere l'interfaccia senza motore, con `node test/interfaccia.mjs`).

## 0.9.1 — 2026-10-15

Lo scheletro dell'omino non resta più nella foto.

- **Controllo automatico**: ogni foto fatta con l'omino (in Personaggio e nelle ricette) viene guardata dal Qwen3-VL a lavoro finito; se
  vede lo scheletro (linee colorate, puntini, omino accanto alla persona) parte da sola una modifica che lo **toglie** e ridisegna
  quello che c'è sotto (pelle, vestiti, mani, sfondo). La foto ripulita prende il posto di quella sporca nei risultati (in galleria
  restano tutte e due). Se la foto è pulita non succede niente.
- **Prompt più chiari**: la mappa di posa è «solo un foglio di riferimento» e il prompt dice che nella foto finale non ci sono
  scheletri, linee né puntini (prima descriveva le linee colorate, e il modello le disegnava).

## 0.9.0 — 2026-10-15

L'omino con le ossa e le mani, idee da sommare al posto delle azioni rapide, Esempio con i colori giusti.

- **L'omino** (Personaggio e Laboratorio): un manichino con le ossa di lunghezza fissa che trascini come vuoi (i pallini sono le
  articolazioni: il bacino sposta tutto, gli altri ruotano l'osso e si portano dietro il resto), con 11 pose pronte (T-pose, braccia in
  alto, saluta, mani sui fianchi, corsa, salto…) e **Specchia**. **Le mani**: clic su un polso e apri/chiudi la mano (aperta, pugno,
  indice, pace, pollice su…), muovi **le dita una per una**, le divarichi, pieghi il polso, con l'ingrandimento della mano. L'omino
  diventa una **mappa di posa in stile OpenPose** (corpo e dita colorati) che si dà al modello come immagine, più la posa descritta a
  parole («braccio destro alzato sopra la testa, mano sinistra chiusa a pugno…»).
  - In **Personaggio**: posa «Disegnata» (con l'omino) accanto a T-pose, A-pose, in piedi…
  - Nelle **ricette** (come la camera): il campo «Muovi l'omino» in *Il personaggio in 9 pose* e in *Foglio personaggio*; muovendolo
    compare il passo **La tua posa** (si segna da solo).
- **Idee da sommare** (al posto delle azioni rapide fisse): i pulsanti di Modifica ora si accendono e si spengono, **ne puoi scegliere
  quante vuoi**; premendo Modifica il Qwen3-VL **guarda la foto, mescola tutte le idee (e la tua nota) in una sola istruzione e inventa
  lui i dettagli**: colori, materiali, oggetti, stile. Con «Fantasia del modello» (Fedele / Normale / Tanta) decidi quanto osa. Il
  piano si vede e si corregge; «Rifai» lo rimescola con dettagli nuovi. Un'idea sola in «Fedele» resta com'era (frase fissa).
- **Esempio, colori giusti**: il modello descrive **a parole i colori e i dettagli esatti** di quello che prende da ogni foto
  («iride arancio ambra con anello marrone scuro e striature radiali»), e **ritaglia la parte che conta** di ogni riferimento
  (l'iride dentro la foto di un occhio) così il modello di modifica la vede in grande; i ritagli si vedono sotto il piano. Se è
  acceso il Turbo c'è un avviso: segue meno colori e dettagli, con **Alta** è più fedele.
- Foglio di foto e ritagli in `foglio.ts`, regista delle idee in `regista.ts`, omino in `omino.ts` (puro, provato) e
  `componenti/Omino.tsx`.
- Da provare con l'app vera: la resa delle pose con le mani (il modello di modifica legge la mappa di posa, ma non è garantito dito
  per dito) e i colori dell'Esempio.

## 0.8.1 — 2026-10-15

Il modo Esempio funziona con qualsiasi cosa, non solo con le persone.

- **Esempio, il modello decide da solo**: via i pulsanti «cosa tenere». Premendo «Crea come l'esempio» il Qwen3-VL **guarda in un colpo solo
  l'esempio e le tue foto** (un foglio con le foto numerate) e scrive lui l'istruzione di modifica: cosa dell'esempio va sostituito con cosa
  (persone, volti, **iridi**, vestiti, oggetti, prodotti, sfondi, stili…), abbinando le cose dello stesso tipo una per una, e cosa resta identico.
  Se scrivi una nota la segue; se la lasci vuota capisce da solo l'intento più naturale.
- **Il piano si vede** («Il piano del modello», colonna di destra) e si può **correggere**: vale finché non cambi le foto o la nota; «Rifai»
  lo fa rifare.
- Prima il prompt dava per scontato che nell'esempio ci fossero persone (volto, capelli…): con altre cose (le iridi) il modello andava
  fuori strada.

## 0.8.0 — 2026-10-15

Tasto destro in Galleria, la camera nel turnaround, LoRA sempre usati, Esempio che segue meglio.

- **Galleria**: **tasto destro** su una foto = **Copia** (una foto: l'immagine negli appunti; più foto: i file, da incollare in una
  cartella o in una chat), **Elimina** (per sempre: non va nel Cestino, c'è la conferma), Apri, Modifica, Mostra nella cartella,
  Seleziona tutte. **Ctrl+clic** ne sceglie più di una, **Maiusc+clic** un intervallo, **Ctrl+A** tutte, **Ctrl+C** copia, **Canc**
  elimina, **Esc** toglie la scelta; le scelte hanno la spunta gialla. Nella barra in alto Copia, Nel Cestino ed Elimina.
- **Laboratorio**: il **comando Camera** (i due cerchi: gira attorno, alza e abbassa, distanza) è anche nel **Foglio personaggio
  (turnaround)** e nel **Giro intorno al soggetto**: lo muovi e compare il passo **La tua vista** (si segna da solo). Resta anche
  in Modifica e nel modo Personaggio.
- **LoRA sempre usati**: appena ne accendi uno, la sua parola chiave entra nel prompt **da sola in ogni richiesta** (Laboratorio,
  Personaggio, azioni rapide, Fusion, Esempio…), senza doverla scrivere. Prima lo faceva solo da alcune pagine.
- **Modo Esempio** più fedele: il prompt ora dice chiaramente che l'esempio è il **bersaglio** e cosa va **tenuto** esattamente; scegli
  tu cosa tenere (posa, inquadratura, sfondo, luce e colori, vestiti); e il modello **guarda l'esempio e lo descrive** prima di partire
  (si può spegnere), così lo segue meglio. Il volto e il corpo vengono dai riferimenti, mai dalla persona dell'esempio.
- **La foto principale nel testo**: in Modifica (tutta la foto, zona, espandi) c'è il chip **\<image1\> · principale** vicino ai
  riferimenti, e la foto principale è la prima tessera nei Riferimenti; in Esempio c'è **\<image1\> · esempio**; nell'editor delle
  ricette ogni passo ha i chip `<image1>`, `<image2>`… e `{campo}`.
- Da provare con l'app vera: Esempio (la resa dipende dal modello), la copia di più file (usa PowerShell di Windows).

## 0.7.0 — 2026-10-15

Album rifatto da capo (semplice, con tanti modelli), modo Personaggio, Sorpresa sempre a tema.

- **Album, tutto più semplice**: a sinistra le **foto grandi**, al centro lo spread, a destra tre schede (**Layout**, **Stile**,
  **Testi e forme**). Si parte da due cose: il formato (con la forma vera disegnata) e le foto: l'album si impagina da solo. Spariti
  i dieci cursori: «Impagina da capo» ha solo *quante foto per pagina* (aerea / normale / fitta), copertina e preferite a tutto
  foglio; margini e cornici stanno sotto «Ritocca» nello Stile, l'abbondanza nell'esportazione.
- **Clic su uno spread = le sue foto si illuminano** nella colonna di sinistra (col numero della loro cella), le altre si
  abbassano; la colonna scorre da sola fino a loro e c'è il filtro **Qui**. Clic su una cella e poi su un'altra foto: la
  **sostituisce** (o le scambia, se era già nello spread). Clic su una foto spenta: la aggiunge allo spread.
- **Libreria di modelli** (`album/modelli.ts`, quasi 100 layout disegnati a mano per 1–8 foto, per l'aperto e per la pagina
  singola): una grande e tante piccole, pagine uguali, strisce, griglie, tutto il foglio a vivo con gli inserti incorniciati…
  Le foto si abbinano alle celle per orientamento (le verticali nelle celle alte, la preferita nella più grande) e ogni layout si
  vede **con le tue foto vere**; più qualche impaginazione «su misura» a tagli. «Un altro» ne prova uno a caso fra i migliori.
- **12 stili** per tutto l'album con un clic (Classico, Galleria, Crema, Polaroid, A tutto foglio, Minimal, Moderno, Blu notte,
  Rustico, Rosa antico, Pellicola, Viaggio): colori, margini, angoli, cornice e ombra alle foto, carattere.
- **Testi e forme** sullo spread: titolo, didascalia, cerchio, riquadro, linea, cornice. Si **trascinano** sulla pagina (si
  attaccano al centro), il quadratino azzurro li allarga, colore, trasparenza, carattere, ombra. Il titolo della copertina è ora un
  testo come gli altri (gli album vecchi si aprono lo stesso).
- **Modo Personaggio** in Modifica: dai una foto con **più persone**, «Trova le persone» (il Qwen3-VL le riquadra; se ne manca
  una la riquadri tu trascinando), **clic su una persona e si illumina**. «Estrai il personaggio» la porta a **figura intera** su
  sfondo pulito (bianco, grigio, trasparente o come la foto) in **T-pose**, A-pose, in piedi o com'è nella foto. Poi **muovi la
  camera**: i due cerchi del comando Camera (gira attorno / alza e abbassa + distanza) per una vista sola, o **il giro completo**
  (le 4 viste classiche o tutte le 8) in coda con un clic.
- **Sorpresa a tema**: il modello riceve categoria, descrizione, impostazioni scelte e esempi presi da tutta la ricetta, e deve
  inventare lo **stesso tipo di variazione** (se la ricetta cambia le acconciature inventa un'acconciatura, non altro).
- Il selettore di foto ha le miniature più grandi (almeno 168 px, quadrate).
- Refactoring: l'Album è in pezzi (`album/viste/`: Palco, Foto, PannelloLayout/Stile/Elementi, Esporta, Formato, Avvio, Miniatura),
  `proposte.ts` (i layout di uno spread), `temi.ts`, `modelli.ts`; il Personaggio in `personaggio.ts` + `componenti/Personaggio.tsx`.
- Da provare con l'app vera: la qualità dell'estrazione (identità e T-pose) e il rilevamento delle persone con il tuo LLM.

## 0.6.0 — 2026-10-15

Ricette tue, più foto insieme, ingranditore NVIDIA RTX, modo Esempio e molta pulizia.

- **Fusion al posto di "Nuova dalle foto"** e **modo Esempio**: dai le foto da usare (persone, vestiti, oggetti) e **una foto di
  esempio** di come vuoi il risultato: il modello rifà l'esempio (posa, inquadratura, luce) con le tue foto. In Fusion e in Esempio
  scegli anche la **misura precisa** (formati e risoluzioni da cliccare).
- **Laboratorio**: **più foto insieme** (la ricetta parte per ognuna, tutto in coda); **di partenza non c'è niente di segnato**;
  in ogni ricetta il passo **🎲 Sorpresa** (il modello inventa una variazione nuova nello stile della ricetta); **vedi i prompt**
  di ogni passo; **ricette tue**: ne crei di nuove, **duplichi e modifichi** quelle che ci sono (nome, campi, prompt, "uno per ogni
  riga"), le elimini o le nascondi; **preset** per ricetta (campi e passi segnati con un nome). Nuova categoria **Sticker e icone**:
  sticker di qualsiasi cosa (non solo persone), tante azioni, una lista (uno per riga), set di icone.
- **Misura mia** con i **formati** (1:1, 4:5, 3:2…) e le **risoluzioni usuali** (HD, Full HD, 2K, 4K, Instagram, Storia, A4 300 dpi…) da
  cliccare, anche in Crea (**Misura precisa**) e in Fusion.
- **Ingranditore NVIDIA RTX** (RTX Video Super Resolution, il nodo di Comfy-Org + `nvidia-vfx`): usa i Tensor core, più nitido e
  veloce di 4x-UltraSharp, che resta come ripiego. Si installa da solo con l'aggiornamento del motore; se non riesce l'app funziona
  lo stesso. (DLSS 5 vero e proprio non c'è come ingranditore: vedi sotto.)
- **Quando l'app è ferma** (un minuto senza lavori) scarica da sola i file consigliati che mancano (LoRA Turbo, traduttore…): lo
  vedi nella barra in basso; si spegne da Opzioni.
- **Opzioni**: i gruppi si chiudono (si ricorda come li lasci) e i modelli sono divisi per tipo; nuovo gruppo **File inutilizzati**
  (vecchi VAE, modelli tolti dal catalogo, scaricati ma non scelti) con **Cestino**.
- **Modifica**: il confronto **prima/dopo** mostra sempre l'**originale** (anche da v3 o v4).
- **Galleria**: nelle informazioni c'è **l'effetto** usato (azione, ricetta, Fusion…); **un clic fuori dalla foto chiude** il visore
  (anche in Lab e nella coda).
- **Crea** rivisto: sezioni che si chiudono, **Sorprendimi** (il modello inventa un'idea), **Misura precisa**, e quando è vuota
  ripartire dalle ultime opere.
- Sistemato: "Tainted canvas" importando foto nell'Album, la griglia della galleria nel selettore (foto schiacciate), l'anteprima di
  Fusion tagliata. Refactoring: ricette di serie in `ricetteBase.ts`, viste del Laboratorio in `LabVista.tsx`, Fusion/Esempio in
  `fusion.ts`, `AdattaFoto` per le anteprime.

## 0.5.0 — 2026-10-14

Album per la stampa, Fusion, coda a tessere.

- **Album** (nuova pagina, come SmartAlbums): scegli le foto **dalla galleria o dal PC, anche i RAW di tutte le fotocamere**
  (CR2/CR3, NEF, ARW, DNG, RAF, ORF… passano da WIC di Windows), il formato (quadrato 20/25/30, verticale, orizzontale, A4,
  una misura tua; aperto a due pagine o pagina singola) e premi **Impagina tutto**: le foto vanno nell'ordine di scatto (data
  EXIF, anche dei RAW), divise in spread da N a M foto (si può cominciare uno spread nuovo dopo una pausa fra gli scatti),
  con layout che tagliano il meno possibile, la copertina col titolo e una pagina intera per le preferite (★). Poi ritocchi a mano:
  **altro layout**, stile ordinato / dinamico / una grande, sposta e scambia le foto, **trascini la foto nella cella per
  cambiare l'inquadratura** e zoom, foto trascinate dalla striscia sugli spread, testi, margini, spazio, angoli, taglio
  massimo, sfondo a colori, da un'immagine o **fatto dall'AI** (Qwen-Image), annulla/ripeti e salvataggio da solo.
  **Esporti per la stampa** in PDF a grandezza vera o in JPEG, a 150/200/300 dpi, con l'abbondanza (il vivo) e le pagine
  doppie o singole. Gli originali non si toccano: nell'album ci sono JPEG ad alta qualità (6000 px) e le miniature.
- **Fusion** (era "Nuova dalle foto"): metti **più foto, tutte riferimenti**, scrivi cosa vuoi e ne esce una foto nuova.
  Le foto stanno in una griglia (`<image1>`, `<image2>`…, riordinabili), il formato lo scegli tu (come la prima foto, 1:1,
  4:5, 3:2, 16:9, 9:16) e i risultati compaiono sotto, con "Fra le foto" per fonderli ancora.
- **La coda è un menu a tessere**: ogni foto che si sta facendo, quelle in attesa e quelle finite, con l'anteprima dal
  vivo; clic per vederla in grande; si apre anche toccando la barra in basso; ✕ per annullarne una sola.
- **Laboratorio**: segni **solo i passi che ti servono** (se vuoi una posa sola non le fai tutte) e puoi saltare un passo già in coda.
- **Dimensioni dell'immagine**: in Modifica e nel Laboratorio scegli se l'immagine esce **come la foto originale**, secondo i
  megapixel, o a una **misura tua** (il motore porta il risultato alla misura esatta, con l'ingranditore se serve).
- Sistemato: l'anteprima in Crea usciva dallo spazio sotto la striscia e poi si aggiustava; ora sta sempre dentro, come la foto finita.
  Il testo "Scarico il traduttore" non sborda più dalla barra in basso.

## 0.4.1## 0.4.1 — 2026-10-14

- **Traduzione con un modello fatto apposta**: il prompt italiano lo traduce **Opus-MT it→en** (Helsinki-NLP, ~300 MB),
  un modello di sola traduzione che gira sul **processore**: niente Qwen, niente VRAM, nessun rifiuto sui prompt espliciti
  e molto più veloce. I testi fra virgolette e i `<imageN>` restano identici (si traducono solo i pezzi in mezzo). Si scarica
  da solo la prima volta che serve. In Opzioni → *Chi traduce* si può tornare a Qwen3-VL. Se il traduttore non si scarica,
  l'app traduce con Qwen3-VL come prima. Nuovo nodo `DaProdTraduci` (alzato `motore` a 4: l'app aggiorna il motore da sola).

## 0.4.0 — 2026-10-14

Un laboratorio di ricette, più foto insieme, il Turbo nuovo e la scelta dell'LLM.

- **Barra di stato in basso**: fase, passi, tempo e prompt inglese sempre scritti lì, senza riquadri sopra le foto.
- **Prima / dopo di nuovo sulla tela**: dopo ogni modifica si apre la linea da trascinare (PRIMA / DOPO) con
  **Continua da qui** e **Torna indietro** bene in vista.
- **Modifica**: la foto si prende **dalla galleria**, dal PC, trascinata o incollata; **Togli foto** riporta la pagina
  com'era appena aperta, senza chiudere il programma.
- **Più foto, tu scegli la base**: sulle miniature dei riferimenti c'è **★ base** (la foto diventa quella che si
  modifica, la vecchia passa fra i riferimenti). Il nuovo modo **Nuova dalle foto** non modifica niente: crea
  un'immagine completamente nuova prendendo persone, vestiti, oggetti, luoghi e stili dalle foto (`<image1>`, `<image2>`…).
  Più foto trascinate insieme: la prima è la base, le altre riferimenti. Anche in Crea ci sono i riferimenti.
- **Azioni rapide a categorie** in Modifica: persone, vestiti, situazioni, **prospettiva** (con la **camera da
  trascinare**: giro, altezza, distanza, anche senza prompt), luce, stili, testi, ritocco; accendono da sole i LoRA giusti
  (coerenza, cambio vestito, camera) e li propongono con un clic se mancano.
- **Laboratorio**: 47 ricette pronte, serie e catene (il personaggio in 9 pose, espressioni, età, armadio, camera,
  luce, what-if, stili, prodotto, testi, casa, restauro…), foglio contatti e confronto prima/dopo per ogni risultato.
- **Il nuovo Turbo di AtomicChat** (`Qwen-Image-2.1-Turbo-GGUF`): già distillato, 8 passi, senza LoRA. L'app chiede a
  Hugging Face il nome vero del file e lo scarica con lo sha256.
- **Solo Q4, Q6 e Q8**, per tutti i modelli (denoiser e LLM). Via Q5 e bf16.
- **Scelta dell'LLM (text encoder)**: oltre al Qwen3-VL int8 di sempre, in Opzioni si scaricano e si scelgono
  l'encoder **uncensored di AtomicChat** (`Qwen-Image-2.1-Turbo-Uncensored-GGUF`) e il
  **Qwen3-VL 8B Uncensored V2 di mradermacher**, in Q4 / Q6 / Q8, con l'mmproj che serve per guardare le foto
  (si mette accanto col nome che il nodo GGUF cerca). Il motore li carica con `CLIPLoaderGGUF`.
  L'LLM fa tre cose: legge il prompt, guarda le foto e traduce dall'italiano.

## 0.3.0 — 2026-10-08

Modifica che funziona sempre, anteprime vere, foto di ogni formato.

- **Anteprima dal vivo nitida, passo per passo** (come in Invoke): il motore usa TAEQI 2.1, il decoder piccolissimo di
  madebyollin per Qwen-Image 2.1 (15 MB, si scarica da solo). Prima l'anteprima usciva a 1/16 della risoluzione e
  non si vedeva niente: ora in Modifica la zona si vede davvero nascere al suo posto.
- **Modifica di una zona senza impostazioni**: il modello riceve sempre anche **la foto intera con la zona evidenziata
  in rosso**, così capisce il contesto e sa esattamente dove lavorare; fuori dalla zona resta identica al pixel. Via
  forza, contesto, bordi e interruttori: bordo e morbidezza si regolano sulla grandezza della zona, e se scrivi
  "rimuovi…" la zona si ripulisce da sola prima di ridisegnarla. La grandezza di lavoro è in "Avanzate".
- **Dopo una modifica si continua**: la nuova versione resta sulla tela, pronta da ritoccare, con la barra delle
  versioni (‹ ›), **Tieni premuto: prima**, **Confronta** (con "Tieni questa e continua") e **Torna indietro**.
- **Traduzione automatica in inglese**: Qwen-Image capisce molto meglio l'inglese, quindi i prompt in italiano li traduce
  il Qwen3-VL già caricato (niente modelli in più) prima di disegnare; i testi fra virgolette restano identici.
  Si vede la traduzione mentre lavora e nel visore. Si spegne da Opzioni.
- **Tutte le foto diventano PNG**, come in DaP-Convertitore: JPG, WEBP, AVIF e GIF li apre Chromium col verso EXIF
  giusto; HEIC, TIFF, RAW delle fotocamere e JXL passano da WIC di Windows (colori portati in sRGB). Sistemato il
  motivo per cui in Modifica funzionavano solo i PNG.
- **Galleria**: righe ordinate con le proporzioni vere (niente più miniature sovrapposte), Ctrl+rotella per la
  grandezza, **Importa** e trascina qualsiasi foto (diventa PNG), visore con **zoom a rotella**, trascina e doppio clic.
  Lo zoom c'è anche sul risultato in Crea.
- **Barra in alto bianca** per tutti (anche col tema scuro di Windows), con **RAM, VRAM e GPU** (uso e temperatura)
  in tempo reale.
- Sistemato il velo "Rilascia…" che restava sopra la finestra dopo aver trascinato un file.

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
