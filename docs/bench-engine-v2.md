# Benchmark engine v2 — prima / dopo

Misurato il 22/10/2026 su RTX 4060 8 GB (driver 617.42), ComfyUI 0.42.3 (engine installato, motore 8), tutto 1024×1024, stesso prompt e stessa maschera di `scripts/misure_gpu.mjs`.
Grafi veri dell'app (`grafi.ts` impacchettato con esbuild). GPU libera prima di ogni giro (< 15 %), un benchmark alla volta, ComfyUI di prova sulla porta 8819 (non quello dell'app, non quello degli asset: il 8818 era fermo e vuoto). Dati completi: `docs/bench-engine-v2.json`.
Come si ripete: `node scripts/bench_serie.mjs --repo . --out <cartella> --etichetta <nome> --rip 3 --porta 8819 <prove>` con `MOTORE_OUT` = cartella di output del motore (`node scripts/misure_gpu.mjs --prova elenco` stampa le prove).

**Prima** = Klein 3 veloce, 8 passi (il percorso rapido di prima di engine v2). **Dopo** = FLUX.2 Klein 4B FP8, 4 passi (`Flux2Scheduler` + `CFGGuider`).

## A caldo (mediana di 3 giri dopo un giro di riscaldamento)

| Scenario | Modello | Passi | Totale | s/passo | VRAM picco* | Peggiore |
|---|---|---:|---:|---:|---:|---:|
| Crea | Klein 3 veloce (prima) | 8 | 6,4 s | 0,471 | 6,1 GB | 6,4 s |
| Crea | **Klein 4B (dopo)** | 4 | **5,4 s** | 0,572 | 5,3 GB | 5,4 s |
| Crea | Klein 4B, 8 passi (controllo) | 8 | 8,5 s | 0,711 | 7,1 GB | 8,5 s |
| Modifica zona | Klein 3 veloce (prima) | 8 | 24,9 s | 1,873 | 7,4 GB | 25,7 s |
| Modifica zona | **Klein 4B (dopo)** | 4 | **21,3 s** | 2,258 | 6,1 GB | 21,5 s |
| Modifica tutta la foto | Klein 3 veloce (prima) | 8 | 11,5 s | 1,050 | 6,9 GB | 11,5 s |
| Modifica tutta la foto | **Klein 4B (dopo)** | 4 | **9,6 s** | 1,307 | 7,3 GB | 9,6 s |

## A freddo (1 giro; modelli scaricati con `/free`, i file restano nella cache del disco)

| Scenario | Modello | Passi | Totale | s/passo | VRAM picco* |
|---|---|---:|---:|---:|---:|
| Crea | Klein 3 veloce | 8 | 9,7 s | 0,468 | 6,8 GB |
| Crea | Klein 4B | 4 | 8,6 s | 0,623 | 6,9 GB |
| Crea | Klein 3 Base (CFG 3,5, riferimento) | 50 | 59,4 s | 1,006 | 6,8 GB |
| Crea | Qwen-Image 2.1 Q4_K_M (riferimento) | 40 | 162,9 s | 2,880 | 5,9 GB |

\* picco letto con `nvidia-smi` una volta al secondo (include la cache di PyTorch): serve a vedere che nessun giro va fuori memoria, non a confrontare i megabyte fra modelli. Il primissimo avvio a freddo di Klein 4B (file mai letti dal disco) è costato 15,6 s.

## Che cosa si tiene e che cosa no

- **Tenuto: Klein 4B come quarto modello.** Guadagno reale ma piccolo: −16 % in Crea, −14 % in zona, −17 % in Modifica, perché ogni passo costa di più (0,57 contro 0,47 s) e a 8 passi il 4B non va più veloce di Klein 3 (8,5 contro 6,4 s). Un'immagine di Crea (teiera) e le due modifiche rosse sono pulite a occhio; **non** è stato fatto un confronto di qualità alla cieca con Klein 3. Non diventa il predefinito: il vantaggio vero è la licenza Apache-2.0, non la velocità.
- **Niente altro è stato aggiunto in nome della velocità.** Le ottimizzazioni suggerite dalla ricerca (SageAttention, `torch.compile`, cache approssimate, Nunchaku/SVDQuant) non sono state installate né misurate: richiedono pacchetti esterni nell'engine produttivo (wheel Windows, graph break con l'offload) e la ricerca stessa le classifica «esperimenti separati». Non c'è un numero a loro favore, quindi non entrano.
- Già in 1.1.0 e non rimisurato qui: il 4B che scrive i testi (185,9 → 133,5 s su «Migliora + Crea» con Qwen), vedi `docs/misure-1.1.0.md`.
- BiRefNet e SAM 2 non sono stati cronometrati: i loro nodi (`DaProdSfondo`, `DaProdSegmenta`) arrivano con il motore 9 e il motore installato qui è l'8. Girano a parte, senza il modello che disegna in VRAM.
- Un incidente di misura, scartato: un secondo `bench_serie` partito per errore in parallelo ha sporcato un primo tentativo; i dati sopra vengono da una ripetizione con un solo benchmark vivo (controllato con la lista dei processi).
