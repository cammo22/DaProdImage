// Il selettore del modello che disegna, nella barra in alto dell'app (si sceglie solo da lì, da qualsiasi pagina): Qwen, Qwen veloce, Klein e Klein Base da ORDINE_MODELLI.
// Salva `modelloScelto` (la famiglia si allinea da sola nel main). Se i file che servono (Klein, o il LoRA Lightning di Qwen veloce) non ci sono,
// la pillola ha un puntino e un clic apre il pannellino che dice quanto pesano e li scarica.
import { useEffect, useRef, useState, type JSX } from 'react'
import type { Download } from '@shared/tipi'
import { MODELLI, ORDINE_MODELLI, modelloDaImpostazioni, type IdModello } from '@shared/modelli'
import { api } from '../api'
import { ricaricaImp, usaStato } from '../stato'
import { I } from './Icone'

/** le voci del catalogo da avere per usare un modello (il modello INT8 sta nelle schede da 8 GB) */
const SERVONO: Record<Exclude<IdModello, 'qwen-base'>, string[]> = { 'qwen-veloce': ['lora-lightning'], klein: ['klein-int8', 'klein-te', 'klein-vae'], 'klein-base': ['klein-base-int8', 'klein-te', 'klein-vae'] }
const PESO: Record<Exclude<IdModello, 'qwen-base'>, string> = { 'qwen-veloce': 'circa 67 MB', klein: 'circa 10 GB', 'klein-base': 'circa 10 GB (4,7 se hai già Klein)' }
const ETICHETTA: Record<IdModello, string> = { 'qwen-base': 'Qwen', 'qwen-veloce': 'Qwen veloce', klein: 'Klein 3', 'klein-base': 'Klein 3 Base' }
const COSA_SERVE: Record<Exclude<IdModello, 'qwen-base'>, string> = {
  'qwen-veloce': 'Serve il LoRA Lightning',
  klein: 'Servono il modello (INT8, adatto a 8 GB), il text encoder e il VAE',
  'klein-base': 'Servono il modello (INT8, adatto a 8 GB), il text encoder e il VAE'
}

export function SelettoreModello(): JSX.Element {
  const imp = usaStato((s) => s.imp)
  const avvisa = usaStato((s) => s.avvisa)
  const inCorso = usaStato((s) => s.lavori.some((l) => l.stato === 'in coda' || l.stato === 'in corso'))
  const scelto = modelloDaImpostazioni(imp)
  const [pronti, setPronti] = useState<Record<IdModello, boolean>>({ 'qwen-base': true, 'qwen-veloce': true, klein: false, 'klein-base': false })
  const [aperto, setAperto] = useState<IdModello | null>(null)
  const [scarico, setScarico] = useState<{ id: IdModello; passo: string; perc: number } | null>(null)
  const radice = useRef<HTMLDivElement>(null)

  /** i file di Klein e il LoRA Lightning ci sono? (si guardano le cartelle: vale anche per chi li ha messi a mano) */
  const ricarica = async (): Promise<void> => {
    const f = await api.modelli.file()
    const comuni = (f.kleinTe?.length ?? 0) > 0 && (f.kleinVae?.length ?? 0) > 0
    setPronti({
      'qwen-base': true,
      'qwen-veloce': !!f.lightning,
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
  // un clic fuori chiude il pannellino
  useEffect(() => {
    if (!aperto) return
    const fuori = (e: MouseEvent): void => {
      if (radice.current && !radice.current.contains(e.target as Node)) setAperto(null)
    }
    window.addEventListener('mousedown', fuori)
    return () => window.removeEventListener('mousedown', fuori)
  }, [aperto])

  const salva = async (id: IdModello): Promise<void> => {
    await api.impostazioni.salva({ modelloScelto: id })
    await ricaricaImp()
  }

  const scegli = async (id: IdModello): Promise<void> => {
    if (id !== 'qwen-base' && !pronti[id]) {
      setAperto(aperto === id ? null : id)
      return
    }
    setAperto(null)
    if (id === scelto) return
    await salva(id)
    if (inCorso) avvisa(`${MODELLI[id].nome}: vale dal prossimo lavoro`, 'ok')
  }

  const scarica = async (id: Exclude<IdModello, 'qwen-base'>): Promise<void> => {
    try {
      const stato = await api.modelli.stato()
      const nomi: Record<string, string> = { 'lora-lightning': 'il LoRA Lightning', 'klein-int8': 'il modello Klein', 'klein-base-int8': 'il modello Klein Base', 'klein-te': 'il text encoder', 'klein-vae': 'il VAE' }
      for (const voce of SERVONO[id]) {
        if (stato.find((v) => v.id === voce)?.presente) continue
        setScarico({ id, passo: nomi[voce], perc: 0 })
        const d = await api.modelli.scarica(voce)
        if (d.stato !== 'fatto') throw new Error(d.errore || 'Download non riuscito')
      }
      await ricarica()
      await salva(id)
      setAperto(null)
      avvisa(`${MODELLI[id].nome} pronto: ora disegna con lui`, 'ok')
    } catch (e) {
      avvisa((e as Error).message, 'errore')
    } finally {
      setScarico(null)
    }
  }

  return (
    <div className="sel-modello" ref={radice} data-selettore-modello>
      <div className="sel-modello-pillole" role="radiogroup" aria-label="Modello che disegna">
        {ORDINE_MODELLI.map((id) => {
          const m = MODELLI[id]
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={id === scelto}
              data-modello={id}
              className={`${id === scelto ? 'su' : ''} ${!pronti[id] ? 'da-scaricare' : ''}`}
              onClick={() => void scegli(id)}
              title={`${m.nome}: ${m.sotto}${!pronti[id] ? ' (da scaricare)' : ''}${inCorso ? ' · vale dal prossimo lavoro' : ''}`}
            >
              {ETICHETTA[id]} <small>· {m.passi} passi</small>
              {!pronti[id] && <i className="puntino" />}
            </button>
          )
        })}
      </div>
      {aperto && aperto !== 'qwen-base' && !pronti[aperto] && (
        <div className="sel-modello-pop">
          <b>{MODELLI[aperto].nome}</b>
          <div className="piccolo tenue">{MODELLI[aperto].sotto}. {COSA_SERVE[aperto]}: {PESO[aperto]}, una volta sola.</div>
          {scarico?.id === aperto ? (
            <div className="piccolo oro" style={{ marginTop: 6 }}>Scarico {scarico.passo}… {scarico.perc}%</div>
          ) : (
            <button className="btn piccolo primario" style={{ marginTop: 8 }} onClick={() => void scarica(aperto)}><I.scarica /> Scarica {MODELLI[aperto].nome}</button>
          )}
        </div>
      )}
    </div>
  )
}
