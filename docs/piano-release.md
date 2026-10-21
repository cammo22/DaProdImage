# Piano della grande release (1.1.0): Modifica e Lab insieme, tre modelli, meno tasti

Scritto da claude-opus il 21/10/2026 (task t_e7c42490). È **solo un piano**: niente codice, niente GPU, niente push.
Si parte dal ramo `feat/klein-upsampler-veloce` (1.0.2 + le modifiche non committate di `lavori.ts`, vedi §7).

Cosa ha chiesto Cammo:
1. guardare le novità di Hugging Face e ComfyUI e prendere quello che conviene;
2. unire Modifica e Lab;
3. selettore del modello **sempre visibile**, con tre modelli soli (D1 rivista: Qwen base, Klein veloce a 8 passi, Klein Base);
4. molti meno tasti, solo il meglio;
5. pensare alla GPU da ~8 GB: niente carichi in parallelo, tenere d'occhio la memoria, niente Chrome nelle prove.

---

## 0. Decisioni (prese qui, da confermare con Cammo prima di T3)

- **D1 — I tre modelli (rivista da Cammo il 21/10: niente Turbo di Qwen, a Cammo non piace).** Due famiglie, tre voci:
  - **Qwen base** (`qwen-base`) = Qwen-Image 2.1 pieno, **40 passi**, CFG 1, con tutti i LoRA. È il modello di partenza.
  - **Klein veloce** (`klein`) = FLUX 3 Klein distillato a **8 passi** (oggi 16), senza CFG: è lui il "Flux turbo". BFL dice 4–16 passi per il distillato, quindi 8 rientra.
  - **Klein Base** (`klein-base`) = FLUX 3 Klein pieno, 50 passi con CFG 3,5: **resta nell'interfaccia** (la qualità piena di Klein).
  - **Il Turbo di Qwen sparisce**: né il LoRA Turbo8 né il GGUF Turbo di AtomicChat si propongono più. Il LoRA non si scarica più da solo
    (`lora-turbo` non è più `consigliato`); chi ha il GGUF Turbo come denoiser torna, una volta sola, a quello pieno dello stesso quant se c'è.
    I file e il codice del Turbo nei grafi restano (i PNG vecchi con `turbo: true` si riaprono), ma l'interfaccia non manda più `turbo: true`.
- **D2 — Il backend non cambia forma.** `Famiglia` (`qwen | klein | klein-base`) resta com'è nel main e nei PNG. La mappa unica è
  `src/shared/modelli.ts` (fatta in T2): `IdModello = 'qwen-base' | 'klein' | 'klein-base'`,
  `qwen-base → {famiglia:'qwen', turbo:false, passi:40}`, `klein → {famiglia:'klein', passi:8}`, `klein-base → {famiglia:'klein-base', passi:50}`;
  `FAMIGLIE` in `tipi.ts` prende nomi e passi da lì. Nelle impostazioni il campo nuovo si chiama **`modelloScelto`** (non `modello`, che è già il file
  del denoiser di Qwen) e resta sempre d'accordo con `famiglia` (`allineaScelta`). Così **i grafi di Qwen non cambiano di un nodo** (regola del CLAUDE.md)
  e i PNG vecchi si riaprono (`modelloDaOpera`: Klein Base, Klein, tutto il resto Qwen base).
- **D3 — La Qualità sparisce.** Ogni modello ha i suoi passi. Il flusso "bozza → rifinisci" diventa: esplori con **Klein veloce**,
  sulla foto che ti piace premi **Rifai in qualità piena** (stesso seed, stesso prompt) con **Klein Base** (il più vicino) o **Qwen base**
  (`inQualitaPiena('klein')`). Qwen base e Klein Base sono già pieni: lì il pulsante non c'è. `qualita` resta nella `Richiesta`
  per i PNG e le ricette vecchie (`turbo` vale `alta`: `senzaTurbo`), ma l'interfaccia non la mostra più.
- **D4 — Il nome.** La pagina unica si chiama **Modifica**. Le ricette del Lab diventano la scheda **Ricette** dentro Modifica.
- **D5 — Versione.** 1.1.0 (interfaccia e modelli). Se in T13 si alza ComfyUI, anche `motore: 8` in `engine/versioni.json`.

---

## 1. Novità di ComfyUI e Hugging Face (controllate oggi, 21/10/2026)

Noi siamo su **ComfyUI 0.41.2**. L'ultima stabile è la **0.42.3** (21/10). Cosa c'è di utile per noi:

| Novità | Dove | Per noi | Decisione |
|---|---|---|---|
| "Qwen 3.x performance: faster text generation" | ComfyUI 0.42.0 | Il nostro `TextGenerate` gira su Qwen3-VL (4B e 8B): più token al secondo per Migliora prompt, Idee, Estrai, potenziamento | **Sì** (T13), con prova vera |
| "Synchronize model-prefetch graph cleanups so repeated runs release memory reliably" | 0.42.1 | È proprio il nostro caso: tanti lavori di fila e `/free` fra testo e immagine | **Sì** (T13) |
| `SetReferenceMultiLatent` (più latenti di riferimento da un nodo) | 0.41.0, c'è già | Alternativa ai `ReferenceLatent` in catena di Klein, che il CLAUDE.md dà per "non provati" | Prova in T12, cambio solo se meglio |
| FLUX.3 Layout Prompt (riquadri nel prompt) | 0.41.0 | Bello per Estrai/zona con Klein | **Dopo** questa release |
| Klein distillato "4–16 passi" | docs.comfy.org, tutorial Klein | Conferma D1 (Klein a 8 passi) | Sì |
| Klein in nvfp4 | HF di BFL | Serve una RTX 50 (Blackwell); la 4060 è Ada | No, resta int8 |
| Upsampler ufficiale Qwen3.5 9B | template Klein | 9B non sta in 8 GB con Klein | No, resta il 4B |
| Qwen-Image 2.1: fino a 10 riferimenti, modifiche locali "con cerchi e annotazioni dipinte" | HF Qwen/Qwen-Image-2.1 | Conferma il nostro modo della zona (velo rosso sull'ultima immagine) | Niente da cambiare |
| MOSS-Image, Krea 3, Bria FIBO 2 | 0.41.1–0.42.3 | Modelli nuovi o a pagamento (partner node) | No: Cammo vuole meno modelli, non di più |
| Dynamic VRAM (dalla 0.18, attiva di serie) | blog Comfy | Già in uso; `--lowvram` viene ignorato | Niente flag nuovi |

Rischio di T13: il nostro `ComfyUI-GGUF` ha una correzione in `ops.py` per la 0.39+/0.41. Va riprovata una generazione vera
prima di pubblicare (regola del CLAUDE.md). Se si rompe, la 0.42 si rimanda e la release esce con la 0.41.2: **T13 non blocca il resto**.

---

## 2. Il flusso dell'interfaccia dopo

### La cornice (sempre)
- **Barra in alto, accanto a RAM/VRAM/GPU: il selettore del modello**, tre pillole: `Qwen base · 40 passi` / `Klein veloce · 8 passi` / `Klein Base · 50 passi` (ordine di `ORDINE_MODELLI`).
  Si vede su tutte le pagine (oggi `ScegliModello` sta in cima a Crea e Modifica e occupa una sezione intera).
  La pillola di un modello da scaricare ha un puntino; un clic apre il pannellino di download che c'è già.
  Durante un lavoro il selettore resta cliccabile, ma vale **dal lavoro dopo** (si scrive "dal prossimo lavoro").
- **Rotaia a sinistra: 4 voci** — Crea, Modifica, Galleria, Album. **LoRA va dentro Opzioni** (scheda LoRA, stessa pagina di oggi).
  Lab sparisce dalla rotaia.

### Crea
Restano: prompt (`Casella`) con **Migliora prompt**, **Stili** (i preset in un menu solo), **Formato** (proporzioni a chip + lato), **Quante** (1/2/4), pulsante **Crea**.
LoRA: una riga "LoRA · 2 accesi" che si apre (solo con i modelli Qwen).
Sotto **Altro** (chiuso): seed, megapixel del modello, misura precisa.
Vanno via: Qualità/Bozza (D3), sampler, scheduler, CFG, negativo, "Rimetti quelli ufficiali" (si usano sempre quelli ufficiali del modello).

### Modifica (Modifica + Lab)
A sinistra la foto (o le foto), in mezzo la tela, a destra **quattro schede**:

1. **Scrivi** — prompt + Idee (le azioni rapide a interruttore, `regista.ts`). Niente più "tutta la foto" o "zona" da scegliere:
   **se hai disegnato una zona vale la zona, se no tutta la foto** (`modalita` si decide al momento dell'invio). Pennello e Pulisci stanno sulla tela.
2. **Espandi** — i bordi come oggi (Quadrata, Azzera).
3. **Ricette** — il catalogo del Lab (le carte di `LabVista`), con dentro anche **Unisci foto** (Fusion) e **Come l'esempio** (Esempio), che oggi sono modi a parte.
   Scelta una ricetta: i suoi ingressi, i passi da segnare, Avvia. Qui, e solo qui, si possono mettere **più foto** (il lotto di `avviaLotto`).
4. **Estrai** — come oggi.

Sotto le schede, uguale per tutte: **Riferimenti** (chiuso se vuoto), **Quante versioni**, **Altro** (misura, LoRA), e il pulsante grande con la stima.
Il prima/dopo e "Continua da qui" restano.

### Cosa va via (o si nasconde)
- Il selettore Qualità ovunque (Crea, Modifica, Laboratorio, `ScegliQualita.tsx`): sostituito da "Rifai in qualità piena" in galleria e sul risultato.
- `AvvisoTurbo` e `Turbo.tsx`: il Turbo di Qwen non c'è più (D1). Dalla T2 il selettore Qualità non mostra più la voce Turbo.
- In Modifica: la sezione Dimensioni sempre aperta (va in Altro), "Mostra la zona al modello" (sperimentale), il doppio selettore modello.
- Nel Lab: la sezione Preset delle ricette (si tengono le ricette tue, non i preset dei valori), "Vedi i prompt" (va dentro l'editor della ricetta).
- Il LoRA Turbo8 da "consigliato" (fatto in T2) e i `turbo-q*` dai suggerimenti del Setup. Klein Base resta.

**Obiettivo misurabile**: oggi `Crea.tsx` + `Modifica.tsx` + `Laboratorio.tsx` hanno **72** righe con `onClick` (22 + 31 + 19).
Dopo, Crea + Modifica (con le ricette) devono stare **sotto 40**. Si conta con `grep -c onClick` in T14.

---

## 3. Modelli e VRAM (RTX 4060, 8 GB)

| Modello | Denoiser | Encoder per il disegno | Passi | VRAM attesa |
|---|---|---|---|---|
| Qwen base | UC Q4 GGUF 4,6 GB | Qwen3-VL 8B int8 (9,35 GB: non entra, va a pezzi) | 40 | piena, con scambi |
| Klein veloce | int8 ~5,6 GB | Qwen3-VL 4B (entra tutto) | 8 | ~7 GB |
| Klein Base | int8 | Qwen3-VL 4B | 50 (CFG 3,5) | ~7 GB, il doppio del calcolo per il CFG |

Regole (alcune ci sono già, altre sono nuove):
- **Un lavoro alla volta** (`lavori.ts`, la coda): resta. Nessun precaricamento "per fare prima", nessun download pesante del modello mentre la GPU disegna
  (il download va bene, è rete e disco, ma l'**import** di un modello nuovo aspetta la coda ferma).
- **Una cosa alla volta in VRAM** (`fattiSpazio`): oggi distingue solo `immagine / testo / cpu`. Passando da Qwen a Klein restano entrambi `immagine`
  e **non parte `/free`**: due modelli da 5-6 GB si contendono VRAM e RAM. Nuovo: la chiave diventa `immagine:qwen`, `immagine:klein`, `testo:4b`, `testo:8b`
  (T4). È l'unico cambiamento del main sulla memoria, e non tocca i grafi.
- **Testo sempre col 4B, se c'è.** Dalla 1.0.2 il 4B scrive 15-40 token/s contro 0,35 dell'8B. Oggi lo usa solo chi disegna con Klein.
  Proposta: se il file del 4B c'è, `conEncoderDiTesto` lo usa **con qualsiasi modello** (Migliora prompt, Idee, Estrai, Fusion/Esempio, Sorpresa).
  Costo: dopo un testo, il denoiser di Qwen si ricarica (si paga già oggi, perché l'8B fa uscire il denoiser). Da misurare in T12 prima di accenderlo di serie.
  Il disegno di Qwen continua a usare l'8B (lo vuole il modello).
- **Monitorare**: la barra in alto ha già RAM/VRAM/GPU (`risorse.ts`, nvidia-smi ogni 2 s). Nuovo, piccolo: se la VRAM resta sopra il 95% per più di 10 s
  a coda ferma, un avviso "la memoria della scheda non si è liberata, premi Libera" (pulsante che manda `/free`). Niente di automatico in più.
- **Profilo memoria** (`profiloMemoria()`): non cambia.

---

## 4. File da toccare

Renderer:
- `src/shared/modelli.ts` (fatto in T2, puro): `IdModello`, la mappa di D2, `modelloDa`, `modelloDaImpostazioni`, `modelloDaOpera`, `parametriModello`, `inQualitaPiena`, `senzaTurbo`, `denoiserSenzaTurbo`.
- `src/shared/tipi.ts`: `FAMIGLIE` dalla mappa (Klein a 8 passi); `Impostazioni.modelloScelto` (fatto in T2, migrazione in `src/main/impostazioni.ts`). `Famiglia` resta.
- `src/renderer/src/componenti/ScegliModello.tsx`: diventa la riga di pillole della barra in alto (la logica di download resta).
- `src/renderer/src/App.tsx`: selettore nella barra, rotaia a 4 voci, `Pagina` senza `laboratorio` (con redirect se arriva da localStorage).
- `src/renderer/src/stato.ts`: `ModoModifica` → `'scrivi' | 'espandi' | 'ricette' | 'estrai'`, migrazione di `tutta/zona → scrivi`, `fusion/esempio → ricette`.
- `src/renderer/src/pagine/Modifica.tsx` (839 righe): si spezza. `Modifica.tsx` tiene la tela e le schede; nuovi `componenti/SchedaScrivi.tsx`,
  `SchedaEspandi.tsx`, `SchedaRicette.tsx` (prende il corpo di `Laboratorio.tsx`). **Hotspot**: un solo task alla volta su questo file.
- `src/renderer/src/pagine/Laboratorio.tsx`: svuotato in `SchedaRicette`, poi tolto. `workflow.ts`, `ricetteBase.ts`, `ricette.ts`, `LabVista.tsx`, `EditorRicetta.tsx` restano.
- `src/renderer/src/ricetteBase.ts`: due voci nuove, `unisci` (Fusion) ed `esempio`, di tipo "speciale" che mostrano `Fusion.tsx`.
- `src/renderer/src/pagine/Crea.tsx`: via Qualità, avanzate; Formato e Altro.
- `src/renderer/src/azioni.ts` (`perQualita`), `workflow.ts`: i passi vengono dal modello, non più dalla qualità.
- `src/renderer/src/componenti/ScegliQualita.tsx`, `Turbo.tsx`: tolti a fine lavoro.
- `src/renderer/src/pagine/Galleria.tsx` + `MenuContestuale.tsx`: "Rifai in qualità piena".
- `src/renderer/src/pagine/Impostazioni.tsx`: scheda LoRA (monta `pagine/Lora.tsx`), via Klein Base.
- `src/renderer/src/stile.css`: barra, pillole, schede.
- `test/finto.js`: stessi campi del main (`modello`, niente `laboratorio`).

Main:
- `src/main/motore/lavori.ts`: chiave di `fattiSpazio` (T4), testo col 4B (T5), più le modifiche già in corso (§7).
- `src/main/installa/catalogo.ts`: il LoRA Turbo8 fuori dai consigliati (fatto in T2); i `turbo-q*` non si propongono nel Setup (T7).
- `src/main/impostazioni.ts`: migrazione `famiglia` (+ Turbo GGUF) → `modelloScelto` (fatto in T2).
- `engine/versioni.json`: solo se T13 va bene.
- **Non si toccano**: `grafi.ts` per Qwen (si controlla col confronto del grafo, T3), `engine/custom_nodes/*`, l'Album.

Testi: `CHANGELOG.md` (1.1.0), `README.md`, la guida del primo avvio.

---

## 5. Prove (senza Chrome, una cosa alla volta)

- Ogni task: `npm run typecheck` e `npm run build`.
- Test puri con Node 26 (che legge i `.ts` da solo, togliendo i tipi): `node test/pulisci_didascalia.mjs`, e un nuovo `test/modelli.mjs` per la mappa di D2 e le migrazioni.
- **Confronto dei grafi di Qwen** (T3): uno script che costruisce i grafi di Crea/Modifica/Zona/Espandi con `costruisci()` prima e dopo e li confronta in JSON. Deve uscire "uguali".
- Interfaccia: `node test/foto.mjs` (Electron vero, a motore spento). **`test/interfaccia.mjs` (Chromium) in questa release non si usa**, come chiesto.
- GPU: le fa solo **@ollamo**, **una prova alla volta**, con l'app sola aperta (niente browser), log di `nvidia-smi` ogni 2 s salvato accanto al report.

---

## 6. Rischi

1. **Grafi di Qwen cambiati per sbaglio** passando da "qualità" a "modello" → confronto dei grafi (T3) prima di tutto, e di nuovo in T14.
2. **localStorage e impostazioni vecchie** (`modo: 'fusion'`, `pagina: 'laboratorio'`, `famiglia: 'klein-base'`, ricette tue con `qualita`) →
   migrazioni in `stato.ts`/`impostazioni.ts` con test; mai buttare via i dati, solo tradurli.
3. **Klein a 8 passi peggio del previsto sulle modifiche** (zona, riferimenti) → T12 lo misura; se serve, Klein in Modifica usa 12 passi (solo un numero nella mappa).
4. ~~Turbo8 + altri LoRA~~: il Turbo di Qwen non c'è più (D1 rivista). Resta da vedere che i LoRA vadano su Qwen base a 40 passi, come oggi.
5. **Più foto in Modifica**: la tela è per una foto sola → il lotto è permesso solo nella scheda Ricette; nelle altre schede si usa la prima foto e si dice.
6. **`Modifica.tsx` troppo grande e toccato da tutti** → spezzarlo è il primo lavoro sull'interfaccia (T6), poi un task alla volta.
7. **ComfyUI 0.42 rompe la correzione GGUF** → T13 è separato e facoltativo.
8. **Testo col 4B con Qwen** fa ricaricare il denoiser più spesso → si accende di serie solo se T12 dice che conviene (tempo totale di un "Migliora prompt + Crea").

---

## 7. Le modifiche non committate (da integrare, non da scartare)

Oggi nel ramo, fuori dalla 1.0.2:
- `src/main/motore/lavori.ts` (+60 righe): `pulisciDidascalia()` (toglie le frasi di cortesia e le regole che il 4B ricopia prima della didascalia) e il **seed casuale**
  del potenziamento (prima era sempre 0).
- `test/pulisci_didascalia.mjs` (144 righe): prova `pulisciDidascalia` sui campioni veri, ma **ne ricopia la logica** ("stessa logica di…").
- `test/campioni/out_*.txt`: due risposte vere del 4B.
- `scripts/bench_upsampler.mjs` (431 righe): misura tok/s, VRAM, RAM del potenziamento.

Come si integrano (T1, prima di tutto il resto, uscita come **1.0.3**):
1. `pulisciDidascalia`, `PREAMBOLI`, `REGOLA`, `INIZIO_DIDASCALIA` e il vecchio `senzaTitolo` (fa la stessa cosa, il titolo in grassetto) vanno in un file puro
   `src/main/motore/didascalia.ts`, senza import di Electron; `lavori.ts` lo importa. `senzaTitolo` usa la stessa funzione.
2. Il test importa `../src/main/motore/didascalia.ts` (Node 26) invece di ricopiare le regex: se cambia il codice, il test lo vede.
3. `test/campioni/` diventa `test/campioni-pup/` (nome chiaro), si committa (sono testi piccoli).
4. `bench_upsampler.mjs`: dice che il 4B si carica come `flux3`; dalla 1.0.1 per scrivere si usa `krea2` → si allinea, poi si committa. I `bench*.json` sono già nel `.gitignore`.
5. Il seed casuale: si tiene, ma la cache `potenziati` deve restare per prompt (lo è già: lo stesso prompt dà la stessa didascalia finché l'app è aperta).
6. Commit come `cammo22 <78992276+cammo22@users.noreply.github.com>`, senza push finché Cammo non dice ok.

---

## 8. I task (30-60 minuti l'uno)

| # | Task | Chi | Dipende da | Min |
|---|---|---|---|---|
| T1 | Integra le modifiche non committate (§7), 1.0.3 | sonnet | — | 45 |
| T2 | `src/shared/modelli.ts` + migrazione impostazioni + `test/modelli.mjs` (**fatto**, D1 rivista) | opus | T1 | 45 |
| T3 | Script di confronto dei grafi di Qwen (prima/dopo), eseguito su T2 | opus | T2 | 45 |
| T4 | `fattiSpazio` per famiglia (`immagine:qwen` / `immagine:klein` / `testo:4b` / `testo:8b`) | opus | T2 | 30 |
| T5 | Testo col 4B con qualsiasi modello, dietro un'impostazione spenta | sonnet | T4 | 30 |
| T6 | Spezza `Modifica.tsx` in tela + schede, senza cambiare niente di visibile | sonnet | T1 | 60 |
| T7 | Selettore modello nella barra in alto (tre pillole Qwen base / Klein veloce / Klein Base da `ORDINE_MODELLI`, salva `modelloScelto`), via i `turbo-q*` dal Setup, rotaia a 4 voci, LoRA in Opzioni | sonnet | T2 | 60 |
| T8 | Scheda Scrivi (zona automatica se c'è la maschera) + Espandi | sonnet | T6 | 60 |
| T9 | Scheda Ricette (dal Laboratorio) + Unisci/Esempio come ricette; via `Laboratorio.tsx` | sonnet | T8 | 60 |
| T10 | Crea essenziale: via Qualità e avanzate, Formato, Altro | sonnet | T7 | 45 |
| T11 | "Rifai in qualità piena" in galleria e sul risultato (solo sulle foto di Klein veloce: `modelloDaOpera` + `inQualitaPiena` → Klein Base o Qwen base, stesso seed); via `ScegliQualita`, `Turbo.tsx`, `AvvisoTurbo`, `turboPresente` | sonnet | T10 | 45 |
| T12 | Misure GPU (una alla volta, niente browser): Klein 8 vs 16 passi in Crea e zona, Klein Base 50 passi su 8 GB, testo 4B con Qwen, `SetReferenceMultiLatent` | ollamo | T5, T9 | 60 |
| T13 | ComfyUI 0.42.3 su un ramo a parte: generazione vera Qwen + Klein, `motore: 8` solo se va | beam | T1 | 60 |
| T14 | Controllo finale: conteggio `onClick` < 40, confronto grafi, typecheck, build, `test/foto.mjs` | ollamo | T9, T10, T11 | 30 |
| T15 | CHANGELOG 1.1.0, README, testi dell'interfaccia | haiku | T14 | 45 |
| T16 | Avviso "VRAM non liberata" + pulsante Libera | beam | T4 | 30 |

Totale circa 12 ore di lavoro, in serie sui file "hotspot" (`Modifica.tsx`, `lavori.ts`), in parallelo solo dove i file non si toccano
(es. T7 e T6 sì, T8 e T9 no).

Ordine consigliato: **T1 → T2 → (T3, T4, T6, T7) → T5, T8, T10 → T9, T11, T16 → T12, T13 → T14 → T15**.
D1 confermata e cambiata da Cammo il 21/10: Qwen base (40) + Klein veloce (8) + Klein Base (50), niente Turbo di Qwen.
