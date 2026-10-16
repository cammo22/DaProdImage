// Il selettore del modello che disegna: Qwen-Image 2.1, FLUX 3 Klein (veloce, 16 passi) o FLUX 3 Klein Base (50 passi con CFG).
// Se i file di Klein non ci sono, la scheda dice quanto pesano e li scarica con un clic.
import { useEffect, useState, type JSX } from 'react'
import { FAMIGLIE, type Download, type Famiglia } from '@shared/tipi'
import { api } from '../api'
import { ricaricaImp, usaStato } from '../stato'
import { I } from './Icone'
import { Interruttore } from './Controlli'

const ORDINE: Famiglia[] = ['qwen', 'klein', 'klein-base']
/** le voci del catalogo da avere per usare un modello (il modello INT8 sta nelle schede da 8 GB) */
const SERVONO: Record<Exclude<Famiglia, 'qwen'>, string[]> = { klein: ['klein-int8', 'klein-te', 'klein-vae'], 'klein-base': ['klein-base-int8', 'klein-te', 'klein-vae'] }
const PESO: Record<Exclude<Famiglia, 'qwen'>, string> = { klein: 'circa 10 GB', 'klein-base': 'circa 10 GB (4,7 se hai già Klein)' }
const ICONA: Record<Famiglia, () => JSX.Element> = { qwen: I.stella, klein: I.fulmine, 'klein-base': I.ritratto }

export function ScegliModello(): JSX.Element {
  const famiglia = usaStato((s) => s.imp?.famiglia || 'qwen')
  const avvisa = usaStato((s) => s.avvisa)
  const potenzia = usaStato((s) => s.imp?.potenziaKlein ?? true)
  const [pronti, setPronti] = useState<Record<Famiglia, boolean>>({ qwen: true, klein: false, 'klein-base': false })
  const [aperto, setAperto] = useState<Famiglia | null>(null)
  const [scarico, setScarico] = useState<{ f: Famiglia; passo: string; perc: number } | null>(null)

  /** i file di Klein ci sono? (si guardano le cartelle: vale anche per chi li ha messi a mano) */
  const ricarica = async (): Promise<void> => {
    const f = await api.modelli.file()
    const comuni = (f.kleinTe?.length ?? 0) > 0 && (f.kleinVae?.length ?? 0) > 0
    setPronti({
      qwen: true,
      klein: comuni && !!f.klein?.some((n) => !/base/i.test(n)),
      'klein-base': comuni && !!f.klein?.some((n) => /base/i.test(n))
    })
  }
  useEffect(() => {
    void ricarica()
    return api.su.download((d: Download) => {
      setScarico((s) => (s && d.totali ? { ...s, perc: Math.round((d.ricevuti / d.totali) * 100) } : s))
    })
  }, [])

  const scegli = async (f: Famiglia): Promise<void> => {
    if (f !== 'qwen' && !pronti[f]) {
      setAperto(aperto === f ? null : f)
      return
    }
    setAperto(null)
    await api.impostazioni.salva({ famiglia: f })
    await ricaricaImp()
  }

  const scarica = async (f: Exclude<Famiglia, 'qwen'>): Promise<void> => {
    try {
      const stato = await api.modelli.stato()
      const nomi: Record<string, string> = { 'klein-int8': 'il modello Klein', 'klein-base-int8': 'il modello Klein Base', 'klein-te': 'il text encoder', 'klein-vae': 'il VAE' }
      for (const id of SERVONO[f]) {
        if (stato.find((v) => v.id === id)?.presente) continue
        setScarico({ f, passo: nomi[id], perc: 0 })
        const d = await api.modelli.scarica(id)
        if (d.stato !== 'fatto') throw new Error(d.errore || 'Download non riuscito')
      }
      await ricarica()
      await api.impostazioni.salva({ famiglia: f })
      await ricaricaImp()
      setAperto(null)
      avvisa(`${FAMIGLIE[f].nome} pronto: ora disegna con lui`, 'ok')
    } catch (e) {
      avvisa((e as Error).message, 'errore')
    } finally {
      setScarico(null)
    }
  }

  return (
    <div className="sel-modello">
      <div className="piccolo tenue" style={{ marginBottom: 6 }}>Modello che disegna</div>
      <div className="sel-modello-card">
        {ORDINE.map((f) => {
          const Ic = ICONA[f]
          const m = FAMIGLIE[f]
          const su = f === famiglia
          return (
            <button key={f} className={`${su ? 'su' : ''} ${!pronti[f] ? 'da-scaricare' : ''}`} onClick={() => void scegli(f)} title={m.sotto}>
              <span className="ic"><Ic /></span>
              <b>{f === 'qwen' ? 'Qwen-Image 2.1' : f === 'klein' ? 'Klein' : 'Klein Base'}</b>
              <small>{f === 'qwen' ? '40 passi · LoRA' : f === 'klein' ? 'veloce · 16 passi' : 'normale · 50 passi'}</small>
              {!pronti[f] && <em>da scaricare</em>}
            </button>
          )
        })}
      </div>
      {aperto && aperto !== 'qwen' && !pronti[aperto] && (
        <div className="turbo-box" style={{ marginTop: 8 }}>
          <b>{FAMIGLIE[aperto].nome}</b>
          <div className="piccolo tenue">{FAMIGLIE[aperto].sotto}. Servono il modello (INT8, adatto a 8 GB), il text encoder e il VAE: {PESO[aperto]}, una volta sola.</div>
          {scarico?.f === aperto ? (
            <div className="piccolo oro" style={{ marginTop: 6 }}>Scarico {scarico.passo}… {scarico.perc}%</div>
          ) : (
            <button className="btn piccolo primario" style={{ marginTop: 8 }} onClick={() => void scarica(aperto)}><I.scarica /> Scarica {FAMIGLIE[aperto].nome}</button>
          )}
        </div>
      )}
      {famiglia !== 'qwen' && (
        <div style={{ marginTop: 8 }}>
          <Interruttore acceso={potenzia} cambia={(potenziaKlein) => void api.impostazioni.salva({ potenziaKlein }).then(ricaricaImp)} sotto="Black Forest Labs lo consiglia: Klein dà il meglio con didascalie lunghe. Lo scrive il Qwen3-VL (circa mezzo minuto in più per immagine)">
            Espandi il prompt prima di disegnare
          </Interruttore>
          <div className="piccolo spento" style={{ marginTop: 6 }}>I LoRA e il Turbo sono di Qwen: con Klein non servono. Migliora prompt, Idee e Estrai usano sempre il Qwen3-VL. Lo sfondo trasparente è solo di Qwen.</div>
        </div>
      )}
    </div>
  )
}
