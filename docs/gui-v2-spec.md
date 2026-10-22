# DaProd Image — GUI v2 «Orbita» · specifica di progetto

**Stato:** bozza 1 per la revisione di Opus · **Base:** `375ac96` (v1.1.0, `feat/klein-upsampler-veloce`) · **Branch:** `design/gui-v2` · **Autore:** claude-sonnet (task t_4a7955f9, subentrato ad Astra per la quota GPT).
**Letti per scriverla:** `CLAUDE.md`, `rapide.ts`, `ricetteBase.ts`, `preset.ts`, `stile.css`, `Crea.tsx`, `Modifica.tsx` / `SchedaScrivi.tsx`, `ScegliModello.tsx`, `Lora.tsx`, `Impostazioni.tsx`, `shared/modelli.ts`, `util.ts`, e la ricerca di Sol (`docs/ricerca-modelli-2026-10.md`, branch `research/modelli-2026-10`).
**Questo documento non cambia `src/`.** Tutto ciò che qui è «proposta di interfaccia» (campi, IPC) va concordato nel thread dei task engine (t_22f93113) e UI (t_3f06c5f1) prima di scriverlo nel codice.
**Mockup:** `docs/mockup/index.html` (statico, si apre con doppio clic; 4 schermate navigabili).

---

## 0. In una pagina

| Cosa chiede l'utente | Come lo risolve la v2 |
|---|---|
| GUI «spaziale», moderna, divertente | Tema **Orbita**: spazio profondo, vetro scuro, stelle in parallasse, anelli di luce al posto dei bordi, microcopy da missione. Sempre leggibile: l'effetto sta nello sfondo e nei bordi, mai sul testo (§8, §9) |
| Crea: pulsanti, niente tendine | Ogni scelta è una **tessera** (icona grande + nome corto). Zero `<select>`; i menu a tendina restano solo per le cartelle di sistema (§4.1) |
| Creare e modificare nella stessa schermata | Una sola schermata **Studio** con quattro modi sullo stesso palco: **Crea · Modifica · Box · Ricette**. Il palco, la console del prompt, la striscia dei risultati e il «contatore di misura» sono condivisi (§3, §4) |
| Risoluzione finale sempre chiara | **HUD misura**: striscia fissa sul palco e nella console con `1536 × 1024 px · 3:2 · 1,50 MP` e, se serve, `disegna a 1,0 MP → ingrandisce ×1,5 → 1536×1024` (§4.2) |
| Editor box (regional prompting) | Modo **Box**: disegni rettangoli sul palco, ognuno con il suo testo, la sua foto-riferimento e un tipo (persona/oggetto/testo/sfondo); disposizioni già pronte (§5) |
| Creazione senza sfondo | Tessera **Senza sfondo** nella riga *Sfondo*: PNG con trasparenza vera, anteprima su scacchi/bianco/nero/colore (§4.1) |
| Modifica: estrarre personaggi e oggetti, semplice | Tessera grande **Estrai**: un clic sulla cosa nella foto → 3 pulsanti di uscita (ritaglio fedele PNG · ricrea in nuova posa/vista · su sfondo a scelta) (§6.3) |
| Ricette: meno, più potenti, unite | Da ~30 a **6** (§7). Le altre si spostano nei controlli di Modifica o nei Generi di Crea |
| Stili tutti rifatti, moderni | **28 stili** in 4 scaffali, con anteprima illustrata e intensità a 3 scatti (§7.4) |
| Pulsanti a griglia con icona (come «Idee»), niente chip/etichette sotto | **Regola d'oro:** tessera = icona grande + una parola. Dentro ogni categoria, **controlli interattivi** (interruttori a icona, cursori, campioni colore, quadranti, orbita camera, segnaposto per foto) al posto dei chip di testo. Il nome lungo compare solo come tooltip (§6) |
| Impostazioni: modelli uncensored con download | Sezione **Laboratorio Uncensored**: interruttore + disclaimer + conferma → catalogo per ruolo con licenza, peso, stato. I modelli attivati compaiono con la fascetta arancio **Uncensored** e **non** sono mai scelti da soli (§9) |
| LoRA migliori per Klein e Qwen | **Pila LoRA**: slot ordinabili con forza, parole chiave, compatibilità per architettura, prova A/B, «look» salvati (§10) |
| ComfyUI: potenza ma semplice | **Cassetto «Ingranaggi»**: la catena di nodi che l'app costruirebbe, mostrata come piccolo grafo di sola lettura con i valori modificabili (§11) |

**Cosa non cambia:** il motore (ComfyUI senza interfaccia), i grafi Qwen, il PNG con le impostazioni dentro, la promessa «fuori dalla zona la foto resta identica al pixel», lo stato in `stato.ts`, le pagine che restano montate.

---

## 1. Principi

1. **Un'azione = un tocco.** Se per ottenere un risultato servono più di due clic e un testo, è sbagliato.
2. **Prima si vede, poi si legge.** Tessere con icona/anteprima; il testo è una parola. Le frasi stanno nei tooltip e nella riga di aiuto sotto il pannello (una sola, cambia al passaggio del mouse).
3. **Niente chip di testo sotto i pulsanti.** I vecchi «+ Cambia persona», «Sorriso», «Occhi aperti» spariscono: diventano controlli (§6.2). Restano solo i chip delle *parole chiave dei LoRA* e dei *tag* `<imageN>` perché sono inserti di testo veri.
4. **La misura è sempre sotto gli occhi.** Mai una modifica di formato/qualità senza vedere i pixel finali.
5. **Ogni controllo compila un pezzo di istruzione.** L'utente non scrive prompt se non vuole; se vuole, la console mostra e lascia correggere il testo compilato.
6. **Potenza a richiesta.** Ogni schermata ha il livello base (tessere) e un livello «Ingranaggi» (§11): seed, passi, CFG, megapixel, LoRA, nodi.
7. **Divertente senza rallentare.** Animazioni solo su `transform`/`opacity`, 120–260 ms, disattivabili («Meno movimento» e `prefers-reduced-motion`).
8. **Una cosa alla volta in VRAM** resta la regola (`unaCosaAllaVolta`): l'interfaccia lo racconta (fasi con nome: «Leggo la foto», «Disegno», «Rifinisco»).

---

## 2. Mappa delle schermate

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Barra titolo bianca (invariata): logo · stato motore · RAM/VRAM/GPU      │
├──────┬───────────────────────────────────────────────────────────────────┤
│ DOCK │                                                                   │
│ 78px │   ┌─ STUDIO ────────────────────────────────────────────────┐     │
│      │   │ modi:  ✦ Crea · ✎ Modifica · ▦ Box · ⚡ Ricette          │     │
│ ✦ Studio                                                                  │
│ ▦ Galleria                                                                │
│ ❏ Album                                                                   │
│ ⬡ LoRA   ← (era dentro Impostazioni: ora è di primo livello)            │
│ ⚙ Impost.                                                                 │
└──────┴───────────────────────────────────────────────────────────────────┘
        + Barra di stato in basso con la coda (invariata nel comportamento)
```

| Schermata | Cosa è | Da dove viene | Note |
|---|---|---|---|
| **Studio** | Crea + Modifica + Box + Ricette sullo stesso palco | `Crea.tsx` + `Modifica.tsx` + `SchedaRicette.tsx` | Il dock non ha più «Modifica» separata. Scorciatoia **2** apre Studio in modo Modifica (compatibile con chi è abituato). Il contenuto resta montato quando si cambia pagina |
| **Galleria** | Come ora, con barra di scelta rapida «Apri in Studio → Modifica / Estrai / Box» | `Galleria.tsx` | Nel tasto destro: «Estrai», «Usa come riferimento», «Usa come base» |
| **Album** | Invariato (tema nuovo, token nuovi) | `Album.tsx` | Fuori scopo di questa spec |
| **LoRA** | Pila e libreria dei LoRA, per modello | `Lora.tsx` (sub-tab di Impostazioni) | §10 |
| **Impostazioni** | Sub-navigazione a sinistra: Modelli · **Uncensored** · Prestazioni · Cartelle · Account · Motore · Info | `Impostazioni.tsx` | §9 |
| **Setup** | Pagina di installazione: stesso flusso, tema nuovo (pianeta che si «accende» a ogni passo) | `Setup.tsx` | Solo grafica |
| **Coda** | Menu a tessere, come ora, con anteprime e fasi | `Coda.tsx` | Aggiunge la fase attuale in italiano |

**Modali / popover ricorrenti:** Misura (popover dal HUD), Cassetto Pila LoRA, Cassetto Ingranaggi, Disclaimer Uncensored, Visore (zoom), Menu contestuale.

**Navigazione da tastiera:** `1` Studio·Crea, `2` Studio·Modifica, `3` Studio·Box, `4` Studio·Ricette, `5` Galleria, `6` Album, `7` LoRA, `,` Impostazioni; `Ctrl+Invio` lancia; `Ctrl+Z/Y` annulla/ripristina nel palco; `B` pennello, `R` rettangolo, `L` lazo, `V` sposta/box, `Spazio` mano; `[ ]` dimensione pennello; `Alt+clic` su una tessera = «mostra cosa farà» (tooltip esteso).

---

## 3. Struttura di Studio (valida per tutti i modi)

```
┌ strip dei modi ───────────────────────────────────────────────────────────────┐
│ [✦ Crea] [✎ Modifica] [▦ Box] [⚡ Ricette]      Motore: ◉ Klein veloce   LoRA 2 │
├───┬──────────────────────────────────────────────────────┬───────────────────┤
│ T │                                                       │  PANNELLO         │
│ O │                    PALCO                              │  CONTESTUALE      │
│ O │   (tela con foto/scena, maschere, box, anteprima      │  (cambia col modo)│
│ L │    live del campionatore, scacchi se trasparente)     │  380 px, scorre   │
│ S │                                                       │                   │
│   │  ┌ HUD MISURA ───────────────────────┐ ┌ zoom ┐       │                   │
│   │  │ ▭ 1536×1024 px · 3:2 · 1,50 MP     │ │ 100% │       │                   │
│   │  └───────────────────────────────────┘ └──────┘       │                   │
├───┴──────────────────────────────────────────────────────┴───────────────────┤
│ CONSOLE:  [ Scrivi cosa vuoi… (Casella) ]  ✦Migliora ▣Da foto ⚄Sorprendimi    │
│           icone delle scelte attive ✕✕✕        [ ◎ CREA ✦  ~2 min ]            │
├───────────────────────────────────────────────────────────────────────────────┤
│ STRISCIA RISULTATI (miniature con anello di avanzamento, ★, …)                 │
└───────────────────────────────────────────────────────────────────────────────┘
```

- **Strip dei modi:** quattro pulsanti grandi (icona + nome). Il modo attivo ha l'anello orbitante. Sulla destra: **Motore** (pulsante-pillola che mostra il modello in uso; clic = apre il pannello Motore) e **LoRA N** (apre la Pila, §10).
- **Strumenti (colonna sottile a sinistra del palco, 48 px):** Sposta/Mano · Pennello · Gomma · Rettangolo · Lazo · **Bacchetta magica** (clic su una cosa → maschera con SAM2, fase engine) · Box (solo modo Box) · Zoom adatta · Annulla/Ripristina. Compaiono solo gli strumenti utili al modo (in Crea senza foto: nessuno).
- **Palco:** una sola tela per tutto. *Crea senza foto:* mostra la cornice vuota con le proporzioni scelte e lo stato vuoto (§8.4). *Con foto:* la foto è la base e il modo passa **da solo** a Modifica con un invito discreto («Hai messo una foto — Modifica?» con due tessere: *Modifica questa* / *Usala come riferimento*). L'utente può sempre tornare a Crea: la foto resta come base «messa da parte».
- **Console:** la `Casella` del prompt (cresce col testo), a destra il pulsante principale. Il pulsante cambia verbo col modo: **CREA ✦**, **MODIFICA ✦**, **COMPONI ✦** (Box), **LANCIA ✦** (Ricette). Sotto il pulsante: stima (`~2 min`) e `Ctrl+Invio`. Le **scelte attive** (idee, stile, LoRA, sfondo, box) sono mostrate come **sole icone** tonde con ✕ al passaggio (non chip di testo) sopra la casella; il tooltip dice cosa sono.
- **Striscia risultati:** invariata nella sostanza (`striscia` / `mini`), con anello di avanzamento attorno alla miniatura in corso.
- **Responsive:** sotto 1280 px il pannello contestuale diventa cassetto (si apre con la tessera «Pannello»), sotto 1100 px la striscia risultati si comprime a una riga. Larghezza minima supportata 1000 px.

**Mappa verso il codice (per Sonnet):** `pagine/Studio.tsx` nuovo compone `StripModi`, `Palco` (riusa `TelaMaschera`, `VistaZoom`, `PrimaDopo`), `Console`, `PannelloCrea`, `PannelloModifica`, `PannelloBox`, `PannelloRicette`. Gli slice di stato `crea` e `modifica` restano separati dietro lo Studio (così i test e i PNG vecchi funzionano); un nuovo slice `studio` tiene `modo`, `box[]`, `sfondo`, `stile`, `misura`. `usaStato.pagina` perde `'modifica'` (diventa alias di `studio` + `studio.modo='modifica'`).

---

## 4. Modo CREA

### 4.1 Pannello contestuale (dall'alto in basso)

Ogni riga è una **riga di tessere**, non un menu. Titolo di sezione in maiuscoletto con un solo numero/valore a destra.

1. **Motore** — tessere larghe (2–3 per riga): *Qwen-Image 2.1* · *Klein veloce* · *Klein Base* (+ tessere *Uncensored* se attivate, §9). Ogni tessera: icona del motore, nome corto, sottotitolo (`40 passi · LoRA`, `8 passi · il più veloce`), stato («da scaricare» = puntino ambra, clic = pannellino di download già esistente in `ScegliModello`). Il motore scelto è anche nella strip dei modi.
2. **Cosa** — griglia **Generi** 4×3: Foto · Ritratto · Prodotto · Poster · Infografica · Logo · Social · Miniatura · Fumetto · Invito · Menù · **Libero**. (Copertina, Slide, App, Arte e Sticker non hanno più una tessera propria: vedi §7.3.) Scegliere un genere mostra sotto **1–3 campi** (stessi `campi` di `preset.ts`), compilati con esempi grigi. Il prompt in inglese si compone da solo.
3. **Atmosfera** — 4 tessere con icona e anteprima (le attuali `stili` per genere: Luce naturale, Ora d'oro, Notte, Pellicola…), ma ora **icone**, non righe di testo. Una sola scelta, «nessuna» possibile.
4. **Stile** — scaffale orizzontale a scorrimento (4 scaffali, §7.4). Tessera 76×76 con anteprima; clic = attiva; secondo clic = disattiva. Sotto, **Intensità** a 3 scatti (Leggero · Pieno · Estremo) come tre pulsanti-pianeta di grandezza crescente.
5. **Formato** — tessere con la **forma** del rettangolo disegnata in scala (1:1, 4:5, 3:4, 2:3, 9:16, 5:4, 4:3, 3:2, 16:9, 21:9) + «Mio» (misura libera). Niente numeri nelle tessere tranne il rapporto.
6. **Misura** — pulsanti **S · M · L · XL · MAX** (= lato corto 512 · 768 · 1024 · 1440 · 2048; le vecchie 256–720 stanno sotto «Bozza» raggruppate in una tessera con ⚡). Ogni pulsante mostra i pixel che darebbe *con il formato scelto* (`1024×683`) — vedi HUD.
7. **Sfondo** — 3 tessere: **Scena** (default) · **Senza sfondo** (PNG trasparente, icona a scacchi) · **Tinta unita** (apre campione colore; utile per prodotti/sticker). Sotto la scelta «Senza sfondo» compaiono i 4 pulsanti-anteprima *Scacchi · Bianco · Nero · Colore* che cambiano solo la vista, non il file.
8. **Quante** — pulsanti **1 · 2 · 4 · 8** (la coda li fa uno dopo l'altro) + tessera **Seed** (dado = nuovo seed a ogni immagine; lucchetto = fissa quello corrente).
9. **Ingranaggi** (chiusa) — megapixel del modello, misura precisa, passi, CFG, ingrandimento (§4.2), cache del prompt, LoRA (§10), «Mostra la pipeline» (§11).

### 4.2 HUD misura (la richiesta più importante)

Sempre visibile in **due posti**: sul palco (in basso a sinistra, vetro) e nella console accanto al pulsante (versione corta). Mai nascosto da altri pannelli. Mostra:

```
 ▭   1536 × 1024 px      3 : 2       1,50 MP
     Il modello disegna a 1280 × 848 (1,08 MP)  →  ingrandisce ×1,2  →  1536 × 1024
```

- **Icona-forma** del rettangolo in scala (si anima con la molla quando cambia il formato).
- **Pixel finali** in grande (numeri a rotolo). **Rapporto** accanto. **Megapixel** accanto.
- **Seconda riga solo quando c'è una conversione**, in tre stati con colore e icona diversi:
  | Stato | Quando | Colore | Testo |
  |---|---|---|---|
  | **Nativa** | il modello disegna esattamente la misura finale | verde | `Nativa: il modello disegna proprio a 1536×1024` |
  | **Ingrandita** | il modello disegna più piccolo e poi `allaMisura()` ingrandisce (`> 1,5×` ⇒ ingranditore RTX / 4x-UltraSharp) | ciano | `Disegna a 1280×848 → ingrandisce ×1,2` — con ×2 o ×4 il nome dell'ingranditore in tooltip |
  | **Ridotta / tagliata** | limite 4,2 MP o 2688 px, oppure la misura precisa non rispetta il rapporto | ambra | `Limite del modello: scende a 2048×1365` / `Taglio al centro di 40 px` |
- **Clic sull'HUD** apre il popover **Misura** con: tessere formato, pulsanti S–MAX, due campi W × H con lucchetto del rapporto, **Ingrandimento** (tessere *Nessuno · ×1,5 · ×2 · ×4 · «Rifinisci 2K»*), **Come l'originale** (solo con una foto sul palco). Qualsiasi cambio aggiorna l'HUD in tempo reale.
- **In Modifica:** l'HUD mostra `uscita` (auto / come l'originale / tua) con la stessa grammatica; con «come l'originale» dice anche `la foto non viene ridimensionata`.
- **Regola di coerenza:** i numeri dell'HUD vengono dalla **stessa funzione** che costruisce la richiesta (`dimensioniRis`, `dimMp`, `allaMisura` in `util.ts`/`grafi.ts`), così «la cifra che vedi è quella che esce». Test: `test/interfaccia.mjs` confronta HUD e `Richiesta` per 10 formati × 5 misure.

### 4.3 Dopo la creazione (azioni sul risultato)
Barra sotto il palco con **icone grandi** (tooltip = nome): ✎ Modifica (passa a modo Modifica con questo come base) · ✂ **Estrai** · ⇄ Varia · ✦ Rifinisci 2K · ⤢ Ingrandisci ×2 · ♻ Riusa · ★ · ⧉ Copia · ▣ Cartella. Il pulsante «Rifai con Klein Base / Qwen» diventa una tessera-motore (stessa tessera del pannello). Con trasparenza: pulsante **PNG** che esporta con alpha (default) + «Scacchi/Bianco/Nero».

---

## 5. Modo BOX (Editor regionale)

**Idea:** il palco ha le proporzioni scelte; l'utente disegna rettangoli e per ognuno dice *cosa ci deve essere*. È la stessa tela di Crea (stesso HUD, stessa console).

```
┌ strumenti ┐ ┌ palco con le proporzioni scelte ────────────────────┐ ┌ pannello Box ─────┐
│ ▭ Disegna │ │  ┌──────1────────┐         ┌───2───┐                │ │ DISPOSIZIONI      │
│ ✥ Sposta  │ │  │ «una ragazza  │         │«cane» │                │ │ ▭▭ ▭▮▭ ▭/▭ ⊞ …    │
│ ⧉ Duplica │ │  │  con cappotto │         └───────┘                │ │ BOX               │
│ ⌫ Elimina │ │  │  rosso»       │   «cielo di tempesta»  (box 3)   │ │ ①  persona   ▲▼ 👁 │
│ ⇅ Livello │ │  └───────────────┘                                  │ │ ②  oggetto   ▲▼ 👁 │
└───────────┘ └─────────────────────────────────────────────────────┘ │ ③  sfondo         │
              HUD misura                                              │ RIGIDITÀ ◔ ◑ ●     │
                                                                      └───────────────────┘
console: scena generale (opzionale)                [ COMPONI ✦ ]  [ Bozza veloce ⚡ ]
```

**Interazioni**
- **Disegnare:** trascina sul palco (strumento Box sempre attivo in questo modo). Il box nasce con un numero, un colore del ciclo spaziale (viola, ciano, magenta, oro, verde, corallo, azzurro, lime) e un campo di testo **dentro il box** (si digita subito: il box è già selezionato). `Invio` conferma, `Esc` annulla, `Tab` passa al box successivo.
- **Modificare:** maniglie agli angoli e ai lati, sposta trascinando dentro, frecce = 1 px, `Maiusc+frecce` = 10 px. Aggancio ai terzi, al centro, ai bordi e ad altri box (linee guida ciano). `Ctrl+D` duplica, `Canc` elimina, `Ctrl+↑/↓` livello.
- **Per ogni box (pannello a destra, scheda espandibile):**
  - **Tipo** (4 tessere a icona): Persona · Oggetto · Testo · Sfondo/Ambiente. Il tipo aggiunge una frase guida al prompt regionale e suggerisce la dimensione.
  - **Testo** (`Casella`): cosa ci deve essere. Per tipo *Testo* è il testo da scrivere fra virgolette.
  - **Riferimento** (segnaposto trascinabile): una foto che diventa `<imageN>` di quel box (persona/oggetto/vestito).
  - **Rigidità** (3 pulsanti): *Suggerita* (box come guida compositiva, il modello può uscire dai bordi) · *Decisa* · *Blocca* (maschera + compositing: solo lì).
  - Ordine/Livello, occhio (nascondi senza cancellare), lucchetto.
- **Disposizioni pronte** (tessere con schema): 1 grande · 2 affiancati · 3 colonne · 2 sopra/1 sotto · terzi · griglia 2×2 · primo piano + sfondo · polaroid · titolo + immagine. Un clic le mette; i box restano modificabili.
- **Bozza veloce ⚡:** esegue la composizione con Klein veloce a bassa risoluzione prima del lancio finale; se piace, **Finale** riusa i box e il seed.
- **Su una foto (modo Box con base):** i box diventano **modifiche multiple** («qui metti X, qui togli Y, qui cambia il colore in Z»), ognuna con la maschera e il compositing esistente, in sequenza. Fase 2 (§12).

**Dati (proposta, da concordare con Sol):**
```ts
interface BoxRegione {
  id: string            // stabile
  rect: [number, number, number, number]  // x0,y0,x1,y1 normalizzati 0–1 sulla tela finale
  tipo: 'persona' | 'oggetto' | 'testo' | 'sfondo'
  prompt: string        // italiano o inglese, tradotto come tutti i prompt
  rif?: string          // percorso foto di riferimento → <imageN>
  rigidita: 'guida' | 'decisa' | 'blocca'
  ordine: number
}
// Richiesta.box?: BoxRegione[]  (+ Richiesta.promptScena = console)
```
La conversione al formato Klein 3 (`[top,left,bottom,right]` su 0–1000) e alle maschere Qwen la fa **solo** l'engine in un adattatore (la ricerca di Sol §6 lo chiede così: internamente XYXY 0–1).

---

## 6. Modo MODIFICA

### 6.1 Flusso

```
 foto sul palco
   │
   ├─ 1) COSA TOCCHI?     [ Tutta la foto ] [ Una zona ] [ Espandi ]          ← 3 tessere larghe
   │        zona: strumenti sul palco (pennello · rettangolo · lazo · bacchetta ✦)
   │
   ├─ 2) COSA VUOI FARE?  griglia 3×3 di categorie con icona (come «Idee»):
   │        Estrai✂  Persone  Vestiti  Situazioni  Prospettiva  Luce e colore  Stili  Testi  Ritocco
   │
   └─ 3) controlli della categoria (§6.2)  →  console  →  MODIFICA ✦
```

- La griglia di categorie è **identica nella forma** al pannello «Idee» che piace all'utente: tessere quadrate, icona in alto, nome sotto. **Nessun chip di testo sotto le tessere.** Una tessera si apre sul posto (accordion con animazione) mostrando i suoi controlli; più tessere possono restare aperte; le scelte attive di ogni categoria si riassumono con una **pallina luminosa** sull'angolo della tessera (numero = quante).
- Le scelte si sommano e il modello le mescola (`pianificaIdee`, già esistente). La console mostra le icone delle scelte attive; `Togli tutte` = icona cestino.
- **Fantasia del modello** (come `FANTASIE`): 3 pulsanti-pianeta (Fedele · Libera · Selvaggia) sotto la griglia.
- Con una **zona** disegnata il pannello mostra in alto la tessera «Solo qui» (anello viola) e nasconde le categorie che non hanno senso su una zona (Situazioni, Prospettiva, Luce globale), come fa oggi `per:['tutta','zona']`.

### 6.2 Controlli interattivi per categoria (sostituiscono le voci di `rapide.ts`)

Convenzioni: **T** = interruttore a icona (tondo, acceso = anello) · **S** = cursore con icone agli estremi · **C** = campioni colore · **Q** = quadrante · **G** = griglia di tessere con icona · **F** = segnaposto foto (trascina/incolla/dalla galleria) · **O** = orbita camera · **N** = stepper (− n +). Il testo libero resta un campo **solo** dove è davvero necessario, in fondo alla categoria («altro…», una riga).

| Categoria | Controlli (nessuna etichetta di testo sotto) | Compila (esempio, EN) | LoRA suggerito |
|---|---|---|---|
| **Estrai ✂** | vedi §6.3 | — | — |
| **Persone** | **G espressione** 6 facce (sorriso, ridere, serio, sorpreso, triste, occhiolino) · **T occhi aperti** · **S età** (−30 … +30 anni, faccia giovane ↔ anziana) · **G capelli** 8 stili a icona + **C colore** (10 campioni + arcobaleno) · **N barba** (nessuna/ombra/corta/folta) · **T occhiali** · **F cambia persona** · **F aggiungi persona** · **T togli le persone** · **G animale** (cane, gatto, cavallo, uccello, drago, ?) | `Make the person smile naturally. Keep the identity…` | coerenza |
| **Vestiti** | **F prova vestito** (foto) · **G capo** (giacca, abito, maglia, pantaloni, cappotto, cappello, scarpe) × **C colore** × **G materiale** (jeans, seta, pelle, lana, metallo) · **G costume** (astronauta, cavaliere, pirata, supereroe, samurai, mago, chef, medico, sposa) | `Dress the person in a … Keep face, hair, pose…` | vestiti |
| **Situazioni** | **G luogo** 10 miniature (città, spiaggia, montagna, bosco, deserto, interno, studio bianco, spazio, sott'acqua, futuro) · **G meteo** (sole, nuvole, pioggia, neve, nebbia, temporale) · **S ora del giorno** (alba→notte, sfondo cielo che cambia) · **G stagione** (4) · **S epoca** (anni '20 → oggi → futuro) · **N folla** · **T svuota la scena** | `Change the time of day to…` | coerenza |
| **Prospettiva** | **O orbita** (sfera 3D: trascina per girare di lato/alto; al rilascio mostra l'angolo in gradi) · **G inquadratura** (dettaglio, primo piano, busto, figura intera, campo largo — con sagoma) · **S altezza** (dal basso ↔ dall'alto) · **G obiettivo** (14 · 24 · 35 · 50 · 85 · 200 mm) | `Rotate the camera 45° to the right…` | camera |
| **Luce e colore** | **Q direzione luce** (quadrante attorno al soggetto, 8+ posizioni) · **G qualità** (morbida / dura) · **S temperatura** (freddo ↔ caldo, striscia colore) · **C colore luce** · **G mood** (studio, ora d'oro, controluce, neon, drammatica, candela) · **G grading** (pellicola, B/N, vivace, cinema, colora il B/N) | `Relight the photo with…` | coerenza |
| **Stili** | **scaffali di stili** (§7.4) + **intensità a 3 scatti** | `Transform into … style. Keep composition…` | — |
| **Testi** | **G lingua** (bandiere: traduci) · **T togli scritte** · **G posizione** (griglia 3×3 dove mettere un titolo) + una riga di testo · **G formato testo** (titolo, cartello, meme, firma) | `Replace the text "…" with "…"…` | — |
| **Ritocco** | **G sfondo** (bianco, grigio, sfumato, **C colore**, «Trasparente» → vedi Estrai) · **T restaura** · **S dettagli** (+ nitidezza) · **S pelle** (naturale ↔ liscia) · **T colora il B/N** · **T foto da CV** | `Restore this old photo…` | coerenza |

- Ogni controllo ha `id`, `categoria`, `tipo`, `icona`, `tooltip`, `compila(valore) → { frase, lora?, rif?, forza? }`. Il catalogo sta in un solo file `controlli.ts` (sostituisce la lista di `rapide.ts`, che resta solo per i PNG vecchi). Test: `test/controlli.mjs` verifica che ogni controllo produca una frase non vuota e che non sia più di 1 `<imageN>` per slot.
- **Regolazioni istantanee** (non generative, in canvas, fase 2): luminosità, contrasto, saturazione, nitidezza come cursori con anteprima live e pulsante «Applica» (crea una versione). Sono la parte «ComfyUI senza attese».

### 6.3 ESTRAI (la funzione da rendere semplicissima)

**Una tessera grande in cima, «Estrai».** Il flusso minimo sono 2 clic:

1. **Clic sulla cosa nella foto** (bacchetta magica attiva da sola) → sagoma evidenziata con bordo luminoso. Se non sai dov'è: pulsante **Trova** (il VLM propone i riquadri, già esistente `trovaElementi`); più sagome: clic su ognuna; `Estrai tutti` per persone e oggetti trovati. Correzioni: `+`/`−` per aggiungere/togliere pezzi, pennello per rifinire.
2. **Scegli l'uscita con un pulsante** (3 tessere grandi, a icona):
   | Pulsante | Cosa fa | Motore | Risultato |
   |---|---|---|---|
   | **Ritaglio** ✂ | Taglia la cosa **dai pixel originali** | SAM2 (maschera) + BiRefNet (bordo/capelli) — **non rigenera** | PNG con trasparenza; identico alla foto |
   | **Ricrea** ✦ | Ricrea la cosa pulita, completando le parti coperte, in nuova posa/vista/inquadratura | Qwen/Klein come l'attuale `richiestaEstrai` | PNG o immagine su sfondo, identità simile non garantita (avviso a icona ⚠) |
   | **Su sfondo** ▣ | Ritaglio + sfondo scelto (bianco, grigio, colore, sfumato, un'altra foto) | maschera + compositing | immagine |
- **Persone:** dopo *Ricrea* compaiono 2 righe di tessere: **inquadratura** (intera · vita · volto) e **posa** (come nella foto · T · A · in piedi · omino). **Oggetti:** **vista** (come nella foto · davanti · ¾ · alto · lato).
- **Risultati:** appaiono in un pannello «Estratti» con scacchi; ogni pezzo si **trascina fuori** (esporta file), si **fa clic destro → «Usa come riferimento»** o **«Metti nel Box»** (porta il pezzo come `rif` di un box, pensato per ricomporre scene). Salvati anche in Galleria con tag `estratto`.
- Le due strade (fedele vs rigenerata) sono sempre **distinte per nome e icona**: il ritaglio non promette ciò che non può dare (parti nascoste), la ricreazione non promette fedeltà pixel.
- **Engine richiesto:** `estrai:ritaglia({foto, punti|box|maschera}) → {png, maschera}` (SAM2 + BiRefNet, caricati su richiesta, scaricati dalla VRAM prima del DiT) — proposta da chiudere con Sol. Per iniziare, il flusso «Ricrea» e «Trova» funzionano già oggi.

### 6.4 Espandi (zona di lavoro)
Tessera «Espandi»: 4 frecce sui lati del palco con anello trascinabile, preset **Quadrato · 16:9 · 9:16 · +20%**, e l'HUD che mostra `da 1024×768 → 1536×768`. Nessun cambio al grafo.

---

## 7. Ricette, Generi e Stili

### 7.1 Principio
Le ~30 ricette di `ricetteBase.ts` oggi sono un catalogo lungo con ingressi eterogenei. La v2 ne tiene **6 «superpoteri»**, ognuna con **segnaposti e tessere** invece di testi. Il resto è assorbito da Crea (Generi), Modifica (controlli) o scompare.

### 7.2 Le sei ricette

Ogni ricetta è una **locandina** (512×320, illustrazione generata, §13) nella scheda *Ricette*; si apre un pannello con 3–5 tessere/segnaposti e il pulsante **LANCIA ✦** che mostra, prima, quante immagini farà e il tempo (`9 immagini · ~6 min`).

| # | Ricetta | Cosa fa | Ingressi (tutti a tessere/segnaposti) | Uscita | Assorbe |
|---|---|---|---|---|---|
| 1 | **Foglio** | Da **un soggetto** fa una serie coerente: stessa persona/cosa che varia **una** dimensione | segnaposto soggetto (foto o testo) · tessere **Varia**: *Viste* · *Pose* · *Emozioni* · *Età* · *Vestiti* (segnaposti multipli) · *Azioni* · *Giro 360°* (con orbita) · **Quante** 4 · 6 · 9 | N immagini + **foglio unico** (contact sheet) | turnaround, giro, viste, eta, sticker (emozioni), prova i vestiti, sticker-azioni, tempo (parte «età») |
| 2 | **Mondi** | «E se…?»: la stessa scena in più mondi | foto o testo · tessere **Cambia**: *Luogo* · *Epoca* · *Stagione* · *Stile* · *Tutto* · **Quanti** 4 · 6 · 9 · riga «E se…» libera facoltativa | N varianti + foglio | sefosse, tempo, preset-*stili |
| 3 | **Mix** | Unisce più foto con **ruoli**: base, persona, oggetto, vestito, stile da copiare | segnaposti con ruolo (icona): Base · Persona · Oggetto · Vestito · **Stile da copiare** (opz.) | 1–4 immagini | unisci, esempio (Come l'esempio = ruolo «Stile da copiare») |
| 4 | **Set** | Una **serie di cose** con stile coerente e **sfondo trasparente** di default (sticker, icone, loghi, personaggi) | tessere tipo (*Sticker* · *Icone* · *Loghi* · *Mascotte*) · riga «un soggetto per riga» o foto di riferimento · **Stile** (§7.4) | PNG trasparenti + foglio | sticker-tutto, sticker-lista, icone-set, preset logo/sticker |
| 5 | **Formati** | Una idea → tutti i formati e i mockup | idea o foto · **tessere multiscelta** formati (1:1, 4:5, 9:16, 16:9, 2:3, **Stampa**) · tessere **Mockup** (maglietta, tazza, cartellone, biglietto di auguri: usa il tuo logo se lo trascini) | N immagini coerenti | formati, mockup, auguri, preset social/miniatura/slide |
| 6 | **Rinnova** | Un'operazione di trasformazione «prima/dopo» a scelta | foto · tessere **Cosa**: *Restaura* · *Dal disegno al render* · *Svuota e arreda* · *Ingrandisci e rifinisci* · *Colora* | 1–2 immagini + **Prima/Dopo** | restauro, disegno, arreda, restaura/dettagli (rapide) |

- **Le tue ricette** (`ricette.ts`) restano: tab «Mie» + pulsante **Salva come ricetta** nella console (salva i controlli attivi di Modifica o la catena di una ricetta). Il vecchio `EditorRicetta` viene semplificato (passi in verticale come nodi, §11).
- **Migrazione** (per Sonnet): le ricette vecchie *utente* (localStorage) continuano a funzionare; le ricette di serie rimosse restano caricabili dai PNG vecchi (`ricetteBase.ts` si conserva per leggere i PNG, non per mostrare). Lotto su più foto (`avviaLotto`): vale per Foglio, Mondi, Rinnova.
- **Tolti del tutto:** *testo-foto*, *meme*, *lingue* → diventano controlli di **Testi** (6.2); *mockup logo* → Formati; *preset-** (uno per genere × stili) → sostituiti da Genere × Stile di Crea.

### 7.3 Generi di Crea (ex preset)
16 preset → **11 generi + Libero**. Fusi: Copertina→Poster (formato 2:3), Slide e App→Social (formato 16:9 / 9:16), Arte→**Stile**. Sticker e Logo restano come **tipo del Set** (Ricette) e come tessere Genere con `Sfondo: Senza sfondo` già acceso. I campi di ogni genere restano in italiano e fra virgolette i testi da disegnare (invariato da `preset.ts`).

### 7.4 Stili nuovi (28)

Tutti mostrano una **anteprima** (asset §13, stessa scena in ogni tessera per confrontarli). Il frammento di prompt è in inglese; l'**intensità** (Leggero · Pieno · Estremo) cambia la frase («subtle … influence» / «in … style» / «fully rendered as … , extreme») e in Modifica il `denoise` (0,45 · 0,7 · 0,9). Ogni stile ha un `id` stabile.

**Scaffale 1 — Foto d'oggi**
| id | Nome | Frammento |
|---|---|---|
| `cinema-anam` | Cinema anamorfico | cinematic still, anamorphic lens flares, oval bokeh, rich color grade, 2.39:1 feel |
| `flash-y2k` | Flash 2000 | direct on-camera flash, early-2000s compact digital camera look, harsh highlights, candid party snapshot |
| `pellicola35` | Pellicola 35mm | shot on 35mm film, visible grain, soft halation, faded blacks |
| `moda-editoriale` | Moda editoriale | high-fashion editorial photography, studio strobes, bold color blocking, magazine cover composition |
| `polaroid` | Polaroid | instant film photo, white frame, soft focus, washed warm tones, light leaks |
| `notte-neon` | Notte al neon | night street photography, wet asphalt reflections, magenta and cyan neon signage |
| `documentario` | Reportage | gritty documentary photograph, available light, slightly desaturated, imperfect framing |

**Scaffale 2 — Disegnati**
| id | Nome | Frammento |
|---|---|---|
| `anime-film` | Anime da film | high quality anime movie still, painterly backgrounds, soft cinematic lighting |
| `acquerello-film` | Acquerello animato | hand-painted watercolor animation background, soft gradients, gentle clouds |
| `manga-inchiostro` | Manga a inchiostro | black and white manga, screentones, dynamic inked lines |
| `gouache` | Gouache moderna | contemporary gouache illustration, flat shapes, rich matte colors, subtle paper texture |
| `risograph` | Risograph | two-color risograph print, grainy overprint, misregistration, limited palette |
| `collage` | Collage di carta | cut-paper collage, layered torn paper edges, mixed textures |
| `linea` | Linea unica | minimal single continuous line drawing on white, a touch of color |

**Scaffale 3 — In 3D**
| id | Nome | Frammento |
|---|---|---|
| `soft3d` | 3D morbido | soft 3D render, rounded shapes, pastel studio light, subsurface scattering, friendly character look |
| `plastilina` | Plastilina | stop-motion claymation, visible fingerprints, handmade imperfections |
| `vinile` | Vinile da collezione | designer vinyl toy, glossy plastic, seam lines, studio product shot |
| `diorama` | Diorama isometrico | isometric miniature diorama, tilt-shift, clean cube base, soft shadows |
| `mattoncini` | Mattoncini | scene built of interlocking plastic bricks and minifigures |
| `vetro` | Vetro liquido | liquid glass and crystal, refractive translucent material, caustics, iridescent edges |
| `chrome` | Cromo Y2K | chrome blobject, reflective metal, hyperreal studio HDRI, early-2000s futurism |

**Scaffale 4 — Grafica spaziale e oltre**
| id | Nome | Frammento |
|---|---|---|
| `cyberpunk` | Cyberpunk | dense neon cityscape, holograms, rain, high contrast magenta/teal |
| `synthwave` | Synthwave | retro-futuristic 80s sunset grid, chrome lettering, purple-pink gradient sky |
| `aura` | Aura gradient | soft airbrushed aura gradients, grain, glowing blurred shapes, dreamy abstract |
| `pixel` | Pixel 32-bit | detailed 32-bit pixel art, limited palette, dithering |
| `spaziale60` | Space age ’60 | 1960s space-age illustration, atomic shapes, retro NASA poster palette |
| `solarpunk` | Solarpunk | solarpunk utopia, lush green architecture, warm sunlight, art nouveau curves |
| `svizzero` | Poster svizzero | Swiss international typographic poster, strong grid, flat color, bold sans-serif |

Nei vecchi `rapide.ts` (13 stili) e `preset.ts` (stili per genere) **non resta nulla**: i PNG vecchi si leggono comunque perché le impostazioni stanno dentro il file.

---

## 8. Design system «Orbita»

### 8.1 Palette

Dallo spazio profondo (continuità col viola/oro/magenta DaProd, ma più scuro e con il ciano come terzo colore).

| Token | Valore | Uso |
|---|---|---|
| `--vuoto` | `#04030c` | fondo assoluto (dietro lo starfield) |
| `--spazio-1` | `#0a0716` | fondo app |
| `--spazio-2` | `#110c24` | pannelli |
| `--spazio-3` | `#1a1338` | rialzo (tessere a riposo) |
| `--spazio-4` | `#251c4d` | tessere al passaggio |
| `--vetro` | `rgba(22,15,50,.62)` + `backdrop-filter: blur(14px) saturate(1.2)` | HUD, popover, console |
| `--bordo-vetro` | `rgba(190,160,255,.16)` | bordo sottile dei pannelli |
| `--testo` | `#f1ecff` | testo principale (contrasto ≥ 12:1 su `--spazio-2`) |
| `--tenue` | `#b2a7d8` | testo secondario (≥ 7:1) |
| `--spento` | `#7a70a3` | testo disattivo (≥ 4,5:1 su `--spazio-2`) |
| `--nebulosa` | `#8a5cff` | viola principale (selezione, focus) |
| `--supernova` | `#ff3df2` | magenta (azione primaria, gradiente) |
| `--plasma` | `#3fe0ff` | ciano (misura, aiuti, upscale) |
| `--stella` | `#ffd54a` | oro (valori, "attivo") |
| `--cometa` | `#ffb627` | oro scuro/ambra (avvisi lievi) |
| `--ok` | `#3ee08f` | verde |
| `--errore` | `#ff5470` | rosso |
| `--ember` | `#ff8a3d` | **arancio Uncensored** (solo per questo scopo) |
| `--aurora` | `linear-gradient(135deg,#8a5cff 0%,#ff3df2 55%,#3fe0ff 100%)` | pulsante primario, anello attivo |
| `--corona` | `linear-gradient(135deg,#ffd54a,#ff8a3d)` | stato "speciale"/Uncensored/oro |

Contrasto: tutti i testi su pannello ≥ 4,5:1; i colori accento non portano testo piccolo senza fondo scuro. L'arancio Uncensored è riservato (mai usato per altro).

### 8.2 Token

```css
:root{
  /* superfici */ --raggio-s:8px; --raggio:12px; --raggio-l:18px; --raggio-pill:999px;
  /* spazi (griglia 4) */ --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px; --s6:32px;
  /* ombre e bagliori */
  --ombra-1:0 1px 0 rgba(255,255,255,.04) inset, 0 6px 18px rgba(0,0,0,.35);
  --ombra-2:0 10px 40px rgba(0,0,0,.55);
  --alone-nebulosa:0 0 0 1px rgba(138,92,255,.7), 0 0 22px rgba(138,92,255,.45);
  --alone-supernova:0 0 0 1px rgba(255,61,242,.7), 0 0 26px rgba(255,61,242,.4);
  --alone-plasma:0 0 0 1px rgba(63,224,255,.7), 0 0 20px rgba(63,224,255,.35);
  /* movimento */
  --t-rapido:120ms; --t-base:200ms; --t-lento:320ms;
  --curva:cubic-bezier(.2,.8,.2,1); --molla:cubic-bezier(.34,1.56,.64,1);
  /* tipografia */
  --titolo:'Orbitron','Rajdhani',sans-serif;   /* solo titoli, tessere grandi, numeri HUD */
  --font:'Rajdhani','Segoe UI',system-ui,sans-serif; /* corpo */
  --num:'Rajdhani',ui-monospace,monospace;      /* numeri tabulari: font-variant-numeric:tabular-nums */
  --t-tessera:13px; --t-corpo:15px; --t-titolo-sez:12px; --t-hud:22px;
  /* strati */ --z-stelle:0; --z-app:1; --z-hud:20; --z-popover:60; --z-modale:100; --z-toast:120;
  /* tessera */ --tessera:84px; --tessera-l:120px; --icona:28px;
}
```

Font: restano **Orbitron** (titoli/numeri) e **Rajdhani** (corpo) già nel pacchetto (`@fontsource`): nessuna nuova dipendenza.

### 8.3 Componenti base

| Componente | Descrizione | Stati |
|---|---|---|
| **Tessera** (`Tessera`) | quadrato `--tessera`, icona 28 px in alto, una parola 13 px sotto (max 12 caratteri, `text-overflow`); sfondo `--spazio-3`, bordo `--bordo-vetro` | riposo · hover (alza di 2 px + alone tenue) · attiva (anello **aurora** rotante lento, icona `--stella`) · disabilitata (40%) · da scaricare (puntino ambra) · con valore (pallina luminosa + numero) |
| **Tessera larga** | 2 per riga, icona a sinistra + nome + sottotitolo breve | come sopra |
| **Tessera anteprima** | 76×76 con immagine di fondo (stili, luoghi) e nome in banda scura in basso | come sopra |
| **Interruttore a icona** | tondo 44 px, icona; acceso = anello + riempimento | on/off · hover · focus |
| **Cursore stellare** | traccia sottile con segnaposti-icona ai lati; il pomello è una stella con scia | trascinamento: pomello cresce, valore in bolla |
| **Campione colore** | pallini 22 px, il selezionato ha corona; ultimo = ruota colore | |
| **Quadrante** | cerchio con pallino-sole orbitante (direzione luce) | |
| **Segnaposto foto** | rettangolo tratteggiato 72×72 «+»; accetta trascina/incolla/galleria; compilato = miniatura + ✕ + tag `<imageN>` | |
| **Pulsante primario** | `--aurora`, testo bianco, 48 px alto; anello di avanzamento attorno al bordo durante il lavoro | riposo · hover (alone) · premuto (scala .97) · in corso (anello orbita + percentuale) · bloccato |
| **HUD** | vetro scuro, numeri Orbitron 22 px | nativa/ingrandita/ridotta (§4.2) |
| **Fascetta Uncensored** | pillola `--ember`, lettere maiuscole 10 px, icona fiamma | solo sui modelli uncensored |
| **Toast** | vetro, 3 s, in basso a destra | ok · avviso · errore |

Icone: stile esistente (24×24, tratto 1,8, `Icone.tsx`), **ampliate** a ~60 icone nuove (elenco in §13.4) disegnate come SVG a mano — **non** generate da Klein.

### 8.4 Sfondo, stati vuoti, pianeti
- **Sfondo app:** `--vuoto` + 3 strati: (1) nebulosa statica (immagine asset `bg-nebulosa`, opacità .35) — (2) campo di stelle (canvas 2D, 160 punti, deriva lenta; 2 strati di parallasse che si muovono di 2–4 px col mouse) — (3) vignettatura. Si ferma quando la finestra non è in primo piano o con «Meno movimento».
- **Stato vuoto di Studio:** pianeta in basso a sinistra (asset `hero-pianeta`) + un astronauta che galleggia (asset, 6 s di loop CSS) + frase «Cosa costruiamo oggi?» + 3 tessere di partenza (*Crea dal nulla · Apri una foto · Prova una ricetta*).
- **Setup / primo avvio:** il pianeta si «accende» a ogni passo (anelli di luce).

---

## 9. Impostazioni

### 9.1 Layout
Sub-navigazione verticale a sinistra (tessere piccole con icona), contenuto a destra a larghezza massima 880 px, sezioni a scheda vetro. Ordine: **Modelli · Uncensored · Prestazioni · Cartelle · Account · Motore · Aggiornamenti · Info**. I `<select>` residui di `Impostazioni.tsx` (`voceScelta`) diventano **segmenti a pulsanti** (profilo memoria: Auto · Bassa · Normale · Alta; traduttore: Opus-MT · LLM; ecc.).

### 9.2 Laboratorio Uncensored

```
┌ LABORATORIO UNCENSORED ───────────────────────────────────────────────────┐
│ 🔥 Modelli senza filtri di rifiuto                    [ ◯────  Disattivato ] │
│ Per scrittura libera e immagini mature fra adulti consenzienti.            │
│ Sono più liberi, non “permessi”: la legge e le licenze valgono sempre.     │
└────────────────────────────────────────────────────────────────────────────┘
(attivato) CATALOGO PER RUOLO
 Ruolo       Modello                         Licenza        Peso    Stato
 Testo (LLM) Qwen3-VL 4B abliterated          Apache-2.0     ~4 GB   [Scarica]   (in valutazione)
 Encoder     Qwen3-VL 8B Uncensored (GGUF)    Apache-2.0     ~5 GB   [Scarica]
 Immagine    Qwen-Image 2.1 Uncensored Q4/6/8 Qwen Research  4–7 GB  [Scarica]   ⚠ solo uso non commerciale
 Immagine    FLUX / Klein 3                   Kommunity      —       [Non disponibile] ℹ la licenza vieta di aggirare le protezioni
```

**Flusso**
1. L'interruttore apre il **disclaimer** in modale (non si attiva finché non lo si accetta):
   > **Prima di continuare.** Questi componenti non rifiutano le richieste e possono produrre contenuti sensibili o inesatti. Usali solo per scopi leciti, con i diritti e il consenso necessari. Sono vietati — e non verranno mai supportati — contenuti sessuali che coinvolgono minori, immagini intime non consensuali, deepfake ingannevoli di persone reali, violenza reale o altri usi illegali. «Uncensored» non significa «senza regole»: restano valide le leggi del tuo Paese e le licenze di ogni modello (che possono vietare l'uso commerciale o la ridistribuzione). Rispondi tu di ciò che crei e pubblichi.
   Tre caselle **obbligatorie** (non preselezionate): *Ho almeno 18 anni* · *Userò questi modelli solo per scopi leciti e nel rispetto delle licenze* · *Capisco che chi crea i contenuti ne è responsabile*. Pulsante **Attiva** disabilitato finché non sono tutte accese. Si registra `uncensored.accettatoIl` (data) e `versioneDisclaimer`.
2. Attivato: compare il catalogo. Ogni riga ha **ruolo, licenza (link), peso, stato, pulsante**. Per i modelli con licenza non commerciale (Qwen Research) il download chiede una **seconda conferma** con il testo della licenza e non parte da solo. **Niente download automatici** dell'idle (`idle.ts` li esclude esplicitamente).
3. Nessun file illegale o d'abuso nel catalogo; le voci le approva il team (lista chiusa in `catalogo.ts`, `categoria: 'uncensored'`, con `repo`, `revisione`, `licenza`, `ruolo`).
4. **Dopo il download**, il modello compare nel selettore Motore (Studio e Impostazioni) come tessera con **fascetta Uncensored**. **Non è mai scelto da solo**: al riavvio il motore torna a un modello standard (`modelloScelto` non può essere un uncensored al caricamento), le ricette/lavori in coda non lo usano se non è stato scelto esplicitamente; il tooltip dice *«Scelto da te: nessun filtro di rifiuto»*.
5. **Segnali visivi** quando è in uso: fascetta fissa accanto al pulsante Crea, bordo console in `--corona`, `uncensored: true` nelle impostazioni dentro il PNG (e filtro «solo uncensored» in Galleria per trovarli).
6. **Disattiva:** l'interruttore spento nasconde le tessere (i file restano), e il pulsante **Rimuovi i file** li cancella dopo conferma.

### 9.3 Decisione aperta (D1 — serve Opus/utente)
La ricerca di Sol (§3) dice che **FLUX 3 Klein** ha licenza Kommunity con §4(d) che vieta di aggirare/rimuovere le protezioni; l'encoder Klein uncensored (AtomicChat) non è utilizzabile nel sampler e non esiste un denoiser Klein «de-safety» legittimo da distribuire. **Proposta per la v2:** il catalogo Uncensored contiene **LLM** (testo/Idee/Migliora) e **Qwen-Image 2.1** (con avviso licenza Research). La riga **Klein/FLUX** compare come *«Non disponibile»* con spiegazione cliccabile. Se l'utente vuole comunque una voce Flux, l'unica via pulita è **FLUX.2 Klein 4B (Apache-2.0)** + un encoder uncensored dalla licenza chiara (oggi nessuno verificato): da valutare da Sol. **Rispondere nel thread** prima che Sonnet scriva il catalogo.

---

## 10. Gestione LoRA (Studio + pagina LoRA)

**Obiettivi:** caricare più LoRA con forza e ordine per **entrambe** le famiglie, capire a colpo d'occhio cosa è compatibile col modello scelto, provare «con e senza».

### 10.1 Cassetto «Pila LoRA» (da Studio, pulsante `LoRA N` nella strip)

```
┌ PILA LORA · per Klein veloce ───────────────── [＋ Aggiungi] ┐
│ ① ⠿ [thumb] Cinema grain      Klein 3 ✓   ━━●━━ 0,70  [S] [👁]  ⋯ │
│     parole chiave: [cngrain] ← clic le inserisce nel prompt        │
│ ② ⠿ [thumb] Visi coerenti     Klein 3 ✓   ━●━━━ 0,50  [S] [👁]  ⋯ │
│ ③ ⠿ [thumb] Acquerello XL     ⚠ non per Klein   (spenta, grigia)    │
│ Suggeriti da te in Modifica:  (+) Coerenza   ← un clic = in pila   │
│ [ ◧ Prova A/B ]   [ Salva come look ▾ ]            Forza totale 1,20 ⚠│
└────────────────────────────────────────────────────────────────────┘
```

- **Slot ordinabili** (trascina `⠿`; l'ordine è l'ordine di applicazione dei `LoraLoaderModelOnly`). Max 8 slot attivi (avviso oltre 4).
- **Compatibilità per architettura**, non per «Flux»: badge `Qwen 2.1` · `Klein 3` · `Klein 2 4B/9B` (se aggiunti) · `Altro (SD/SDXL/Flux 1)` · `Sconosciuto`. Si legge dall'intestazione safetensors (come oggi `lora:info`) e dal sidecar `.json` se c'è. Il LoRA incompatibile col modello in uso è **grigio, con motivo** («fatto per Qwen 2.1, qui usi Klein»), non nascosto; si può comunque tenere in pila per l'altro modello (la pila ha **una vista per modello**: cambiando motore cambia la pila; i LoRA condivisi tra famiglie non esistono).
- **Forza** 0–1,5 (avanzate: −1,0…2,0) con valore di partenza dalla scheda o **0,7** (la ricerca lo propone come default UI). Doppio clic sul cursore = ripristina. Nessuna normalizzazione automatica; la **forza totale > 1,8** mostra solo un avviso.
- **S (solo)** = prova questo LoRA da solo (gli altri in pausa per un lancio); **occhio** = spegni senza rimuovere.
- **Parole chiave** come chip (qui servono davvero): un clic le inserisce una sola volta nel prompt; il motore le aggiunge comunque (`conParoleLora`). Il testo da disegnare e le parole chiave restano separati.
- **Gruppo esclusivo «Acceleratori»** (Turbo/Lightning/Distillazione): se ne può accendere uno solo; i conflitti sono spiegati.
- **Suggeriti** (`ChiaveLora` di `rapide.ts`: coerenza, vestiti, camera): compaiono come slot fantasma quando una categoria di Modifica li chiede, un clic li mette in pila.
- **Prova A/B:** lancia 2 immagini con lo stesso seed, una con la pila e una senza (o con/senza il LoRA selezionato), le mostra affiancate con cursore di confronto (`PrimaDopo`). Costa 2 immagini: l'HUD lo dice.
- **Look:** salva la pila (con forze e ordine) come preset nominato; tessere a icona per richiamarli.
- **Nel PNG** (`png.ts`): per ogni LoRA `hash, file, peso, ordine, base, trigger`; cambiare un peso/ordine invalida le cache (lavoro del motore).

### 10.2 Pagina LoRA (libreria)
- Griglia di **carte con copertina** (immagine generata in app: l'ultima dove è stato usato + miniatura del creatore, se c'è), filtro a **tessere**: *Tutti · Per questo modello · Qwen · Klein · Stili · Persone · Dettagli · Acceleratori*; ordinamento recenti/nome.
- **Aggiungi:** trascina `.safetensors` ovunque nella finestra (già esiste) · incolla link Hugging Face/Civitai · «Scansiona cartella». Dopo l'import: **assistente a 2 passi** (1. «Per quale modello l'hai preso?» con riconoscimento automatico ma correggibile; 2. parole chiave e forza). I pickle (`.pt/.ckpt`) vengono rifiutati con spiegazione.
- **Consigliati** (`catalogo.ts`): tessere per modello (Qwen 2.1: coerenza, vestiti, camera; Klein 3: da aggiungere dopo il test del loader di Sol).
- **Dettaglio carta:** metadati (base, formato, hash, licenza), storico di uso, pulsanti *Prova A/B*, *Apri la pagina*, *Mostra nella cartella*, *Elimina*.
- **Dati richiesti dall'engine (proposta a Sol):** `lora:info(file) → { architettura, baseRevisione?, formato, sha256, trigger[], pesoConsigliato?, distillazione?: 'turbo'|'lightning'|null, compatibili: IdModello[] }`; `Richiesta.lora: { file, peso, ordine }[]` (esiste in forma più semplice); test del loader Klein prima di abilitare il caricamento.

---

## 11. Cassetto «Ingranaggi» (ispirato a ComfyUI, ma semplice)

Piccolo pulsante `⚙` accanto al pulsante primario. Apre un cassetto a destra con il **piano di volo**: la catena di passi che l'app farà per questa richiesta, disegnata come **grafo verticale di nodi** (6–10 nodi), solo lettura per la struttura ma con i **valori modificabili sul nodo**.

```
 ◉ Foto base 1024×768
  │
 ▢ Zona (maschera morbida, contesto 0,8)
  │
 ◇ Motore: Klein veloce · 8 passi · CFG 1       [seed 123456 ⚄]
  │        └─ LoRA ① Cinema grain 0,70
 ◇ Testo: tradotto in inglese · migliorato
  │
 ✦ Campionatore euler/simple
  │
 ⤢ Ingrandisce ×1,2 (RTX)  →  1536×1024
  │
 ⬒ Salva PNG (alpha)  + Galleria
```
- I nodi sono *derivati dalla richiesta*, non un editor libero: niente cavi da collegare. Ogni nodo mostra 1–3 valori modificabili (passi, CFG, seed, megapixel, forza LoRA, denoise).
- **Modifica ricetta:** «Salva questa catena come ricetta» (Le mie). L'Editor ricette diventa una versione dello stesso grafo con passi riordinabili e ingressi esposti (testo, foto, scelta).
- **Esporta grafo ComfyUI** (`.json` workflow) per chi vuole aprirlo altrove — fase 3, utile per i power user.
- Vale come strumento di diagnosi: se un lavoro fallisce, il nodo in errore è evidenziato in `--errore`.

---

## 12. Micro-interazioni

Tutte rispettano «Meno movimento» (le durate vanno a ~0 e si spegnono rotazioni e parallasse).

| Dove | Interazione | Dettaglio |
|---|---|---|
| Tessere | **Hover** | sollevamento 2 px, alone tenue `--alone-nebulosa`, icona che «respira» (scala 1→1,06, 600 ms) |
| Tessere | **Selezione** | anello `--aurora` che compare con un'espansione a molla e poi ruota lentamente (12 s/giro); l'icona passa a `--stella` |
| Tessere | **Pallina valore** | quando una categoria ha scelte attive, una pallina luminosa pulsa una volta e mostra il numero |
| Interruttori | **Accendi** | il pianeta scivola e l'anello si accende; click sonoro opzionale (OFF di default) |
| Cursori | **Trascina** | il pomello-stella allunga una scia; il valore appare in una bolla vetro sopra; rilascio = piccolo «ping» luminoso |
| Strip modi | **Cambio modo** | il pannello a destra scorre di 24 px con dissolvenza (220 ms); il palco non salta (stessa tela) |
| Palco | **Rilascio foto** | l'anello «wormhole» si apre dal punto del rilascio e la foto vi entra; invito Modifica/Riferimento |
| Palco | **Cambio formato** | la cornice cambia forma con una molla (240 ms); l'HUD fa rotolare i numeri |
| HUD | **Cambio stato** (nativa/ingrandita/ridotta) | l'icona e il colore cambiano con un lampo breve; la seconda riga si espande/collassa |
| Box | **Nuovo box** | scala .9→1 con alone; bordo tratteggiato che avanza («formiche in marcia») finché è selezionato |
| Box | **Elimina** | si ritrae verso il centro e svanisce (140 ms) |
| Box | **Aggancio** | linee guida ciano a comparsa istantanea, un tick a 60 Hz (nessuna latenza) |
| Pulsante primario | **In corso** | un anello di luce gira attorno al bordo, il testo diventa fase+percentuale («Disegno… 42%») |
| Palco | **Anteprima live** | l'anteprima taesd si sfuoca in ingresso e si «mette a fuoco» con ogni passo (blur 8→0) |
| Risultato | **Finito** | piccola **supernova** (anello che si espande e svanisce, 500 ms) attorno alla miniatura; l'immagine si deposita nella striscia con rimbalzo |
| Errore | **Fallito** | la miniatura trema 2 volte, bordo `--errore`, toast con la causa in italiano e azione «Riprova» |
| Estrai | **Sagoma** | il bordo della maschera scorre come un'aurora (gradiente animato); dopo il ritaglio la cosa «esce» dalla foto con ombra e scorre nel pannello Estratti |
| Impostazioni | **Attiva Uncensored** | la modale fa una breve scossa di avvertimento sul pulsante se le caselle non sono tutte accese; dopo l'attivazione la tessera appare con la fascetta fiamma |
| LoRA | **Trascina slot** | lo slot si solleva, gli altri scorrono; sul rilascio fa un «clic» di aggancio |
| Generale | **Parallasse** | lo starfield si sposta di 2–4 px verso il mouse (rAF, throttle 30 fps) |
| Generale | **Stati vuoti** | l'astronauta fluttua; cliccandolo fa una piroetta (easter egg) |
| Generale | **Easter egg** | digitando «cometa» o ↑↑↓↓ passa una cometa sullo schermo (una volta per sessione) |

**Microcopy spaziale (ma sempre chiaro)**

| Momento | Testo |
|---|---|
| Stato vuoto | «Cosa costruiamo oggi?» |
| Fasi del lavoro | «Leggo la foto…» · «Traduco il prompt…» · «Preparo i motori…» · «Disegno…» · «Rifinisco i bordi…» · «Metto in orbita…» |
| Fine | «Atterrato.» (+ tempo) |
| Coda | «In attesa di decollo (n°)» |
| Errore | «Intoppo in orbita: <causa>. [Riprova]» |
| Pulsanti | CREA ✦ · MODIFICA ✦ · COMPONI ✦ · LANCIA ✦ (nomi chiari prima del colore) |

**Budget:** ≤ 4 animazioni continue contemporanee; starfield ≤ 3% CPU; nessun `box-shadow` animato su più di 12 elementi (animare `opacity` di uno pseudo-elemento); mai animare `width/height/top/left`.

---

## 13. Elenco asset da generare (per Sol / Haiku — Flux Klein, modalità veloce)

**Scopo:** dare un'identità visiva coerente senza appesantire l'installer (< 6 MB totali aggiunti ai `resources/`; WebP qualità 82; PNG con alpha solo dove serve).
**Cartella:** `resources/gui/<gruppo>/<id>.webp` (o `.png`); un `resources/gui/README.md` con prompt, seed, modello e data di ogni asset.
**Motore:** Klein veloce 8 passi (stesso modello dell'app), seed fissato, un seed per gruppo. **Stile comune** (prefisso di ogni prompt): *«polished 3D stylized icon, soft glossy materials, deep-space color palette of violet, magenta, cyan and gold, subtle rim light, dark navy background, clean composition, no text»* (per i gruppi con trasparenza: aggiungere *«isolated on plain dark background»* e poi **togliere lo sfondo con BiRefNet** quando l'engine v2 lo permette, altrimenti con il modello Qwen «Rimuovi sfondo» esistente).

### 13.1 Set di prova (4–6, da mostrare a Opus/Astra PRIMA di generare il resto)
| id | File | Misura | Prompt (dopo il prefisso comune) |
|---|---|---|---|
| `prova-persone` | `tessera/persone.png` | 256² alpha | an astronaut helmet visor reflecting a smiling face, three-quarter view |
| `prova-estrai` | `tessera/estrai.png` | 256² alpha | scissors cutting a glowing outline around a small planet, sparks |
| `prova-sfondo` | `sfondi/nebulosa.webp` | 2560×1440 | deep space nebula in violet and magenta with faint stars, large empty dark area on the right, cinematic, no planet |
| `prova-stile-1` | `stili/anime-film.webp` | 320² | a young woman in a red scarf holding a coffee cup on a city street at sunset, anime movie still style |
| `prova-stile-2` | `stili/vetro.webp` | 320² | the same woman rendered as liquid glass and crystal, refractive translucent material |
| `prova-locandina` | `ricette/foglio.webp` | 512×320 | a character turnaround sheet floating in space, multiple poses of an astronaut fox, neat grid |

### 13.2 Gruppi completi

| Gruppo | Cartella | Quanti | Misura | Contenuto | Alpha |
|---|---|---|---|---|---|
| **Sfondi** | `sfondi/` | 6 | 2560×1440 (WebP ≤ 350 kB) | `nebulosa` (principale) · `nebulosa-calda` (oro/magenta) · `stelle` (tile 1024², trasparente, stelle sparse) · `aurora` (banner Impostazioni 1600×400) · `hero-pianeta` (stato vuoto, pianeta in basso a sinistra) · `setup-pianeta` | `stelle`, `hero-pianeta` sì |
| **Tessere Modifica** | `tessera/` | 10 | 256² | Estrai · Persone · Vestiti · Situazioni · Prospettiva · Luce e colore · Stili · Testi · Ritocco · Espandi — un oggetto simbolo 3D per ognuna | sì |
| **Modi** | `modi/` | 4 | 128² | Crea · Modifica · Box · Ricette (versione piccola, per la strip) | sì |
| **Generi di Crea** | `generi/` | 12 | 256² | Foto · Ritratto · Prodotto · Poster · Infografica · Logo · Social · Miniatura · Fumetto · Invito · Menù · Libero | sì |
| **Anteprime stili** | `stili/` | 28 | 320² | **stessa scena** per tutti (*ragazza con sciarpa rossa che beve un caffè in una strada di città al tramonto*, seed fisso), un file per stile con il frammento del §7.4 come prompt | no |
| **Ricette** | `ricette/` | 6 | 512×320 | locandine di Foglio · Mondi · Mix · Set · Formati · Rinnova | no |
| **Luoghi** | `luoghi/` | 10 | 160² | miniature per Situazioni: città, spiaggia, montagna, bosco, deserto, interno, studio bianco, spazio, sott'acqua, futuro | no |
| **Meteo/stagioni** | `meteo/` | 10 | 128² | sole, nuvole, pioggia, neve, nebbia, temporale · primavera, estate, autunno, inverno | sì |
| **Costumi** | `costumi/` | 9 | 128² | astronauta, cavaliere, pirata, supereroe, samurai, mago, chef, medico, sposa (busto stilizzato) | sì |
| **Animali** | `animali/` | 5 | 128² | cane, gatto, cavallo, uccello, drago | sì |
| **Espressioni** | `facce/` | 6 | 128² | sorriso, ridere, serio, sorpreso, triste, occhiolino (faccia 3D tonda) | sì |
| **Disposizioni Box** | `box/` | 9 | 160×100 | *non da generare*: SVG disegnati a mano (schemi dei box) | — |
| **Personaggi** | `mascotte/` | 3 | 512² | astronauta che fluttua (stato vuoto), astronauta con cartello (errore), astronauta che saluta (setup) | sì |
| **LoRA** | `lora/` | 2 | 256² | copertina generica «Qwen» e «Klein» per i LoRA senza anteprima | no |
| **Uncensored** | `uncensored/` | 1 | 256² | icona fiamma arancio (fascetta e tessera) — meglio SVG | sì |

**Totale:** circa 125 immagini (di cui 8 sono SVG scritti a mano e non vanno in coda).
**Priorità:** P0 = set di prova + sfondi + tessere Modifica + modi (indispensabili alla fase 1); P1 = anteprime stili + generi + ricette; P2 = luoghi, meteo, costumi, animali, facce, mascotte.

### 13.3 Regole
- Niente testo dentro le immagini (le scritte le fa l'interfaccia). Niente volti di persone reali riconoscibili. Niente loghi o personaggi con diritti (per «stili» usare nomi generici: vedi §7.4, es. «Anime da film», non marchi).
- Stile coerente: stessa luce (rim light ciano a sinistra, magenta a destra), stessa famiglia di colori. Ogni asset 3D su fondo scuro neutro (poi alpha).
- Per ogni asset il README riporta: `id, file, prompt, negative, modello (nome file), passi, seed, dimensioni originali, dimensioni finali, data`.
- Se un asset non arriva, l'interfaccia mostra un **fallback a icona SVG + gradiente** (nessuna tessera vuota).

### 13.4 Icone SVG nuove (le disegna Sonnet, `Icone.tsx`)
`estrai, box, ricette, studio, pila, pennello-magico, bacchetta-sam, orbita, sole-dir, sole-qualita, temperatura, eta, sorriso, ridere, serio, sorpreso, triste, occhiolino, occhiali, barba, capelli, cappello, scarpe, giacca, abito, pantaloni, maglia, cappotto, ora-giorno, epoca, folla, meteo-*, stagione-*, lingua, titolo, cartello, restaura, dettagli, pelle, bianco-nero, grading, ritaglio, ricrea, su-sfondo, fiamma, lucchetto, occhio-barrato, trascina, dado, quadrante, wormhole, supernova, disposizione-*`.

---

## 14. Piano di consegna (per i task successivi)

| Fase | Contenuto | Responsabile | Cosa si vede |
|---|---|---|---|
| **F0** | Token + `stile.css` «Orbita», componenti base (`Tessera`, interruttore, cursore, segnaposto), starfield, `test/interfaccia.mjs` verde con i nuovi stili | Sonnet UI | Nuovo aspetto su tutte le pagine senza cambiare funzioni |
| **F1** | `Studio` con 4 modi, strip, console, **HUD misura**, Crea a tessere (Motore, Cosa, Atmosfera, Stile, Formato, Misura, Sfondo, Quante), Senza sfondo (engine: RGBA Qwen / genera+BiRefNet Klein) | Sonnet UI + Sol (`Richiesta.sfondo`, `bg:rimuovi`) | Crea completo, risoluzione chiara |
| **F2** | Modifica: griglia categorie + `controlli.ts` (sostituisce `rapide.ts`), Estrai (Ricrea + Trova già pronti; Ritaglio con SAM2/BiRefNet), stili nuovi, ricette 6 | Sonnet UI + Sol (`estrai:ritaglia`) | Modifica a pulsanti, Estrai in 2 clic |
| **F3** | Box (disegno, pannello, disposizioni, adattatore Klein 3 / maschere Qwen), Bozza veloce | Sonnet UI + Sol (`Richiesta.box`) | Editor regionale |
| **F4** | Pila LoRA + pagina LoRA nuova, Klein LoRA (dopo test loader), Laboratorio Uncensored, Ingranaggi, A/B | Sonnet UI + Sol (`lora:info`, catalogo uncensored) | Gestione completa |
| **F5** | Rifiniture: microcopy, easter egg, audio opzionale, test visivi `test/foto.mjs`, README/CHANGELOG | Sonnet | Release 1.2.0 |

**Interfacce da fissare nel thread di t_22f93113 (proposta):**
1. `Richiesta.sfondo?: 'scena' | 'trasparente' | { tinta: string }` + `Opera.alpha: boolean` nelle impostazioni dentro il PNG.
2. `Richiesta.box?: BoxRegione[]` e `Richiesta.promptScena?: string` (§5).
3. `estrai:ritaglia`, `estrai:maschera` (clic/box → maschera SAM2), IPC di progresso (fase, percentuale).
4. `lora:info` esteso, `Richiesta.lora` ordinato con peso, supporto Klein (se il loader funziona).
5. `modelli.catalogo({categoria:'uncensored'})` → voci con `ruolo, licenza, licenzaUrl, peso, stato ('disponibile'|'in-valutazione'|'bloccato-licenza'), richiedeConferma` ; `impostazioni.uncensored = { abilitato, accettatoIl, versioneDisclaimer }`.
6. `MODELLI` (in `shared/modelli.ts`) estendibile con `uncensored?: true` e `ruolo` senza rompere `modelloDa`.
7. `test/finto.js` allineato a ogni nuovo campo (CLAUDE.md lo impone).

**Criteri di accettazione trasversali:** `npm run typecheck`, `npm run build`, `node test/interfaccia.mjs`, `node test/modelli.mjs`, `node test/ricette.mjs` (adattato), foto di ogni schermata in `test/.out/`; nessun `<select>` in Studio; HUD coerente con la `Richiesta` (test); nessuna animazione attiva con `prefers-reduced-motion`; contrasto verificato sui token; nessuna regressione dei grafi Qwen (confronto con `docs/confronto-grafi-qwen-708b74d-vs-head.md`).

---

## 15. Rischi e domande aperte

| # | Tema | Proposta | Chi decide |
|---|---|---|---|
| D1 | Uncensored per FLUX/Klein (licenza §4(d)) | Voce «Non disponibile» + spiegazione; LLM e Qwen disponibili. Vedi §9.3 | Opus / utente |
| D2 | Un solo item «Studio» nel dock invece di Crea e Modifica | Sì, con scorciatoia 2 per Modifica | Opus |
| D3 | Sorgente del ritaglio fedele: SAM2 + BiRefNet (licenze: Apache / MIT, ok) | Sì; RMBG 2.0 escluso (CC BY-NC) | Sol |
| D4 | LoRA Klein 3 | Abilitare dopo il test del loader; fino ad allora la pila Klein mostra «in arrivo» | Sol |
| D5 | Box su Qwen (senza box nativi) | Ripiego: sfondo + ogni box come zona con compositing, in sequenza (più lento); su Klein 3 box nativi come guida | Sol |
| D6 | Tema: starfield canvas vs. solo CSS | Canvas con kill-switch; se la GPU dell'utente è sotto sforzo (job in corso) si ferma | Sonnet |
| D7 | Suoni | Opzionali, spenti di default, tre effetti brevi (ping, supernova, errore) | Opus |
| D8 | Le 6 ricette sono giuste? | Foglio · Mondi · Mix · Set · Formati · Rinnova. Se l'utente ne vuole 5, fondere Mondi dentro Foglio | Utente |
| D9 | Fallback VRAM con SAM2 + BiRefNet su 6 GB | Fase separata come `testo`/`cpu` in `lavori.ts` (`fattiSpazio`) | Sol |

---

## Appendice A — Mappa vecchio → nuovo

| Vecchio | Nuovo |
|---|---|
| Pagina Crea (colonna con sezioni, `<select>`/`Segmenti`) | Studio · Crea (tessere) |
| Pagina Modifica (Scrivi/Espandi/Ricette/Estrai) | Studio · Modifica (3 tessere ambito + categorie), Espandi è una tessera, Estrai in cima |
| Scheda Ricette (Laboratorio) | Studio · Ricette (6 locandine + Mie) |
| Idee/azioni rapide (chip) | Controlli interattivi (§6.2) |
| Preset (16) con stili per genere | Generi (11 + Libero) + Atmosfera (icone) + Stile (28) |
| `ScegliModello` (3 pillole nella barra) | Tessere Motore (+ Uncensored) |
| Misura, ScegliMp, Uscita in «Altro» | HUD misura sempre visibile + popover |
| `Lora.tsx` sub-tab di Impostazioni, `SceltaLora` | Pagina LoRA + Pila LoRA nel cassetto |
| `Impostazioni` con `<select>` | Segmenti a pulsanti + Laboratorio Uncensored |
| `Coda`, `BarraStato` | Invariate nel comportamento (tema nuovo) |

## Appendice B — Cose che NON cambiano (verifica con `docs/confronto-grafi-…`)
Grafi Qwen, pipeline di zona e Espandi, `DaProd-Nodi`, anteprime taesd, profilo memoria, formato dei PNG con le impostazioni (si **aggiungono** campi, non se ne tolgono), galleria ricostruita dai file, protocollo `daprod://`, aggiornamento automatico.
