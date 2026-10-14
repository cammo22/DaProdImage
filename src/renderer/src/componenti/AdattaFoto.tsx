// Una scatola che adatta il contenuto (una foto, un segnaposto) alle proporzioni `ar` (larghezza / altezza) dentro tutto
// lo spazio che c'è, senza mai uscire dai bordi: come la foto finita con lo zoom. Il genitore deve essere `position: relative`.
import type { JSX, ReactNode } from 'react'

export function AdattaFoto(p: { ar: number; children: ReactNode; margine?: number }): JSX.Element {
  return (
    <div className="adatta-fuori" style={{ inset: p.margine ?? 0 }}>
      <div className="adatta" style={{ ['--arn' as string]: p.ar }}>
        {p.children}
      </div>
    </div>
  )
}
