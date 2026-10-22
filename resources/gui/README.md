# Asset GUI v2 «Orbita» (generati con FLUX 3 Klein veloce)

Generati con **FLUX 3 Klein veloce** (`flux3_image_klein_sd_int8_convrot.safetensors`, 8 passi, CFG 1, euler/simple),
encoder **Qwen3-VL 4B** (`qwen3vl_4b_int8_convrot.safetensors`, tipo `flux3`), VAE **FLUX.2** (`flux2-vae.safetensors`),
con l'engine ComfyUI di DaProdImage. Script: `scripts/gui-v2/genera_klein.py`. Spec: `docs/gui-v2-spec.md` §13.

Stile comune: icone/tessere con il prefisso «polished 3D stylized icon …» (spec §13); sfondi, luoghi e ricette con
«cinematic digital art» o «stylized 3D illustration» (stessa palette, niente «icon»); stili (§7.4) con la scena fissa
«a young woman in a red scarf holding a coffee cup on a city street at sunset» + frammento dello stile + «full frame, no black bars»,
senza prefisso. Seed fisso per gruppo (campo `seed`).

Trasparenza: sfondo scuro uniforme → alpha dalla distanza di colore dal fondo (rampa 70→140, sotto 0,12 zero), buchi chiusi
del soggetto riempiti; stelle → alpha dalla luminosità su nero. **Limiti noti:** il visore/parti interne aperte verso il bordo
restano trasparenti (si vedono chiare su fondo bianco); l'alpha è una stima, non una segmentazione. **Non** è BiRefNet
(non ancora nell'engine). Gli stili con bande nere (cinema 2,39:1) sono ritagliati al centro quadrato.

| File | Gruppo | Misura | Seed | Alpha | Prompt (completo) | Data | Secondi |
|---|---|---|---|---|---|---|---|
| `ricette/foglio.webp` | ricette | 512×320 | 3131 | — | stylized 3D illustration, deep-space color palette of violet, magenta, cyan and gold, subtle rim light, clean composition, no text, a character turnaround sheet floating in space, multiple poses of an astronaut fox, neat grid | 2026-10-22 | 6.0 |
| `sfondi/nebulosa.webp` | sfondi | 2560×1440 | 2026 | — | cinematic digital art, deep-space color palette of violet, magenta, cyan and gold, soft glow, clean composition, no text, deep space nebula in violet and magenta with faint stars, large empty dark area on the right, cinematic, no planet | 2026-10-22 | 32.2 |
| `stili/anime-film.webp` | stili | 320×320 | 4242 | — | a young woman in a red scarf holding a coffee cup on a city street at sunset, high quality anime movie still, painterly backgrounds, soft cinematic lighting, full frame, no black bars | 2026-10-22 | 12.0 |
| `stili/vetro.webp` | stili | 320×320 | 4242 | — | a young woman in a red scarf holding a coffee cup on a city street at sunset, liquid glass and crystal, refractive translucent material, caustics, iridescent edges, full frame, no black bars | 2026-10-22 | 12.1 |
| `tessera/estrai.webp` | tessera | 256×256 | 1111 | chiave | polished 3D stylized icon, soft glossy materials, deep-space color palette of violet, magenta, cyan and gold, subtle rim light, dark navy background, clean composition, no text, scissors cutting a glowing outline around a small planet, sparks, isolated on plain dark background | 2026-10-22 | 22.1 |
| `tessera/persone.webp` | tessera | 256×256 | 1111 | chiave | polished 3D stylized icon, soft glossy materials, deep-space color palette of violet, magenta, cyan and gold, subtle rim light, dark navy background, clean composition, no text, an astronaut helmet visor reflecting a smiling face, three-quarter view, isolated on plain dark background | 2026-10-22 | 11.1 |

Totale: 6 asset. Modello: `flux3_image_klein_sd_int8_convrot.safetensors`, encoder `qwen3vl_4b_int8_convrot.safetensors`, VAE `flux2-vae.safetensors`.
