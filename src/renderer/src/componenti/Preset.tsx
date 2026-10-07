// La barra dei preset (a sinistra in Crea) e la scheda coi campi del preset scelto.
// Scegliere un preset mette formato, risoluzione e sfondo giusti e scrive il prompt dagli esempi;
// cambiando un campo o uno stile il prompt si riscrive (e si può sempre ritoccare a mano).
import type { JSX } from 'react'
import { usaStato } from '../stato'
import { I } from './Icone'
import { PRESET, campiCon, componiPreset, presetDa, type Preset } from '../preset'

const icona = (nome: string): JSX.Element => {
  const Ic = (I as Record<string, () => JSX.Element>)[nome] || I.crea
  return <Ic />
}

export function BarraPreset({ prima }: { prima: (prompt: string) => void }): JSX.Element {
  const { crea, setCrea } = usaStato()
  const scegli = (p: Preset | null): void => {
    if (!p) {
      setCrea({ preset: '' })
      return
    }
    if (!crea.preset && crea.prompt.trim()) prima(crea.prompt)
    const stile = p.stili[0]?.id || ''
    setCrea({ preset: p.id, stile, campi: {}, formato: p.formato, ris: p.ris, trasparente: !!p.trasparente, prompt: componiPreset(p, {}, stile) })
  }
  return (
    <nav className="barra-preset" aria-label="Preset">
      <button className={!crea.preset ? 'su' : ''} onClick={() => scegli(null)} title="Scrivi tu il prompt, senza preset">
        {icona('libero')}
        <span>Libero</span>
      </button>
      <i className="riga-sep" />
      {PRESET.map((p) => (
        <button key={p.id} className={crea.preset === p.id ? 'su' : ''} onClick={() => scegli(p)} title={p.descrizione}>
          {icona(p.icona)}
          <span>{p.nome}</span>
        </button>
      ))}
    </nav>
  )
}

export function SchedaPreset(): JSX.Element | null {
  const { crea, setCrea } = usaStato()
  const p = presetDa(crea.preset)
  if (!p) return null
  const valori = campiCon(p, crea.campi)
  const cambiaCampo = (id: string, valore: string): void => {
    const campi = { ...valori, [id]: valore }
    setCrea({ campi, prompt: componiPreset(p, campi, crea.stile) })
  }
  const cambiaStile = (stile: string): void => setCrea({ stile, prompt: componiPreset(p, valori, stile) })
  return (
    <div className="sezione scheda-preset">
      <h3>
        <span className="ic">{icona(p.icona)}</span> {p.nome}
        <span className="dx">
          <button className="btn piccolo fantasma" onClick={() => setCrea({ preset: '' })} title="Torna al prompt libero (il testo resta)">
            <I.x /> Esci
          </button>
        </span>
      </h3>
      <div className="riga a-capo" style={{ gap: 6, marginBottom: 10 }}>
        {p.stili.map((s) => (
          <button key={s.id} className={`chip ${crea.stile === s.id ? 'su' : ''}`} onClick={() => cambiaStile(s.id)} title={s.testo}>
            {s.nome}
          </button>
        ))}
      </div>
      <div className="col" style={{ gap: 8 }}>
        {p.campi.map((c) => (
          <label key={c.id} className="campo-preset">
            <span>{c.nome}</span>
            {c.tipo === 'righe' ? (
              <textarea value={valori[c.id]} onChange={(e) => cambiaCampo(c.id, e.target.value)} style={{ minHeight: 84 }} placeholder={c.esempio} />
            ) : (
              <input type="text" value={valori[c.id]} onChange={(e) => cambiaCampo(c.id, e.target.value)} placeholder={c.esempio} />
            )}
          </label>
        ))}
      </div>
      <div className="piccolo spento" style={{ marginTop: 8 }}>
        Scrivi in italiano: i testi da mettere nell'immagine restano identici (anche gli accenti). Il prompt qui sotto si aggiorna da solo.
      </div>
    </div>
  )
}
