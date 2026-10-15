---
name: rilascio
description: Prepara una nuova versione di DaProd Image (numero di versione, CHANGELOG, README, CLAUDE.md, typecheck, build, PR). Da usare quando si finisce un giro di modifiche e va consegnato come vX.Y.Z.
---

# Rilascio di DaProd Image

Una versione = `version` in `package.json` (e `package-lock.json`, due punti in cima) + una voce in `CHANGELOG.md`. Unita su `main`,
la CI (`.github/workflows/app.yml`) compila l'installer e pubblica da sola la release.

1. **Scegli il numero**: 0.X.0 per una novità visibile, 0.X.Y per correzioni.
2. **Alza la versione** in `package.json` e nelle prime righe di `package-lock.json` (`"version"` due volte).
3. **CHANGELOG.md**: nuova sezione in cima, `## X.Y.Z — AAAA-MM-GG`, una frase di riassunto e poi elenco in grassetto di cosa cambia.
   Si scrive **in italiano parlato**, per l'utente (non per gli sviluppatori).
4. **README.md** e **CLAUDE.md**: aggiorna le parti toccate (CLAUDE.md è la mappa del codice: file nuovi, nomi cambiati, regole).
5. Se è cambiato il **motore** (ComfyUI, pacchetti, nodi in `engine/`): alza `motore` in `engine/versioni.json`. Altrimenti no.
6. **Prima di consegnare**: `npm run typecheck` e `npm run build` devono passare. Se hai toccato l'interfaccia, guarda anche le foto di
   `node test/interfaccia.mjs` (vedi la skill `prova-interfaccia`).
7. Commit sul ramo di lavoro, push, PR in bozza. Dopo il merge la release esce da sola.

Commenti, messaggi dell'interfaccia e testi per l'utente: sempre in italiano parlato. Nomi tecnici in inglese dove serve.
