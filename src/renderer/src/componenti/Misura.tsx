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
/** i formati (proporzioni) da cliccare */
const FORMATI_MISURA: { id: string; r: [number, number] }[] = [
  { id: '1:1', r: [1, 1] }, { id: '4:5', r: [4, 5] }, { id: '3:2', r: [3, 2] }, { id: '4:3', r: [4, 3] },
  { id: '16:9', r: [16, 9] }, { id: '9:16', r: [9, 16] }, { id: '21:9', r: [21, 9] }
]
/** le risoluzioni più usate */
const RISOLUZIONI_USUALI: { nome: string; w: number; h: number; titolo: string }[] = [
  { nome: 'HD', w: 1280, h: 720, titolo: '1280 × 720' },
  { nome: 'Full HD', w: 1920, h: 1080, titolo: '1920 × 1080' },
  { nome: '2K', w: 2560, h: 1440, titolo: '2560 × 1440' },
  { nome: '4K', w: 3840, h: 2160, titolo: '3840 × 2160' },
  { nome: 'Instagram', w: 1080, h: 1350, titolo: '1080 × 1350 (4:5)' },
  { nome: 'Storia', w: 1080, h: 1920, titolo: '1080 × 1920 (9:16)' },
  { nome: 'Quadrata', w: 1080, h: 1080, titolo: '1080 × 1080' },
  { nome: 'A4 300 dpi', w: 2480, h: 3508, titolo: '2480 × 3508' },
  { nome: 'Foto 10×15', w: 1800, h: 1200, titolo: '1800 × 1200 (300 dpi)' }
]

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
  /** quali scelte offrire (Fusion non ha l'originale) */
  ammetti?: ('auto' | 'originale' | 'custom')[]
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
  /** un formato (proporzioni): il lato lungo resta com'è (o 2048 se non c'era una misura) */
  const conFormato = (r: [number, number]): void => {
    const lungo = Math.max(custom.w, custom.h)
    const orizz = r[0] >= r[1]
    const ar2 = r[0] / r[1]
    setBlocca(false)
    p.cambia({ tipo: 'custom', w: limita(orizz ? lungo : lungo * ar2), h: limita(orizz ? lungo / ar2 : lungo) })
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
          { id: 'auto' as const, nome: 'Auto', sotto: `${mpTesto} MP`, titolo: 'Esce grande quanto i megapixel scelti, con le proporzioni della foto' },
          { id: 'originale' as const, nome: 'Originale', sotto: p.base ? `${p.base.larghezza}×${p.base.altezza}` : 'come la foto', titolo: 'Esce grande esattamente come la foto di partenza' },
          { id: 'custom' as const, nome: 'Misura mia', sotto: 'scelgo io' }
        ].filter((x) => (p.ammetti || ['auto', 'originale', 'custom']).includes(x.id))}
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
          <span className="piccolo tenue" style={{ display: 'block', marginTop: 10 }}>Formato</span>
          <div className="riga a-capo" style={{ gap: 6, marginTop: 4 }}>
            {FORMATI_MISURA.map((f) => {
              const su = Math.abs(v.w / v.h - f.r[0] / f.r[1]) < 0.01
              return <button key={f.id} className={`chip ${su ? 'su' : ''}`} onClick={() => conFormato(f.r)} title={`Proporzioni ${f.id}, tenendo il lato lungo`}>{f.id}</button>
            })}
          </div>
          <span className="piccolo tenue" style={{ display: 'block', marginTop: 10 }}>Risoluzioni usuali</span>
          <div className="riga a-capo" style={{ gap: 6, marginTop: 4 }}>
            {RISOLUZIONI_USUALI.map((r) => (
              <button key={r.nome} className={`chip ${v.w === r.w && v.h === r.h ? 'su' : ''}`} onClick={() => { setBlocca(false); p.cambia({ tipo: 'custom', w: r.w, h: r.h }) }} title={r.titolo}>{r.nome}</button>
            ))}
          </div>
          <span className="piccolo tenue" style={{ display: 'block', marginTop: 10 }}>Lato lungo</span>
          <div className="riga a-capo" style={{ gap: 6, marginTop: 4 }}>
            {LATI.map((l) => (
              <button key={l} className={`chip ${Math.max(v.w, v.h) === l ? 'su' : ''}`} onClick={() => conLato(l)} title={`Il lato lungo a ${l} px`}>{l >= 3000 ? `${Math.round(l / 1024)}K` : l}</button>
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
