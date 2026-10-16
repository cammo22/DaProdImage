// Modifica: tutta la foto, solo una zona (la segni col pennello) o allargarla oltre i bordi.
// Le azioni rapide (persone, vestiti, situazioni, camera, luce, stili, testi) mettono l'istruzione giusta;
// dopo ogni modifica la nuova versione resta sulla tela, col confronto prima/dopo e il tasto "Continua da qui".
import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { usaStato, attesiModifica, scegliFoto, type ModoModifica, type Qualita, type FotoBase } from '../stato'
import { api, urlFile } from '../api'
import { I } from '../componenti/Icone'
import { Casella } from '../componenti/Casella'
import { ScegliQualita } from '../componenti/ScegliQualita'
import { ScegliModello } from '../componenti/ScegliModello'
import { Contatore, Cursore, Segmenti } from '../componenti/Controlli'
import { SceltaLora, conParoleLora } from '../componenti/SceltaLora'
import { TelaMaschera, type AnteprimaTela, type ComandiTela, type Strumento } from '../componenti/TelaMaschera'
import { AvvisoTurbo, useTurbo } from '../componenti/Turbo'
import { AvvisoLora } from '../componenti/AvvisoLora'
import { Riferimenti } from '../componenti/Riferimenti'
import { SceltaMisura, ScegliMp, MISURA0, conMisura, dimMp } from '../componenti/Misura'
import { Fusion, MAX_FUSION } from '../componenti/Fusion'
import { ControlliEstrai, PalcoEstrai } from '../componenti/Estrai'
import { FANTASIE, pianificaIdee, unisciRapide } from '../regista'
import { FORMATI_FUSION, chiaveEsempio, pianificaEsempio, richiestaEsempio, richiestaFusion } from '../fusion'
import { ascoltatoriLavoro } from '../stato'
import { CAMERA0, ControlloCamera, componiCamera, conLora, type PosizioneCamera } from '../componenti/Camera'
import { daDataUrl, durata, immagineDaIncolla, normalizza, stimaSecondi } from '../util'
import { SISTEMA_MIGLIORA_MODIFICA, fileLoraCamera, loraPer, perQualita, richiestaBase } from '../azioni'
import { categoriePer, type Rapida } from '../rapide'
import { apriInModifica, fotoDaOpera } from '../azioni'
import type { Bordi, Lavoro, Opera } from '@shared/tipi'

const attesiFusion = new Set<string>()

const NIENTE: Bordi = { sinistra: 0, sopra: 0, destra: 0, sotto: 0 }

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
  const [categoria, setCategoria] = useState('persone')
  const [camera, setCamera] = useState<PosizioneCamera>(CAMERA0)
  const [scrivendo, setScrivendo] = useState(false)
  const turbo = useTurbo()
  // Fusion: i risultati (foto nuove) e il lavoro che li sta creando
  const [ris, setRis] = useState<Opera[]>([])
  const fusion = m.modo === 'fusion'
  const esempioMode = m.modo === 'esempio'
  const estraiMode = m.modo === 'estrai'
  /** i modi con una griglia di foto al posto della tela: Fusion e Esempio */
  const griglia = fusion || esempioMode

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
  const stima = stimaSecondi(imp?.tempi, m.mp, m.modo === 'zona' && forzaRapida ? Math.max(Math.min(passi, m.qualita === 'turbo' ? 4 : 8), Math.round(passi * forzaRapida)) : passi) * m.quante
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
    return m.modo === 'zona' || mis.tipo === 'originale' ? { w: rif.larghezza, h: rif.altezza } : dimMp(m.mp, rif.larghezza, rif.altezza)
  })()
  const categorie = categoriePer(m.modo === 'zona' ? 'zona' : 'tutta')
  const cat = categorie.find((c) => c.id === categoria) || categorie[0]
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
    if (s.modo === 'fusion' && !s.riferimenti.length && s.base) setModifica({ riferimenti: [s.base] })
    if (s.modo === 'esempio' && !s.esempio && s.base) setModifica({ esempio: s.base })
  }, [m.modo])

  // pennello proporzionato alla foto; foto nuova = niente confronto
  useEffect(() => {
    if (base) setPennello(Math.max(8, Math.round(Math.min(base.larghezza, base.altezza) / 16)))
  }, [base?.percorso])

  // cambiando modo si torna alla tela (per disegnare la zona o vedere la cornice)
  useEffect(() => {
    setConfronto(false)
    if (!categoriePer(m.modo === 'zona' ? 'zona' : 'tutta').some((c) => c.id === categoria)) setCategoria(m.modo === 'zona' ? 'zona-base' : 'persone')
  }, [m.modo])

  // un risultato nuovo: si apre il confronto prima/dopo (con "Continua da qui" bene in vista)
  const lunghezza = useRef(m.versioni.length)
  useEffect(() => {
    if (m.versioni.length > lunghezza.current && m.versioni.length > 1 && usaStato.getState().modifica.modo !== 'fusion') setConfronto(true)
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
    if (['fusion', 'esempio'].includes(usaStato.getState().modifica.modo)) {
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
    if (['fusion', 'esempio'].includes(usaStato.getState().modifica.modo)) {
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
    setModifica({ base: null, versioni: [], riferimenti: [], prompt: '', modo: 'tutta', bordi: { ...NIENTE }, misura: MISURA0 })
    setConfronto(false)
    setRapida(null)
    setHaMaschera(false)
    setCamera(CAMERA0)
  }

  // incolla dagli appunti: senza foto = base, con la foto = riferimento
  useEffect(() => {
    const incolla = async (e: ClipboardEvent): Promise<void> => {
      if (usaStato.getState().pagina !== 'modifica') return
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
      const d = immagineDaIncolla(e)
      if (!d) return
      e.preventDefault()
      const f = await daDataUrl(await d)
      const s = usaStato.getState().modifica
      if (s.modo === 'fusion') aggiungiFusion([f])
      else if (s.modo === 'esempio') {
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
      else if (m.modo === 'zona' && !e.ctrlKey) {
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
    if (s.modo === 'fusion' || s.modo === 'esempio') return mandaGriglia()
    if (!s.base) return
    if (s.modo !== 'espandi' && !s.prompt.trim() && !idee.length) {
      avvisa('Scrivi cosa cambiare (o scegli una o più idee)', 'errore')
      return
    }
    if (rapida?.rif && s.riferimenti.length < rapida.rif) {
      avvisa(`Serve ${rapida.rifNome || 'una foto di riferimento'}: aggiungila in Riferimenti (<image2>)`, 'errore')
      return
    }
    if (s.qualita === 'turbo' && !turbo.presente) {
      avvisa('Per il Turbo scarica prima il suo LoRA (il pulsante sotto Qualità), o scegli Alta', 'errore')
      return
    }
    // le idee scelte: il modello guarda la foto e le mescola in una sola istruzione, inventando i dettagli
    let testo = s.prompt.trim()
    if (s.modo !== 'espandi' && idee.length) {
      if (s.fantasia === 'fedele' && idee.length === 1 && !testo) testo = idee[0].prompt
      else {
        const chiave = JSON.stringify([s.base.percorso, idee.map((r) => r.id), testo, s.riferimenti.map((r) => r.percorso), s.fantasia, s.modo])
        let piano = s.pianoIdee?.chiave === chiave ? s.pianoIdee.testo : ''
        if (!piano) {
          avvisa('Il modello guarda la foto e mescola le idee…', 'info')
          try {
            piano = await pianificaIdee({ base: s.base, idee, nota: testo, riferimenti: s.riferimenti, fantasia: s.fantasia, zona: s.modo === 'zona' })
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
      modalita: (s.modo === 'tutta' ? 'modifica' : s.modo) as 'modifica' | 'zona' | 'espandi',
      prompt: conParoleLora(testo),
      immagini: [s.base.percorso, ...s.riferimenti.map((r) => r.percorso)],
      megapixel: s.mp,
      ...perQualita(s.qualita),
      quante: s.quante,
      origine: s.base.operaId,
      // Klein: una richiesta breve scritta da te si espande; le istruzioni già costruite (idee, azioni rapide) no
      potenzia: s.modo === 'tutta' && !rapida && !idee.length,
      etichetta: (rapida && rapida.id !== 'camera' ? rapida.nome + ' · ' : rapida ? 'Camera · ' : '') + (testo.slice(0, 50) || 'Espandi')
    }
    if (s.modo !== 'espandi') Object.assign(q, conMisura(s.misura, s.base))
    if (s.modo === 'tutta') Object.assign(q, { trasparente: !!rapida?.trasparente })
    if (s.modo === 'zona') {
      const e = tela.current?.esporta()
      if (!e) {
        avvisa('Segna prima la zona da cambiare col pennello', 'errore')
        return
      }
      const maschera = await api.file.salvaTemp(e.dataUrl)
      // tutto il resto (contesto, bordi, riempimento per "rimuovi") lo decide il motore dalla zona e dall'istruzione
      Object.assign(q, { maschera, riquadro: e.riquadro, forza: rapida?.forza })
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
    if (s.modo === 'esempio') {
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
      e = richiestaEsempio(s, turbo.presente, piano)
    } else e = richiestaFusion(s, turbo.presente)
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

  const espandiPreset = (tipo: 'tutto' | 'largo' | 'alto' | 'quadrato'): void => {
    if (!base) return
    const { larghezza: W, altezza: H } = base
    let b: Bordi = { ...NIENTE }
    const t32 = (x: number): number => Math.round(x / 32) * 32
    if (tipo === 'tutto') {
      const d = t32(Math.min(W, H) * 0.25)
      b = { sinistra: d, sopra: d, destra: d, sotto: d }
    } else if (tipo === 'largo') {
      const nuovo = Math.max(W, Math.round((H * 16) / 9))
      const d = t32((nuovo - W) / 2)
      b = { sinistra: d, sopra: 0, destra: d, sotto: 0 }
    } else if (tipo === 'alto') {
      const nuovo = Math.max(H, Math.round((W * 16) / 9))
      const d = t32((nuovo - H) / 2)
      b = { sinistra: 0, sopra: d, destra: 0, sotto: d }
    } else {
      const lato = Math.max(W, H)
      b = { sinistra: t32((lato - W) / 2), destra: t32((lato - W) / 2), sopra: t32((lato - H) / 2), sotto: t32((lato - H) / 2) }
    }
    setModifica({ bordi: b })
  }

  const disegna = m.modo === 'zona'
  const confrontoAttivo = confronto && !!precedente && !inCorso
  const mancaRif = !!rapida?.rif && m.riferimenti.length < rapida.rif
  /** per quali foto, idee e note vale il piano delle idee (come in manda()) */
  const chiaveIdee = base ? JSON.stringify([base.percorso, idee.map((r) => r.id), m.prompt.trim(), m.riferimenti.map((r) => r.percorso), m.fantasia, m.modo]) : ''

  return (
    <div className="pagina">
      <div
        className="editor"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const fs = Array.from(e.dataTransfer.files)
          if (!fs.length) return
          if (['fusion', 'esempio'].includes(usaStato.getState().modifica.modo)) {
            // Fusion / Esempio: tutte le foto trascinate sono riferimenti
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
        <div className="attrezzi">
          <div style={{ width: 660 }}>
            <Segmenti<ModoModifica>
              valore={m.modo}
              cambia={(modo) => setModifica({ modo })}
              voci={[
                { id: 'tutta', nome: 'Tutta la foto' },
                { id: 'zona', nome: 'Solo una zona' },
                { id: 'espandi', nome: 'Espandi' },
                { id: 'fusion', nome: 'Fusion', titolo: 'Più foto, tutte riferimenti: ne esce una immagine nuova' },
                { id: 'esempio', nome: 'Esempio', titolo: 'Dai le foto da usare e una foto di esempio di come vuoi il risultato' },
                { id: 'estrai', nome: 'Estrai', titolo: 'Dalla foto estrai una persona o un oggetto, su sfondo pulito' }
              ]}
            />
          </div>
          {disegna && base && !confrontoAttivo && (
            <>
              <span className="sep" />
              {([
                ['pennello', I.pennello, 'Pennello (B)'],
                ['gomma', I.gomma, 'Gomma (E)'],
                ['rettangolo', I.rettangolo, 'Rettangolo (R)'],
                ['lazo', I.lazo, 'Lazo (L)'],
                ['mano', I.mano, 'Sposta (H o Spazio)']
              ] as const).map(([id, Ic, t]) => (
                <button key={id} className={`btn icona piccolo ${strumento === id ? 'attivo' : ''}`} onClick={() => setStrumento(id)} title={t}>
                  <Ic />
                </button>
              ))}
              <div style={{ width: 150 }}>
                <Cursore etichetta="Pennello" valore={pennello} min={2} max={Math.max(200, Math.round(Math.min(base.larghezza, base.altezza) / 3))} formato={(v) => `${v}px`} cambia={setPennello} />
              </div>
              <span className="sep" />
              <button className="btn piccolo icona" onClick={() => tela.current?.annulla()} title="Annulla (Ctrl+Z)"><I.annulla /></button>
              <button className="btn piccolo icona" onClick={() => tela.current?.ripeti()} title="Ripeti (Ctrl+Y)"><I.ripeti /></button>
              <button className="btn piccolo icona" onClick={() => tela.current?.inverti()} title="Inverti la zona"><I.inverti /></button>
              <button className="btn piccolo" onClick={() => tela.current?.pulisci()} title="Cancella la zona">Pulisci</button>
            </>
          )}
          <span className="flex1" />
          {base && !griglia && <button className="btn piccolo icona" onClick={() => tela.current?.adatta()} title="Adatta alla finestra"><I.adatta /></button>}
          <button className="btn piccolo" onClick={daGalleria} title={griglia ? 'Aggiungi foto dalla galleria (anche tante insieme)' : 'Scegli una foto dalla galleria'}><I.galleria /> {griglia ? 'Aggiungi dalla galleria' : 'Dalla galleria'}</button>
          <button className="btn piccolo" onClick={daPc} title={griglia ? 'Aggiungi foto dal PC (anche tante insieme)' : 'Apri una foto dal PC'}><I.immagine /> Dal PC</button>
          {base && !griglia && (
            <button className="btn piccolo pericolo" onClick={togliFoto} title="Toglie la foto e rimette la pagina com'era appena aperta (le versioni restano in galleria)">
              <I.x /> Togli
            </button>
          )}
        </div>

        {estraiMode ? <PalcoEstrai base={base} daGalleria={daGalleria} daPc={daPc} /> : null}
        {estraiMode ? null : griglia ? (
          <Fusion
            foto={m.riferimenti}
            cambia={(riferimenti) => setModifica({ riferimenti })}
            inserisci={inserisci}
            risultati={ris}
            inCorso={fusInCorso}
            inAttesa={fusInAttesa}
            daGalleria={daGalleria}
            daPc={daPc}
            riusa={(o) => aggiungiFusion([fotoDaOpera(o)])}
            esempio={esempioMode ? { foto: m.esempio, cambia: (esempio) => setModifica({ esempio }), daGalleria: async () => { const [f] = await scegliFoto(false); if (f) setModifica({ esempio: f }) }, daPc: async () => { const [x] = await api.file.scegliImmagini(false); if (x) { try { setModifica({ esempio: await normalizza(x) }) } catch (e) { avvisa((e as Error).message, 'errore') } } } } : undefined}
            apriInModifica={(o) => { apriInModifica(fotoDaOpera(o)); setModifica({ modo: 'tutta' }) }}
            mostra={(o) => void api.galleria.mostra(o.id)}
          />
        ) : null}
        {griglia || estraiMode ? null : !base ? (
          <div className="tela" style={{ display: 'grid', placeItems: 'center', cursor: 'default' }}>
            <div className="vuoto">
              <div className="grosso">MODIFICA UNA <b>FOTO</b></div>
              <p>Trascina qui una foto, incollala con <kbd>Ctrl</kbd>+<kbd>V</kbd>, o scegline una.</p>
              <p className="piccolo">Cambi tutta la foto con una frase o un'azione rapida, o segni col pennello solo la zona da cambiare: il resto resta identico al pixel.</p>
              <div className="riga" style={{ justifyContent: 'center', marginTop: 14 }}>
                <button className="btn primario" onClick={daGalleria}><I.galleria /> Dalla galleria</button>
                <button className="btn" onClick={daPc}><I.immagine /> Dal PC</button>
              </div>
            </div>
          </div>
        ) : (
          <TelaMaschera
            ref={tela}
            url={urlFile(base.percorso)}
            larghezza={base.larghezza}
            altezza={base.altezza}
            strumento={strumento}
            dimensione={pennello}
            disegna={disegna && !inCorso && !confrontoAttivo}
            bordi={qi?.modalita === 'espandi' && anteprima ? qi.bordi : m.modo === 'espandi' ? m.bordi : undefined}
            cambiaMaschera={setHaMaschera}
            cambiaDimensione={setPennello}
            anteprima={anteprima}
            // il "prima" è sempre la foto originale, qualunque versione stai guardando (v3, v4…)
            confronto={confrontoAttivo && m.versioni[0] ? { prima: urlFile(m.versioni[0].percorso) } : undefined}
          >
            {!inCorso && m.versioni.length > 1 && indice >= 0 && (
              <div className="barra-versioni" onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
                <button className="btn piccolo icona" disabled={!precedente} onClick={() => { if (precedente) { setModifica({ base: precedente }); setConfronto(false) } }} title="Versione prima"><span className="freccina">‹</span></button>
                <b>{indice === 0 ? 'Originale' : `v${indice + 1}`}</b>
                <span className="spento">di {m.versioni.length}</span>
                <button className="btn piccolo icona" disabled={!successiva} onClick={() => { if (successiva) { setModifica({ base: successiva }); setConfronto(false) } }} title="Versione dopo"><span className="freccina">›</span></button>
                {precedente && (
                  <>
                    <span className="sep" />
                    <button className={`btn piccolo ${confrontoAttivo ? 'attivo' : ''}`} onClick={() => setConfronto(!confronto)} title="L'originale e questa versione, con la linea da trascinare">
                      <I.inverti /> Prima / dopo
                    </button>
                    {confrontoAttivo ? (
                      <button className="btn piccolo primario" onClick={() => setConfronto(false)} title="Chiude il confronto: da qui puoi modificare ancora">
                        <I.modifica /> Continua da qui
                      </button>
                    ) : (
                      <button className="btn piccolo" onClick={() => { setModifica({ base: precedente }); setConfronto(false) }} title="Scarta questa modifica e torna alla versione prima"><I.annulla /> Torna indietro</button>
                    )}
                  </>
                )}
              </div>
            )}
            {confrontoAttivo && (
              <div className="suggerimento-confronto">Trascina la linea per confrontare · poi premi <b>Continua da qui</b> per modificare ancora{disegna ? ' (o per segnare un\'altra zona)' : ''}</div>
            )}
          </TelaMaschera>
        )}

        {!griglia && !estraiMode && m.versioni.length > 0 && (
          <div className="versioni">
            {m.versioni.map((v, i) => (
              <div key={v.percorso} className={`v ${v.percorso === base?.percorso ? 'su' : ''}`} style={{ ['--ar' as string]: `${v.larghezza} / ${v.altezza}` }} onClick={() => { setModifica({ base: v }); setConfronto(false) }} title={v.prompt}>
                <img src={urlFile(v.percorso)} alt="" />
                <span>{i === 0 ? 'Originale' : `v${i + 1}`}</span>
              </div>
            ))}
            {inAttesa > 0 && <span className="piccolo oro">+{inAttesa} in arrivo…</span>}
            <span className="flex1" />
            {base && indice > 0 && !confrontoAttivo && <span className="piccolo tenue">Continua a modificare da qui: ogni modifica parte dalla versione scelta.</span>}
          </div>
        )}
      </div>

      {estraiMode ? <ControlliEstrai base={base} /> : <div className="colonna destra">
        <div className="scorri">
          <div className="sezione"><ScegliModello /></div>
          <div className="sezione">
            <h3>
              {fusion ? 'Cosa creare con le foto' : esempioMode ? 'Cosa vuoi (facoltativo)' : m.modo === 'espandi' ? 'Cosa c\'è fuori (facoltativo)' : m.modo === 'zona' ? 'Cosa fare nella zona' : 'Cosa cambiare'}
              {m.modo === 'zona' && <span className="dx">{haMaschera ? <span className="oro">zona segnata ✓</span> : 'segnala col pennello'}</span>}
            </h3>
            <Casella
              inputRef={prompt}
              valore={m.prompt}
              cambia={(v) => {
                setModifica({ prompt: v })
                if (!v.trim()) setCameraRapida(null)
              }}
              placeholder={esempioMode ? 'Facoltativo, es. "sostituisci le iridi con quelle delle mie foto". Se lasci vuoto il modello capisce da solo cosa fare' : fusion ? 'es. "la ragazza di <image1> con la giacca di <image2> in una strada di Tokyo di notte"' : m.modo === 'zona' ? 'es. "una camicia di lino bianca" o "rimuovi la persona"' : m.modo === 'espandi' ? 'es. "una spiaggia al tramonto"' : 'es. "fallo di notte con la neve", "metti la maglia di <image2>"'}
              minimo={96}
              disabled={scrivendo}
            />
            <div className="riga a-capo" style={{ marginTop: 8 }}>
              <button className="btn piccolo" onClick={migliora} disabled={(!base && !griglia) || (fusion && !m.riferimenti.length) || (esempioMode && !m.esempio) || scrivendo || !m.prompt.trim()} title="Il modello guarda la foto e rende l'istruzione precisa (in inglese)">
                <I.bacchetta /> {scrivendo ? 'Scrivo…' : 'Migliora'}
              </button>
              {!fusion && (esempioMode ? m.esempio : base) && (
                <button className="chip principale" onClick={() => inserisci('<image1>')} title={esempioMode ? 'Mette l\'esempio nel testo' : 'Mette la foto principale (quella che modifichi) nel testo'}>
                  &lt;image1&gt; · {esempioMode ? 'esempio' : 'principale'}
                </button>
              )}
              {m.riferimenti.map((_, i) => (
                <button key={i} className="chip" onClick={() => inserisci(`<image${i + (fusion ? 1 : 2)}>`)} title="Inserisci il riferimento nel testo">&lt;image{i + (fusion ? 1 : 2)}&gt;</button>
              ))}
            </div>
            {mancaRif && !griglia && (
              <div className="avviso-box" style={{ marginTop: 10, padding: '8px 10px', fontSize: 13.5 }}>
                Serve {rapida?.rifNome || 'una foto di riferimento'}: aggiungila qui sotto in <b>Riferimenti</b> (nel testo è <b>&lt;image2&gt;</b>).
              </div>
            )}
          </div>

          {esempioMode && m.qualita === 'turbo' && (
            <div className="avviso-box" style={{ margin: '10px 16px 0', padding: '8px 10px', fontSize: 13.5 }}>
              Il Turbo è velocissimo ma segue meno i <b>colori e i dettagli</b> delle tue foto: per le iridi, i vestiti, i loghi… prova <b>Alta</b>.
            </div>
          )}
          {esempioMode && (
            <div className="sezione">
              <h3>Il piano del modello {m.pianoEsempio && <button className="btn piccolo fantasma" style={{ marginLeft: 'auto' }} onClick={() => setModifica({ pianoEsempio: null })} title="Al prossimo lavoro il modello guarda di nuovo le foto e rifà il piano">Rifai</button>}</h3>
              {m.pianoEsempio && m.pianoEsempio.chiave === chiaveEsempio(m) ? (
                <>
                  <Casella valore={m.pianoEsempio.testo} minimo={120} senzaCestino cambia={(testo) => setModifica({ pianoEsempio: { ...m.pianoEsempio!, testo } })} />
                  {m.pianoEsempio.ritagli?.some(Boolean) && (
                    <div style={{ marginTop: 8 }}>
                      <span className="piccolo tenue">Le parti delle tue foto che contano (ritagliate dal modello)</span>
                      <div className="riga a-capo" style={{ gap: 6, marginTop: 4 }}>
                        {m.pianoEsempio.ritagli.map((r, i) => r && <img key={i} src={urlFile(r)} alt="" style={{ height: 56, borderRadius: 6, border: '1px solid var(--bordo2)' }} title={`<image${i + 2}>`} />)}
                      </div>
                    </div>
                  )}
                  <div className="piccolo spento" style={{ marginTop: 4 }}>L'ha scritto il modello guardando le foto: puoi correggerlo. Si usa così com'è finché non cambi le foto o le note.</div>
                </>
              ) : (
                <div className="piccolo spento">Quando premi il pulsante il modello guarda l'esempio e le tue foto insieme e decide da solo cosa sostituire con cosa, e cosa lasciare com'è. Qui vedrai cosa ha deciso, e potrai correggerlo.</div>
              )}
            </div>
          )}

          {m.modo !== 'espandi' && !griglia && (
            <div className="sezione">
              <h3>Idee <span className="dx">sommale: il modello le mescola</span></h3>
              <div className="cat-rapide">
                {categorie.map((c) => {
                  const Ic = (I as Record<string, () => JSX.Element>)[c.icona] || I.crea
                  return (
                    <button key={c.id} className={cat?.id === c.id ? 'su' : ''} onClick={() => setCategoria(c.id)}>
                      <Ic />
                      {c.nome}
                    </button>
                  )
                })}
              </div>
              {cat && cat.id === 'prospettiva' && m.modo === 'tutta' && (
                <div style={{ marginTop: 12 }}>
                  <ControlloCamera valore={camera} cambia={cambiaCamera} lora={loraCamera} />
                  <AvvisoLora id="lora-camera" perche="Rifà la foto da un'altra posizione della camera, molto più fedele. Si accende da solo con il comando Camera." />
                </div>
              )}
              {cat && cat.id === 'vestiti' && <div style={{ marginTop: 10 }}><AvvisoLora id="lora-vestiti" perche="Tiene volto, pose e sfondo mentre cambia il vestito. Si accende da solo qui." /></div>}
              <div className="riga a-capo" style={{ marginTop: 10, gap: 6 }}>
                {cat?.voci.map((r) => (
                  <button key={r.id} className={`chip ${idee.some((x) => x.id === r.id) ? 'su' : ''}`} onClick={() => void usaRapida(r)} title={r.rif ? `Serve ${r.rifNome || 'una foto di riferimento'}` : 'Un clic la accende, un altro la spegne: puoi sommarne quante vuoi'}>
                    {r.rif ? '＋ ' : ''}{r.nome}
                  </button>
                ))}
              </div>
              {idee.length > 0 && (
                <div className="idee-scelte">
                  <div className="riga spazia">
                    <b className="oro piccolo">{idee.length} {idee.length === 1 ? 'idea' : 'idee'}: {idee.map((r) => r.nome.replace('…', '')).join(' + ')}</b>
                    <button className="btn piccolo fantasma" onClick={() => setIdee([])}>Togli tutte</button>
                  </div>
                  <span className="piccolo tenue">Fantasia del modello</span>
                  <Segmenti valore={m.fantasia} cambia={(fantasia) => setModifica({ fantasia })} voci={FANTASIE.map((f) => ({ id: f.id, nome: f.nome, sotto: f.sotto }))} />
                  {m.pianoIdee && m.pianoIdee.chiave === chiaveIdee ? (
                    <div style={{ marginTop: 8 }}>
                      <div className="riga spazia"><span className="piccolo tenue">Il piano del modello (puoi correggerlo)</span><button className="btn piccolo fantasma" onClick={() => setModifica({ pianoIdee: null })} title="Al prossimo lavoro il modello rimescola le idee, con dettagli nuovi">Rifai</button></div>
                      <Casella minimo={110} senzaCestino valore={m.pianoIdee.testo} cambia={(testo) => setModifica({ pianoIdee: { chiave: m.pianoIdee!.chiave, testo } })} />
                    </div>
                  ) : (
                    <div className="piccolo spento" style={{ marginTop: 6 }}>Quando premi «Modifica» il modello guarda la foto, mescola le idee e inventa i dettagli. Qui vedrai cosa ha deciso.</div>
                  )}
                </div>
              )}
              {cat && ['luce', 'ritocco', 'situazioni'].includes(cat.id) && <div style={{ marginTop: 10 }}><AvvisoLora id="lora-coerenza" perche="Le modifiche restano sul fotogramma: luce, colori e stili cambiano, i contorni no. Si accende da solo in queste azioni." /></div>}
            </div>
          )}

          {m.modo === 'espandi' && base && (
            <div className="sezione">
              <h3>Di quanto allargare <span className="dx">{base.larghezza + m.bordi.sinistra + m.bordi.destra} × {base.altezza + m.bordi.sopra + m.bordi.sotto}</span></h3>
              <div className="riga a-capo" style={{ gap: 6, marginBottom: 10 }}>
                <button className="chip" onClick={() => espandiPreset('tutto')}>+25% ovunque</button>
                <button className="chip" onClick={() => espandiPreset('largo')}>Larga 16:9</button>
                <button className="chip" onClick={() => espandiPreset('alto')}>Alta 9:16</button>
                <button className="chip" onClick={() => espandiPreset('quadrato')}>Quadrata</button>
                <button className="chip" onClick={() => setModifica({ bordi: { ...NIENTE } })}>Azzera</button>
              </div>
              {(['sinistra', 'destra', 'sopra', 'sotto'] as const).map((k) => (
                <Cursore key={k} etichetta={k[0].toUpperCase() + k.slice(1)} valore={m.bordi[k]} min={0} max={Math.round(Math.max(base.larghezza, base.altezza) * 0.75 / 32) * 32} passo={32} formato={(v) => `${v}px`} cambia={(v) => setModifica({ bordi: { ...m.bordi, [k]: v } })} />
              ))}
            </div>
          )}

          {!griglia && <div className="sezione">
            <Riferimenti
              lista={m.riferimenti}
              cambia={(riferimenti) => setModifica({ riferimenti })}
              inizio={2}
              inserisci={inserisci}
              principale={base?.percorso}
              comeBase={comeBase}
              titolo="Riferimenti"
              esempio={'Es. "metti a <image1> la giacca di <image2>". Persone, vestiti, oggetti, stili: fino a 9 foto in più (dalla galleria, dal PC o incollate con Ctrl+V).'}
            />
          </div>}

          {m.modo === 'zona' && (
            <div className="sezione">
              <div className="nota-zona">
                <I.occhio /> Il modello guarda <b>tutta la foto</b> con la tua zona evidenziata e cambia <b>solo lì</b>: fuori dalla zona la foto resta identica al pixel.
                Per togliere qualcosa scrivi "rimuovi…": la zona si ripulisce da sola prima di ridisegnarla.
              </div>
            </div>
          )}

          {fusion && (() => {
            const mis = m.misura && m.misura.tipo !== 'originale' ? m.misura : MISURA0
            const prima = m.riferimenti[0] ? { larghezza: m.riferimenti[0].larghezza, altezza: m.riferimenti[0].altezza } : null
            return (
              <div className="sezione">
                <h3>Dimensioni della foto nuova <span className="dx">{mis.tipo === 'custom' ? `${mis.w} × ${mis.h}` : 'automatiche'}</span></h3>
                <SceltaMisura valore={mis} cambia={(misura) => setModifica({ misura })} base={prima} mp={m.mp} ammetti={['auto', 'custom']} cambiaMp={(mp) => setModifica({ mp })} auto={(() => {
                  const [a, b] = FORMATI_FUSION.find((f) => f.id === (m.formatoFusion || 'prima'))?.r || (prima ? [prima.larghezza, prima.altezza] : [1, 1])
                  return dimMp(m.mp, a, b)
                })()} />
                {mis.tipo === 'auto' && (
                  <div style={{ marginTop: 10 }}>
                    <span className="piccolo tenue">Proporzioni</span>
                    <Segmenti valore={m.formatoFusion || 'prima'} cambia={(formatoFusion) => setModifica({ formatoFusion })} voci={FORMATI_FUSION.map((f) => ({ id: f.id, nome: f.nome }))} />
                  </div>
                )}

              </div>
            )
          })()}

          {m.modo !== 'espandi' && !fusion && (
            <div className="sezione">
              <h3>Dimensioni <span className="dx">{(m.misura ?? MISURA0).tipo === 'auto' ? 'come i megapixel' : (m.misura ?? MISURA0).tipo === 'originale' ? 'come la foto' : 'misura mia'}</span></h3>
              <SceltaMisura valore={m.misura ?? MISURA0} cambia={(misura) => setModifica({ misura })} base={esempioMode ? m.esempio : base} mp={m.mp} cambiaMp={(mp) => setModifica({ mp })}
                senzaPx={m.modo === 'zona'} auto={m.modo === 'zona' && base ? { w: base.larghezza, h: base.altezza, nota: 'resta com\'è, cambia solo la zona' } : undefined} />
            </div>
          )}

          <div className="sezione">
            <h3>Qualità <span className="dx">{passi} passi · ~{durata(stima)}</span></h3>
            <div>
              <ScegliQualita valore={m.qualita} cambia={(qualita) => setModifica({ qualita })} />
            </div>
            <div className="riga spazia" style={{ marginTop: 10 }}>
              <span className="tenue">Quante versioni</span>
              <Contatore valore={m.quante} min={1} max={8} cambia={(quante) => setModifica({ quante })} />
            </div>
            {m.modo === 'espandi' && (
              <div style={{ marginTop: 12 }}>
                <span className="piccolo tenue">Megapixel a cui lavora il modello</span>
                <ScegliMp mp={m.mp} cambia={(mp) => setModifica({ mp })} />
              </div>
            )}
          </div>

          {(imp?.famiglia || 'qwen') === 'qwen' && (
            <div className="sezione">
              <h3>LoRA</h3>
              <SceltaLora />
            </div>
          )}
        </div>
        <div className="sezione" style={{ borderTop: '1px solid #1d1636' }}>
          <button className="btn primario grande" style={{ width: '100%' }} onClick={manda} disabled={fusion ? !m.riferimenti.length : esempioMode ? !m.esempio || !m.riferimenti.length : !base}>
            {m.modo === 'zona' ? <I.zona /> : m.modo === 'espandi' ? <I.espandi /> : griglia ? <I.crea /> : <I.modifica />}
            {m.modo === 'zona' ? 'Cambia la zona' : m.modo === 'espandi' ? 'Espandi' : fusion ? 'Fusion · crea la foto nuova' : esempioMode ? 'Crea come l\'esempio' : 'Modifica'}
          </button>
          <div className="piccolo spento" style={{ textAlign: 'center', marginTop: 6 }}>{dimOut ? `${dimOut.w} × ${dimOut.h} px · ` : ''}Ctrl+Invio · ~{durata(stima)}</div>
        </div>
      </div>}
    </div>
  )
}
