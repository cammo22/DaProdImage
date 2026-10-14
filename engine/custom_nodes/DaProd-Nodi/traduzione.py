# DaProdTraduci: porta il prompt dall'italiano all'inglese con un modello di sola traduzione (Opus-MT it→en di Helsinki-NLP,
# ~300 MB, gira sul processore: niente VRAM, niente Qwen). I testi fra virgolette (quelli da scrivere nell'immagine) e i
# tag <image2> non si toccano: la traduzione lavora solo sui pezzi fra l'uno e l'altro.
import os
import re

# pezzi che non si traducono
PROTETTI = re.compile(r'("[^"]*"|“[^”]*”|«[^»]*»|<image\d+>)')
# fine frase: si traduce una frase alla volta (il modello è fatto per frasi, non per paragrafi)
FRASI = re.compile(r'(?<=[.!?;])\s+|\n+')
FINE_FRASE = re.compile(r'[.!?;:]\s*$')


def _rifinisci(originale, tradotto, dopo_protetto):
    """un pezzo tradotto da solo prende maiuscola e punto finale: li si riporta com'erano nell'originale"""
    t = tradotto.strip()
    if not t:
        return originale
    o = originale.strip()
    if not FINE_FRASE.search(o) and t.endswith("."):
        t = t[:-1]
    if dopo_protetto and o[:1].islower() and t[:1].isupper() and not t.startswith("I "):
        t = t[:1].lower() + t[1:]
    return t


def traduci_testo(testo, traduci_frasi):
    """traduci_frasi(lista di frasi) -> lista di traduzioni, della stessa lunghezza"""
    pezzi = PROTETTI.split(testo)
    risultato = []
    dopo_protetto = False
    for i, p in enumerate(pezzi):
        if i % 2 == 1:  # un pezzo protetto: com'è
            risultato.append(p)
            dopo_protetto = True
            continue
        if not re.search(r'[^\W\d_]', p):  # niente lettere (spazi, numeri, segni): com'è
            risultato.append(p)
            continue
        inizio = p[: len(p) - len(p.lstrip())]
        fine = p[len(p.rstrip()):]
        frasi = [f for f in FRASI.split(p.strip()) if f.strip()]
        out = traduci_frasi(frasi)
        tradotte = []
        for k, (f, t) in enumerate(zip(frasi, out)):
            tradotte.append(_rifinisci(f, t, dopo_protetto and k == 0))
        risultato.append(inizio + " ".join(tradotte) + fine)
        dopo_protetto = False
    return "".join(risultato)


_cache = {}


def _carica(cartella):
    if cartella not in _cache:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer  # già con ComfyUI; sentencepiece è fra i pacchetti
        tok = AutoTokenizer.from_pretrained(cartella)
        mod = AutoModelForSeq2SeqLM.from_pretrained(cartella).eval()
        _cache.clear()
        _cache[cartella] = (tok, mod)
    return _cache[cartella]


class DaProdTraduci:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"testo": ("STRING", {"multiline": True, "default": ""}), "modello": ("STRING", {"default": "opus-mt-it-en"})}}

    RETURN_TYPES = ("STRING",)
    FUNCTION = "traduci"
    OUTPUT_NODE = True
    CATEGORY = "DaProd"

    def traduci(self, testo, modello):
        import folder_paths
        import torch

        cartella = os.path.join(folder_paths.models_dir, "translate", modello)
        if not os.path.isdir(cartella):
            raise RuntimeError("manca il traduttore in " + cartella)
        tok, mod = _carica(cartella)

        def frasi(lista):
            with torch.inference_mode():
                batch = tok(lista, return_tensors="pt", padding=True, truncation=True, max_length=256)
                gen = mod.generate(**batch, num_beams=4, max_new_tokens=256)
            return tok.batch_decode(gen, skip_special_tokens=True)

        t = traduci_testo(testo, frasi)
        return {"ui": {"text": [t]}, "result": (t,)}
