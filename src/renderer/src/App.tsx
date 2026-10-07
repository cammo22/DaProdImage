// La cornice dell'app: barra del titolo, rotaia a sinistra, pagine, coda, avvisi.
import { useEffect, useState, type JSX } from 'react'
import { usaStato, collegaEventi, ricaricaLore, type Pagina } from './stato'
import { api } from './api'
import { I } from './componenti/Icone'
import { Coda } from './componenti/Coda'
import { Crea } from './pagine/Crea'
import { Modifica } from './pagine/Modifica'
import { Galleria } from './pagine/Galleria'
import { Lora } from './pagine/Lora'
import { Impostazioni } from './pagine/Impostazioni'
import { Setup } from './pagine/Setup'
import { normalizza } from './util'
import { apriInModifica } from './azioni'

const VOCI: { id: Pagina; nome: string; icona: () => JSX.Element }[] = [
  { id: 'crea', nome: 'Crea', icona: I.crea },
  { id: 'modifica', nome: 'Modifica', icona: I.modifica },
  { id: 'galleria', nome: 'Galleria', icona: I.galleria },
  { id: 'lora', nome: 'LoRA', icona: I.lora }
]

export function App(): JSX.Element {
  const { pagina, vai, motore, lavori, codaAperta, avvisi, avvisa, agg, imp } = usaStato()
  const [pronto, setPronto] = useState(false)
  const [installato, setInstallato] = useState(true)
  // il motore era installato ma la sua versione è cambiata (aggiornamento dell'app): si aggiorna da solo
  const [aggiornaMotore, setAggiornaMotore] = useState(false)
  const [rilascio, setRilascio] = useState(false)

  useEffect(() => {
    void (async () => {
      await collegaEventi()
      const s = await api.setup.stato()
      setInstallato(s.installato)
      setAggiornaMotore(!s.installato && !!usaStato.getState().imp?.installato)
      setPronto(true)
    })()
  }, [])

  // file trascinati sulla finestra (dove una pagina non li prende già): foto → Modifica, .safetensors → LoRA
  useEffect(() => {
    let conta = 0
    const entra = (e: DragEvent): void => {
      if (!e.dataTransfer?.types.includes('Files')) return
      conta++
      setRilascio(true)
    }
    const esce = (): void => {
      conta = Math.max(0, conta - 1)
      if (!conta) setRilascio(false)
    }
    const sopra = (e: DragEvent): void => e.preventDefault()
    const giu = async (e: DragEvent): Promise<void> => {
      e.preventDefault()
      conta = 0
      setRilascio(false)
      const files = Array.from(e.dataTransfer?.files || [])
      if (!files.length) return
      const percorsi = files.map((f) => api.file.percorso(f))
      const lore = percorsi.filter((p) => /\.safetensors$/i.test(p))
      if (lore.length) {
        await api.lora.importa(lore)
        await ricaricaLore()
        avvisa(`${lore.length} LoRA aggiunti`, 'ok')
        return
      }
      const foto = percorsi.find((p) => /\.(png|jpe?g|webp|bmp|gif|avif)$/i.test(p))
      if (foto) {
        try {
          apriInModifica(await normalizza(foto))
        } catch (er) {
          avvisa((er as Error).message, 'errore')
        }
      }
    }
    const h = (e: DragEvent): void => void giu(e)
    window.addEventListener('dragenter', entra)
    window.addEventListener('dragleave', esce)
    window.addEventListener('dragover', sopra)
    window.addEventListener('drop', h)
    return () => {
      window.removeEventListener('dragenter', entra)
      window.removeEventListener('dragleave', esce)
      window.removeEventListener('dragover', sopra)
      window.removeEventListener('drop', h)
    }
  }, [])

  const attivi = lavori.filter((l) => l.stato === 'in coda' || l.stato === 'in corso').length
  const vram = motore.vramTotale && motore.vramLibera !== undefined ? 1 - motore.vramLibera / motore.vramTotale : 0
  const statoMotore = motore.stato === 'pronto' ? 'pronto' : motore.stato === 'avvio' ? 'avvio' : motore.stato === 'errore' ? 'errore' : ''
  const testoMotore = { pronto: 'Motore pronto', avvio: 'Avvio del motore…', errore: 'Motore fermo', spento: 'Motore spento', 'non installato': 'Da installare' }[motore.stato]

  return (
    <div className="app">
      <div className="barra-titolo">
        <div className="logo">
          <img src="./icona.svg" alt="" />
          DAPROD <b>IMAGE</b>
        </div>
        <span className="spazio" />
        {agg.stato === 'scarico' && (
          <span className="pillola" title={`Scarico DaProd Image ${agg.versione}`} onClick={() => vai('impostazioni')}>
            <I.scarica /> Aggiornamento {agg.versione} · {agg.percentuale ?? 0}%
          </span>
        )}
        {agg.stato === 'pronto' && (
          <button className="btn piccolo primario" onClick={() => api.aggiornamento.installa()} title={agg.note || ''}>
            <I.ricicla /> Riavvia e aggiorna a {agg.versione}
          </button>
        )}
        {installato && (
          <>
            <span className={`pillola ${statoMotore}`} onClick={() => vai('impostazioni')} title={motore.messaggio || ''}>
              <span className="punto" /> {testoMotore}
              {motore.vramTotale ? (
                <span className="vram" title={`VRAM usata ${Math.round(vram * 100)}%`}>
                  <i style={{ width: `${vram * 100}%` }} />
                </span>
              ) : null}
            </span>
            {motore.stato === 'errore' && <button className="btn piccolo" onClick={() => api.motore.riavvia().catch((e: Error) => avvisa(e.message, 'errore'))}>Riavvia</button>}
          </>
        )}
      </div>

      {!pronto ? (
        <div style={{ gridColumn: '1 / -1' }} />
      ) : !installato ? (
        <div className="contenuto" style={{ gridColumn: '1 / -1' }}>
          <Setup aggiorna={aggiornaMotore && !!imp?.installato} fatto={() => { setInstallato(true); setAggiornaMotore(false); void ricaricaLore() }} />
        </div>
      ) : (
        <>
          <nav className="rotaia">
            {VOCI.map((v) => (
              <button key={v.id} className={pagina === v.id ? 'attiva' : ''} onClick={() => vai(v.id)}>
                <v.icona />
                {v.nome}
              </button>
            ))}
            <span className="riempi" />
            <button className={codaAperta ? 'attiva' : ''} onClick={() => usaStato.setState({ codaAperta: !codaAperta })}>
              <I.coda />
              Coda
              {attivi > 0 && <span className="badge">{attivi}</span>}
            </button>
            <button className={pagina === 'impostazioni' ? 'attiva' : ''} onClick={() => vai('impostazioni')}>
              <I.impostazioni />
              Opzioni
            </button>
          </nav>
          <main className="contenuto">
            {/* le pagine restano montate: la maschera disegnata o il prompt non si perdono cambiando pagina */}
            <div className={pagina === 'crea' ? '' : 'nascosto'}><Crea /></div>
            <div className={pagina === 'modifica' ? '' : 'nascosto'}><Modifica /></div>
            <div className={pagina === 'galleria' ? '' : 'nascosto'}>{pagina === 'galleria' && <Galleria />}</div>
            <div className={pagina === 'lora' ? '' : 'nascosto'}>{pagina === 'lora' && <Lora />}</div>
            <div className={pagina === 'impostazioni' ? '' : 'nascosto'}>{pagina === 'impostazioni' && <Impostazioni />}</div>
            <Coda />
          </main>
        </>
      )}

      <div className="avvisi">
        {avvisi.map((a) => (
          <div key={a.id} className={`avviso ${a.tipo}`}>{a.testo}</div>
        ))}
      </div>
      {rilascio && (
        <div className="velo-rilascio">
          <div>Rilascia: le foto si aprono in Modifica, i .safetensors vanno fra i LoRA</div>
        </div>
      )}
    </div>
  )
}
