// Modifica: scrivi cosa cambiare (tutta la foto, o solo la zona se l'hai segnata col pennello) o allarga la foto oltre i bordi.
// Le azioni rapide (persone, vestiti, situazioni, camera, luce, stili, testi) mettono l'istruzione giusta;
// dopo ogni modifica la nuova versione resta sulla tela, col confronto prima/dopo e il tasto "Continua da qui".
import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { usaStato, attesiModifica, scegliFoto, type FotoBase } from '../stato'
import { api, urlFile } from '../api'
import { conParoleLora } from '../componenti/SceltaLora'
import { type AnteprimaTela, type ComandiTela, type Strumento } from '../componenti/TelaMaschera'
import { MISURA0, conMisura, dimMp } from '../componenti/Misura'
import { MAX_FUSION } from '../componenti/Fusion'
import { ControlliEstrai } from '../componenti/Estrai'
import { pianificaIdee, unisciRapide } from '../regista'
import { TelaModifica } from './modifica/Tela'
import { SchedeModifica } from './modifica/Schede'
import { NIENTE, bordiPreset, type PresetEspandi } from './modifica/SchedaEspandi'
import { FORMATI_FUSION, chiaveEsempio, pianificaEsempio, richiestaEsempio, richiestaFusion } from '../fusion'
import { ascoltatoriLavoro } from '../stato'
import { specialeOra, usaSpeciale } from '../workflow'
import { SchedaRicette } from './modifica/SchedaRicette'
import { CAMERA0, componiCamera, conLora, type PosizioneCamera } from '../componenti/Camera'
import { daDataUrl, immagineDaIncolla, normalizza, stimaSecondi } from '../util'
import { SISTEMA_MIGLIORA_MODIFICA, fileLoraCamera, loraPer, perQualita, richiestaBase } from '../azioni'
import { categoriePer, type Rapida } from '../rapide'
import type { Bordi, Lavoro, Opera } from '@shared/tipi'

const attesiFusion = new Set<string>()

export function Modifica(): JSX.Element {
  const { modifica: m, setModifica, imp, lavori, avvisa } = usaStato()
  const lore = usaStato((s) => s.lore)
  const tela = useRef<ComandiTela>(null)
  const prompt = useRef<HTMLTextAreaElement>(null)
  const [strumento, setStrumento] = useState<Strumento>('pennello')
  const [pennello, setPennello] = useState(60)
  const [haMaschera, setHaMaschera] = useState(false)
  const [confronto, setConfronto] = useState(false)
  // le idee scelte (azioni rapide, si sommano) e la posizione della camera: insieme portano forza, trasparenza, riferimenti e i LoRA da accendere
  const [idee, setIdee] = useState<Rapida[]>([])
  const [cameraRapida, setCameraRapida] = useState<Rapida | null>(null)
  const rapida = useMemo(() => unisciRapide([...idee, ...(cameraRapida ? [cameraRapida] : [])]), [idee, cameraRapida])
  const setRapida = (_: null): void => {
    setIdee([])
    setCameraRapida(null)
  }
  // nessuna categoria di Idee aperta all'inizio: si apre con un clic e si richiude con un altro
  const [categoria, setCategoria] = useState('')
  const [camera, setCamera] = useState<PosizioneCamera>(CAMERA0)
  const [scrivendo, setScrivendo] = useState(false)
  // Fusion: i risultati (foto nuove) e il lavoro che li sta creando
  const [ris, setRis] = useState<Opera[]>([])
  // Unisci foto e Come l'esempio sono ricette, ma usano la tela di Modifica (la griglia di foto) e la colonna di destra come prima
  const speciale = usaSpeciale()
  const fusion = speciale === 'unisci'
  const esempioMode = speciale === 'esempio'
  /** nel catalogo delle ricette (e nelle ricette normali) Modifica cede il posto a SchedaRicette */
  const catalogo = m.modo === 'ricette' && !speciale
  const estraiMode = m.modo === 'estrai'
  /** le ricette con una griglia di foto al posto della tela: Unisci foto e Come l'esempio */
  const griglia = fusion || esempioMode
  /** in Scrivi: se c'è una zona disegnata vale la zona, se no tutta la foto (si decide da quello che hai sulla tela) */
  const zona = m.modo === 'scrivi' && haMaschera

  const base = m.base
  const indice = base ? m.versioni.findIndex((v) => v.percorso === base.percorso) : -1
  const precedente = indice > 0 ? m.versioni[indice - 1] : null
  const successiva = indice >= 0 && indice < m.versioni.length - 1 ? m.versioni[indice + 1] : null
  const { passi } = perQualita(m.qualita)
  const inCorso = lavori.find((l) => l.stato === 'in corso' && attesiModifica.has(l.id))
  const inAttesa = lavori.filter((l) => (l.stato === 'in coda' || l.stato === 'in corso') && attesiModifica.has(l.id)).length
  const fusInCorso: Lavoro | undefined = lavori.find((l) => l.stato === 'in corso' && attesiFusion.has(l.id))
  const fusInAttesa = lavori.filter((l) => (l.stato === 'in coda' || l.stato === 'in corso') && attesiFusion.has(l.id)).length
  const forzaRapida = rapida?.forza
  const stima = stimaSecondi(imp?.tempi, m.mp, zona && forzaRapida ? Math.max(Math.min(passi, 8), Math.round(passi * forzaRapida)) : passi) * m.quante
  /** a che risoluzione esce la foto (se si sa già) */
  const dimOut = ((): { w: number; h: number } | null => {
    const mis = m.misura ?? MISURA0
    if (mis.tipo === 'custom' && m.modo !== 'espandi') return { w: mis.w, h: mis.h }
    if (fusion) {
      const [a, b] = FORMATI_FUSION.find((f) => f.id === (m.formatoFusion || 'prima'))?.r || (m.riferimenti[0] ? [m.riferimenti[0].larghezza, m.riferimenti[0].altezza] : [1, 1])
      return dimMp(m.mp, a, b)
    }
    const rif = esempioMode ? m.esempio : base
    if (!rif || m.modo === 'espandi') return null
    return zona || mis.tipo === 'originale' ? { w: rif.larghezza, h: rif.altezza } : dimMp(m.mp, rif.larghezza, rif.altezza)
  })()
  const categorie = categoriePer(zona ? 'zona' : 'tutta')
  const cat = categorie.find((c) => c.id === categoria)
  const loraCamera = !!fileLoraCamera() && lore.length >= 0

  // l'anteprima dal vivo si posa sulla foto (se il lavoro è su questa foto): la zona si vede nascere al suo posto
  const qi = inCorso?.richiesta
  const anteprima: AnteprimaTela | undefined =
    inCorso && qi && base && qi.immagini[0] === base.percorso && inCorso.areaAnteprima
      ? {
          src: inCorso.anteprima,
          area: inCorso.areaAnteprima,
          maschera: qi.modalita === 'zona' && qi.maschera ? urlFile(qi.maschera) : undefined,
          sotto: qi.modalita === 'espandi'
        }
      : undefined

  // Fusion: quando un lavoro finisce, la foto nuova compare fra i risultati
  useEffect(() => {
    const h = (uno: Lavoro): void => {
      if (uno.stato === 'fatto' && attesiFusion.has(uno.id)) {
        attesiFusion.delete(uno.id)
        void Promise.all(uno.risultati.map((id) => api.galleria.opera(id))).then((l) => setRis((r) => [...(l.filter(Boolean) as Opera[]).reverse(), ...r]))
      } else if ((uno.stato === 'errore' || uno.stato === 'annullato') && attesiFusion.has(uno.id)) attesiFusion.delete(uno.id)
    }
    ascoltatoriLavoro.push(h)
    return () => {
      const i = ascoltatoriLavoro.indexOf(h)
      if (i >= 0) ascoltatoriLavoro.splice(i, 1)
    }
  }, [])
  // entrando in Fusion con una foto già aperta, quella è la prima
  useEffect(() => {
    const s = usaStato.getState().modifica
    if (speciale === 'unisci' && !s.riferimenti.length && s.base) setModifica({ riferimenti: [s.base] })
    if (speciale === 'esempio' && !s.esempio && s.base) setModifica({ esempio: s.base })
  }, [speciale])

  // pennello proporzionato alla foto; foto nuova = niente confronto
  useEffect(() => {
    if (base) setPennello(Math.max(8, Math.round(Math.min(base.larghezza, base.altezza) / 16)))
  }, [base?.percorso])

  // cambiando modo si torna alla tela (per disegnare la zona o vedere la cornice)
  useEffect(() => {
    setConfronto(false)
  }, [m.modo])
  // con la zona o senza cambiano le idee che hanno senso
  useEffect(() => {
    if (!categoriePer(zona ? 'zona' : 'tutta').some((c) => c.id === categoria)) setCategoria('')
  }, [zona])
  // Fusion ed Estrai non hanno la tela: la zona disegnata si perde, e con lei il segno
  useEffect(() => {
    if (griglia || estraiMode) setHaMaschera(false)
  }, [griglia, estraiMode])

  // un risultato nuovo: si apre il confronto prima/dopo (con "Continua da qui" bene in vista)
  const lunghezza = useRef(m.versioni.length)
  useEffect(() => {
    if (m.versioni.length > lunghezza.current && m.versioni.length > 1 && specialeOra() !== 'unisci') setConfronto(true)
    lunghezza.current = m.versioni.length
  }, [m.versioni.length])

  const nuovaBase = (f: FotoBase): void => {
    setModifica({ base: f, versioni: [f], riferimenti: [] })
    setConfronto(false)
    setRapida(null)
  }

  const apri = async (percorso: string): Promise<void> => {
    try {
      nuovaBase(await normalizza(percorso))
    } catch (e) {
      avvisa((e as Error).message, 'errore')
    }
  }
  /** Fusion: aggiunge foto (anche tante insieme) a quelle che ci sono */
  const aggiungiFusion = (f: FotoBase[]): void => {
    if (!f.length) return
    const cur = usaStato.getState().modifica.riferimenti
    const nuove = [...cur, ...f].slice(0, MAX_FUSION)
    if (cur.length + f.length > MAX_FUSION) avvisa(`Al massimo ${MAX_FUSION} foto`, 'errore')
    setModifica({ riferimenti: nuove })
  }
  const daPc = async (): Promise<void> => {
    if (specialeOra()) {
      const ps = await api.file.scegliImmagini(true)
      const f: FotoBase[] = []
      for (const x of ps) {
        try {
          f.push(await normalizza(x))
        } catch (e) {
          avvisa((e as Error).message, 'errore')
        }
      }
      aggiungiFusion(f)
      return
    }
    const [p] = await api.file.scegliImmagini(false)
    if (p) void apri(p)
  }
  const daGalleria = async (): Promise<void> => {
    if (specialeOra()) {
      aggiungiFusion(await scegliFoto(true))
      return
    }
    const [f] = await scegliFoto(false)
    if (f) nuovaBase(f)
  }
  /** una foto di riferimento diventa la base; la base di prima prende il suo posto fra i riferimenti */
  const comeBase = (i: number): void => {
    const s = usaStato.getState().modifica
    if (!s.base) return
    const f = s.riferimenti[i]
    if (!f) return
    const rif = s.riferimenti.map((r, j) => (j === i ? s.base! : r))
    setModifica({ base: f, versioni: [f], riferimenti: rif })
    setConfronto(false)
    setRapida(null)
    setHaMaschera(false)
    avvisa('Ora la base è la foto che hai scelto; quella di prima è un riferimento', 'ok')
  }
  /** la pagina torna com'era appena aperta, senza chiudere il programma */
  const togliFoto = (): void => {
    setModifica({ base: null, versioni: [], riferimenti: [], prompt: '', modo: 'scrivi', bordi: { ...NIENTE }, misura: MISURA0 })
    setConfronto(false)
    setRapida(null)
    setHaMaschera(false)
    setCamera(CAMERA0)
  }

  // incolla dagli appunti: senza foto = base, con la foto = riferimento
  useEffect(() => {
    const incolla = async (e: ClipboardEvent): Promise<void> => {
      if (usaStato.getState().pagina !== 'modifica') return
      // nel catalogo delle ricette incolla SchedaRicette
      if (usaStato.getState().modifica.modo === 'ricette' && !specialeOra()) return
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
      const d = immagineDaIncolla(e)
      if (!d) return
      e.preventDefault()
      const f = await daDataUrl(await d)
      const s = usaStato.getState().modifica
      if (specialeOra() === 'unisci') aggiungiFusion([f])
      else if (specialeOra() === 'esempio') {
        if (!s.esempio) setModifica({ esempio: f })
        else aggiungiFusion([f])
      }
      else if (!s.base) setModifica({ base: f, versioni: [f], riferimenti: [] })
      else if (s.riferimenti.length < 9) {
        setModifica({ riferimenti: [...s.riferimenti, f] })
        avvisa(`Aggiunta come riferimento <image${s.riferimenti.length + 2}>`, 'ok')
      }
    }
    const h = (e: ClipboardEvent): void => void incolla(e)
    window.addEventListener('paste', h)
    return () => window.removeEventListener('paste', h)
  }, [])

  // tasti: B pennello, E gomma, R rettangolo, L lazo, Ctrl+Z annulla
  useEffect(() => {
    const t = (e: KeyboardEvent): void => {
      if (usaStato.getState().pagina !== 'modifica') return
      if (usaStato.getState().modifica.modo === 'ricette' && !specialeOra()) return
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        if (e.key === 'Enter' && e.ctrlKey) {
          e.preventDefault()
          void manda()
        }
        return
      }
      if (e.key === 'Enter' && e.ctrlKey) void manda()
      else if (e.ctrlKey && e.key.toLowerCase() === 'z') tela.current?.annulla()
      else if (e.ctrlKey && e.key.toLowerCase() === 'y') tela.current?.ripeti()
      else if (m.modo === 'scrivi' && !e.ctrlKey) {
        const k = e.key.toLowerCase()
        if (k === 'b') setStrumento('pennello')
        else if (k === 'e') setStrumento('gomma')
        else if (k === 'r') setStrumento('rettangolo')
        else if (k === 'l') setStrumento('lazo')
        else if (k === 'h') setStrumento('mano')
        else if (k === '[') setPennello((x) => Math.max(2, Math.round(x * 0.85)))
        else if (k === ']') setPennello((x) => Math.round(x * 1.18))
      }
    }
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  })

  /** le azioni rapide sono idee: un clic le accende, un altro le spegne, e se ne possono sommare quante si vuole */
  const usaRapida = async (r: Rapida): Promise<void> => {
    if (idee.some((x) => x.id === r.id)) {
      setIdee(idee.filter((x) => x.id !== r.id))
      return
    }
    setIdee([...idee, r])
    // le idee con una foto di riferimento la chiedono subito (dalla galleria o dal PC)
    if (r.rif && usaStato.getState().modifica.riferimenti.length < r.rif) {
      const nuove = await scegliFoto(r.rif > 1)
      if (nuove.length) setModifica({ riferimenti: [...usaStato.getState().modifica.riferimenti, ...nuove].slice(0, 9) })
    }
  }

  /** il comando Camera scrive il prompt da solo, e porta il LoRA delle angolazioni se c'è */
  const cambiaCamera = (c: PosizioneCamera): void => {
    setCamera(c)
    const lora = !!fileLoraCamera()
    const p = componiCamera(c, lora)
    setModifica({ prompt: p })
    setCameraRapida(p ? { id: 'camera', nome: 'Camera', prompt: p, lora: lora && conLora(c) ? ['camera'] : [] } : null)
  }

  const migliora = async (): Promise<void> => {
    const guarda = fusion ? m.riferimenti : esempioMode ? (m.esempio ? [m.esempio] : []) : base ? [base] : []
    if (!guarda.length || !m.prompt.trim()) return
    setScrivendo(true)
    try {
      const t = await api.testo.scrivi({ ...richiestaBase(), modalita: 'descrivi', prompt: m.prompt, immagini: [guarda[0].percorso], sistema: SISTEMA_MIGLIORA_MODIFICA, maxToken: 200, etichetta: 'Migliora istruzione' })
      if (t) setModifica({ prompt: t })
    } catch (e) {
      avvisa((e as Error).message, 'errore')
    } finally {
      setScrivendo(false)
    }
  }

  async function manda(): Promise<void> {
    const s = usaStato.getState().modifica
    if (specialeOra()) return mandaGriglia()
    if (!s.base) return
    if (s.modo !== 'espandi' && !s.prompt.trim() && !idee.length) {
      avvisa('Scrivi cosa cambiare (o scegli una o più idee)', 'errore')
      return
    }
    if (rapida?.rif && s.riferimenti.length < rapida.rif) {
      avvisa(`Serve ${rapida.rifNome || 'una foto di riferimento'}: aggiungila in Riferimenti (<image2>)`, 'errore')
      return
    }
    // Scrivi: la zona disegnata (se c'è) decide se si cambia solo lì o tutta la foto
    const disegnata = s.modo === 'scrivi' ? tela.current?.esporta() ?? null : null
    const tipo: 'modifica' | 'zona' | 'espandi' = s.modo === 'espandi' ? 'espandi' : disegnata ? 'zona' : 'modifica'
    // le idee scelte: il modello guarda la foto e le mescola in una sola istruzione, inventando i dettagli
    let testo = s.prompt.trim()
    if (s.modo !== 'espandi' && idee.length) {
      if (s.fantasia === 'fedele' && idee.length === 1 && !testo) testo = idee[0].prompt
      else {
        const chiave = JSON.stringify([s.base.percorso, idee.map((r) => r.id), testo, s.riferimenti.map((r) => r.percorso), s.fantasia, tipo === 'zona' ? 'zona' : s.modo])
        let piano = s.pianoIdee?.chiave === chiave ? s.pianoIdee.testo : ''
        if (!piano) {
          avvisa('Il modello guarda la foto e mescola le idee…', 'info')
          try {
            piano = await pianificaIdee({ base: s.base, idee, nota: testo, riferimenti: s.riferimenti, fantasia: s.fantasia, zona: tipo === 'zona' })
          } catch (er) {
            avvisa((er as Error).message, 'errore')
            return
          }
          setModifica({ pianoIdee: { chiave, testo: piano } })
        }
        testo = piano
      }
    }
    const base0 = richiestaBase()
    // i LoRA che l'azione accende da sola (coerenza, cambio vestito, camera) si aggiungono a quelli che hai acceso
    const extra = loraPer(rapida?.lora).filter((x) => !base0.lora.some((l) => l.file === x.file))
    const q = {
      ...base0,
      lora: [...base0.lora, ...extra],
      modalita: tipo,
      prompt: conParoleLora(testo),
      immagini: [s.base.percorso, ...s.riferimenti.map((r) => r.percorso)],
      megapixel: s.mp,
      ...perQualita(s.qualita),
      quante: s.quante,
      origine: s.base.operaId,
      // Klein: una richiesta breve scritta da te si espande; le istruzioni già costruite (idee, azioni rapide) no
      potenzia: tipo === 'modifica' && !rapida && !idee.length,
      etichetta: (rapida && rapida.id !== 'camera' ? rapida.nome + ' · ' : rapida ? 'Camera · ' : '') + (testo.slice(0, 50) || 'Espandi')
    }
    if (s.modo !== 'espandi') Object.assign(q, conMisura(s.misura, s.base))
    if (tipo === 'modifica') Object.assign(q, { trasparente: !!rapida?.trasparente })
    if (disegnata) {
      const maschera = await api.file.salvaTemp(disegnata.dataUrl)
      // tutto il resto (contesto, bordi, riempimento per "rimuovi") lo decide il motore dalla zona e dall'istruzione
      Object.assign(q, { maschera, riquadro: disegnata.riquadro, forza: rapida?.forza })
    }
    if (s.modo === 'espandi') {
      const b = s.bordi
      if (!b.sinistra && !b.destra && !b.sopra && !b.sotto) {
        avvisa('Scegli di quanto allargare la foto', 'errore')
        return
      }
      Object.assign(q, { bordi: b, forza: 1 })
    }
    setConfronto(false)
    const ids = await api.lavori.accoda(q)
    ids.forEach((id) => attesiModifica.add(id))
  }

  /** Fusion / Esempio: la richiesta la costruisce fusion.ts; qui si accoda e si aspetta il risultato */
  async function mandaGriglia(): Promise<void> {
    const s = usaStato.getState().modifica
    let e
    if (specialeOra() === 'esempio') {
      // il modello guarda l'esempio e le tue foto e scrive lui cosa sostituire con cosa; il piano resta qui sotto, correggibile
      const chiave = chiaveEsempio(s)
      let piano: { testo: string; ritagli?: (string | null)[] } = s.pianoEsempio?.chiave === chiave ? s.pianoEsempio : { testo: '' }
      if (!piano.testo && s.esempio && s.riferimenti.length) {
        avvisa('Il modello guarda l\'esempio e le tue foto…', 'info')
        try {
          piano = await pianificaEsempio(s)
        } catch (er) {
          avvisa((er as Error).message, 'errore')
          return
        }
        setModifica({ pianoEsempio: { chiave, ...piano } })
      }
      e = richiestaEsempio(s, piano)
    } else e = richiestaFusion(s)
    if ('errore' in e) {
      avvisa(e.errore, 'errore')
      return
    }
    const ids = await api.lavori.accoda(e.q)
    ids.forEach((id) => attesiFusion.add(id))
  }

  const inserisci = (testo: string): void => {
    const t = prompt.current
    const v = m.prompt
    const i = t ? t.selectionStart : v.length
    setModifica({ prompt: v.slice(0, i) + testo + v.slice(i) })
  }

  const espandiPreset = (tipo: PresetEspandi): void => {
    if (base) setModifica({ bordi: bordiPreset(tipo, base.larghezza, base.altezza) })
  }

  const disegna = m.modo === 'scrivi'
  const confrontoAttivo = confronto && !!precedente && !inCorso
  const mancaRif = !!rapida?.rif && m.riferimenti.length < rapida.rif
  /** per quali foto, idee e note vale il piano delle idee (come in manda()) */
  const chiaveIdee = base ? JSON.stringify([base.percorso, idee.map((r) => r.id), m.prompt.trim(), m.riferimenti.map((r) => r.percorso), m.fantasia, zona ? 'zona' : m.modo]) : ''

  const vista = { display: catalogo ? 'none' : 'contents' }

  return (
    <div className="pagina">
      <div style={vista}>
      <div
        className="editor"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const fs = Array.from(e.dataTransfer.files)
          if (!fs.length) return
          if (specialeOra()) {
            // Unisci / Esempio: tutte le foto trascinate sono riferimenti
            void (async () => {
              const f: FotoBase[] = []
              for (const x of fs.slice(0, MAX_FUSION)) {
                try {
                  f.push(await normalizza(api.file.percorso(x)))
                } catch (er) {
                  avvisa((er as Error).message, 'errore')
                }
              }
              aggiungiFusion(f)
            })()
            return
          }
          void (async () => {
            await apri(api.file.percorso(fs[0]))
            // le altre foto trascinate insieme diventano riferimenti
            const altre: FotoBase[] = []
            for (const f of fs.slice(1, 9)) {
              try {
                altre.push(await normalizza(api.file.percorso(f)))
              } catch {
                /* una foto che non si apre non ferma le altre */
              }
            }
            if (altre.length) setModifica({ riferimenti: altre })
          })()
        }}
      >
        <TelaModifica
          tela={tela}
          strumento={strumento}
          setStrumento={setStrumento}
          pennello={pennello}
          setPennello={setPennello}
          setHaMaschera={setHaMaschera}
          confronto={confronto}
          setConfronto={setConfronto}
          confrontoAttivo={confrontoAttivo}
          disegna={disegna}
          griglia={griglia}
          esempioMode={esempioMode}
          estraiMode={estraiMode}
          base={base}
          indice={indice}
          precedente={precedente}
          successiva={successiva}
          inCorso={inCorso}
          inAttesa={inAttesa}
          anteprima={anteprima}
          ris={ris}
          fusInCorso={fusInCorso}
          fusInAttesa={fusInAttesa}
          daGalleria={daGalleria}
          daPc={daPc}
          togliFoto={togliFoto}
          inserisci={inserisci}
          aggiungiFusion={aggiungiFusion}
        />
      </div>

      {estraiMode ? (
        <ControlliEstrai base={base} />
      ) : (
        <SchedeModifica
          prompt={prompt}
          base={base}
          griglia={griglia}
          haMaschera={haMaschera}
          zona={zona}
          scrivendo={scrivendo}
          migliora={migliora}
          setCameraRapida={setCameraRapida}
          inserisci={inserisci}
          mancaRif={mancaRif}
          rapida={rapida}
          categorie={categorie}
          cat={cat}
          setCategoria={(id) => setCategoria(categoria === id ? '' : id)}
          idee={idee}
          setIdee={setIdee}
          usaRapida={usaRapida}
          chiaveIdee={chiaveIdee}
          camera={camera}
          cambiaCamera={cambiaCamera}
          loraCamera={loraCamera}
          espandiPreset={espandiPreset}
          comeBase={comeBase}
          passi={passi}
          stima={stima}
          dimOut={dimOut}
          manda={manda}
        />
      )}
      </div>
      <div style={{ display: catalogo ? 'contents' : 'none' }}><SchedaRicette /></div>
    </div>
  )
}
