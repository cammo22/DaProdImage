// Icone a tratto (24×24), tutte nello stesso stile.
import type { JSX } from 'react'

const S = (p: { children: React.ReactNode; size?: number }): JSX.Element => (
  <svg viewBox="0 0 24 24" width={p.size || 24} height={p.size || 24} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {p.children}
  </svg>
)

export const I = {
  crea: () => <S><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z" /><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /><path d="M5 16l.6 1.4L7 18l-1.4.6L5 20l-.6-1.4L3 18l1.4-.6z" /></S>,
  modifica: () => <S><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /><path d="M15 20h5" /></S>,
  galleria: () => <S><rect x="3" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" /></S>,
  lora: () => <S><path d="M12 2l8.5 5v10L12 22l-8.5-5V7z" /><path d="M12 22V12" /><path d="M20.5 7L12 12 3.5 7" /></S>,
  impostazioni: () => <S><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></S>,
  coda: () => <S><path d="M4 6h16M4 12h10M4 18h7" /><circle cx="18" cy="16" r="3" /><path d="M18 14.6V16l.9.9" /></S>,
  bacchetta: () => <S><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5" /></S>,
  dado: () => <S><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r="1.2" fill="currentColor" /><circle cx="16" cy="16" r="1.2" fill="currentColor" /><circle cx="16" cy="8" r="1.2" fill="currentColor" /><circle cx="8" cy="16" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /></S>,
  stella: () => <S><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" /></S>,
  stellaPiena: () => <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" /></svg>,
  cestino: () => <S><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" /></S>,
  cartella: () => <S><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></S>,
  copia: () => <S><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></S>,
  scarica: () => <S><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></S>,
  ricicla: () => <S><path d="M3 12a9 9 0 0115.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 01-15.5 6.2L3 16M3 21v-5h5" /></S>,
  x: () => <S><path d="M6 6l12 12M18 6L6 18" /></S>,
  piu: () => <S><path d="M12 5v14M5 12h14" /></S>,
  pennello: () => <S><path d="M18.4 2.6a2 2 0 012.9 2.9L11 15.8 8.2 13z" /><path d="M8.2 13c-2.4 0-4 1.6-4 4 0 1.3-.7 2.4-2 3 4.6 1.2 8.8-.2 8.8-4.2" /></S>,
  gomma: () => <S><path d="M7 21h13M5.6 15.6l8.5-8.5a2 2 0 012.8 0l2 2a2 2 0 010 2.8L11 19.8a2 2 0 01-1.4.6H8.4a2 2 0 01-1.4-.6l-1.4-1.4a2 2 0 010-2.8z" /><path d="M9 12l5 5" /></S>,
  rettangolo: () => <S><rect x="4" y="6" width="16" height="12" rx="1.5" strokeDasharray="3 2.5" /></S>,
  lazo: () => <S><path d="M7 20c2-1 2.5-3 1.5-4.5C5 16 3 13.5 3 11c0-4 4-7 9-7s9 3 9 7-4 7-9 7c-1.2 0-2.3-.2-3.4-.5" /></S>,
  mano: () => <S><path d="M18 11V6a2 2 0 00-4 0v5M14 10V4a2 2 0 00-4 0v6M10 10.5V6a2 2 0 00-4 0v8a8 8 0 0016 0v-3a2 2 0 00-4 0" /></S>,
  inverti: () => <S><circle cx="12" cy="12" r="9" /><path d="M12 3v18" /><path d="M12 3a9 9 0 010 18" fill="currentColor" stroke="none" /></S>,
  annulla: () => <S><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 010 11H11" /></S>,
  ripeti: () => <S><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 000 11H13" /></S>,
  adatta: () => <S><path d="M4 9V5a1 1 0 011-1h4M15 4h4a1 1 0 011 1v4M20 15v4a1 1 0 01-1 1h-4M9 20H5a1 1 0 01-1-1v-4" /></S>,
  occhio: () => <S><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></S>,
  ingrandisci: () => <S><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></S>,
  varia: () => <S><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></S>,
  ripristina: () => <S><path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8" /><path d="M3 3v5h5" /></S>,
  immagine: () => <S><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-3.1-3.1a2 2 0 00-2.8 0L6 21" /></S>,
  link: () => <S><path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7" /></S>,
  play: () => <S><path d="M6 4l14 8-14 8z" /></S>,
  stop: () => <S><rect x="5" y="5" width="14" height="14" rx="2" /></S>,
  chip: () => <S><rect x="5" y="5" width="14" height="14" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></S>,
  espandi: () => <S><rect x="7" y="7" width="10" height="10" rx="1" /><path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5" /></S>,
  zona: () => <S><path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3" /><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" opacity=".55" /></S>,
  tutta: () => <S><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 15l5-5 4 4 3-3 6 6" /></S>,
  trascina: () => <S><path d="M12 3v14M5 10l7 7 7-7" /><path d="M4 21h16" /></S>,
  info: () => <S><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.01" /></S>,
  tempo: () => <S><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>,
  fulmine: () => <S><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></S>
}
