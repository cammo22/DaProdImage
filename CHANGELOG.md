# Changelog

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
