// I file dei modelli che l'app sa scaricare (con dimensione e sha256 per controllarli).
import type { VoceCatalogo } from '@shared/tipi'

const UC = 'https://huggingface.co/abenzerps/Qwen-Image-2.1-Uncensored-GGUF/resolve/main/'

export const CATALOGO: VoceCatalogo[] = [
  // --- modello di diffusione (uno solo serve) ---
  {
    id: 'q4km', tipo: 'diffusione', nome: 'Qwen-Image-2.1 Uncensored Q4_K_M',
    descrizione: 'Il migliore equilibrio per 8 GB: sta tutto nella scheda video.',
    file: 'qwen-image-2.1-UC-Q4_K_M.gguf', cartella: 'diffusion_models', url: UC + 'qwen-image-2.1-UC-Q4_K_M.gguf',
    byte: 4604558112, sha256: 'e79c8a009f2ecbdb6c70fd663d9aea9ee304a0d91f347e4169a756b8ad141b41', consigliato: true
  },
  {
    id: 'q5km', tipo: 'diffusione', nome: 'Qwen-Image-2.1 Uncensored Q5_K_M',
    descrizione: 'Un po\' più fedele, ancora comodo su 8 GB.',
    file: 'qwen-image-2.1-UC-Q5_K_M.gguf', cartella: 'diffusion_models', url: UC + 'qwen-image-2.1-UC-Q5_K_M.gguf',
    byte: 5221284640, sha256: 'af0bf278cf16d204fb31c384dc82fd41dca82d976b15fe9305a60c726fd6f821'
  },
  {
    id: 'q6k', tipo: 'diffusione', nome: 'Qwen-Image-2.1 Uncensored Q6_K',
    descrizione: 'Quasi identico all\'originale; su 8 GB una parte va in RAM (un po\' più lento).',
    file: 'qwen-image-2.1-UC-Q6_K.gguf', cartella: 'diffusion_models', url: UC + 'qwen-image-2.1-UC-Q6_K.gguf',
    byte: 5876556576, sha256: 'e14bb312109333b3d73b92ad9b9ac8b29b51f2edca1e7b86d1af1981bf1c4ee3'
  },
  {
    id: 'q8', tipo: 'diffusione', nome: 'Qwen-Image-2.1 Uncensored Q8_0',
    descrizione: 'Il massimo della fedeltà in GGUF; su 8 GB lavora in parte dalla RAM.',
    file: 'qwen-image-2.1-UC-Q8_0.gguf', cartella: 'diffusion_models', url: UC + 'qwen-image-2.1-UC-Q8_0.gguf',
    byte: 7591557920, sha256: 'cde456c72ea3ecebfc1be783300e972711d875e0c5f1bed33d42b66b156affa8'
  },
  // --- text encoder (Qwen3-VL 8B: legge il prompt e guarda le foto) ---
  {
    id: 'te-int8', tipo: 'encoder', nome: 'Qwen3-VL 8B (int8)',
    descrizione: 'Legge il prompt e le foto. Lavora dalla RAM: non ruba spazio al modello.',
    file: 'qwen3vl_8b_int8_convrot.safetensors', cartella: 'text_encoders', url: UC + 'text_encoders/qwen3vl_8b_int8_convrot.safetensors',
    byte: 9350798360, sha256: '8bfd0f6e12abf2d2d697ecc888e5e90b0d6741d6708f05799f53afa560452e8f', consigliato: true, necessario: true
  },
  {
    id: 'te-bf16', tipo: 'encoder', nome: 'Qwen3-VL 8B (bf16, originale)',
    descrizione: 'Precisione piena. Serve tanta RAM (almeno 32 GB); differenza minima.',
    file: 'qwen3vl_8b_bf16.safetensors', cartella: 'text_encoders', url: UC + 'text_encoders/qwen3vl_8b_bf16.safetensors',
    byte: 17534334616, sha256: '68bdc82bc1b66851162ae656225e7e2068166b603db19bd5d5a3b90eb12669a9'
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
    descrizione: 'Fa le immagini in 8 passi invece di 40: circa 5 volte più veloce, con poca perdita. Il modo Turbo di Crea e Modifica.',
    file: 'turbo8_lora_step2500.safetensors', cartella: 'loras',
    url: 'https://huggingface.co/chriswritescode/Turbo8-LoRA-Qwen-Image-2.1/resolve/main/turbo8_lora_step2500.safetensors',
    byte: 1_360_000_000, circa: true, consigliato: true
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

export const voce = (id: string): VoceCatalogo | undefined => CATALOGO.find((v) => v.id === id)
