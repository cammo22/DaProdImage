#!/usr/bin/env python3
"""Analizza i log del motore di DaProdImage e ricava le misure del prompt upsampler.

Legge il file `motore.log` (o quello passato con --log) e ricava:
  - i blocchi "Generating tokens" (il prompt upsampler) con token, tempo, s/token e tok/s
  - quale text encoder era in carico e quanta VRAM restava sulla GPU (vs offload su CPU)
  - i tempi del sampler (blocchi "N/M" che non sono "Generating tokens"), per modello

Uso:
    python scripts/bench_upsampler.py
    python scripts/bench_upsampler.py --log percorso.log
    python scripts/bench_upsampler.py --json report.json
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

# Il log di default sta in %LOCALAPPDATA%\DaProdImage\log\motore.log
_LOG_PREDEFINITO = os.path.join(
    os.environ.get("LOCALAPPDATA", ""), "DaProdImage", "log", "motore.log"
)

# Un frammento di avanzamento: "  12/300 [00:34<08:20,  1.79s/it]" oppure
# "  3/600 [00:01<03:07,  3.19it/s]" (il 4B veloce scrive in it/s, non in s/it).
_RE_TOKEN = re.compile(
    r"(\d+)/(\d+) \[(\d+):(\d+)<([^,]+),\s*([\d.]+)\s*(s/it|it/s)\]"
)
_RE_MODELLO = re.compile(r"Requested to load ([A-Za-z0-9_]+)")
# i path nel log sono scritti con i separatori di Windows raddoppiati
_RE_ENCODER = re.compile(r"text_encoders\\+([^'\\]+)")
# i modelli GGUF si annunciano così: «Using mmproj '…' for text encoder '…'»
_RE_GGUF = re.compile(r"for text encoder '([^']+)'")
_RE_DIFFUSIONE = re.compile(r"diffusion_models\\+([^'\\]+)")
_RE_VRAM = re.compile(
    r"loaded partially; ([\d.]+) MB usable, ([\d.]+) MB loaded, ([\d.]+) MB offloaded"
)
_RE_VRAM_COMPLETO = re.compile(
    r"loaded completely; ([\d.]+) MB usable, ([\d.]+) MB loaded, full load: True"
)
_RE_PASSI = re.compile(r"^\[INFO\] Prompt executed in ([\d.]+) seconds$")
_RE_STAGED = re.compile(
    r"Model ([A-Za-z0-9_]+) prepared for dynamic VRAM loading\. (\d+)MB Staged"
)
_RE_DEVICE = re.compile(
    r"CLIP/text encoder model load device: ([^,]+), offload device: ([^,]+),"
    r" current: ([^,]+), dtype: (\S+)"
)

# Che ruolo ha avuto l'encoder in quella run.
_SCOPO = {
    "Krea2TEModel_": "krea2_scrittura",  # scrive la didascalia: il potenziamento
    "Flux3TEModel_": "flux3_disegno",  # tokenizza per il disegno
    "QwenImage21TEModel_": "qwen_image",  # encoder di Qwen-Image 2.1
    "WanVAE": "vae",
}


def _analizza_log(percorso_log: str) -> dict:
    with open(percorso_log, encoding="utf-8", errors="replace") as f:
        lines = f.read().split("\n")

    # --- stato corrente mentre si scorre il log ---
    encoder = "?"
    file_encoder = "?"
    file_diffusione = "?"
    vram_gpu = None
    vram_offload = None
    staged_mb = None
    device = None
    offload_device = None
    current_device = None
    dtype = None

    blocchi: list[dict] = []
    corrente: dict | None = None
    sampler: list[dict] = []

    for i, riga in enumerate(lines):
        # aggiorna lo stato dai messaggi del motore
        m_mod = _RE_MODELLO.search(riga)
        if m_mod:
            encoder = m_mod.group(1)
        m_enc = _RE_ENCODER.search(riga)
        if m_enc:
            file_encoder = m_enc.group(1)
        m_gguf = _RE_GGUF.search(riga)
        if m_gguf:
            file_encoder = m_gguf.group(1)
        m_diff = _RE_DIFFUSIONE.search(riga)
        if m_diff:
            file_diffusione = m_diff.group(1)
        m_dev = _RE_DEVICE.search(riga)
        if m_dev:
            device = m_dev.group(1)
            offload_device = m_dev.group(2)
            current_device = m_dev.group(3)
            dtype = m_dev.group(4)
        m_st = _RE_STAGED.search(riga)
        if m_st:
            # il modello sta tutto in VRAM: azzera i valori "loaded partially"
            # del modello precedente, non valido piu' per questo
            encoder = m_st.group(1)
            vram_gpu = None
            vram_offload = None
            staged_mb = int(m_st.group(2))
        m_v = _RE_VRAM.search(riga)
        if m_v:
            vram_gpu = float(m_v.group(2))
            vram_offload = float(m_v.group(3))
        else:
            m_vc = _RE_VRAM_COMPLETO.search(riga)
            if m_vc:
                vram_gpu = float(m_vc.group(2))
                vram_offload = 0.0

        m = _RE_TOKEN.findall(riga)
        if not m:
            continue

        # la barra di avanzamento viene riscritta in continuazione: se la riga
        # contiene piu' frammenti interessa l'ultimo, che e' lo stato piu' recente
        n, totale, minuti, secondi, _resto, valore, unita = m[-1]
        n = int(n)
        totale = int(totale)
        s_per_token = float(valore)
        elapsed = int(minuti) * 60 + int(secondi)
        if unita == "it/s":
            # il 4B veloce scrive in it/s: il valore e' gia' token al secondo
            s_per_token = 1.0 / s_per_token if s_per_token else None

        if "Generating tokens" in riga:
            if corrente is None or i - corrente["fine"] > 5:
                corrente = {
                    "riga": i,
                    "fine": i,
                    "totale": totale,
                    "token": n,
                    "tempo_s": elapsed,
                    "s_per_token": s_per_token,
                    "encoder": encoder,
                    "scopo": _SCOPO.get(encoder, "?"),
                    "file_encoder": file_encoder,
                    "file_diffusione": file_diffusione,
                    "vram_gpu_mb": vram_gpu,
                    "vram_offload_mb": vram_offload,
                    "staged_mb": staged_mb,
                    "device": device,
                    "offload_device": offload_device,
                    "current_device": current_device,
                    "dtype": dtype,
                }
                blocchi.append(corrente)
            corrente["fine"] = i
            corrente["token"] = n
            corrente["tempo_s"] = elapsed
            corrente["s_per_token"] = s_per_token
            corrente["totale"] = totale
        else:
            # blocco del sampler: N/M passi
            if corrente is not None and i - corrente["fine"] <= 5:
                corrente["fine"] = i
            sampler.append(
                {
                    "riga_log": i + 1,
                    "file_diffusione": file_diffusione,
                    "passi": n,
                    "passi_totali": totale,
                    "tempo_s": elapsed,
                    "s_per_step": round(s_per_token, 3) if s_per_token else None,
                }
            )

    for b in blocchi:
        b["riga_log"] = b["riga"] + 1
        b["s_per_token"] = round(b["s_per_token"], 3) if b["s_per_token"] else None
        b["tok_s"] = round(b["token"] / b["tempo_s"], 3) if b["tempo_s"] else None
        del b["riga"], b["fine"]

    return {
        "blocchi": blocchi,
        "sampler": sampler,
        "run_sampler_s": [float(x) for x in _RE_PASSI.findall("\n".join(lines))],
    }


def _riepilogo(gruppo: list[dict]) -> dict:
    def _media(chiave: str):
        valori = [r[chiave] for r in gruppo if r.get(chiave) is not None]
        return round(sum(valori) / len(valori), 3) if valori else None

    return {
        "blocchi": len(gruppo),
        "tok_s_medio": _media("tok_s"),
        "s_per_token_medio": _media("s_per_token"),
        "vram_gpu_mb_medio": _media("vram_gpu_mb"),
        "staged_mb_medio": _media("staged_mb"),
        "vram_offload_mb_medio": _media("vram_offload_mb"),
        "token_totali": sum(r["token"] for r in gruppo),
        "secondi_totali": sum(r["tempo_s"] for r in gruppo),
    }


def analizza(percorso_log: str, soglia_s: float = 20.0) -> dict:
    grezzo = _analizza_log(percorso_log)
    blocchi = grezzo["blocchi"]

    # solo i blocchi lunghi contano per le medie: quelli da 2 token in 2 secondi
    # sono l'avvio del generatore e falserebbero il confronto
    lunghi = [b for b in blocchi if b["tempo_s"] >= soglia_s]

    def _gruppo(pred) -> list[dict]:
        return [b for b in lunghi if pred(b)]

    klein = _gruppo(
        lambda b: "4b" in b["file_encoder"].lower()
        or "klein" in b["file_encoder"].lower()
    )
    qwen = _gruppo(
        lambda b: "8b" in b["file_encoder"].lower()
        or "gguf" in b["file_encoder"].lower()
    )
    ignoti = [b for b in lunghi if b not in klein and b not in qwen]
    # tempi del sampler per modello di diffusione
    per_modello: dict[str, list[float]] = {}
    for s in grezzo["sampler"]:
        if s["passi_totali"] in (16, 50) and s["tempo_s"] >= 5:
            per_modello.setdefault(s["file_diffusione"], []).append(s["tempo_s"])

    # raggruppa anche per ruolo dell'encoder: krea2 scrive la didascalia
    # (potenziamento del prompt), flux3 tokenizza per il disegno
    per_scopo: dict[str, list[dict]] = {}
    for b in blocchi:
        per_scopo.setdefault(b["scopo"], []).append(b)

    return {
        "log": percorso_log,
        "soglia_s": soglia_s,
        "blocchi_totali": len(blocchi),
        "blocchi_significativi": len(lunghi),
        "confronto": {
            "klein_4b": _riepilogo(klein),
            "qwen_8b": _riepilogo(qwen),
            "non_identificato": _riepilogo(ignoti),
        },
        "per_scopo": {
            scopo: _riepilogo(gruppo) for scopo, gruppo in sorted(per_scopo.items())
        },
        "sampler_per_modello": {
            mod: {
                "run": len(medie),
                "tempo_medio_s": round(sum(medie) / len(medie), 2),
                "tempo_min_s": min(medie),
            }
            for mod, medie in per_modello.items()
        },
        "run_sampler_s": grezzo["run_sampler_s"][-25:],
        "blocchi": blocchi,
    }


def _tabella(report: dict) -> str:
    righe = [
        f"{'riga':>7} | {'scopo':<18} | {'file':<34} | {'token':>9} | "
        f"{'tempo':>7} | {'s/tok':>6} | {'tok/s':>6} | GPU / offload (MB)",
        "-" * 150,
    ]
    for b in report["blocchi"]:
        righe.append(
            f"{b['riga_log']:>7} | {b['scopo']:<18} | {b['file_encoder'][:33]:<34} | "
            f"{b['token']:>4}/{b['totale']:<4} | {b['tempo_s']:>6} s | "
            f"{str(b['s_per_token']):>6} | {str(b['tok_s']):>6} | "
            f"{b['vram_gpu_mb']} / {b['vram_offload_mb']}"
        )
    return "\n".join(righe)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--log", default=_LOG_PREDEFINITO, help="percorso del motore.log")
    ap.add_argument("--json", dest="json_out", help="salva il report in JSON")
    ap.add_argument(
        "--soglia",
        type=float,
        default=20.0,
        help="secondi minimi di un blocco per entrare nelle medie",
    )
    args = ap.parse_args(argv)

    if not os.path.isfile(args.log):
        print(f"Log non trovato: {args.log}", file=sys.stderr)
        return 1

    report = analizza(args.log, args.soglia)
    print(f"Log: {args.log}\n")
    print(f"Confronto upsampler (blocchi con almeno {args.soglia:.0f} s di generazione):")
    for nome, dati in report["confronto"].items():
        if not dati["blocchi"]:
            print(f"  {nome:<16} nessun blocco")
            continue
        print(
            f"  {nome:<16} blocchi={dati['blocchi']:<3} "
            f"tok/s={dati['tok_s_medio']}  s/tok={dati['s_per_token_medio']}  "
            f"GPU={dati['vram_gpu_mb_medio']} MB  offload={dati['vram_offload_mb_medio']} MB  "
            f"tempo totale={dati['secondi_totali']} s"
        )

    print("\nPer ruolo dell'encoder (tutti i blocchi, soglia compresa):")
    for scopo, dati in report["per_scopo"].items():
        if not dati["blocchi"]:
            continue
        print(
            f"  {scopo:<18} blocchi={dati['blocchi']:<3} "
            f"tok/s={dati['tok_s_medio']}  s/tok={dati['s_per_token_medio']}  "
            f"token={dati['token_totali']}  tempo={dati['secondi_totali']} s  "
            f"GPU={dati['vram_gpu_mb_medio']} MB  offload={dati['vram_offload_mb_medio']} MB"
        )

    print("\nSampler (tempo totale dei passi, per modello di diffusione):")
    for mod, dati in report["sampler_per_modello"].items():
        print(
            f"  {mod[:60]:<60} run={dati['run']}  medio={dati['tempo_medio_s']} s  "
            f"min={dati['tempo_min_s']} s"
        )

    print()
    print(_tabella(report))

    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print(f"\nReport JSON: {args.json_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
