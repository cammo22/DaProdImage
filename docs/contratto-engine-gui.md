# Contratto engine ↔ GUI (engine v2)

Chi lo usa: la GUI v2 (`feat/gui-v2`). Chi lo possiede: l'engine (`feat/engine-v2`): **`src/shared/tipi.ts`, `src/shared/modelli.ts`, `src/shared/loraBase.ts`, `src/renderer/src/api.ts`, `src/preload/index.ts` sono dell'engine**. La GUI tocca solo pagine e componenti del renderer; se serve un campo nuovo lo chiede (commento sul task), non lo aggiunge.
Tutto passa da `window.daprod` (tipo `Api` in `api.ts`); i canali IPC sono `area:azione` (`gestisci('lavori:accoda', …)` in `src/main/index.ts`).
Provato da: `npm test` (modelli, catalogo, spazio, lora, regioni, adatta, grafi_v2, confronto grafi Qwen) e `npm run typecheck`.

## 1. Modelli (famiglie)

`Famiglia = 'qwen' | 'klein' | 'klein-base' | 'klein4b'`. `IdModello` (`modelli.ts`) ha le stesse chiavi più `qwen-base`; `MODELLI[id]` dà nome, passi, CFG, `lora: true` per tutti.

| Famiglia | Modello | Passi (bozza/alta/massima) | CFG | Licenza pesi |
|---|---|---|---|---|
| `qwen` | Qwen-Image 2.1 GGUF | 20/40/50 | 1 | Qwen Research (solo ricerca) |
| `klein` | FLUX 3 Klein (INT8) | 8/8/16 | 1 | FLUX Kommunity |
| `klein-base` | FLUX 3 Klein Base | 25/50/64 | 3,5 | FLUX Kommunity |
| `klein4b` | FLUX.2 Klein 4B (FP8) | 4/4/8 | 1 | **Apache-2.0** |

`Richiesta.famiglia` (se manca vale `Impostazioni.famiglia`). Tre cose da sapere: Klein 4B usa `Flux2Scheduler` + `CFGGuider`; con Klein i testi (migliora prompt, descrivi…) li scrive il Qwen3-VL 4B; nelle opere in galleria il modello è `«FLUX.2 Klein 4B · file»` (`modelloDaOpera` lo riconosce).

## 2. Richiesta (`lavori.accoda(q): Promise<string[]>` → id dei lavori)

Campi comuni: `modalita`, `famiglia`, `prompt`, `negativo`, `seed` (−1 = casuale), `passi`, `cfg`, `larghezza/altezza`, `megapixel`, `immagini[]` (percorsi; [0] è la foto), `quante`, `uscita`, `lora`.

Modalità: `crea`, `modifica`, `zona` (maschera), `espandi`, `rifinisci`, `varia`, `ingrandisci`, `descrivi` (testo), `traduci`, **`sfondo`**, **`segmenta`**.

### 2.1 LoRA multipli con pesi — `Richiesta.lora: LoraAttiva[]`
`{ file, forza }`, **l'ordine della lista è l'ordine di applicazione**, forza −2…2 (fuori scala si tronca; 0 = ignorato). Vale per **tutte** le famiglie. Il motore mette un `LoraLoaderModelOnly` per ciascuno, in catena. La parola chiave di ogni LoRA acceso entra nel prompt da sola (`conParoleLora`, ora anche con Klein).
Compatibilità: `InfoLora.famiglie: Famiglia[]` (dai nomi dei tensori, `shared/loraBase.ts`) e `InfoLora.compatibile: 'si'|'no'|'?'`. `vaBeneCon(lora, famiglia)` (shared, importabile dal renderer) dice `si|no|?` (`?` = si lascia provare). Un LoRA di Klein 3 **non** va su Klein 4B (e viceversa): sono architetture diverse.
**IPC nuovo:** `lora.compatibili(famiglia): Promise<InfoLora[]>` = solo i `si` e `?` per quel modello. (`lora.elenco()` resta: tutti.)

### 2.2 Senza sfondo
- Foto esistente: `modalita: 'sfondo'`, `immagini: [foto]` → PNG RGBA (BiRefNet, MIT). I pixel del soggetto restano quelli originali, i bordi sono ripuliti dagli aloni. Non serve il modello che disegna.
- In Crea: `trasparente: true` oppure `sfondo: 'trasparente'`. Qwen usa il suo canale alfa; **Klein (tutte) genera e poi toglie lo sfondo con BiRefNet** (la GUI può dire «Klein: sfondo tolto dopo»).
- `sfondo: { tinta: '#rrggbb' }` → una riga in più nel prompt («on a plain solid #rrggbb background»). `sfondo: 'scena'` = niente.
- Il primo uso scarica BiRefNet (~450 MB) da solo; si vede nella `fase` del lavoro («Scarico BiRefNet · 40%»). Stato: `modelli.segmentatori()`.

### 2.3 Estrai personaggi/oggetti (SAM 2)
`modalita: 'segmenta'`, `immagini: [foto]`, `segmenta: { box?: [x0,y0,x1,y1], punti?: {x,y,positivo}[], ritaglia?: boolean }`. Coordinate **0–1 sulla foto**, origine in alto a sinistra. `ritaglia` true (predefinito) = PNG stretto attorno alla cosa (+12 px), false = tela intera col resto trasparente. Senza `box` né `punti` il lavoro fallisce con «dimmi cosa estrarre». Sempre dai pixel originali (nessuna ricreazione). Scarica SAM 2.1 small (~185 MB) al primo uso.
**IPC nuovo:** `modelli.segmentatori(): Promise<StatoVoce[]>` = le voci BiRefNet e SAM 2 con `presente`.

### 2.4 Regional prompting (Editor box) — per `crea` e `modifica`
Due modi equivalenti, il motore normalizza (`adattaRichiesta`, `motore/adatta.ts`):

1. **`box: BoxRegione[]` + `promptScena`** (quello che manda la GUI v2): `{ id, rect:[x0,y0,x1,y1] (0–1 sulla tela finale), tipo, prompt, rif?, rigidita, ordine, nascosta? }`. Le `nascosta` e quelle senza prompt non partono; l'ordine è `ordine`; `promptScena` (se c'è e ci sono riquadri validi) diventa il `prompt`.
2. `regioni: Regione[]` (`{ id, box, prompt }`) già pronte.

Traduzione per modello: **Klein 3 / Base** → prompt «didascalia che cita `<obj_N>`» + righe JSON con `bbox [y_min,x_min,y_max,x_max]` su 0–1000 (formato nativo, `modifica`: `tgt_bbox`); **Qwen e Klein 4B** → la posizione a parole («at the top left of the frame»). Al massimo 16 riquadri, minimo 2 % per lato. I prompt dei riquadri vengono tradotti in inglese come quello della scena (se `traduci` è acceso).
**Limiti, detti chiari:** i riquadri sono una *guida morbida* (l'elemento può uscire un po'); `rigidita: 'blocca'` per ora vale `'decisa'`; `rif` (foto di riferimento del box) non è ancora usato dal motore.

### 2.5 Modifica con istruzioni
`modalita: 'modifica'` (tutta la foto) e `'zona'` (solo la maschera, il resto identico al pixel): il `prompt` è l'istruzione («make the teapot red»). Famiglie Klein: le foto di riferimento sono `immagini[1..]` (`<image2>`…).

## 3. Catalogo, licenze, uncensored

`modelli.stato(): StatoVoce[]` restituisce **tutte** le voci con: `id`, `nome`, `tipo`, `presente`, `byte`, `licenza`, `licenzaUrl`, `ruolo` (`denoiser|encoder|llm|vae|lora|segmentatore|sfondo`), `uncensored?`, `avviso?`. `modelli.scarica(id)` / `annulla(id)` / evento `su.download`.
**La guardia è nel main**, non nella UI (`motivoDiBlocco`): una voce `uncensored` si scarica solo se **tutte e tre** le condizioni valgono, e se no `modelli.scarica` va in errore con il motivo in italiano:
1. `Impostazioni.uncensored === true` (interruttore «Modelli uncensored», spento di serie);
2. `Impostazioni.uncensoredAccettato === true` (ha letto l'avviso, `AVVISO_UNCENSORED` in `catalogo.ts`);
3. **licenza valida** (`motivoLicenza`): Apache-2.0, MIT, BSD-3-Clause, CC-BY-4.0 oppure «Qwen Research» con l'avviso sul limite d'uso. FLUX Kommunity (§4(d), niente scorciatoie per togliere le protezioni), «non-commercial» non letti, licenza o link mancanti = mai.
Nessuna voce uncensored è `consigliato`: non si scarica mai da sola né in idle. Nel catalogo ci sono: encoder Qwen3-VL 8B uncensored (AtomicChat, mradermacher; Apache), LoRA `lora-uc` (Qwen Research, con avviso), LLM **Qwen3-VL 4B abliterated** (Huihui, Apache) per i testi con Klein (`Impostazioni.testoUncensored`, serve anche l'interruttore). **Non c'è un denoiser FLUX uncensored** e non verrà aggiunto.
`Impostazioni.uncensored` è un **booleano**, non l'oggetto `{abilitato, accettatoIl…}` che la GUI v2 aveva ipotizzato: la GUI deve leggere/scrivere `uncensored`, `uncensoredAccettato`, `testoUncensored` con `impostazioni.salva`.

## 4. Coda, eventi, VRAM
Un lavoro alla volta al motore (`lavori.elenco`, `su.lavori`, `su.lavoro`). Il lavoro ha `fase` (testo in italiano, anche i download di BiRefNet/SAM2), `passo/passiTotali`, `stima`, `anteprima`, `risultati[]` (percorsi in galleria), `errore`. «Una cosa alla volta in VRAM»: cambiando famiglia (Qwen → Klein → Klein 4B) il motore scarica il modello precedente (`/free`) e la fase dice «Scarico FLUX.2 Klein 4B». `sfondo` e `segmenta` non chiedono VRAM (il nodo carica e toglie il segmentatore).

## 5. File e cartelle da conoscere
`modelli.file()` ora include `klein4b` e `klein4bTe`. Un modello Klein 4B è «pronto» con modello + text encoder (Qwen3 4B) + VAE di FLUX.2 (`kleinVae`, lo stesso di Klein 3); voci del catalogo `klein4b-fp8`, `klein4b-te`, `klein-vae`.

## 6. Cosa NON c'è (ancora)
`estrai.ritaglia` come IPC a parte: si usa `lavori.accoda` con `modalita: 'segmenta'`. `box.rif` e `rigidita: 'blocca'` non cambiano il risultato. Nessuna prova di qualità con GPU di `sfondo`/`segmenta` sul motore installato (i nodi `DaProdSfondo`/`DaProdSegmenta` arrivano col motore 9: al primo avvio dopo l'aggiornamento l'app aggiorna il motore da sola).
