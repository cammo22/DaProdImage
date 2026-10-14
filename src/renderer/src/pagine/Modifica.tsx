// Modifica: tutta la foto, solo una zona (la segni col pennello) o allargarla oltre i bordi.
// Le azioni rapide (persone, vestiti, situazioni, camera, luce, stili, testi) mettono l'istruzione giusta;
// dopo ogni modifica la nuova versione resta sulla tela, col confronto prima/dopo e il tasto "Continua da qui".
import { useEffect, useRef, useState, type JSX } from 'react'
import { usaStato, attesiModifica, scegliFoto, type ModoModifica, type Qualita, type FotoBase } from '../stato'
import { api, urlFile } from '../api'
import { I } from '../componenti/Icone'
import { Contatore, Cursore, Segmenti } from '../componenti/Controlli'
import { SceltaLora, conParoleLora } from '../componenti/SceltaLora'
import { TelaMaschera, type AnteprimaTela, type ComandiTela, type Strumento } from '../componenti/TelaMaschera'
import { AvvisoTurbo, useTurbo } from '../componenti/Turbo'
import { AvvisoLora } from '../componenti/AvvisoLora'
import { Riferimenti } from '../componenti/Riferimenti'
import { CAMERA0, ControlloCamera, componiCamera, conLora, type PosizioneCamera } from '../componenti/Camera'
import { daDataUrl, durata, immagineDaIncolla, normalizza, stimaSecondi } from '../util'
import { SISTEMA_MIGLIORA_MODIFICA, fileLoraCamera, loraPer, perQualita, richiestaBase } from '../azioni'
import { categoriePer, type Rapida } from '../rapide'
import type { Bordi } from '@shared/tipi'

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
  const [avanzate, setAvanzate] = useState(false)
  // l'azione rapida scelta: porta con sé forza, trasparenza, riferimenti e i LoRA da accendere
  const [rapida, setRapida] = useState<Rapida | null>(null)
  const [categoria, setCategoria] = useState('persone')
  const [camera, setCamera] = useState<PosizioneCamera>(CAMERA0)
  const [scrivendo, setScrivendo] = useState(false)
  const turbo = useTurbo()

  const base = m.base
  const indice = base ? m.versioni.findIndex((v) => v.percorso === base.percorso) : -1
  const precedente = indice > 0 ? m.versioni[indice - 1] : null
  const successiva = indice >= 0 && indice < m.versioni.length - 1 ? m.versioni[indice + 1] : null
  const { passi } = perQualita(m.qualita)
  const inCorso = lavori.find((l) => l.stato === 'in corso' && attesiModifica.has(l.id))
  const inAttesa = lavori.filter((l) => (l.stato === 'in coda' || l.stato === 'in corso') && attesiModifica.has(l.id)).length
  const forzaRapida = rapida?.forza
  const stima = stimaSecondi(imp?.tempi, m.mp, m.modo === 'zona' && forzaRapida ? Math.max(Math.min(passi, m.qualita === 'turbo' ? 4 : 8), Math.round(passi * forzaRapida)) : passi) * m.quante
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
    if (m.versioni.length > lunghezza.current && m.versioni.length > 1 && usaStato.getState().modifica.modo !== 'nuova') setConfronto(true)
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
  const daPc = async (): Promise<void> => {
    const [p] = await api.file.scegliImmagini(false)
    if (p) void apri(p)
  }
  const daGalleria = async (): Promise<void> => {
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
    setModifica({ base: null, versioni: [], riferimenti: [], prompt: '', modo: 'tutta', bordi: { ...NIENTE } })
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
      if (!s.base) setModifica({ base: f, versioni: [f], riferimenti: [] })
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

  const usaRapida = async (r: Rapida): Promise<void> => {
    setModifica({ prompt: r.prompt })
    setRapida(r)
    // le azioni con una foto di riferimento la chiedono subito (dalla galleria o dal PC)
    if (r.rif && usaStato.getState().modifica.riferimenti.length < r.rif) {
      const nuove = await scegliFoto(r.rif > 1)
      if (nuove.length) setModifica({ riferimenti: [...usaStato.getState().modifica.riferimenti, ...nuove].slice(0, 9) })
    }
    if (r.completa) {
      setTimeout(() => {
        const t = prompt.current
        if (!t) return
        t.focus()
        const i = r.prompt.indexOf('…')
        if (i >= 0) t.setSelectionRange(i, i + 1)
      }, 30)
    }
  }

  /** il comando Camera scrive il prompt da solo, e porta il LoRA delle angolazioni se c'è */
  const cambiaCamera = (c: PosizioneCamera): void => {
    setCamera(c)
    const lora = !!fileLoraCamera()
    const p = componiCamera(c, lora)
    setModifica({ prompt: p })
    setRapida(p ? { id: 'camera', nome: 'Camera', prompt: p, lora: lora && conLora(c) ? ['camera'] : [] } : null)
  }

  const migliora = async (): Promise<void> => {
    if (!base || !m.prompt.trim()) return
    setScrivendo(true)
    try {
      const t = await api.testo.scrivi({ ...richiestaBase(), modalita: 'descrivi', prompt: m.prompt, immagini: [base.percorso], sistema: SISTEMA_MIGLIORA_MODIFICA, maxToken: 200, etichetta: 'Migliora istruzione' })
      if (t) setModifica({ prompt: t })
    } catch (e) {
      avvisa((e as Error).message, 'errore')
    } finally {
      setScrivendo(false)
    }
  }

  async function manda(): Promise<void> {
    const s = usaStato.getState().modifica
    if (!s.base) return
    if (s.modo === 'nuova' && !s.prompt.trim()) {
      avvisa('Scrivi cosa deve nascere dalle foto (es. "le due persone di <image1> e <image2> in spiaggia")', 'errore')
      return
    }
    if (s.modo !== 'espandi' && !s.prompt.trim()) {
      avvisa('Scrivi cosa cambiare (o scegli un\'azione rapida)', 'errore')
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
    const base0 = richiestaBase()
    // i LoRA che l'azione accende da sola (coerenza, cambio vestito, camera) si aggiungono a quelli che hai acceso
    const extra = loraPer(rapida?.lora).filter((x) => !base0.lora.some((l) => l.file === x.file))
    const q = {
      ...base0,
      lora: [...base0.lora, ...extra],
      modalita: (s.modo === 'tutta' ? 'modifica' : s.modo === 'nuova' ? 'crea' : s.modo) as 'modifica' | 'zona' | 'espandi' | 'crea',
      prompt: conParoleLora(s.prompt.trim()),
      immagini: [s.base.percorso, ...s.riferimenti.map((r) => r.percorso)],
      megapixel: s.mp,
      ...perQualita(s.qualita),
      quante: s.quante,
      origine: s.base.operaId,
      etichetta: (rapida && rapida.id !== 'camera' ? rapida.nome + ' · ' : rapida ? 'Camera · ' : '') + (s.prompt.trim().slice(0, 50) || 'Espandi')
    }
    if (s.modo === 'tutta') Object.assign(q, { trasparente: !!rapida?.trasparente })
    if (s.modo === 'nuova') {
      // un'immagine nuova che prende dalle foto (persone, oggetti, stile…): stesse proporzioni della foto principale
      const px = s.mp * 1048576
      const ar = s.base.larghezza / s.base.altezza
      const t = (x: number): number => Math.max(256, Math.round(x / 32) * 32)
      Object.assign(q, { larghezza: t(Math.sqrt(px * ar)), altezza: t(Math.sqrt(px / ar)) })
    }
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
          <div style={{ width: 470 }}>
            <Segmenti<ModoModifica>
              valore={m.modo}
              cambia={(modo) => setModifica({ modo })}
              voci={[
                { id: 'tutta', nome: 'Tutta la foto' },
                { id: 'zona', nome: 'Solo una zona' },
                { id: 'espandi', nome: 'Espandi' },
                { id: 'nuova', nome: 'Nuova dalle foto' }
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
          {base && <button className="btn piccolo icona" onClick={() => tela.current?.adatta()} title="Adatta alla finestra"><I.adatta /></button>}
          <button className="btn piccolo" onClick={daGalleria} title="Scegli una foto dalla galleria"><I.galleria /> Dalla galleria</button>
          <button className="btn piccolo" onClick={daPc} title="Apri una foto dal PC"><I.immagine /> Dal PC</button>
          {base && (
            <button className="btn piccolo pericolo" onClick={togliFoto} title="Toglie la foto e rimette la pagina com'era appena aperta (le versioni restano in galleria)">
              <I.x /> Togli foto
            </button>
          )}
        </div>

        {!base ? (
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
            confronto={confrontoAttivo && precedente ? { prima: urlFile(precedente.percorso) } : undefined}
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
                    <button className={`btn piccolo ${confrontoAttivo ? 'attivo' : ''}`} onClick={() => setConfronto(!confronto)} title="Prima e dopo, con la linea da trascinare">
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

        {m.versioni.length > 0 && (
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

      <div className="colonna destra">
        <div className="scorri">
          <div className="sezione">
            <h3>
              {m.modo === 'nuova' ? 'Cosa creare con le foto' : m.modo === 'espandi' ? 'Cosa c\'è fuori (facoltativo)' : m.modo === 'zona' ? 'Cosa fare nella zona' : 'Cosa cambiare'}
              {m.modo === 'zona' && <span className="dx">{haMaschera ? <span className="oro">zona segnata ✓</span> : 'segnala col pennello'}</span>}
            </h3>
            <textarea
              ref={prompt}
              value={m.prompt}
              onChange={(e) => {
                setModifica({ prompt: e.target.value })
                if (!e.target.value.trim()) setRapida(null)
              }}
              placeholder={m.modo === 'nuova' ? 'es. "la ragazza di <image1> con la giacca di <image2> in una strada di Tokyo di notte"' : m.modo === 'zona' ? 'es. "una camicia di lino bianca" o "rimuovi la persona"' : m.modo === 'espandi' ? 'es. "una spiaggia al tramonto"' : 'es. "fallo di notte con la neve", "metti la maglia di <image2>"'}
              style={{ minHeight: 96 }}
              disabled={scrivendo}
            />
            <div className="riga a-capo" style={{ marginTop: 8 }}>
              <button className="btn piccolo" onClick={migliora} disabled={!base || scrivendo || !m.prompt.trim()} title="Il modello guarda la foto e rende l'istruzione precisa (in inglese)">
                <I.bacchetta /> {scrivendo ? 'Scrivo…' : 'Migliora'}
              </button>
              {m.riferimenti.map((_, i) => (
                <button key={i} className="chip" onClick={() => inserisci(`<image${i + 2}>`)} title="Inserisci il riferimento nel testo">&lt;image{i + 2}&gt;</button>
              ))}
            </div>
            {mancaRif && (
              <div className="avviso-box" style={{ marginTop: 10, padding: '8px 10px', fontSize: 13.5 }}>
                Serve {rapida?.rifNome || 'una foto di riferimento'}: aggiungila qui sotto in <b>Riferimenti</b> (nel testo è <b>&lt;image2&gt;</b>).
              </div>
            )}
          </div>

          {m.modo !== 'espandi' && m.modo !== 'nuova' && (
            <div className="sezione">
              <h3>Azioni rapide <span className="dx">un clic = istruzione pronta</span></h3>
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
                  <button key={r.id} className={`chip ${rapida?.id === r.id ? 'su' : ''}`} onClick={() => void usaRapida(r)} title={r.rif ? `Serve ${r.rifNome || 'una foto di riferimento'}` : r.prompt}>
                    {r.rif ? '＋ ' : ''}{r.nome}
                  </button>
                ))}
              </div>
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

          <div className="sezione">
            <Riferimenti
              lista={m.riferimenti}
              cambia={(riferimenti) => setModifica({ riferimenti })}
              inizio={2}
              inserisci={inserisci}
              comeBase={comeBase}
              titolo={m.modo === 'nuova' ? 'Altre foto' : 'Riferimenti'}
              esempio={m.modo === 'nuova' ? 'La foto principale è <image1>, le altre <image2>…: persone, vestiti, oggetti, luoghi, stili. Il risultato è un\'immagine completamente nuova.' : 'Es. "metti a <image1> la giacca di <image2>". Persone, vestiti, oggetti, stili: fino a 9 foto in più (dalla galleria, dal PC o incollate con Ctrl+V).'}
            />
          </div>

          {m.modo === 'zona' && (
            <div className="sezione">
              <div className="nota-zona">
                <I.occhio /> Il modello guarda <b>tutta la foto</b> con la tua zona evidenziata e cambia <b>solo lì</b>: fuori dalla zona la foto resta identica al pixel.
                Per togliere qualcosa scrivi "rimuovi…": la zona si ripulisce da sola prima di ridisegnarla.
              </div>
            </div>
          )}

          <div className="sezione">
            <h3>Qualità <span className="dx">{passi} passi · ~{durata(stima)}</span></h3>
            <div>
              <Segmenti<Qualita>
                valore={m.qualita}
                cambia={(qualita) => setModifica({ qualita })}
                voci={[
                  { id: 'turbo', nome: <><I.fulmine /> Turbo</>, sotto: '8 passi', titolo: 'LoRA Turbo8: circa 5 volte più veloce' },
                  { id: 'bozza', nome: 'Veloce', sotto: '20 passi' },
                  { id: 'alta', nome: 'Alta', sotto: '40 passi' },
                  { id: 'massima', nome: 'Massima', sotto: '50 passi' }
                ]}
              />
              {m.qualita === 'turbo' && <AvvisoTurbo />}
            </div>
            <div className="riga spazia" style={{ marginTop: 10 }}>
              <span className="tenue">Quante versioni</span>
              <Contatore valore={m.quante} min={1} max={8} cambia={(quante) => setModifica({ quante })} />
            </div>
            <h3 style={{ cursor: 'pointer', marginTop: 12, marginBottom: avanzate ? 9 : 0 }} onClick={() => setAvanzate(!avanzate)}>
              {avanzate ? '▾' : '▸'} Avanzate <span className="dx">{m.mp === 1 ? '' : `${String(m.mp).replace('.', ',')} MP`}</span>
            </h3>
            {avanzate && (
              <Segmenti
                valore={m.mp}
                cambia={(mp) => setModifica({ mp })}
                voci={[
                  { id: 0.25, nome: '0,25', sotto: 'lampo', titolo: '0,25 MP (512×512): per provare al volo' },
                  { id: 0.5, nome: '0,5', sotto: 'veloce' },
                  { id: 1, nome: '1 MP', sotto: 'consigliato' },
                  { id: 2, nome: '2 MP', sotto: 'dettaglio' },
                  { id: 4, nome: '4 MP', sotto: 'lento' }
                ]}
              />
            )}
          </div>

          <div className="sezione">
            <h3>LoRA</h3>
            <SceltaLora />
          </div>
        </div>
        <div className="sezione" style={{ borderTop: '1px solid #1d1636' }}>
          <button className="btn primario grande" style={{ width: '100%' }} onClick={manda} disabled={!base}>
            {m.modo === 'zona' ? <I.zona /> : m.modo === 'espandi' ? <I.espandi /> : m.modo === 'nuova' ? <I.crea /> : <I.modifica />}
            {m.modo === 'zona' ? 'Cambia la zona' : m.modo === 'espandi' ? 'Espandi' : m.modo === 'nuova' ? 'Crea dalle foto' : 'Modifica'}
          </button>
          <div className="piccolo spento" style={{ textAlign: 'center', marginTop: 6 }}>Ctrl+Invio · ~{durata(stima)}</div>
        </div>
      </div>
    </div>
  )
}
