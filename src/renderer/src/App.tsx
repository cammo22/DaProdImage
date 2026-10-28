// La cornice dell'app: barra del titolo, rotaia a sinistra, pagine, coda, avvisi.
import { useEffect, useRef, useState, type JSX } from 'react'
import { usaStato, collegaEventi, ricaricaLore, type Pagina } from './stato'
import { api } from './api'
import { I } from './componenti/Icone'
import { Coda } from './componenti/Coda'
import { Crea } from './pagine/Crea'
import { Modifica } from './pagine/Modifica'
import { Box } from './pagine/Box'
import { Lora } from './pagine/Lora'
import { SelettoreModello } from './componenti/ScegliModello'
import { StripModi, PAGINE_STUDIO, vaiModo, type ModoStudio } from './pagine/Studio'
import { Album } from './pagine/Album'
import { BarraStato } from './componenti/BarraStato'
import { SelettoreFoto } from './componenti/SelettoreFoto'
import { Galleria } from './pagine/Galleria'
import { Impostazioni } from './pagine/Impostazioni'
import { Setup } from './pagine/Setup'
import { normalizza } from './util'
import { apriInModifica } from './azioni'

/** la rotaia: Studio (con i suoi modi in cima), Galleria, Album, LoRA */
const VOCI: { id: Pagina | 'studio'; nome: string; icona: () => JSX.Element }[] = [
  { id: 'studio', nome: 'Studio', icona: I.studio },
  { id: 'galleria', nome: 'Galleria', icona: I.galleria },
  { id: 'album', nome: 'Album', icona: I.album },
  { id: 'lora', nome: 'LoRA', icona: I.pila }
]
/** l'ultimo modo dello Studio, per tornarci dalla rotaia */
let ultimoModo: ModoStudio = 'crea'

const gb = (b: number): string => (b / 1073741824).toFixed(b >= 10 * 1073741824 ? 0 : 1)

/** un indicatore piccolo: nome, barra, numeri (rosso quando è quasi pieno) */
function Metro(p: { nome: string; parte: number; testo: string; titolo: string }): JSX.Element {
  const f = Math.max(0, Math.min(1, p.parte))
  return (
    <span className={`metro ${f > 0.9 ? 'pieno' : f > 0.75 ? 'alto' : ''}`} title={p.titolo}>
      <b>{p.nome}</b>
      <span className="barra"><i style={{ width: `${f * 100}%` }} /></span>
      <span className="num">{p.testo}</span>
    </span>
  )
}

/** RAM, VRAM e GPU in tempo reale nella barra in alto */
function Indicatori(): JSX.Element | null {
  const r = usaStato((s) => s.risorse)
  if (!r) return null
  const ramUsata = r.ramTotale - r.ramLibera
  return (
    <span className="indicatori">
      <Metro nome="RAM" parte={ramUsata / r.ramTotale} testo={`${gb(ramUsata)}/${gb(r.ramTotale)} GB`} titolo={`RAM usata ${gb(ramUsata)} GB, libera ${gb(r.ramLibera)} GB`} />
      {r.vramTotale ? (
        <Metro nome="VRAM" parte={(r.vramUsata || 0) / r.vramTotale} testo={`${gb(r.vramUsata || 0)}/${gb(r.vramTotale)} GB`} titolo={`VRAM usata ${gb(r.vramUsata || 0)} GB, libera ${gb(r.vramTotale - (r.vramUsata || 0))} GB${r.gpu ? ` · ${r.gpu}` : ''}`} />
      ) : null}
      {r.gpuUso !== undefined && (
        <Metro nome="GPU" parte={r.gpuUso / 100} testo={`${r.gpuUso}%${r.gpuTemp !== undefined ? ` · ${r.gpuTemp}°` : ''}`} titolo={`${r.gpu || 'Scheda video'}: in uso al ${r.gpuUso}%${r.gpuTemp !== undefined ? `, ${r.gpuTemp} °C` : ''}`} />
      )}
    </span>
  )
}

export function App(): JSX.Element {
  const { pagina, vai, motore, lavori, codaAperta, avvisi, avvisa, agg, imp } = usaStato()
  const [pronto, setPronto] = useState(false)
  const [installato, setInstallato] = useState(true)
  // il motore era installato ma la sua versione è cambiata (aggiornamento dell'app): si aggiorna da solo
  const [aggiornaMotore, setAggiornaMotore] = useState(false)
  const [rilascio, setRilascio] = useState(false)
  // VRAM che resta alta a coda ferma: avviso con pulsante Libera (T16)
  const [vramNonLiberata, setVramNonLiberata] = useState(false)
  const vramAltoDa = useRef<number | null>(null)
  const risorse = usaStato((s) => s.risorse)
  const scarico = usaStato((s) => s.scarico)

  useEffect(() => {
    void (async () => {
      try {
        await collegaEventi()
        const s = await api.setup.stato()
        setInstallato(s.installato)
        setAggiornaMotore(!s.installato && !!usaStato.getState().imp?.installato)
      } catch (e) {
        usaStato.getState().avvisa(`Non riesco a leggere lo stato dell'app: ${e instanceof Error ? e.message : e}`, 'errore')
      } finally {
        setPronto(true)
      }
    })()
  }, [])

  // file trascinati sulla finestra (dove una pagina non li prende già): foto → Modifica, .safetensors → LoRA.
  // Il velo "Rilascia" si toglie sempre: al rilascio (anche se lo prende una pagina, per questo in cattura),
  // quando il file esce dalla finestra, o se per un attimo non arriva più nessun dragover.
  useEffect(() => {
    let timer = 0
    const via = (): void => {
      window.clearTimeout(timer)
      setRilascio(false)
    }
    const sopra = (e: DragEvent): void => {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      setRilascio(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(via, 350)
    }
    const esce = (e: DragEvent): void => {
      if (!e.relatedTarget) via()
    }
    const giu = async (e: DragEvent): Promise<void> => {
      e.preventDefault()
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
      const foto = percorsi.find((p) => !/\.(safetensors|ckpt|pt|gguf|json|txt|zip)$/i.test(p))
      if (foto) {
        try {
          apriInModifica(await normalizza(foto), true)
        } catch (er) {
          avvisa((er as Error).message, 'errore')
        }
      }
    }
    const h = (e: DragEvent): void => void giu(e)
    window.addEventListener('dragover', sopra)
    window.addEventListener('dragleave', esce)
    window.addEventListener('drop', via, true)
    window.addEventListener('dragend', via, true)
    window.addEventListener('drop', h)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('dragover', sopra)
      window.removeEventListener('dragleave', esce)
      window.removeEventListener('drop', via, true)
      window.removeEventListener('dragend', via, true)
      window.removeEventListener('drop', h)
    }
  }, [])

  // l'ultimo modo dello Studio (per tornarci dalla rotaia) e le scorciatoie 1–7 e «,» (non quando si scrive)
  useEffect(() => {
    const t = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      const mappa: Record<string, () => void> = {
        '1': () => vaiModo('crea'), '2': () => vaiModo('modifica'), '3': () => vaiModo('box'), '4': () => vaiModo('ricette'),
        '5': () => usaStato.getState().vai('galleria'), '6': () => usaStato.getState().vai('album'), '7': () => usaStato.getState().vai('lora'), ',': () => usaStato.getState().vai('impostazioni')
      }
      const f = mappa[e.key]
      if (f && !usaStato.getState().visore) {
        e.preventDefault()
        f()
      }
    }
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  }, [])
  const modoCorrente = usaStato((s) => (s.pagina === 'modifica' ? (s.modifica.modo === 'ricette' ? 'ricette' : 'modifica') : s.pagina === 'box' ? 'box' : s.pagina === 'crea' ? 'crea' : null))
  if (modoCorrente) ultimoModo = modoCorrente

  // Monitoraggio VRAM: se resta sopra il 95% per più di 10 s a coda ferma, avvisa.
  useEffect(() => {
    const attiviNow = lavori.some((l) => l.stato === 'in coda' || l.stato === 'in corso')
    const piena = !!risorse && (risorse.vramTotale || 0) > 0 && ((risorse.vramUsata || 0) / (risorse.vramTotale || 1)) > 0.95
    const idle = !attiviNow && !scarico
    const motorePronto = motore.stato === 'pronto'
    if (piena && idle && motorePronto) {
      if (vramAltoDa.current === null) vramAltoDa.current = Date.now()
      if (Date.now() - (vramAltoDa.current || 0) >= 10000) setVramNonLiberata(true)
    } else {
      vramAltoDa.current = null
      setVramNonLiberata(false)
    }
  }, [risorse, lavori, motore, scarico])

  // Klein: una pagina sola. Se si cambia modello mentre si è in Modifica o Box, si torna a Crea
  const conKlein = !!imp && imp.famiglia !== 'qwen'
  useEffect(() => {
    if (conKlein && (pagina === 'modifica' || pagina === 'box')) vai('crea')
  }, [conKlein, pagina, vai])

  const attivi = lavori.filter((l) => l.stato === 'in coda' || l.stato === 'in corso').length
  const statoMotore = motore.stato === 'pronto' ? 'pronto' : motore.stato === 'avvio' ? 'avvio' : motore.stato === 'errore' ? 'errore' : ''
  const testoMotore = { pronto: 'Motore pronto', avvio: 'Avvio del motore…', errore: 'Motore fermo', spento: 'Motore spento', 'non installato': 'Da installare' }[motore.stato]

  return (
    <div className={`app ${pronto && installato ? 'con-barra' : ''}`}>
      <div className="barra-titolo">
        <div className="logo">
          <img src="./icona.svg" alt="" />
          DAPROD <b>IMAGE</b>
        </div>
        {/* il modello che disegna si sceglie qui, in alto, da qualsiasi pagina */}
        {pronto && installato && <SelettoreModello />}
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
        <Indicatori />
        {installato && (
          <>
            <span className={`pillola ${statoMotore}`} onClick={() => vai('impostazioni')} title={motore.messaggio || ''}>
              <span className="punto" /> {testoMotore}
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
            {VOCI.map((v) => {
              const attiva = v.id === 'studio' ? PAGINE_STUDIO.includes(pagina) : pagina === v.id
              return (
                <button key={v.id} className={attiva ? 'attiva' : ''} onClick={() => (v.id === 'studio' ? (PAGINE_STUDIO.includes(pagina) ? undefined : vaiModo(ultimoModo)) : vai(v.id))} data-voce={v.id}>
                  <v.icona />
                  {v.nome}
                </button>
              )
            })}
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
            <div className={PAGINE_STUDIO.includes(pagina) ? 'studio' : 'nascosto'}>
              {/* con Klein c'è una pagina sola (Crea: scrivi, aggiungi foto se vuoi): niente modi, niente schede */}
              {!conKlein && <StripModi />}
              <div className="studio-corpo">
                <div className={pagina === 'crea' ? '' : 'nascosto'}><Crea /></div>
                <div className={pagina === 'modifica' ? '' : 'nascosto'}><Modifica /></div>
                <div className={pagina === 'box' ? '' : 'nascosto'}><Box /></div>
              </div>
            </div>
            <div className={pagina === 'album' ? '' : 'nascosto'}>{pagina === 'album' && <Album />}</div>
            <div className={pagina === 'galleria' ? '' : 'nascosto'}>{pagina === 'galleria' && <Galleria />}</div>
            <div className={pagina === 'lora' ? '' : 'nascosto'}>{pagina === 'lora' && <Lora />}</div>
            <div className={pagina === 'impostazioni' ? '' : 'nascosto'}>{pagina === 'impostazioni' && <Impostazioni />}</div>
            <Coda />
          </main>
        </>
      )}

      {pronto && installato && <BarraStato />}
      <SelettoreFoto />
      <div className="avvisi">
        {vramNonLiberata && (
          <div className="avviso" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>La memoria della scheda non si è liberata, premi Libera</span>
            <button className="btn piccolo" onClick={() => { setVramNonLiberata(false); vramAltoDa.current = null; void api.motore.libera().catch((e: Error) => avvisa(e.message, 'errore')) }}>Libera</button>
          </div>
        )}
        {avvisi.map((a) => (
          <div key={a.id} className={`avviso ${a.tipo}`}>{a.testo}</div>
        ))}
      </div>
      {rilascio && (
        <div className="velo-rilascio">
          <div>{pagina === 'galleria' ? 'Rilascia: le foto entrano in Galleria (diventano PNG)' : pagina === 'lora' ? 'Rilascia: i .safetensors vanno fra i LoRA' : imp?.famiglia && imp.famiglia !== 'qwen' ? 'Rilascia: la foto si aggiunge alle Foto di Klein (diventa PNG)' : 'Rilascia: la foto si apre in Modifica (diventa PNG)'}</div>
        </div>
      )}
    </div>
  )
}
