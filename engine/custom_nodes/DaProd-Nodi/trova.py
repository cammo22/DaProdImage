# DaProdTrova: trova persone e oggetti in una foto con un modello piccolo (Florence-2 base, ~0,23 miliardi di parametri, MIT) invece del
# Qwen3-VL da 8 miliardi: un secondo invece di mezzo minuto. Risponde con lo stesso JSON che si chiederebbe all'LLM:
#   [{"bbox_2d":[x1,y1,x2,y2],"label":"...","kind":"person"|"object"}]   (coordinate 0–1000 sull'intera foto)
# Il modello scrive il compito <OD> come testo con i riquadri in gettoni <loc_N> (N = 0–999, già in millesimi della foto): si leggono
# direttamente, così non dipende da come cambia post_process_generation fra una versione di transformers e l'altra.
# Finito, il modello esce dalla memoria (una cosa alla volta in VRAM).
import gc
import json
import os
import re

PERSONA = re.compile(r"\b(person|people|man|men|woman|women|boy|girl|child|children|kid|baby|toddler|guy|lady|human|player|dancer|bride|groom)\b", re.I)
RIQUADRO = re.compile(r"([^<>]*?)((?:<loc_\d+>){4})")


def leggi_riquadri(testo):
    """il testo generato da Florence-2 per <OD>: 'etichetta<loc_a><loc_b><loc_c><loc_d>etichetta<loc_…>…' → elenco nel formato dell'app"""
    testo = re.sub(r"</?s>|<pad>", "", testo)
    fuori = []
    for m in RIQUADRO.finditer(testo):
        etichetta = m.group(1).strip()
        n = [int(x) for x in re.findall(r"<loc_(\d+)>", m.group(2))]
        x1, y1, x2, y2 = n
        if x2 <= x1 or y2 <= y1:
            continue
        fuori.append(
            {
                "bbox_2d": [x1, y1, x2, y2],
                "label": etichetta or "object",
                "kind": "person" if PERSONA.search(etichetta) else "object",
            }
        )
    return fuori


_cache = {}


class DaProdTrova:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"image": ("IMAGE",), "modello": ("STRING", {"default": "florence-2-base-ft"})}}

    RETURN_TYPES = ("STRING",)
    FUNCTION = "trova"
    OUTPUT_NODE = True
    CATEGORY = "DaProd"

    def trova(self, image, modello):
        import folder_paths
        import torch
        from PIL import Image
        from transformers import AutoProcessor, Florence2ForConditionalGeneration  # nativo da transformers 4.56

        cartella = os.path.join(folder_paths.models_dir, "detect", modello)
        if not os.path.isdir(cartella):
            raise RuntimeError("manca il rilevatore in " + cartella)

        a = (image[0].clamp(0, 1) * 255).byte().cpu().numpy()
        img = Image.fromarray(a).convert("RGB")

        cuda = torch.cuda.is_available()
        dtype = torch.float16 if cuda else torch.float32
        proc = AutoProcessor.from_pretrained(cartella)
        mod = Florence2ForConditionalGeneration.from_pretrained(cartella, torch_dtype=dtype).eval()
        try:
            if cuda:
                mod = mod.to("cuda")
            dati = proc(text="<OD>", images=img, return_tensors="pt")
            dati = {k: (v.to(mod.device, dtype) if v.is_floating_point() else v.to(mod.device)) for k, v in dati.items()}
            with torch.inference_mode():
                ids = mod.generate(**dati, max_new_tokens=1024, num_beams=3, do_sample=False)
            testo = proc.batch_decode(ids, skip_special_tokens=False)[0]
        finally:
            del mod
            gc.collect()
            if cuda:
                torch.cuda.empty_cache()

        elenco = leggi_riquadri(testo)
        t = json.dumps(elenco, ensure_ascii=False)
        return {"ui": {"text": [t]}, "result": (t,)}
