#!/usr/bin/env python3
"""Genera gli asset grafici della GUI v2 («Orbita») con FLUX 3 Klein veloce (8 passi, senza CFG).

Parla con l'engine ComfyUI già installato da DaProdImage (stesso modello, stesso encoder, stesso VAE
che usa l'app per «Klein veloce»). Il grafo è quello che costruisce `costruisci()` in
src/main/motore/grafi.ts per la famiglia klein (UNETLoader + CLIPLoader flux3 + VAELoader,
CLIPTextEncode, EmptyFlux2LatentImage, KSampler euler/simple cfg 1, VAEDecode, SaveImage).

Uso (con il Python dell'engine, che ha Pillow e numpy):
  "%LOCALAPPDATA%/DaProdImage/engine/venv/Scripts/python.exe" scripts/gui-v2/genera_klein.py --server 127.0.0.1:8818 --set prova
  ... --gruppo tessera
  ... --id tessera/persone
  ... --tutti            (tutti i gruppi, salta quelli già fatti)
  ... --readme           (rigenera resources/gui/README.md dal manifest)

Output:
  resources/gui/<gruppo>/<id>.webp|png   (asset finali)
  resources/gui/manifest.json            (prompt, seed, modello, misure, data per ogni asset)
  resources/gui/README.md                (tabella generata dal manifest)
  grezzi (scratch)                       (PNG grezzi di ComfyUI, fuori dal repo)
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent  # radice del worktree
RISORSE = REPO / "resources" / "gui"
MANIFEST = RISORSE / "manifest.json"
GREZZI = Path(os.environ.get("GUI_GREZZI", "C:/Users/cammo/AppData/Local/hermes/profiles/claude-haiku/cache/scratch/gui-v2/grezzi"))

# --- modelli: gli stessi file del catalogo di DaProdImage (src/main/installa/catalogo.ts) ---
MODELLO = {
    "unet": "flux3_image_klein_sd_int8_convrot.safetensors",  # klein-int8: FLUX 3 Klein veloce
    "encoder": "qwen3vl_4b_int8_convrot.safetensors",          # klein-te: Qwen3-VL 4B, tipo flux3
    "vae": "flux2-vae.safetensors",                           # klein-vae
    "passi": 8,
    "cfg": 1,
    "sampler": "euler",
    "scheduler": "simple",
}

# --- prefissi (dalla spec §13). Le scene (sfondi, luoghi, stili, ricette) non sono icone: stesso palette, altra frase ---
PREFISSO_ICONA = ("polished 3D stylized icon, soft glossy materials, deep-space color palette of violet, magenta, cyan and gold, "
                  "subtle rim light, dark navy background, clean composition, no text, ")
PREFISSO_SCENA = ("cinematic digital art, deep-space color palette of violet, magenta, cyan and gold, soft glow, "
                  "clean composition, no text, ")
PREFISSO_LOCANDINA = ("stylized 3D illustration, deep-space color palette of violet, magenta, cyan and gold, subtle rim light, "
                      "clean composition, no text, ")
ISOLATO = ", isolated on plain dark background"
ISOLATO_NERO = ", isolated on pure black background"

# Seed: uno per gruppo (spec §13). Gli stili usano la stessa scena e lo stesso seed per il confronto.
SEME = {"prova": 2026, "sfondi": 2026, "tessera": 1111, "modi": 1111, "generi": 1212, "stili": 4242,
        "ricette": 3131, "luoghi": 5151, "meteo": 6161, "costumi": 7171, "animali": 8181, "facce": 9191,
        "mascotte": 1313, "lora": 1414}

SCENA_STILI = "a young woman in a red scarf holding a coffee cup on a city street at sunset"

# asset: id, gruppo, file (relativo a resources/gui), gen (w,h), misura finale (w,h), prompt, alpha ('chiave'|'luce'|None), prefisso
def A(gruppo, nome, misura, prompt, alpha=None, prefisso=PREFISSO_ICONA, gen=None, file=None, prefix_isolato=True):
    w, h = misura
    if gen is None:
        # icone piccole: si genera a ~1 MP e si scala giù (bordi più puliti); il resto alla misura finale (multipli di 16)
        scala = 1024 / max(w, h) if max(w, h) <= 512 else 1.0
        gen = (round(w * scala / 16) * 16, round(h * scala / 16) * 16)
    gw, gh = gen
    full = (prefisso + prompt + (ISOLATO if alpha == "chiave" and prefix_isolato else ISOLATO_NERO if alpha == "luce" else "")) if prefisso else prompt
    return {"id": f"{gruppo}/{nome}", "gruppo": gruppo, "file": file or f"{gruppo}/{nome}.webp",
            "misura": [w, h], "gen": [gw, gh], "prompt": full, "alpha": alpha, "seme": SEME[gruppo]}


ASSET = []
# --- set di prova (spec §13.1): persone, estrai, nebulosa, stile 1 e 2 (dal file degli stili), locandina ---
ASSET += [
    A("tessera", "persone", (256, 256), "an astronaut helmet visor reflecting a smiling face, three-quarter view", alpha="chiave"),
    A("tessera", "estrai", (256, 256), "scissors cutting a glowing outline around a small planet, sparks", alpha="chiave"),
    A("sfondi", "nebulosa", (2560, 1440), "deep space nebula in violet and magenta with faint stars, large empty dark area on the right, cinematic, no planet", prefisso=PREFISSO_SCENA),
    A("ricette", "foglio", (512, 320), "a character turnaround sheet floating in space, multiple poses of an astronaut fox, neat grid", prefisso=PREFISSO_LOCANDINA, gen=(1024, 640)),
]
PROVA = ["tessera/persone", "tessera/estrai", "sfondi/nebulosa", "stili/anime-film", "stili/vetro", "ricette/foglio"]

# --- tessere Modifica (10), modi (4): oggetti simbolo 3D ---
for nome, p in [("estrai", "scissors cutting a glowing outline around a small planet, sparks"),
                ("persone", "an astronaut helmet visor reflecting a smiling face, three-quarter view"),
                ("vestiti", "a folded jacket and a hanger floating in space, fabric with soft gloss"),
                ("situazioni", "a glowing globe showing mountains and a sunrise on its edge, tiny landscape"),
                ("prospettiva", "a camera lens with orbiting rings around it, perspective grid lines"),
                ("luce-colore", "a glass prism splitting white light into a rainbow of violet, magenta, cyan and gold"),
                ("stili", "a paint palette with a brush and a swirl of paint, floating"),
                ("testi", "floating letter blocks, a glowing letter T and an O, typographic cubes"),
                ("ritocco", "a retouching brush with a soft glowing sparkle, healing light"),
                ("espandi", "a glowing frame expanding outward with arrows, stars around it")]:
    if nome in ("estrai", "persone"):
        continue
    ASSET.append(A("tessera", nome, (256, 256), p, alpha="chiave"))
for nome, p in [("crea", "a glowing four-point star sparkle"),
                ("modifica", "a glowing pen nib drawing a light trail"),
                ("box", "a floating glowing rectangle frame with corner handles"),
                ("ricette", "a glowing lightning bolt inside a rounded tile")]:
    ASSET.append(A("modi", nome, (128, 128), p, alpha="chiave"))

# --- generi di Crea (12) ---
for nome, p in [("foto", "a vintage film camera"), ("ritratto", "a classic oval portrait frame with a silhouette"),
                ("prodotto", "a glossy perfume bottle"), ("poster", "a rolled poster with a film reel"),
                ("infografica", "a pie chart and a bar chart floating"), ("logo", "a glowing abstract emblem shield"),
                ("social", "a smartphone with a heart and a thumbs up"), ("miniatura", "a play button over a video frame"),
                ("fumetto", "a comic speech bubble with a burst"), ("invito", "an envelope with a wax seal"),
                ("menu", "a restaurant menu card with a fork and a spoon"), ("libero", "a blank canvas with a glowing sparkle")]:
    ASSET.append(A("generi", nome, (256, 256), p, alpha="chiave"))

# --- sfondi (6) ---
ASSET += [
    A("sfondi", "nebulosa-calda", (2560, 1440), "warm nebula in gold and magenta with faint stars, open space in the center-left", prefisso=PREFISSO_SCENA),
    A("sfondi", "stelle", (1024, 1024), "sparse small white and gold stars, tiny bright points, seamless", prefisso="", alpha="luce", gen=(1024, 1024)),
    A("sfondi", "aurora", (1600, 400), "aurora borealis ribbons in cyan, violet and gold over a dark horizon, wide panoramic banner", prefisso=PREFISSO_SCENA, gen=(2048, 512)),
    A("sfondi", "hero-pianeta", (2560, 1440), "a large planet with glowing atmosphere in the lower left corner, dark space, cinematic", prefisso=PREFISSO_SCENA, alpha="chiave"),
    A("sfondi", "setup-pianeta", (2560, 1440), "a planet with rings in the lower left, glowing atmosphere, dark space, cinematic", prefisso=PREFISSO_SCENA),
]

# --- ricette (6): locandine 512×320 ---
for nome, p in [("mondi", "the same city street in several parallel worlds, a grid of four glowing portal windows"),
                ("mix", "several floating photo cards merging into one glowing card, collage of mixed elements"),
                ("set", "a neat row of sticker icons: a rocket, a planet, a star and a heart"),
                ("formati", "a poster frame, a phone frame and a square frame side by side, glowing outlines"),
                ("rinnova", "an old faded photograph turning into a sharp glowing photo, restoration sparkle")]:
    ASSET.append(A("ricette", nome, (512, 320), p, prefisso=PREFISSO_LOCANDINA, gen=(1024, 640)))

# --- stili (28): scena fissa + frammento della spec §7.4 (letti dal file stili.json) ---
STILI_JSON = HERE / "stili.json"
if STILI_JSON.exists():
    for s in json.loads(STILI_JSON.read_text(encoding="utf-8")):
        ASSET.append(A("stili", s["id"], (320, 320), f"{SCENA_STILI}, {s['frammento']}, full frame, no black bars", prefisso="", gen=(768, 768)))

# --- luoghi (10) ---
for nome, p in [("citta", "a miniature 3D stylized city at dusk"), ("spiaggia", "a miniature 3D stylized tropical beach"),
                ("montagna", "a miniature 3D stylized snowy mountain"), ("bosco", "a miniature 3D stylized forest with glowing fireflies"),
                ("deserto", "a miniature 3D stylized desert with dunes"), ("interno", "a miniature 3D stylized cozy room interior"),
                ("studio-bianco", "an empty white photo studio with a softbox light"), ("spazio", "a miniature 3D stylized space station view"),
                ("sott-acqua", "a miniature 3D stylized underwater coral reef, light rays"), ("futuro", "a miniature 3D stylized futuristic city of glass towers")]:
    ASSET.append(A("luoghi", nome, (160, 160), p, prefisso=PREFISSO_SCENA))

# --- meteo e stagioni (10) ---
for nome, p in [("sole", "a bright sun"), ("nuvole", "fluffy clouds"), ("pioggia", "a cloud with rain drops"),
                ("neve", "a cloud with snowflakes"), ("nebbia", "a foggy cloud bank"), ("temporale", "a dark storm cloud with lightning"),
                ("primavera", "a blossom branch"), ("estate", "a sunflower"), ("autunno", "a falling maple leaf"), ("inverno", "a snowflake crystal")]:
    ASSET.append(A("meteo", nome, (128, 128), p, alpha="chiave"))

# --- costumi (9): busti stilizzati ---
for nome, p in [("astronauta", "an astronaut"), ("cavaliere", "a medieval knight in helmet"), ("pirata", "a pirate with hat and eyepatch"),
                ("supereroe", "a superhero with mask and cape"), ("samurai", "a samurai warrior"), ("mago", "a wizard with pointed hat and beard"),
                ("chef", "a chef with toque"), ("medico", "a doctor with stethoscope"), ("sposa", "a bride with a veil")]:
    ASSET.append(A("costumi", nome, (128, 128), f"stylized 3D bust portrait of {p}", alpha="chiave"))

# --- animali (5), facce (6), mascotte (3), lora (2) ---
for nome, p in [("cane", "a friendly 3D stylized dog head"), ("gatto", "a friendly 3D stylized cat head"),
                ("cavallo", "a 3D stylized horse head"), ("uccello", "a 3D stylized bird head with colorful feathers"),
                ("drago", "a 3D stylized dragon head")]:
    ASSET.append(A("animali", nome, (128, 128), p, alpha="chiave"))
for nome, p in [("sorriso", "a round 3D face smiling"), ("ridere", "a round 3D face laughing with eyes closed"),
                ("serio", "a round 3D face with a serious look"), ("sorpreso", "a round 3D face surprised with open mouth"),
                ("triste", "a round 3D face looking sad with a tear"), ("occhiolino", "a round 3D face winking")]:
    ASSET.append(A("facce", nome, (128, 128), p, alpha="chiave"))
for nome, p in [("fluttua", "a cute astronaut floating in zero gravity, relaxed pose, arms out"),
                ("cartello", "a cute astronaut holding a sign with an error warning symbol"),
                ("saluta", "a cute astronaut waving hello")]:
    ASSET.append(A("mascotte", nome, (512, 512), p, alpha="chiave", gen=(1024, 1024)))
ASSET.append(A("lora", "qwen", (256, 256), "a glowing spiral of layered light, violet and magenta", prefisso=PREFISSO_SCENA))
ASSET.append(A("lora", "klein", (256, 256), "a glowing crystal spark, cyan and gold", prefisso=PREFISSO_SCENA))

PER_ID = {a["id"]: a for a in ASSET}


# ---------------- ComfyUI ----------------

def grafo(a: dict) -> dict:
    w, h = a["gen"]
    tiled = w * h > 2.2 * 1024 * 1024  # stessa soglia dell'app («normale»): oltre 2,2 MP il VAE a tessere
    decode = (
        {"class_type": "VAEDecodeTiled", "inputs": {"samples": ["7", 0], "vae": ["3", 0], "tile_size": 512, "overlap": 64,
                                                    "temporal_size": 64, "temporal_overlap": 8}}
        if tiled else {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["3", 0]}}
    )
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": MODELLO["unet"], "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": MODELLO["encoder"], "type": "flux3", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": MODELLO["vae"]}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": a["prompt"]}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": ""}},
        "6": {"class_type": "EmptyFlux2LatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}},
        "7": {"class_type": "KSampler", "inputs": {
            "model": ["1", 0], "seed": a["seme"], "steps": MODELLO["passi"], "cfg": MODELLO["cfg"],
            "sampler_name": MODELLO["sampler"], "scheduler": MODELLO["scheduler"],
            "positive": ["4", 0], "negative": ["5", 0], "latent_image": ["6", 0], "denoise": 1}},
        "8": decode,
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": "gui/" + a["id"].replace("/", "_")}},
    }


def chiama(server: str, path: str, dati: dict | None = None, timeout: int = 60):
    url = f"http://{server}{path}"
    req = urllib.request.Request(url, data=json.dumps(dati).encode() if dati is not None else None,
                                 headers={"Content-Type": "application/json"} if dati is not None else {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode() or "null")


def genera_grezzo(server: str, a: dict, timeout_s: int = 900) -> tuple[Path, float]:
    client = str(uuid.uuid4())
    t0 = time.time()
    risposta = chiama(server, "/prompt", {"prompt": grafo(a), "client_id": client})
    if not risposta or "prompt_id" not in risposta:
        raise RuntimeError(f"ComfyUI ha rifiutato il grafo: {risposta}")
    pid = risposta["prompt_id"]
    while True:
        if time.time() - t0 > timeout_s:
            raise TimeoutError(f"{a['id']}: troppo lento")
        storia = chiama(server, f"/history/{pid}") or {}
        if pid in storia:
            stato = storia[pid].get("status", {})
            if stato.get("status_str") == "error":
                msgs = [m for m in stato.get("messages", []) if m and m[0] == "execution_error"]
                raise RuntimeError(f"{a['id']}: errore del motore {msgs[-1][1] if msgs else stato}")
            out = storia[pid].get("outputs", {}).get("9", {}).get("images", [])
            if out:
                img = out[0]
                q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img.get("subfolder", ""), "type": img.get("type", "output")})
                with urllib.request.urlopen(f"http://{server}/view?{q}", timeout=120) as r:
                    dest = GREZZI / f"{a['id'].replace('/', '_')}.png"
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_bytes(r.read())
                return dest, time.time() - t0
        time.sleep(1.0)


# ---------------- trasparenza ----------------

def fondo_da_bordo(rgb: np.ndarray) -> np.ndarray:
    bordo = np.concatenate([rgb[:4].reshape(-1, 3), rgb[-4:].reshape(-1, 3), rgb[:, :4].reshape(-1, 3), rgb[:, -4:].reshape(-1, 3)])
    return np.median(bordo, axis=0)


def buchi_chiusi(a: np.ndarray, area_min: float = 0.02) -> np.ndarray:
    """Regioni trasparenti chiuse dentro il soggetto (es. il visore dell'astronauta) grandi almeno `area_min` dell'immagine:
    da riempire. Le zone trasparenti che toccano il bordo restano fuori. Lavora a 512 px (basta per le aree grandi)."""
    scala = 512
    piccola = Image.fromarray(((a < 0.5) * 255).astype(np.uint8)).resize((scala, scala), Image.Resampling.NEAREST)
    m = np.asarray(piccola) > 0
    visto = np.zeros_like(m, dtype=bool)
    da_riempire = np.zeros_like(m, dtype=bool)
    h, w = m.shape
    for y0 in range(h):
        for x0 in range(w):
            if not m[y0, x0] or visto[y0, x0]:
                continue
            pila = [(y0, x0)]
            visto[y0, x0] = True
            zona = []
            tocca_bordo = False
            while pila:
                y, x = pila.pop()
                zona.append((y, x))
                if y in (0, h - 1) or x in (0, w - 1):
                    tocca_bordo = True
                for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not visto[ny, nx]:
                        visto[ny, nx] = True
                        pila.append((ny, nx))
            if not tocca_bordo and len(zona) >= area_min * h * w:
                for y, x in zona:
                    da_riempire[y, x] = True
    if not da_riempire.any():
        return np.zeros(a.shape, dtype=bool)
    grande = Image.fromarray((da_riempire * 255).astype(np.uint8)).resize((a.shape[1], a.shape[0]), Image.Resampling.NEAREST)
    return np.asarray(grande) > 0


def scontorna_chiave(img: Image.Image) -> Image.Image:
    """Sfondo scuro uniforme: alpha dalla distanza di colore dal fondo (rampa 30→100), buchi chiusi del soggetto
    riempiti (il visore), colore sbiancato dal fondo sui bordi."""
    rgb = np.asarray(img.convert("RGB")).astype(np.float32)
    fondo = fondo_da_bordo(rgb)
    d = np.sqrt(((rgb - fondo) ** 2).sum(axis=2))
    a = np.clip((d - 70.0) / (140.0 - 70.0), 0.0, 1.0)
    a = np.where(a < 0.12, 0.0, a)  # l'alone grigio del fondo sparisce; i bordi morbidi restano
    pieno = buchi_chiusi(a)
    a = np.where(pieno, 1.0, a)
    colore = np.where(a[..., None] > 0.02, (rgb - (1 - a[..., None]) * fondo) / np.maximum(a[..., None], 1e-3), 0.0)
    colore = np.where(pieno[..., None], rgb, colore)
    colore = np.clip(colore, 0, 255)
    out = np.dstack([colore, a * 255.0]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def scontorna_luce(img: Image.Image) -> Image.Image:
    """Fondo nero: l'alpha è la luminosità (le stelle restano, il nero sparisce)."""
    rgb = np.asarray(img.convert("RGB")).astype(np.float32)
    a = rgb.max(axis=2) / 255.0
    a = np.clip((a - 0.06) / 0.5, 0, 1)
    colore = np.clip(rgb / np.maximum(a[..., None], 1e-3), 0, 255)
    colore = np.where(a[..., None] > 0.02, colore, 0)
    return Image.fromarray(np.dstack([colore, a * 255.0]).astype(np.uint8), "RGBA")


# ---------------- salvataggio ----------------

def toglie_barre(img: Image.Image) -> Image.Image:
    """Il modello «anime movie still» a volte disegna le bande nere del cinema (2,39:1): le toglie in alto e in basso
    e ritaglia al centro un quadrato, così la misura resta quella delle altre anteprime."""
    a = np.asarray(img.convert("L")).astype(np.float32)
    h, w = a.shape
    righe = a.mean(axis=1)
    top, bot = 0, h - 1
    while top < h // 4 and righe[top] < 14:
        top += 1
    while bot > 3 * h // 4 and righe[bot] < 14:
        bot -= 1
    if top == 0 and bot == h - 1:
        return img
    alt = bot - top + 1
    lato = min(w, alt)
    x0 = (w - lato) // 2
    y0 = top + (alt - lato) // 2
    return img.crop((x0, y0, x0 + lato, y0 + lato))


def salva_finale(a: dict, grezzo: Path) -> Path:
    img = Image.open(grezzo).convert("RGB")
    if a["gruppo"] == "stili":
        img = toglie_barre(img)
    if a["alpha"] == "chiave":
        img = scontorna_chiave(img)
    elif a["alpha"] == "luce":
        img = scontorna_luce(img)
    w, h = a["misura"]
    if img.size != (w, h):
        img = img.resize((w, h), Image.Resampling.LANCZOS)
    dest = RISORSE / a["file"]
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.suffix == ".webp":
        img.save(dest, "WEBP", quality=82, method=6)
    else:
        img.save(dest, "PNG", optimize=True)
    return dest


def carica_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text(encoding="utf-8"))
    return {"modello": MODELLO, "asset": {}}


def scrivi_manifest(m: dict) -> None:
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(m, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()[:16]


def fai(server: str, lista: list[dict], forza: bool) -> None:
    m = carica_manifest()
    for a in lista:
        dest = RISORSE / a["file"]
        ent = m["asset"].get(a["id"])
        if not forza and dest.exists() and ent and ent.get("prompt") == a["prompt"] and ent.get("seme") == a["seme"]:
            print(f"= {a['id']} già fatto", flush=True)
            continue
        print(f"> {a['id']}  {a['gen'][0]}x{a['gen'][1]} seed {a['seme']}", flush=True)
        grezzo, secondi = genera_grezzo(server, a)
        finale = salva_finale(a, grezzo)
        m["asset"][a["id"]] = {
            "id": a["id"], "gruppo": a["gruppo"], "file": a["file"].replace("\\", "/"), "misura": a["misura"], "generato": a["gen"],
            "prompt": a["prompt"], "negativo": "", "seme": a["seme"], "alpha": a["alpha"], **MODELLO,
            "modello_file": MODELLO["unet"], "data": dt.datetime.now().isoformat(timespec="seconds"),
            "secondi": round(secondi, 1), "sha256_16": sha(finale), "byte": finale.stat().st_size,
        }
        scrivi_manifest(m)
        print(f"  ok {finale.name} {finale.stat().st_size // 1024} KB in {secondi:.0f}s", flush=True)


def scrivi_readme() -> None:
    m = carica_manifest()
    righe = [
        "# Asset GUI v2 «Orbita» (generati con FLUX 3 Klein veloce)",
        "",
        "Generati con **FLUX 3 Klein veloce** (`flux3_image_klein_sd_int8_convrot.safetensors`, 8 passi, CFG 1, euler/simple),",
        "encoder **Qwen3-VL 4B** (`qwen3vl_4b_int8_convrot.safetensors`, tipo `flux3`), VAE **FLUX.2** (`flux2-vae.safetensors`),",
        "con l'engine ComfyUI di DaProdImage. Script: `scripts/gui-v2/genera_klein.py`. Spec: `docs/gui-v2-spec.md` §13.",
        "",
        "Stile comune: icone/tessere con il prefisso «polished 3D stylized icon …» (spec §13); sfondi, luoghi e ricette con",
        "«cinematic digital art» o «stylized 3D illustration» (stessa palette, niente «icon»); stili (§7.4) con la scena fissa",
        "«a young woman in a red scarf holding a coffee cup on a city street at sunset» + frammento dello stile + «full frame, no black bars»,",
        "senza prefisso. Seed fisso per gruppo (campo `seed`).",
        "",
        "Trasparenza: sfondo scuro uniforme → alpha dalla distanza di colore dal fondo (rampa 70→140, sotto 0,12 zero), buchi chiusi",
        "del soggetto riempiti; stelle → alpha dalla luminosità su nero. **Limiti noti:** il visore/parti interne aperte verso il bordo",
        "restano trasparenti (si vedono chiare su fondo bianco); l'alpha è una stima, non una segmentazione. **Non** è BiRefNet",
        "(non ancora nell'engine). Gli stili con bande nere (cinema 2,39:1) sono ritagliati al centro quadrato.",
        "",
        "| File | Gruppo | Misura | Seed | Alpha | Prompt (completo) | Data | Secondi |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for id_, e in sorted(m["asset"].items(), key=lambda kv: (kv[1]["gruppo"], kv[0])):
        righe.append(f"| `{e['file']}` | {e['gruppo']} | {e['misura'][0]}×{e['misura'][1]} | {e['seme']} | {e['alpha'] or '—'} | {e['prompt']} | {e['data'][:10]} | {e['secondi']} |")
    righe.append("")
    righe.append(f"Totale: {len(m['asset'])} asset. Modello: `{m['modello']['unet']}`, encoder `{m['modello']['encoder']}`, VAE `{m['modello']['vae']}`.")
    (RISORSE / "README.md").write_text("\n".join(righe) + "\n", encoding="utf-8")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--server", default="127.0.0.1:8818")
    p.add_argument("--set", choices=["prova"])
    p.add_argument("--gruppo")
    p.add_argument("--id", action="append", default=[])
    p.add_argument("--tutti", action="store_true")
    p.add_argument("--forza", action="store_true", help="rigenera anche se c'è già")
    p.add_argument("--readme", action="store_true")
    p.add_argument("--elenco", action="store_true")
    a = p.parse_args()
    if a.elenco:
        for x in ASSET:
            print(x["id"], x["misura"], x["gen"], x["alpha"] or "-")
        print("totale", len(ASSET))
        return 0
    if a.readme:
        scrivi_readme()
        print("README scritto")
        return 0
    if a.set == "prova":
        lista = [PER_ID[i] for i in PROVA]
    elif a.gruppo:
        lista = [x for x in ASSET if x["gruppo"] == a.gruppo]
    elif a.id:
        lista = [PER_ID[i] for i in a.id]
    elif a.tutti:
        lista = ASSET
    else:
        p.error("serve --set, --gruppo, --id o --tutti")
    fai(a.server, lista, a.forza)
    scrivi_readme()
    return 0


if __name__ == "__main__":
    sys.exit(main())
