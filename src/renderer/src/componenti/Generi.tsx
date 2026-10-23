// I generi di Crea (ex «preset») come tessere, e l'atmosfera: una tessera per ogni stile di luce del genere scelto.
// Scegliere un genere mette formato, risoluzione e sfondo giusti e scrive il prompt dagli esempi;
// cambiando un campo o l'atmosfera il prompt si riscrive (e si può sempre ritoccare a mano).
// Dalla GUI v2 il genere non è più un menu a tendina: 11 tessere + «Libero». Copertina, slide, app, arte e sticker non hanno la tessera
// (stanno nei Formati, nello Stile e nel Set delle Ricette) ma restano nell'elenco per leggere i lavori salvati.
import type { JSX } from 'react'
import { usaStato } from '../stato'
import { I } from './Icone'
import { Casella } from './Casella'
import { Tessera, Tessere } from './Tessere'
import { PRESET, campiCon, componiPreset, presetDa } from '../preset'

const icona = (nome: string): JSX.Element => {
  const Ic = (I as Record<string, () => JSX.Element>)[nome] || I.crea
  return <Ic />
}

/** i generi che hanno la tessera, nell'ordine della spec */
const GENERI = ['foto', 'ritratto', 'prodotto', 'poster', 'infografica', 'logo', 'social', 'miniatura', 'fumetto', 'invito', 'menu']

/** sceglie un genere (o «Libero» con '') */
export function scegliGenere(id: string, prima: (prompt: string) => void): void {
  const { crea, setCrea } = usaStato.getState()
  const p = presetDa(id)
  if (!p) {
    setCrea({ preset: '' })
    return
  }
  if (!crea.preset && crea.prompt.trim()) prima(crea.prompt)
  const stile = p.stili[0]?.id || ''
  setCrea({
    preset: p.id, stile, campi: {}, formato: p.formato, ris: p.ris, trasparente: !!p.trasparente, sfondo: p.trasparente ? 'trasparente' : 'scena',
    prompt: componiPreset(p, {}, stile)
  })
}

/** «Cosa»: la griglia dei generi 4×3 */
export function GrigliaGeneri({ prima }: { prima: (prompt: string) => void }): JSX.Element {
  const crea = usaStato((s) => s.crea)
  const attivo = presetDa(crea.preset)
  const nascosto = !!attivo && !GENERI.includes(attivo.id)
  return (
    <Tessere colonne={4}>
      {GENERI.map((id) => {
        const p = presetDa(id)!
        return <Tessera key={id} id={`genere-${id}`} icona={icona(p.icona)} nome={p.nome === 'Post social' ? 'Social' : p.nome} titolo={`${p.nome}: ${p.descrizione}`} su={crea.preset === id} onClick={() => scegliGenere(id, prima)} />
      })}
      <Tessera id="genere-libero" icona={icona('libero')} nome="Libero" titolo="Scrivi tu il prompt, senza genere" su={!crea.preset || nascosto} onClick={() => scegliGenere('', prima)} />
    </Tessere>
  )
}

const ATMOSFERE: [RegExp, string][] = [
  [/naturale|luce/i, '☀️'], [/oro/i, '🌅'], [/notte|neon/i, '🌙'], [/pellicola/i, '🎞️'], [/finestra/i, '🪟'], [/studio/i, '💡'], [/strada/i, '🛣️'],
  [/vetro/i, '🔮'], [/pop/i, '💥'], [/lusso|elegante/i, '💎'], [/minimal|pulita|chiaro/i, '⚪'], [/scuro/i, '🌑'], [/acquerello/i, '🎨'], [/pixel/i, '👾']
]
const emojiAtmosfera = (nome: string, i: number): string => ATMOSFERE.find(([r]) => r.test(nome))?.[1] || ['✨', '🌈', '🎯', '🔆'][i % 4]
const SFONDI = ['linear-gradient(135deg,#3a2c7a,#f2a65a)', 'linear-gradient(135deg,#f6c453,#c0392b)', 'linear-gradient(135deg,#0b1d4a,#7b2cbf)', 'linear-gradient(135deg,#3b6b5e,#d8c3a5)']

/** «Atmosfera»: gli stili del genere come tessere con icona, una sola scelta */
export function AtmosferaGenere(): JSX.Element | null {
  const { crea, setCrea } = usaStato()
  const p = presetDa(crea.preset)
  if (!p || p.stili.length < 2) return null
  const valori = campiCon(p, crea.campi)
  return (
    <Tessere colonne={4}>
      {p.stili.map((s, i) => (
        <Tessera key={s.id} id={`atmosfera-${s.id}`} icona={<span aria-hidden>{emojiAtmosfera(s.nome, i)}</span>} nome={s.nome} fondo={SFONDI[i % SFONDI.length]} titolo={`${s.nome}: ${s.testo}`} su={crea.stile === s.id} onClick={() => setCrea({ stile: s.id, prompt: componiPreset(p, valori, s.id) })} />
      ))}
    </Tessere>
  )
}

/** i campi del genere scelto (1–3 righe in italiano, con esempi in grigio) */
export function CampiGenere(): JSX.Element | null {
  const { crea, setCrea } = usaStato()
  const p = presetDa(crea.preset)
  if (!p) return null
  const valori = campiCon(p, crea.campi)
  const cambiaCampo = (id: string, valore: string): void => {
    const campi = { ...valori, [id]: valore }
    setCrea({ campi, prompt: componiPreset(p, campi, crea.stile) })
  }
  return (
    <div className="scheda-preset" style={{ padding: '2px 0 0' }}>
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

export { PRESET }
