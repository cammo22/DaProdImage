# ComfyUI-GGUF (copia di DaProd Image)

Copia di [leejet/ComfyUI-GGUF](https://github.com/leejet/ComfyUI-GGUF) al commit `373048b`
(il fork con Qwen-Image 2.1: `qwen_image21` e il mmproj di Qwen3-VL), originale di city96, licenza Apache-2.0 (vedi LICENSE).

Una sola modifica, in `ops.py` (`GGMLOps.Linear.forward_ggml_cast_weights`): da ComfyUI 0.39 la `Linear`
riceve anche `input_act`, `act_weight`, `act_eps`, `residual`, `residual_scale`; senza questa correzione il
KSampler si ferma con `unexpected keyword argument 'input_act'`.

Da ComfyUI 0.41 quei parametri non arrivano più alla `Linear` (c'è `comfy.ops.linear_input_act()`, che per i pesi GGUF
ricade su `forward()`): la correzione resta compatibile con tutte e due le versioni. In più `GGMLOps.Linear` ha
`comfy_force_forward = True`, così `--fast fp16_accumulation` non porta mai i pesi quantizzati nel percorso fp16.
Provato (CPU, Q8_0 reali) con ComfyUI 0.39 e 0.41.2; il motore ora è alla 0.41.2.
