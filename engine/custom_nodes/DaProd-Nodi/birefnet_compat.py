# Le poche cose che il codice di BiRefNet (birefnet_modello.py, di ZhengPeng7, licenza MIT: vedi BIREFNET_LICENSE.txt) prendeva da `timm`:
# le abbiamo qui, così il motore non ha bisogno di un pacchetto in più. Sono le stesse funzioni (DropPath = profondità stocastica, spenta in inferenza).
import collections.abc
from itertools import repeat

import torch
import torch.nn as nn
from transformers import PretrainedConfig

trunc_normal_ = nn.init.trunc_normal_


def _ntuple(n):
    def parse(x):
        if isinstance(x, collections.abc.Iterable) and not isinstance(x, str):
            return tuple(x)
        return tuple(repeat(x, n))

    return parse


to_2tuple = _ntuple(2)


def drop_path(x, drop_prob: float = 0.0, training: bool = False, scale_by_keep: bool = True):
    if drop_prob == 0.0 or not training:
        return x
    keep_prob = 1 - drop_prob
    shape = (x.shape[0],) + (1,) * (x.ndim - 1)
    random_tensor = x.new_empty(shape).bernoulli_(keep_prob)
    if keep_prob > 0.0 and scale_by_keep:
        random_tensor.div_(keep_prob)
    return x * random_tensor


class DropPath(nn.Module):
    def __init__(self, drop_prob: float = 0.0, scale_by_keep: bool = True):
        super().__init__()
        self.drop_prob = drop_prob
        self.scale_by_keep = scale_by_keep

    def forward(self, x):
        return drop_path(x, self.drop_prob, self.training, self.scale_by_keep)

    def extra_repr(self):
        return f"drop_prob={round(self.drop_prob, 3):0.3f}"


class BiRefNetConfig(PretrainedConfig):
    model_type = "SegformerForSemanticSegmentation"

    def __init__(self, bb_pretrained=False, **kwargs):
        self.bb_pretrained = bb_pretrained
        super().__init__(**kwargs)
