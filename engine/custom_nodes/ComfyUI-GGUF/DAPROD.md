# ComfyUI-GGUF (copia di DaProd Image)

Copia di [leejet/ComfyUI-GGUF](https://github.com/leejet/ComfyUI-GGUF) al commit `373048b`
(il fork con Qwen-Image 2.1: `qwen_image21` e il mmproj di Qwen3-VL), originale di city96, licenza Apache-2.0 (vedi LICENSE).

Una sola modifica, in `ops.py` (`GGMLOps.Linear.forward_ggml_cast_weights`): da ComfyUI 0.39 la `Linear`
riceve anche `input_act`, `act_weight`, `act_eps`, `residual`, `residual_scale`; senza questa correzione il
KSampler si ferma con `unexpected keyword argument 'input_act'`.
