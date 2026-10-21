# Misure GPU per la 1.1.0 (T12)

Fatte il 21/10/2026 con `scripts/misure_gpu.mjs`: lo script costruisce i grafi veri dell'app (`src/main/motore/grafi.ts`, `costruisci()`),
li manda a un ComfyUI 0.41.2 avviato a parte (porta 8819, stesso `main.py`, stessi argomenti dell'app) e cronometra.
Prove **una alla volta**, `/free` fra l'una e l'altra quando si misura «a freddo». Nessun subagent, nessuna automazione dello schermo: solo script e API.

- Scheda: **RTX 4060 8 GB** (8188 MiB), 64 GB di RAM, driver e PyTorch 2.14 cu130 dell'engine installato (motore 7).
- Stesso prompt e stesso seed (424242) per ogni prova; 1024×1024 (1 MP). Impostazioni dell'app com'erano sulla macchina
  (VAE Texture-Fix, denoiser UC Q4_K_M, Klein int8 «convrot», 4B int8, VAE di Klein `flux2-vae`).
- Prompt di Crea: *a ceramic teapot with blue floral patterns on a rustic wooden table by a window, soft morning light, steam rising, shallow depth of field*.
  Modifica e zona: *make the teapot bright glossy red* (zona = rettangolo 420×380 sul corpo della teiera, contesto 0,8, ritaglio ingrandito come in app).
- **Una nota onesta sul «niente browser aperti»**: Chrome di Cammo era aperto durante le misure (non l'ho chiuso: non potevo sapere se c'era lavoro non salvato).
  `nvidia-smi` mostrava 0-177 MiB usati e nessun processo GPU prima di ogni giro, quindi la scheda era libera; la CPU però non era dedicata.
  Chi ripete le misure a macchina completamente ferma può scostarsi di qualche punto percentuale.
- «A freddo» = modelli scaricati dalla VRAM con `/free`, ma i file restano nella cache del disco di Windows (un vero primo avvio dopo il riavvio costa di più).
  «Caldo» = il modello è già in VRAM (la prova precedente era dello stesso modello).

## Tabella

| Prova | Totale | Campionatore | s/passo | VRAM picco |
|---|---:|---:|---:|---:|
| **Klein veloce · Crea · 8 passi · a freddo** | 16,2 s | 3,3 s | 0,47 | 6,8 GB |
| Klein veloce · Crea · 8 passi · caldo | 7,2 s | 3,2 s | 0,46 | 6,9 GB |
| Klein veloce · Crea · 16 passi · caldo | 10,7 s | 7,4 s | 0,50 | 5,8 GB |
| Klein veloce · **zona** · 8 passi · caldo | 26,4 s | 13,0 s | 1,86 | 7,3 GB |
| Klein veloce · zona · 12 passi | 31,5 s | 21,5 s | 1,96 | 7,3 GB |
| Klein veloce · zona · 16 passi | 40,6 s | 30,1 s | 2,01 | 7,3 GB |
| Klein veloce · Modifica tutta la foto · 8 passi | 13,9 s | 7,3 s | 1,04 | 7,1 GB |
| Klein veloce · Modifica tutta la foto · 16 passi | 21,4 s | 16,9 s | 1,12 | 6,9 GB |
| **Klein Base · Crea · 50 passi (CFG 3,5) · a freddo** | 59,9 s | 49,5 s | 1,01 | 6,9 GB |
| Klein Base · Crea · 50 passi · caldo (seed 77) | 55,8 s | 49,5 s | 1,01 | 6,9 GB |
| Klein Base · zona · 50 passi | 193,9 s | 174,8 s | 3,57 | 7,3 GB |
| Qwen base · Crea · 40 passi · a freddo | 165,9 s | 112,3 s | 2,88 | 6,2 GB |
| Modifica con riferimento · `ReferenceLatent` in catena · 8 passi | 20,2 s | 12,9 s | 1,85 | 7,3 GB |
| Modifica con riferimento · **`ReferenceMultiLatent`** · 8 passi | 20,3 s | 12,9 s | 1,85 | 7,3 GB |

Nota: la prima prova «a freddo» di Klein carica 5,6 GB di denoiser e il 4B: costa circa 9 s in più della stessa prova a caldo.

### Testo col 4B (T5, `testoCon4B`) e «Migliora prompt + Crea» con Qwen

«Migliora prompt» = il lavoro di testo dell'app (`SISTEMA_MIGLIORA`, fino a 380 token), poi `/free` (cambio di modello, come `fattiSpazio`), poi un Crea Qwen a 40 passi col prompt migliorato.
Si parte con Qwen già caricato (riscaldamento), come quando l'utente ha appena disegnato.

| Chi scrive il prompt | Velocità di scrittura | Testo | Scarichi `/free` | Crea Qwen 40 passi | **Totale** |
|---|---:|---:|---:|---:|---:|
| Encoder 8B **int8** (predefinito dell'app), senza il 4B | 3,3 token/s | 56,3 s | 4,0 + 1,5 s | 124,1 s | **185,9 s** |
| Qwen3-VL **4B**, con `testoCon4B` | 46 token/s* | 5,4 s | 3,3 + 1,5 s | 123,3 s | **133,5 s** |
| Encoder GGUF Q4 «uncensored» (le impostazioni di questa macchina), senza il 4B | 0,55 token/s | 299,0 s | 4,5 + 2,3 s | 139,6 s | **445,5 s** |
| Qwen3-VL **4B**, con `testoCon4B` (stessa macchina) | 47 token/s* | 4,7 s | 4,5 + 1,5 s | 139,3 s | **150,0 s** |

\* Velocità misurata dai messaggi di avanzamento sul solo tratto di generazione: 46-47 token/s sul 4B (128 token in 2,7 s), 0,55 token/s sull'8B GGUF (157 token in 286 s),
3,3 token/s sull'8B int8 (120 token in 36 s).
Il tempo del testo col 4B (5 s) comprende anche il caricamento dell'encoder.

Il costo temuto dal piano (il denoiser di Qwen che si ricarica dopo il testo) c'è, ma **si paga uguale con l'8B**: anche l'8B fa uscire il denoiser
(`/free` a ogni cambio di modello), quindi il ricaricamento è lo stesso nei due casi (circa 124-140 s di Crea contro 112 s di campionatore: la differenza è il caricamento).
Il 4B toglie solo il tempo di scrittura, e la qualità dei testi è quella attesa (paragrafo ricco da 100-130 parole, stesse regole del sistema).

## Decisioni (applicate nel codice)

1. **Klein in Modifica e in zona resta a 8 passi.** Rosso lucido sulla teiera: 8, 12 e 16 passi danno lo stesso risultato per l'occhio (stessa tinta, stessi bordi,
   nessuna cucitura; Modifica a tutta foto idem). Il costo cresce quasi linearmente (zona: 26 s a 8 passi, 31 a 12, 41 a 16; Modifica: 14 s contro 21 s a 16). Niente 12 passi: nessun numero cambia nella mappa
   (`src/shared/modelli.ts`: `klein.passi` resta 8).
   Prova fatta anche con un'istruzione più difficile («turn the teapot into a polished brass teapot with engraved patterns»): a tutti i passi il modello cambia poco
   (ceramica giallina invece di ottone) e 8 non è peggio di 16. È un limite del modello su quell'istruzione, non dei passi.
2. **`testoCon4B` acceso di serie** (`src/main/impostazioni.ts`): «Migliora prompt + Crea» con Qwen scende da 186 s a 134 s con l'encoder 8B int8 predefinito
   (da 446 s a 150 s con l'8B GGUF). La regola `scriveCol4B` lo usa solo se il file del 4B c'è sul disco: chi non ha scaricato il 4B (Klein) resta con l'8B, niente errori.
   L'interruttore in Opzioni resta per chi vuole l'8B; testo dell'interruttore aggiornato.
3. **`ReferenceMultiLatent` non sostituisce la catena di `ReferenceLatent`**: stesso tempo (20,3 s contro 20,2-21,5 s) e immagine **identica al pixel** (differenza massima 0 fra le due uscite).
   Nessun vantaggio, nessun cambio nel grafo. Il nodo si chiama `ReferenceMultiLatent` («Set Reference Multi Latent», `images.image1…`), non `SetReferenceMultiLatent`.
4. **Klein Base a 50 passi entra negli 8 GB**: picco 6,9 GB in Crea e 7,3 GB in zona, nessun rallentamento da memoria condivisa (1,01 s/passo in Crea; 3,6 s/passo in zona con tre foto di riferimento
   nel condizionamento). Crea in 56-60 s; zona 3,2 minuti: lenta ma regolare. Il valore 50 resta.

## Altri numeri utili

- Klein veloce zona a 8 passi: 26 s totali (di cui 13 s di campionatore); Klein Base zona: 7 volte tanto. Ha senso dire in interfaccia che «Rifai in qualità piena» da zona costa ~3 minuti.
- Nel confronto Crea a 50 passi, Klein Base disegna una composizione diversa da Klein veloce con lo stesso seed (come atteso: modelli diversi): più dettaglio fine sul decoro, teiera più grande nell'inquadratura.
- L'encoder 8B int8 è tre volte più veloce nel testo del GGUF Q4 (3,3 contro 0,55 token/s): chi ha il GGUF come encoder predefinito ha un motivo in più per accendere il 4B.

Come ripeterle: avviare un ComfyUI sulla porta 8819 e lanciare `node scripts/misure_gpu.mjs --out <cartella> --prova <nome>` (`--prova elenco` stampa i nomi);
`MOTORE_OUT` dice dove il motore salva le immagini, `ENCODER_QWEN` cambia l'encoder di Qwen, `PROMPT_ZONA` il prompt di zona e Modifica.
