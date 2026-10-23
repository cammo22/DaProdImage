// I file dei modelli che l'app sa scaricare (con dimensione e sha256 per controllarli).
import type { VoceCatalogo } from '@shared/tipi'

const UC = 'https://huggingface.co/abenzerps/Qwen-Image-2.1-Uncensored-GGUF/resolve/main/'
const TURBO = 'AtomicChat/Qwen-Image-2.1-Turbo-GGUF'
const ENC_AC = 'AtomicChat/Qwen-Image-2.1-Turbo-Uncensored-GGUF'
const ENC_MR = 'mradermacher/Qwen3-VL-8B-Instruct-Uncensored-V2-GGUF'
const KLEIN = 'black-forest-labs/flux-3-image-klein-comfy'
// revisioni fissate (controllate il 22/10/2026): il download è riproducibile anche se il repo cambia dopo
const KLEIN_REV = 'feef60b0aaf63a4773ace96636ebbcf43b881312'
const BIREFNET = 'ZhengPeng7/BiRefNet'
const BIREFNET_REV = 'e2bf8e4460fc8fa32bba5ea4d94b3233d367b0e4'
const SAM2 = 'facebook/sam2.1-hiera-small'
const SAM2_REV = 'ee5bba1d82bb8749febdf90f45e84b687142ba03'
const HUIHUI4B = 'ahmed22xa/Huihui-Qwen3-VL-4B-Instruct-abliterated-comfy'
const HUIHUI4B_REV = '6d6fc98f9bfa783dfa4f143804525742cb5dad62'

const LIC_QWEN = 'https://huggingface.co/Qwen/Qwen-Image-2.1/raw/main/LICENSE'
const LIC_KOMMUNITY = 'https://huggingface.co/black-forest-labs/flux-3-image-klein/blob/main/LICENSE.md'
const LIC_APACHE = 'https://www.apache.org/licenses/LICENSE-2.0'

const GREZZO: VoceCatalogo[] = [
  // --- modello di diffusione (uno solo serve; solo Q4, Q6 e Q8) ---
  {
    id: 'q4km', tipo: 'diffusione', quant: 'Q4', nome: 'Qwen-Image-2.1 Uncensored · Q4',
    descrizione: 'Il migliore equilibrio per 6-8 GB: sta tutto nella scheda video. 40 passi.',
    file: 'qwen-image-2.1-UC-Q4_K_M.gguf', cartella: 'diffusion_models', url: UC + 'qwen-image-2.1-UC-Q4_K_M.gguf',
    byte: 4604558112, sha256: 'e79c8a009f2ecbdb6c70fd663d9aea9ee304a0d91f347e4169a756b8ad141b41', consigliato: true
  },
  {
    id: 'q6k', tipo: 'diffusione', quant: 'Q6', nome: 'Qwen-Image-2.1 Uncensored · Q6',
    descrizione: 'Quasi identico all\'originale; su 8 GB una parte va in RAM (un po\' più lento).',
    file: 'qwen-image-2.1-UC-Q6_K.gguf', cartella: 'diffusion_models', url: UC + 'qwen-image-2.1-UC-Q6_K.gguf',
    byte: 5876556576, sha256: 'e14bb312109333b3d73b92ad9b9ac8b29b51f2edca1e7b86d1af1981bf1c4ee3'
  },
  {
    id: 'q8', tipo: 'diffusione', quant: 'Q8', nome: 'Qwen-Image-2.1 Uncensored · Q8',
    descrizione: 'Il massimo della fedeltà in GGUF; su 8 GB lavora in parte dalla RAM.',
    file: 'qwen-image-2.1-UC-Q8_0.gguf', cartella: 'diffusion_models', url: UC + 'qwen-image-2.1-UC-Q8_0.gguf',
    byte: 7591557920, sha256: 'cde456c72ea3ecebfc1be783300e972711d875e0c5f1bed33d42b66b156affa8'
  },
  // --- il Turbo ufficiale di AtomicChat: già distillato a 8 passi, niente LoRA. Il nome del file si trova al primo download ---
  {
    id: 'turbo-q4', tipo: 'diffusione', quant: 'Q4', turbo: true, nome: 'Qwen-Image-2.1 Turbo · Q4',
    descrizione: 'Il nuovo Turbo: 8 passi, circa 5 volte più veloce, per 6-8 GB.',
    file: '', cartella: 'diffusion_models', url: '', byte: 4_600_000_000, circa: true,
    repo: TURBO, cerca: ['Q4_K_M', 'Q4_K', 'Q4_0', 'Q4']
  },
  {
    id: 'turbo-q6', tipo: 'diffusione', quant: 'Q6', turbo: true, nome: 'Qwen-Image-2.1 Turbo · Q6',
    descrizione: 'Il Turbo con più fedeltà; su 8 GB una parte va in RAM.',
    file: '', cartella: 'diffusion_models', url: '', byte: 5_900_000_000, circa: true,
    repo: TURBO, cerca: ['Q6_K', 'Q6']
  },
  {
    id: 'turbo-q8', tipo: 'diffusione', quant: 'Q8', turbo: true, nome: 'Qwen-Image-2.1 Turbo · Q8',
    descrizione: 'Il Turbo al massimo della fedeltà in GGUF; lavora in parte dalla RAM.',
    file: '', cartella: 'diffusion_models', url: '', byte: 7_600_000_000, circa: true,
    repo: TURBO, cerca: ['Q8_0', 'Q8']
  },
  // --- text encoder (Qwen3-VL 8B: legge il prompt e guarda le foto) ---
  {
    id: 'te-int8', tipo: 'encoder', famiglia: 'Originale', nome: 'Qwen3-VL 8B (int8)',
    descrizione: 'Quello di sempre, provato e sicuro. Lavora dalla RAM: non ruba spazio al modello.',
    file: 'qwen3vl_8b_int8_convrot.safetensors', cartella: 'text_encoders', url: UC + 'text_encoders/qwen3vl_8b_int8_convrot.safetensors',
    byte: 9350798360, sha256: '8bfd0f6e12abf2d2d697ecc888e5e90b0d6741d6708f05799f53afa560452e8f', consigliato: true, necessario: true
  },
  // AtomicChat: l'encoder del Turbo con il rifiuto "tolto" dai pesi (abliterated), in GGUF
  ...(['Q4', 'Q6', 'Q8'] as const).map((q): VoceCatalogo => ({
    id: 'te-ac-' + q.toLowerCase(), tipo: 'encoder', quant: q, famiglia: 'AtomicChat · uncensored', nome: `Qwen3-VL 8B AtomicChat · ${q}`,
    descrizione: `L'encoder uncensored fatto apposta per Qwen-Image 2.1 (con la parte che guarda le foto). ${q === 'Q4' ? 'Il più leggero.' : q === 'Q6' ? 'Equilibrato.' : 'Il più fedele.'}`,
    file: '', cartella: 'text_encoders', url: '', byte: q === 'Q4' ? 5_290_000_000 : q === 'Q6' ? 7_490_000_000 : 8_710_000_000, circa: true,
    repo: ENC_AC, cerca: q === 'Q4' ? ['AD-Q4_K', 'Q4_K', 'Q4'] : q === 'Q6' ? ['AD-Q6_K', 'Q6_K', 'Q6'] : ['Q8_0', 'Q8'],
    cercaMmproj: ['mmproj.*Q8_0', 'mmproj.*f16', 'mmproj']
  })),
  // mradermacher: Qwen3-VL 8B Instruct Uncensored V2 (non fatto per Qwen-Image: da provare)
  ...(['Q4', 'Q6', 'Q8'] as const).map((q): VoceCatalogo => ({
    id: 'te-mr-' + q.toLowerCase(), tipo: 'encoder', quant: q, famiglia: 'mradermacher · Uncensored V2', nome: `Qwen3-VL 8B Uncensored V2 · ${q}`,
    descrizione: 'Un Qwen3-VL 8B senza filtri fatto da altri, non per Qwen-Image: può capire un po\' diversamente il prompt. Da provare.',
    file: '', cartella: 'text_encoders', url: '', byte: q === 'Q4' ? 5_100_000_000 : q === 'Q6' ? 6_800_000_000 : 8_800_000_000, circa: true,
    repo: ENC_MR, cerca: q === 'Q4' ? ['Q4_K_M', 'Q4_K_S', 'Q4'] : q === 'Q6' ? ['Q6_K', 'Q6'] : ['Q8_0', 'Q8'],
    cercaMmproj: ['mmproj.*Q8_0', 'mmproj.*f16', 'mmproj']
  })),
  // --- traduttore: un modello di sola traduzione italiano → inglese (~300 MB, sul processore). Si scarica da solo al primo uso ---
  {
    id: 'trad-it-en', tipo: 'traduttore', nome: 'Traduttore italiano → inglese (Opus-MT)',
    descrizione: 'Un modello fatto solo per tradurre: traduce il prompt prima di disegnare, sul processore, senza Qwen e senza VRAM. I testi fra virgolette restano identici.',
    file: '', cartella: 'translate/opus-mt-it-en', url: '', byte: 310_000_000, circa: true, consigliato: true,
    repo: 'Helsinki-NLP/opus-mt-it-en', cerca: ['^model\\.safetensors$', '^pytorch_model\\.bin$'],
    accanto: ['^config\\.json$', '^generation_config\\.json$', '^tokenizer_config\\.json$', '^source\\.spm$', '^target\\.spm$', '^vocab\\.json$']
  },
  // --- FLUX 3 Image Klein (Black Forest Labs): il repo «comfy» ha bf16, int8 («convrot») e NVFP4 per Klein (veloce, 8 passi) e Klein Base (50 passi, CFG).
  //     I percorsi esatti vengono dall'albero del repo (controllato il 22/10/2026, revisione KLEIN_REV): la prima espressione di ogni lista è il nome esatto,
  //     le altre sono ripieghi per i nomi vecchi (flux3_image_klein_sd_…) e per eventuali rinomine; l'ultima è larga ma esclude VAE, encoder, upsampler e altri formati.
  //     Per una scheda da 6-8 GB va bene l'INT8. L'encoder è un Qwen3-VL 4B (diverso dal nostro 8B); il VAE è quello di FLUX.2. ---
  ...([
    ['klein-int8', 'FLUX 3 Klein · veloce · INT8', 'Il più veloce: 8 passi senza CFG. L\'INT8 sta nelle schede da 8 GB.', 5_800_000_000, ['^flux3-image-klein-int8-convrot\\.safetensors$', '^flux3_image_klein_sd_int8', '^(?=.*klein)(?!.*base)(?!.*(vae|qwen|text_enc|upsampl|bf16|nvfp4|fp8))(?=.*int8)']],
    ['klein-bf16', 'FLUX 3 Klein · veloce · BF16', 'Stessa qualità dell\'originale, ma pesa il doppio: serve molta RAM.', 11_100_000_000, ['^flux3-image-klein-bf16\\.safetensors$', '^flux3_image_klein_sd(_bf16)?\\.safetensors$', '^(?=.*klein)(?!.*base)(?!.*(vae|qwen|text_enc|upsampl|int8|nvfp4|fp8))(?=.*bf16)']],
    ['klein-base-int8', 'FLUX 3 Klein Base · INT8', 'La versione «normale»: 50 passi con CFG 3,5, la qualità piena (3 volte più lenta di Klein).', 5_800_000_000, ['^flux3-image-klein-base-int8-convrot\\.safetensors$', '^flux3_image_klein_base_int8', '^(?=.*klein)(?=.*base)(?!.*(vae|qwen|text_enc|upsampl|bf16|nvfp4|fp8))(?=.*int8)']],
    ['klein-base-bf16', 'FLUX 3 Klein Base · BF16', 'Klein Base non quantizzato.', 11_100_000_000, ['^flux3-image-klein-base-bf16\\.safetensors$', '^flux3_image_klein_base(_bf16)?\\.safetensors$', '^(?=.*klein)(?=.*base)(?!.*(vae|qwen|text_enc|upsampl|int8|nvfp4|fp8))(?=.*bf16)']]
  ] as const).map(([id, nome, descrizione, byte, cerca]): VoceCatalogo => ({
    id, tipo: 'klein', nome, descrizione, file: '', cartella: 'diffusion_models', url: '', byte, circa: true, repo: KLEIN, cerca: [...cerca], revisione: KLEIN_REV
  })),
  {
    id: 'klein-te', tipo: 'klein-te', nome: 'Text encoder di FLUX 3 Klein (Qwen3-VL 4B)',
    descrizione: 'Legge il prompt per Klein. È un Qwen3-VL da 4 miliardi di parametri, diverso dal nostro encoder 8B (che resta per migliora prompt, Idee, Estrai…).',
    file: '', cartella: 'text_encoders', url: '', byte: 4_900_000_000, circa: true,
    repo: KLEIN, revisione: KLEIN_REV, cerca: ['^qwen3vl_4b_int8_convrot\\.safetensors$', '^qwen3vl_4b_int8', '^(?=.*(qwen3|qwen_3))(?=.*vl)(?=.*4b)(?!.*(prompt|upsampl|9b))', '^(?=.*(qwen3|qwen_3))(?=.*4b)(?!.*(prompt|upsampl|9b))']
  },
  {
    id: 'klein-vae', tipo: 'klein-vae', nome: 'VAE di FLUX 3 Klein (FLUX.2)',
    descrizione: 'Il decoder delle immagini di Klein (piccolo).',
    file: '', cartella: 'vae', url: '', byte: 336_211_292, circa: true,
    repo: KLEIN, revisione: KLEIN_REV, cerca: ['^flux2-vae\\.safetensors$', '^(?=.*flux)(?=.*vae)', '^(?=.*vae)(?!.*qwen)']
  },
  // --- togli sfondo e estrai fedele: si scaricano al primo uso, girano in una fase a parte (pochi centinaia di MB di VRAM) e poi escono dalla scheda ---
  {
    id: 'sfondo-birefnet', tipo: 'sfondo', nome: 'BiRefNet (togli sfondo)',
    descrizione: 'Separa il soggetto dallo sfondo senza ridisegnarlo: i pixel restano quelli della tua foto, con capelli e bordi fini. Licenza MIT.',
    file: '', cartella: 'segment/birefnet', url: '', byte: 444_473_596, circa: true, consigliato: false,
    repo: BIREFNET, revisione: BIREFNET_REV, cerca: ['^model\\.safetensors$'], accanto: ['^config\\.json$']
  },
  {
    id: 'seg-sam2', tipo: 'segmentatore', nome: 'SAM 2.1 small (estrai fedele)',
    descrizione: 'Dal riquadro o dai punti che indichi ritaglia esattamente quella cosa dalla foto originale (persona, oggetto), senza ricrearla. Licenza Apache-2.0.',
    file: '', cartella: 'segment/sam2.1-hiera-small', url: '', byte: 184_305_280, circa: true, consigliato: false,
    repo: SAM2, revisione: SAM2_REV, cerca: ['^model\\.safetensors$'], accanto: ['^config\\.json$', '^preprocessor_config\\.json$', '^processor_config\\.json$']
  },
  // --- LLM uncensored per i testi (migliora prompt, descrivi foto, Idee, Estrai…) con Klein: stesso formato del Qwen3-VL 4B di Klein, quindi si sostituisce uno a uno ---
  {
    id: 'llm-huihui-4b', tipo: 'llm', uncensored: true, nome: 'Qwen3-VL 4B uncensored (Huihui, INT8)',
    descrizione: 'Il Qwen3-VL 4B «abliterated» di huihui-ai, nel formato di ComfyUI. Scrive e descrive senza rifiuti: serve solo ai testi, non al disegno.',
    file: '', cartella: 'text_encoders', url: '', byte: 5_064_440_625, circa: true,
    repo: HUIHUI4B, revisione: HUIHUI4B_REV, cerca: ['^Huihui-Qwen3-VL-4B-Instruct-abliterated-int8_convrot\\.safetensors$', 'int8_convrot\\.safetensors$']
  },
  // --- VAE ---
  {
    id: 'vae-fix', tipo: 'vae', nome: 'Texture-Fix VAE (madebyollin)',
    descrizione: 'Il VAE ritoccato: trame più pulite, niente scacchiera. Il predefinito per la massima qualità.',
    file: 'texture_fix_vae_for_qwen_image_2.1_bf16.safetensors', cartella: 'vae',
    url: 'https://huggingface.co/madebyollin/texture-fix-vae-for-qwen-image-2.1/resolve/main/texture_fix_vae_for_qwen_image_2.1_bf16.safetensors',
    byte: 675509688, sha256: '36f56608b02077a50a08ea3dbcdb88351298ceba49948f41f9f87186378e6908', consigliato: true, necessario: true
  },
  {
    id: 'vae', tipo: 'vae', nome: 'VAE originale Qwen-Image-2.1',
    descrizione: 'Il VAE ufficiale.',
    file: 'qwen_image_2.1_vae_bf16.safetensors', cartella: 'vae', url: UC + 'vae/qwen_image_2.1_vae_bf16.safetensors',
    byte: 675509688, sha256: 'bb21f7473051e1ac368515dd3f2e15cd44d7a11748ee8823e1ddca3e4876b7c9'
  },
  // --- anteprima dal vivo: il "tiny VAE" di madebyollin per Qwen-Image 2.1 (64 canali, 16×) ---
  {
    // senza questo il motore mostra l'anteprima a 1/16 della risoluzione (una macchia); con questo è nitida a ogni passo
    id: 'tae', tipo: 'anteprima', nome: 'TAEQI 2.1 (anteprime dal vivo)',
    descrizione: 'Il decoder piccolissimo che fa vedere l\'immagine nascere passo per passo, nitida. Solo per le anteprime.',
    file: 'taeqi2_1_decoder.pth', cartella: 'vae_approx',
    url: 'https://raw.githubusercontent.com/madebyollin/taesd/main/taeqi2_1_decoder.pth',
    byte: 15314938, sha256: '53c2212f4ea6c8ad06a30d4969d891f80339ff87bb3f77fe793848613d3a9042', consigliato: true, necessario: true
  },
  // --- ingrandimento ---
  {
    id: 'ultrasharp', tipo: 'upscaler', nome: '4x-UltraSharp',
    descrizione: 'Ingrandisce 4 volte tenendo i dettagli nitidi (per "Ingrandisci" e "Rifinisci").',
    file: '4x-UltraSharp.pth', cartella: 'upscale_models', url: 'https://huggingface.co/Kim2091/UltraSharp/resolve/main/4x-UltraSharp.pth',
    byte: 66961958, sha256: 'a5812231fc936b42af08a5edba784195495d303d5b3248c24489ef0c4021fe01', consigliato: true, necessario: true
  },
  // --- LoRA consigliati ---
  {
    // Turbo8 (chriswritescode): distillazione a 8 passi, CFG 1, euler/simple. Niente sha256 pubblicato: basta che ci sia
    id: 'lora-turbo', tipo: 'lora', nome: 'Turbo 8 passi (Turbo8)',
    descrizione: 'Fa le immagini in 8 passi invece di 40: circa 5 volte più veloce, con poca perdita. Dalla 1.1 non serve più: il Turbo di Qwen non esiste più.',
    file: 'turbo8_lora_step2500.safetensors', cartella: 'loras',
    url: 'https://huggingface.co/chriswritescode/Turbo8-LoRA-Qwen-Image-2.1/resolve/main/turbo8_lora_step2500.safetensors',
    // dalla 1.1 il Turbo di Qwen non si usa più (D1 del piano): resta per chi ce l'ha, ma non si scarica da solo
    byte: 1_360_000_000, circa: true, consigliato: false
  },
  {
    // ausboss: tiene le modifiche "ferme" (luce, colori, stile, testi) senza spostare niente; non fa muovere i soggetti
    id: 'lora-coerenza', tipo: 'lora', nome: 'Coerenza delle modifiche (ausboss)', uso: 'Modifiche che non spostano niente',
    descrizione: 'Le modifiche restano sul fotogramma: luce, colori, testi e stili cambiano, i contorni no. Si accende da solo nelle azioni giuste. Non serve per cambiare pose.',
    file: 'qwen-image-2.1-consistency.safetensors', cartella: 'loras',
    url: 'https://huggingface.co/ausboss/Qwen-Image-2.1-Consistency-LoRA/resolve/main/qwen-image-2.1-consistency.safetensors',
    byte: 159_000_000, circa: true, consigliato: true
  },
  {
    // ausboss: persona nell'image_1, vestito nell'image_2
    id: 'lora-vestiti', tipo: 'lora', nome: 'Cambio vestito (ausboss)', uso: 'Prova vestito',
    descrizione: 'Mette alla persona il vestito di un\'altra foto, tenendo volto, pose e sfondo. Si accende da solo in "Prova vestito".',
    file: 'qwen-image-2.1-outfit-swap.safetensors', cartella: 'loras',
    url: 'https://huggingface.co/ausboss/Qwen-Image-2.1-Outfit-Swap-Consistency-LoRA/resolve/main/qwen-image-2.1-outfit-swap.safetensors',
    byte: 159_000_000, circa: true, consigliato: true
  },
  {
    // akhaliq: 36 pose di camera (12 azimut × 4 elevazioni) più il primo piano; parola chiave <mva>
    id: 'lora-camera', tipo: 'lora', nome: 'Camera: angolazioni (akhaliq)', uso: 'Sposta la camera',
    descrizione: 'Rifà la foto da un\'altra posizione della camera: ruoti attorno al soggetto, dall\'alto, dal basso, primo piano. È quello che usa il comando "Camera" di Modifica.',
    file: '', cartella: 'loras', url: '', link: 'https://huggingface.co/akhaliq/Qwen-Image-2.1-Multiple-Angles-LoRA#file=v2,1500,1000',
    byte: 160_000_000, consigliato: true
  },
  {
    id: 'lora-uc', tipo: 'lora', nome: 'Uncensored (abenzerps)',
    descrizione: 'Il LoRA "uncensored" che accompagna il modello.',
    file: 'qwen-image-2.1-uncensored-lora.safetensors', cartella: 'loras', url: UC + 'qwen-image-2.1-uncensored-lora.safetensors',
    byte: 33586704
  },
  {
    id: 'lora-detail', tipo: 'lora', nome: 'Detail Fix 2.0 (e-n-v-y)',
    descrizione: 'Colori meno slavati e trame più fini. Va bene a forza 0.6–1.',
    file: 'qwen2.1-detail-fix-2.0.safetensors', cartella: 'loras',
    url: 'https://huggingface.co/e-n-v-y/Qwen-Image-2.1-Fix-v2.0/resolve/main/qwen2.1-detail-fix-2.0.safetensors',
    byte: 54800124, sha256: '3f00361145703a64c7b9812d7797079820a1f7b0dbb5768b9d3df1f3c7750dfa'
  }
]

// licenza, ruolo, «uncensored» e avvisi di ogni voce, in un posto solo (la UI li mostra accanto al nome; le licenze sono quelle dei repo, controllate il 22/10/2026:
// è una lettura tecnica dei testi, non un parere legale). Un componente «uncensored» ha il rifiuto tolto dai pesi: non cambia la licenza del modello che lo usa.
const AVVISO_QWEN = 'Qwen-Image 2.1 ha la licenza «Qwen Research»: solo ricerca e valutazione, niente uso commerciale senza un accordo con Qwen.'
const AVVISO_KOMMUNITY = 'Licenza FLUX Kommunity: l\'uso commerciale dei risultati ha condizioni (fatturato sotto 5 milioni di dollari, filtri o revisione dei risultati); leggila prima di pubblicare.'
const AVVISO_UNC = 'Questo componente non rifiuta nessuna richiesta e può produrre contenuti sensibili. Usalo solo per scopi leciti, con i diritti e il consenso necessari: sono vietati i contenuti sessuali con minori, le immagini intime non consensuali e ogni altro uso illegale. La licenza del modello resta valida e può limitare l\'uso commerciale.'

const META: Record<string, Partial<VoceCatalogo>> = {
  ...Object.fromEntries(['q4km', 'q6k', 'q8', 'turbo-q4', 'turbo-q6', 'turbo-q8'].map((id) => [id, { licenza: 'Qwen Research', licenzaUrl: LIC_QWEN, ruolo: 'denoiser', avviso: AVVISO_QWEN } as Partial<VoceCatalogo>])),
  'te-int8': { licenza: 'Apache-2.0', licenzaUrl: LIC_APACHE, ruolo: 'encoder' },
  ...Object.fromEntries(['te-ac-q4', 'te-ac-q6', 'te-ac-q8', 'te-mr-q4', 'te-mr-q6', 'te-mr-q8'].map((id) => [id, { licenza: 'Apache-2.0', licenzaUrl: LIC_APACHE, ruolo: 'encoder', uncensored: true, avviso: AVVISO_UNC } as Partial<VoceCatalogo>])),
  'trad-it-en': { licenza: 'CC-BY-4.0', licenzaUrl: 'https://creativecommons.org/licenses/by/4.0/' },
  ...Object.fromEntries(['klein-int8', 'klein-bf16', 'klein-base-int8', 'klein-base-bf16'].map((id) => [id, { licenza: 'FLUX Kommunity', licenzaUrl: LIC_KOMMUNITY, ruolo: 'denoiser', avviso: AVVISO_KOMMUNITY } as Partial<VoceCatalogo>])),
  'klein-te': { licenza: 'Apache-2.0', licenzaUrl: LIC_APACHE, ruolo: 'encoder' },
  'klein-vae': { licenza: 'Apache-2.0', licenzaUrl: LIC_APACHE, ruolo: 'vae' },
  'sfondo-birefnet': { licenza: 'MIT', licenzaUrl: 'https://huggingface.co/ZhengPeng7/BiRefNet', ruolo: 'sfondo' },
  'seg-sam2': { licenza: 'Apache-2.0', licenzaUrl: LIC_APACHE, ruolo: 'segmentatore' },
  'llm-huihui-4b': { licenza: 'Apache-2.0', licenzaUrl: LIC_APACHE, ruolo: 'llm', avviso: AVVISO_UNC },
  'lora-uc': { uncensored: true, licenza: 'Qwen Research', licenzaUrl: LIC_QWEN, ruolo: 'lora', avviso: AVVISO_QWEN + ' ' + AVVISO_UNC }
}

export const CATALOGO: VoceCatalogo[] = GREZZO.map((v) => ({ ...v, ...(META[v.id] || {}) }))

export const voce = (id: string): VoceCatalogo | undefined => CATALOGO.find((v) => v.id === id)

/** il testo di un avviso sui modelli uncensored, uguale per tutti (la UI lo mostra prima di chiedere l'accettazione) */
export const AVVISO_UNCENSORED = AVVISO_UNC

/** le licenze con cui un componente uncensored può stare nel catalogo: permissive, o «Qwen Research» (solo con l'avviso sul limite d'uso).
 *  Fuori: FLUX Kommunity (§4(d): niente scorciatoie per togliere le protezioni), qualunque «non-commercial» non letto, licenze mancanti o senza link. */
export const LICENZE_UNCENSORED = ['Apache-2.0', 'MIT', 'BSD-3-Clause', 'CC-BY-4.0', 'Qwen Research']

/** una voce uncensored ha una licenza valida? null = sì, se no il motivo in italiano */
export function motivoLicenza(v: VoceCatalogo): string | null {
  if (!v.uncensored) return null
  if (!v.licenza || !v.licenzaUrl) return `«${v.nome}» non ha una licenza dichiarata e verificabile: non si scarica.`
  if (!LICENZE_UNCENSORED.includes(v.licenza)) return `«${v.nome}» ha la licenza «${v.licenza}», che non permette di distribuire una versione senza protezioni: non si scarica.`
  if (v.licenza === 'Qwen Research' && !/Qwen Research/.test(v.avviso || '')) return `«${v.nome}» è sotto «Qwen Research» ma manca l'avviso sul limite d'uso: non si scarica.`
  return null
}

/** una voce uncensored si scarica solo con licenza valida (`motivoLicenza`), con l'interruttore «Modelli uncensored» acceso e l'avviso accettato; null = si può, se no il motivo in italiano.
 *  È la guardia del processo principale: la UI nasconde le voci, ma anche una chiamata diretta non le scarica. */
export function motivoDiBlocco(v: VoceCatalogo, imp: { uncensored?: boolean; uncensoredAccettato?: boolean }): string | null {
  if (!v.uncensored) return null
  const licenza = motivoLicenza(v)
  if (licenza) return licenza
  if (!imp.uncensored) return `«${v.nome}» è un modello uncensored: accendi «Modelli uncensored» in Opzioni per poterlo scaricare.`
  if (!imp.uncensoredAccettato) return `«${v.nome}» è un modello uncensored: prima leggi e accetta l'avviso in Opzioni → Modelli uncensored.`
  return null
}
