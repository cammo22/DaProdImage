# Togli sfondo e estrai fedele, per DaProd Image.
#  - DaProdSfondo: BiRefNet (ZhengPeng7, MIT) separa il soggetto dallo sfondo; l'uscita è la foto ORIGINALE con il canale alfa (i pixel del soggetto non si ridisegnano).
#  - DaProdSegmenta: SAM 2.1 (Meta, Apache-2.0, via transformers) ritaglia la cosa indicata da un riquadro o da punti, sempre dai pixel originali.
# Tutte e due: modello da models/segment/<cartella> (si scarica dall'app al primo uso), caricato sulla GPU solo per il tempo del lavoro
# e poi tolto, così il modello che disegna ha di nuovo tutta la VRAM.
import json
import os

import torch
import torch.nn.functional as F


def _dispositivo():
    try:
        import comfy.model_management as mm

        return mm.get_torch_device()
    except Exception:
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def _libera(dispositivo):
    if getattr(dispositivo, "type", "cpu") == "cuda":
        torch.cuda.empty_cache()


# ---------- pezzi puri (si provano senza modelli) ----------


def pulisci_colori(rgb, alfa, solido=0.9):
    """rgb [B,H,W,3], alfa [B,H,W] (0..1). Ai bordi i colori dei pixel semi-trasparenti hanno dentro un po' di sfondo (aloni chiari o scuri):
    si rifanno con i colori del soggetto vicino (push-pull, come DaProdRiempiZona). I pixel solidi non si toccano."""
    from . import riempi

    da_rifare = (alfa < solido).float()
    if float(da_rifare.sum()) == 0.0 or float(da_rifare.sum()) == float(da_rifare.numel()):
        return rgb
    rifatto = riempi(rgb, da_rifare)
    m = (alfa >= solido).float().unsqueeze(-1)
    return rgb * m + rifatto * (1.0 - m)


def componi_rgba(rgb, alfa, pulisci=True):
    """foto originale + alfa -> immagine [B,H,W,4]"""
    rgb = rgb[..., :3]
    if pulisci:
        rgb = pulisci_colori(rgb, alfa)
    return torch.cat([rgb, alfa.unsqueeze(-1)], dim=-1).clamp(0, 1)


def ritaglia_su_alfa(rgba, soglia=0.02, margine=12):
    """ritaglia [B,H,W,4] attorno ai pixel con alfa > soglia (+ margine); se non c'è niente, restituisce com'è. Ritorna (immagine, (x0,y0,x1,y1))"""
    a = rgba[0, :, :, 3]
    ys, xs = torch.where(a > soglia)
    h, w = a.shape
    if ys.numel() == 0:
        return rgba, (0, 0, w, h)
    y0 = max(0, int(ys.min()) - margine)
    y1 = min(h, int(ys.max()) + 1 + margine)
    x0 = max(0, int(xs.min()) - margine)
    x1 = min(w, int(xs.max()) + 1 + margine)
    return rgba[:, y0:y1, x0:x1, :], (x0, y0, x1, y1)


def leggi_box(testo, larghezza, altezza):
    """'[x0,y0,x1,y1]' in 0..1 -> [x0,y0,x1,y1] in pixel, dentro la foto; None se vuoto o non valido"""
    if not testo or not testo.strip():
        return None
    try:
        b = json.loads(testo)
        x0, y0, x1, y1 = [float(v) for v in b]
    except Exception:
        return None
    x0, x1 = sorted((x0, x1))
    y0, y1 = sorted((y0, y1))
    x0, x1 = max(0.0, x0) * larghezza, min(1.0, x1) * larghezza
    y0, y1 = max(0.0, y0) * altezza, min(1.0, y1) * altezza
    if x1 - x0 < 2 or y1 - y0 < 2:
        return None
    return [x0, y0, x1, y1]


def leggi_punti(testo, larghezza, altezza):
    """'[{"x":0.4,"y":0.5,"positivo":true}, …]' (0..1) -> ([[x,y],…] in pixel, [1|0,…])"""
    if not testo or not testo.strip():
        return [], []
    try:
        lista = json.loads(testo)
    except Exception:
        return [], []
    punti, etichette = [], []
    for p in lista if isinstance(lista, list) else []:
        try:
            x = min(1.0, max(0.0, float(p["x"]))) * larghezza
            y = min(1.0, max(0.0, float(p["y"]))) * altezza
        except Exception:
            continue
        punti.append([x, y])
        etichette.append(0 if p.get("positivo") is False else 1)
    return punti, etichette


# ---------- BiRefNet ----------

_MEDIA = (0.485, 0.456, 0.406)
_DEV = (0.229, 0.224, 0.225)


def _carica_birefnet(cartella, dispositivo):
    from safetensors.torch import load_file

    from .birefnet_compat import BiRefNetConfig
    from .birefnet_modello import BiRefNet

    modello = BiRefNet(bb_pretrained=False, config=BiRefNetConfig())
    stato = load_file(os.path.join(cartella, "model.safetensors"))
    # alcuni salvataggi hanno il prefisso del modulo
    stato = {k[7:] if k.startswith("module.") else k: v for k, v in stato.items()}
    mancano, inutili = modello.load_state_dict(stato, strict=False)
    mancano = [k for k in mancano if "num_batches_tracked" not in k]
    if mancano:
        raise RuntimeError("BiRefNet: nel file mancano %d pesi (primo: %s)" % (len(mancano), mancano[0]))
    return modello.eval().to(dispositivo).half() if dispositivo.type == "cuda" else modello.eval().to(dispositivo)


def alfa_birefnet(immagine, cartella, lato=1024):
    """immagine [B,H,W,3] 0..1 -> alfa [B,H,W] 0..1"""
    dispositivo = _dispositivo()
    modello = _carica_birefnet(cartella, dispositivo)
    try:
        b, h, w, _ = immagine.shape
        x = immagine[..., :3].permute(0, 3, 1, 2).float()
        x = F.interpolate(x, size=(lato, lato), mode="bilinear", align_corners=False)
        media = torch.tensor(_MEDIA).view(1, 3, 1, 1)
        dev = torch.tensor(_DEV).view(1, 3, 1, 1)
        x = ((x - media) / dev).to(dispositivo)
        if dispositivo.type == "cuda":
            x = x.half()
        fuori = []
        with torch.inference_mode():
            for i in range(b):
                p = modello(x[i : i + 1])[-1].sigmoid().float().cpu()
                fuori.append(F.interpolate(p, size=(h, w), mode="bilinear", align_corners=False)[:, 0])
        return torch.cat(fuori, dim=0).clamp(0, 1)
    finally:
        del modello
        _libera(dispositivo)


# ---------- SAM 2 ----------


def alfa_sam2(immagine, cartella, box, punti, etichette):
    """una foto [1,H,W,3] -> maschera [1,H,W] 0..1 della cosa indicata (box in pixel e/o punti in pixel)"""
    import numpy as np
    from PIL import Image
    from transformers import Sam2Model, Sam2Processor

    dispositivo = _dispositivo()
    elaboratore = Sam2Processor.from_pretrained(cartella)
    modello = Sam2Model.from_pretrained(cartella).eval().to(dispositivo)
    try:
        foto = Image.fromarray((immagine[0, :, :, :3].clamp(0, 1) * 255).round().byte().cpu().numpy())
        arg = {}
        if box is not None:
            arg["input_boxes"] = [[list(box)]]
        if punti:
            arg["input_points"] = [[[list(p) for p in punti]]]
            arg["input_labels"] = [[list(etichette)]]
        dati = elaboratore(images=foto, return_tensors="pt", **arg).to(dispositivo)
        with torch.inference_mode():
            out = modello(**dati, multimask_output=False)
        maschere = elaboratore.post_process_masks(out.pred_masks.cpu(), dati["original_sizes"].cpu(), binarize=False)[0]
        m = maschere.float()
        # [oggetti, scelte, H, W] -> la prima scelta del primo oggetto; i valori sono logit: si porta a 0..1 con la sigmoide
        while m.dim() > 2:
            m = m[0]
        return torch.sigmoid(m).unsqueeze(0).clamp(0, 1)
    finally:
        del modello
        _libera(dispositivo)


# ---------- i nodi ----------


class DaProdSfondo:
    CATEGORY = "DaProd"
    FUNCTION = "esegui"
    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("image", "mask")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "modello": ("STRING", {"default": "birefnet"}),
                "pulisci_bordi": ("BOOLEAN", {"default": True}),
                "ritaglia": ("BOOLEAN", {"default": False}),
            }
        }

    def esegui(self, image, modello, pulisci_bordi, ritaglia):
        import folder_paths

        cartella = os.path.join(folder_paths.models_dir, "segment", modello)
        if not os.path.isfile(os.path.join(cartella, "model.safetensors")):
            raise RuntimeError("manca BiRefNet in " + cartella)
        alfa = alfa_birefnet(image, cartella)
        rgba = componi_rgba(image, alfa, pulisci_bordi)
        if ritaglia:
            rgba, _ = ritaglia_su_alfa(rgba)
        return (rgba, rgba[..., 3])


class DaProdSegmenta:
    CATEGORY = "DaProd"
    FUNCTION = "esegui"
    RETURN_TYPES = ("IMAGE", "MASK")
    RETURN_NAMES = ("image", "mask")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "modello": ("STRING", {"default": "sam2.1-hiera-small"}),
                "box": ("STRING", {"default": ""}),
                "punti": ("STRING", {"default": ""}),
                "ritaglia": ("BOOLEAN", {"default": True}),
                "margine": ("INT", {"default": 12, "min": 0, "max": 512}),
                "pulisci_bordi": ("BOOLEAN", {"default": True}),
            }
        }

    def esegui(self, image, modello, box, punti, ritaglia, margine, pulisci_bordi):
        import folder_paths

        cartella = os.path.join(folder_paths.models_dir, "segment", modello)
        if not os.path.isfile(os.path.join(cartella, "model.safetensors")):
            raise RuntimeError("manca SAM 2 in " + cartella)
        _, h, w, _ = image.shape
        b = leggi_box(box, w, h)
        p, e = leggi_punti(punti, w, h)
        if b is None and not p:
            raise RuntimeError("dimmi cosa estrarre: un riquadro o dei punti")
        alfa = alfa_sam2(image[:1], cartella, b, p, e)
        rgba = componi_rgba(image[:1], alfa, pulisci_bordi)
        if ritaglia:
            rgba, _ = ritaglia_su_alfa(rgba, margine=margine)
        return (rgba, rgba[..., 3])
