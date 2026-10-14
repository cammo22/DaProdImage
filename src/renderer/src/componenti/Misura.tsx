// Le dimensioni dell'immagine che esce: come vengono (dai megapixel scelti), come la foto originale, o una misura tua.
// Il modello lavora ai megapixel scelti; alla fine il motore porta l'immagine alla misura esatta (riduce, o ingrandisce con
// l'ingranditore se serve molto di più; se le proporzioni sono diverse taglia al centro).
import { useState, type JSX } from 'react'
import { Segmenti } from './Controlli'
import type { Richiesta } from '@shared/tipi'

export type Misura = { tipo: 'auto' } | { tipo: 'originale' } | { tipo: 'custom'; w: number; h: number }
export const MISURA0: Misura = { tipo: 'auto' }

const LATO_MAX = 8192
const LATI = [1024, 1536, 2048, 3000, 4096]

/** la parte della richiesta che dice la misura finale (niente se si lascia fare al modello) */
export function conMisura(m: Misura | undefined, base: { larghezza: number; altezza: number } | null): Pick<Richiesta, 'uscita'> | Record<string, never> {
  if (!m || m.tipo === 'auto') return {}
  if (m.tipo === 'originale') return base ? { uscita: { w: base.larghezza, h: base.altezza } } : {}
  return { uscita: { w: m.w, h: m.h } }
}

const limita = (v: number): number => Math.max(64, Math.min(LATO_MAX, Math.round(Number(v) || 0)))

export function SceltaMisura(p: {
  valore: Misura
  cambia: (m: Misura) => void
  /** la foto originale (se c'è): da lì le dimensioni "come l'originale" e le proporzioni */
  base: { larghezza: number; altezza: number } | null
  /** i megapixel a cui lavora il modello, per dirlo chiaro */
  mp: number
}): JSX.Element {
  const [blocca, setBlocca] = useState(true)
  const ar = p.base ? p.base.larghezza / p.base.altezza : 1
  const v = p.valore
  const custom = v.tipo === 'custom' ? v : { tipo: 'custom' as const, w: p.base ? Math.min(LATO_MAX, p.base.larghezza) : 1024, h: p.base ? Math.min(LATO_MAX, p.base.altezza) : 1024 }
  const mpTesto = String(p.mp).replace('.', ',')
  const finale = v.tipo === 'originale' && p.base ? p.base : v.tipo === 'custom' ? { larghezza: v.w, altezza: v.h } : null
  const mpFinale = finale ? (finale.larghezza * finale.altezza) / 1048576 : 0

  const conLato = (lungo: number): void => {
    const orizz = ar >= 1
    const w = orizz ? lungo : lungo * ar
    const h = orizz ? lungo / ar : lungo
    p.cambia({ tipo: 'custom', w: limita(w), h: limita(h) })
  }
  const cambiaW = (w: number): void => {
    const nw = limita(w)
    p.cambia({ tipo: 'custom', w: nw, h: blocca && p.base ? limita(nw / ar) : custom.h })
  }
  const cambiaH = (h: number): void => {
    const nh = limita(h)
    p.cambia({ tipo: 'custom', w: blocca && p.base ? limita(nh * ar) : custom.w, h: nh })
  }
  const taglia = !!p.base && v.tipo === 'custom' && Math.abs(v.w / v.h - ar) > 0.02

  return (
    <div className="misura">
      <Segmenti
        valore={v.tipo}
        cambia={(tipo) => p.cambia(tipo === 'auto' ? { tipo: 'auto' } : tipo === 'originale' ? { tipo: 'originale' } : custom)}
        voci={[
          { id: 'auto', nome: 'Auto', sotto: `${mpTesto} MP`, titolo: 'Esce grande quanto i megapixel scelti, con le proporzioni della foto' },
          { id: 'originale', nome: 'Originale', sotto: p.base ? `${p.base.larghezza}×${p.base.altezza}` : 'come la foto', titolo: 'Esce grande esattamente come la foto di partenza' },
          { id: 'custom', nome: 'Misura mia', sotto: 'scelgo io' }
        ]}
      />
      {v.tipo === 'custom' && (
        <div className="misura-campi">
          <div className="riga" style={{ gap: 8 }}>
            <input type="number" min={64} max={LATO_MAX} step={16} value={v.w} onChange={(e) => cambiaW(Number(e.target.value))} aria-label="Larghezza" />
            <button className={`btn icona piccolo ${blocca ? 'attivo' : ''}`} onClick={() => setBlocca(!blocca)} title={blocca ? 'Proporzioni bloccate (come la foto)' : 'Proporzioni libere'} disabled={!p.base}>
              {blocca && p.base ? '🔗' : '↔'}
            </button>
            <input type="number" min={64} max={LATO_MAX} step={16} value={v.h} onChange={(e) => cambiaH(Number(e.target.value))} aria-label="Altezza" />
            <span className="piccolo tenue">px</span>
          </div>
          <div className="riga a-capo" style={{ gap: 6, marginTop: 8 }}>
            {LATI.map((l) => (
              <button key={l} className="chip" onClick={() => conLato(l)} title={`Il lato lungo a ${l} px`}>{l >= 3000 ? `${Math.round(l / 1024)}K` : l}</button>
            ))}
          </div>
        </div>
      )}
      {finale && (
        <div className="piccolo spento" style={{ marginTop: 6 }}>
          Lavora a ~{mpTesto} MP e porta a <b>{finale.larghezza} × {finale.altezza}</b> ({mpFinale.toFixed(1).replace('.', ',')} MP)
          {mpFinale > p.mp * 1.5 ? ' con l\'ingranditore' : ''}.{taglia ? ' Le proporzioni sono diverse: taglia al centro.' : ''}
        </div>
      )}
    </div>
  )
}
