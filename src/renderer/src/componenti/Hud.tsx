// HUD misura: la striscia fissa sul palco (e la versione corta accanto al pulsante) con i pixel che escono davvero.
// Prima riga: forma in scala, pixel finali, rapporto, megapixel. Seconda riga solo quando c'è una conversione (verde nativa, ciano ingrandita, ambra ridotta).
import type { JSX, ReactNode } from 'react'
import type { StatoMisura } from '../misura'

export interface DatiHud {
  w: number
  h: number
  rapporto: string
  mp: number
  stato: StatoMisura
  nota: string
}

const testoMp = (mp: number): string => (Math.round(mp * 100) / 100).toFixed(2).replace('.', ',')

export function Hud(p: { d: DatiHud; corto?: boolean; onClick?: () => void; extra?: ReactNode; titolo?: string }): JSX.Element {
  const k = 26 / Math.max(p.d.w, p.d.h)
  return (
    <div className={`hud ${p.d.stato} ${p.corto ? 'corto' : ''}`} onClick={p.onClick} role="button" tabIndex={0} title={p.titolo || p.d.nota} data-hud={`${p.d.w}x${p.d.h}`}
      onKeyDown={(e) => e.key === 'Enter' && p.onClick?.()}>
      <span className="forma"><i style={{ width: Math.max(8, p.d.w * k), height: Math.max(8, p.d.h * k) }} /></span>
      <span className="meta">
        <span className="linea1">
          <span className="px">{p.d.w} × {p.d.h}<small>px</small></span>
          <span className="rapporto">{p.d.rapporto.replace(':', ' : ')}</span>
          <span className="mp">{testoMp(p.d.mp)} MP</span>
        </span>
        {!p.corto && p.d.stato !== 'nativa' && <span className="conv" data-stato={p.d.stato}>{p.d.nota}</span>}
        {!p.corto && p.d.stato === 'nativa' && <span className="conv">{p.d.nota}</span>}
      </span>
      {p.extra}
    </div>
  )
}
