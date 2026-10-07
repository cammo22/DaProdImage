# I nodi di DaProd Image per la modifica di una zona (solo torch, niente pacchetti in più).
#
#  - DaProdRiempiZona: riempie la zona con i colori che ha attorno (push-pull: medie a scale sempre
#    più piccole e poi si risale). Serve per "rimuovi": se il modello vede ancora l'oggetto nella foto
#    di riferimento tende a ridisegnarlo; con la zona già "spalmata" disegna solo lo sfondo.
#  - DaProdAccordaColori: la foto passa due volte dal VAE e i colori si spostano un filo; guardando un
#    anello appena fuori dalla zona (dove dovrebbe essere identica) si misura lo scarto e si toglie.
#    Così l'incollaggio non lascia la "macchia" di colore diverso attorno alla zona.
import torch
import torch.nn.functional as F


def _maschera_come(maschera, h, w):
    m = maschera
    if m.dim() == 2:
        m = m.unsqueeze(0)
    m = m.unsqueeze(1).float()
    if m.shape[-2:] != (h, w):
        m = F.interpolate(m, size=(h, w), mode="bilinear", align_corners=False)
    return m.clamp(0, 1)


def riempi(immagine, maschera):
    """immagine [B,H,W,C] 0..1, maschera [B,H,W] (1 = da riempire) → immagine riempita"""
    b, h, w, c = immagine.shape
    x = immagine.permute(0, 3, 1, 2).float()
    m = _maschera_come(maschera, h, w)
    if m.shape[0] != b:
        m = m[:1].expand(b, -1, -1, -1)
    peso = 1.0 - m
    # giù: somme pesate e pesi, a metà ogni volta
    livelli = []
    cx, cw = x * peso, peso
    while True:
        livelli.append((cx, cw))
        if min(cx.shape[-2:]) <= 2:
            break
        cx = F.avg_pool2d(cx, 2, ceil_mode=True)
        cw = F.avg_pool2d(cw, 2, ceil_mode=True)
    # in cima: dove non si sa niente, il colore medio di quello che si vede
    noti = peso.sum((2, 3), keepdim=True).clamp_min(1e-6)
    media = (x * peso).sum((2, 3), keepdim=True) / noti
    cx, cw = livelli[-1]
    colore = torch.where(cw > 1e-4, cx / cw.clamp_min(1e-6), media.expand_as(cx))
    # su: dove il livello conosce i pixel si tengono, il resto viene dal livello sopra
    for cx, cw in reversed(livelli[:-1]):
        su = F.interpolate(colore, size=cx.shape[-2:], mode="bilinear", align_corners=False)
        a = cw.clamp(0, 1)
        colore = (cx / cw.clamp_min(1e-6)) * a + su * (1 - a)
    fuori = x * (1 - m) + colore * m
    return fuori.permute(0, 2, 3, 1).clamp(0, 1).to(immagine.dtype)


def accorda(generata, originale, maschera, forza=1.0):
    """sposta i colori della generata perché, appena fuori dalla zona, combacino con l'originale"""
    b, h, w, _ = generata.shape
    g = generata[..., :3].permute(0, 3, 1, 2).float()
    o = originale[..., :3].permute(0, 3, 1, 2).float()
    if o.shape[-2:] != (h, w):
        o = F.interpolate(o, size=(h, w), mode="bilinear", align_corners=False)
    if o.shape[0] != b:
        o = o[:1].expand(b, -1, -1, -1)
    m = (_maschera_come(maschera, h, w) > 0.5).float()
    if m.shape[0] != b:
        m = m[:1].expand(b, -1, -1, -1)
    r = max(3, round(min(h, w) * 0.02))
    largo = F.max_pool2d(m, 2 * r + 1, stride=1, padding=r)
    anello = (largo - m).clamp(0, 1)
    n = anello.sum((2, 3))
    if float(n.min()) < 16:
        return generata
    scarto = ((o - g) * anello).sum((2, 3)) / n
    fuori = (g + scarto[..., None, None] * forza).clamp(0, 1).permute(0, 2, 3, 1)
    if generata.shape[-1] > 3:
        fuori = torch.cat([fuori, generata[..., 3:].float()], dim=-1)
    return fuori.to(generata.dtype)


class DaProdRiempiZona:
    CATEGORY = "DaProd"
    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "esegui"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"image": ("IMAGE",), "mask": ("MASK",)}}

    def esegui(self, image, mask):
        return (riempi(image, mask),)


class DaProdAccordaColori:
    CATEGORY = "DaProd"
    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "esegui"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "reference": ("IMAGE",),
                "mask": ("MASK",),
                "strength": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.05}),
            }
        }

    def esegui(self, image, reference, mask, strength):
        return (accorda(image, reference, mask, strength),)


NODE_CLASS_MAPPINGS = {
    "DaProdRiempiZona": DaProdRiempiZona,
    "DaProdAccordaColori": DaProdAccordaColori,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "DaProdRiempiZona": "DaProd · Riempi la zona",
    "DaProdAccordaColori": "DaProd · Accorda i colori",
}
