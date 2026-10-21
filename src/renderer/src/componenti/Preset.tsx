// Il menu degli stili (in cima alla colonna di Crea) e la scheda coi campi del preset scelto.
// Scegliere un preset mette formato, risoluzione e sfondo giusti e scrive il prompt dagli esempi;
// cambiando un campo o uno stile il prompt si riscrive (e si può sempre ritoccare a mano).
import type { JSX } from 'react'
import { usaStato } from '../stato'
import { I } from './Icone'
import { Casella } from './Casella'
import { PRESET, campiCon, componiPreset, presetDa } from '../preset'

const icona = (nome: string): JSX.Element => {
  const Ic = (I as Record<string, () => JSX.Element>)[nome] || I.crea
  return <Ic />
}

/** gli stili in un menu solo: «Libero» (scrivi tu) o uno dei preset */
export function MenuStili({ prima }: { prima: (prompt: string) => void }): JSX.Element {
  const { crea, setCrea } = usaStato()
  const scegli = (id: string): void => {
    const p = presetDa(id)
    if (!p) {
      setCrea({ preset: '' })
      return
    }
    if (!crea.preset && crea.prompt.trim()) prima(crea.prompt)
    const stile = p.stili[0]?.id || ''
    setCrea({ preset: p.id, stile, campi: {}, formato: p.formato, ris: p.ris, trasparente: !!p.trasparente, prompt: componiPreset(p, {}, stile) })
  }
  const attivo = presetDa(crea.preset)
  return (
    <label className="col" style={{ gap: 4 }} title={attivo ? attivo.descrizione : 'Scrivi tu il prompt, senza preset'}>
      <span className="piccolo tenue">Stile</span>
      <select value={crea.preset} onChange={(e) => scegli(e.target.value)} aria-label="Stile">
        <option value="">Libero (scrivo io il prompt)</option>
        {PRESET.map((p) => (
          <option key={p.id} value={p.id}>{p.nome}</option>
        ))}
      </select>
    </label>
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
              <Casella valore={valori[c.id]} cambia={(v) => cambiaCampo(c.id, v)} minimo={84} placeholder={c.esempio} />
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
