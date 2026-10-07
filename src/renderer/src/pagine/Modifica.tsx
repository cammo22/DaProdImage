// Modifica: tutta la foto, solo una zona (la segni col pennello) o allargarla oltre i bordi.
import { useEffect, useRef, useState, type JSX } from 'react'
import { usaStato, attesiModifica, type ModoModifica, type Qualita, type FotoBase } from '../stato'
import { api, urlFile } from '../api'
import { I } from '../componenti/Icone'
import { Contatore, Cursore, Interruttore, Segmenti } from '../componenti/Controlli'
import { SceltaLora, conParoleLora } from '../componenti/SceltaLora'
import { TelaMaschera, type AnteprimaTela, type ComandiTela, type Strumento } from '../componenti/TelaMaschera'
import { PrimaDopo } from '../componenti/PrimaDopo'
import { AvvisoTurbo, useTurbo } from '../componenti/Turbo'
import { PannelloLavoro } from './Crea'
import { daDataUrl, durata, immagineDaIncolla, normalizza, stimaSecondi } from '../util'
import { SISTEMA_MIGLIORA_MODIFICA, perQualita, richiestaBase } from '../azioni'
import type { Bordi } from '@shared/tipi'

interface Rapida {
  nome: string
  prompt: string
  completa?: boolean // il prompt va finito dall'utente (finisce con "…")
  trasparente?: boolean
  segna?: boolean
  /** riempie la zona prima (rimuovere: il modello non vede più l'oggetto) */
  riempi?: boolean
  forza?: number
}

const RAPIDE_TUTTA: Rapida[] = [
  { nome: 'Rimuovi sfondo', prompt: 'Remove the background, and output a PNG image', trasparente: true },
  { nome: 'Cambia sfondo', prompt: 'Replace the background with …, keep the subject exactly the same', completa: true },
  { nome: 'Restaura foto', prompt: 'Restore this old photo: remove scratches, dust, noise and blur, sharpen the details and fix the faded colors. Keep the people and the composition identical.' },
  { nome: 'Colora B/N', prompt: 'Colorize this black and white photo with natural, realistic colors. Keep everything else identical.' },
  { nome: 'Luce da studio', prompt: 'Relight the photo with soft professional studio lighting and a natural color grade. Keep the subject, pose and composition identical.' },
  { nome: 'Più dettagli', prompt: 'Enhance the image quality: sharper details, cleaner textures, no noise or compression artifacts. Keep everything identical.' },
  { nome: 'Cambia testo…', prompt: 'Replace the text "…" with "", keeping the same font, size, color, perspective and position.', completa: true },
  { nome: 'Traduci testo…', prompt: 'Translate all the text in the image into …, keeping the same fonts, layout, colors and style. Change nothing else.', completa: true },
  { nome: 'Togli scritte', prompt: 'Remove all text, captions, logos and watermarks from the image, filling those areas naturally. Keep everything else identical.' },
  { nome: 'Sorriso', prompt: 'Make the person smile naturally. Keep the identity, hair, clothes and everything else unchanged.' },
  { nome: 'Anime', prompt: 'Transform this image into a high quality anime illustration style. Keep the composition and the subject.' },
  { nome: 'Acquerello', prompt: 'Transform this image into a delicate watercolor painting. Keep the composition and the subject.' },
  { nome: 'Pittura a olio', prompt: 'Transform this image into a classical oil painting with visible brush strokes. Keep the composition and the subject.' },
  { nome: '3D cartoon', prompt: 'Transform this image into a 3D animated movie style render. Keep the composition and the subject.' },
  { nome: 'Foto realistica', prompt: 'Turn this into a photorealistic photograph with natural lighting and real textures. Keep the composition and the subject.' }
]
const RAPIDE_ZONA: Rapida[] = [
  { nome: 'Rimuovi oggetto', prompt: 'Remove the object completely and fill the area with the surrounding background so it looks natural and untouched.', segna: true, riempi: true },
  { nome: 'Scrivi testo…', prompt: 'Write the text "…" in this area, with lettering that matches the style, perspective and lighting of the image.', completa: true },
  { nome: 'Sostituisci con…', prompt: 'Replace it with …', completa: true, segna: true },
  { nome: 'Cambia colore…', prompt: 'Change its color to …', completa: true },
  { nome: 'Aggiungi…', prompt: 'Add … in this area, matching the lighting and perspective of the scene', completa: true, segna: true },
  { nome: 'Ritocca', prompt: 'Clean up and retouch this area naturally: remove blemishes and defects, keep it realistic.', forza: 0.6 },
  { nome: 'Cambia vestito…', prompt: 'Change the clothing to …', completa: true }
]

const NIENTE: Bordi = { sinistra: 0, sopra: 0, destra: 0, sotto: 0 }

export function Modifica(): JSX.Element {
  const { modifica: m, setModifica, imp, lavori, avvisa, vai } = usaStato()
  const tela = useRef<ComandiTela>(null)
  const prompt = useRef<HTMLTextAreaElement>(null)
  const [strumento, setStrumento] = useState<Strumento>('pennello')
  const [pennello, setPennello] = useState(60)
  const [haMaschera, setHaMaschera] = useState(false)
  const [confronto, setConfronto] = useState(false)
  const [scrivendo, setScrivendo] = useState(false)
  const [rapidaTrasp, setRapidaTrasp] = useState(false)
  const turbo = useTurbo()

  const base = m.base
  const indice = base ? m.versioni.findIndex((v) => v.percorso === base.percorso) : -1
  const precedente = indice > 0 ? m.versioni[indice - 1] : null
  const { passi } = perQualita(m.qualita)
  const inCorso = lavori.find((l) => l.stato === 'in corso' && attesiModifica.has(l.id))
  const inAttesa = lavori.filter((l) => (l.stato === 'in coda' || l.stato === 'in corso') && attesiModifica.has(l.id)).length
  const stima = stimaSecondi(imp?.tempi, m.mp, m.modo === 'zona' ? Math.max(Math.min(passi, m.qualita === 'turbo' ? 4 : 8), Math.round(passi * m.forza)) : passi) * m.quante

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

  // pennello proporzionato alla foto
  useEffect(() => {
    if (base) setPennello(Math.max(8, Math.round(Math.min(base.larghezza, base.altezza) / 16)))
    setConfronto(false)
  }, [base?.percorso])

  // cambiando modo si torna alla tela (per disegnare la zona o vedere la cornice)
  useEffect(() => {
    setConfronto(false)
  }, [m.modo])

  // un risultato nuovo: si mostra il confronto
  useEffect(() => {
    if (indice > 0 && indice === m.versioni.length - 1) setConfronto(true)
  }, [m.versioni.length])

  const apri = async (percorso: string): Promise<void> => {
    try {
      const f = await normalizza(percorso)
      setModifica({ base: f, versioni: [f], riferimenti: [] })
    } catch (e) {
      avvisa((e as Error).message, 'errore')
    }
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

  const usaRapida = (r: Rapida): void => {
    setModifica({
      prompt: r.prompt,
      ...(r.segna !== undefined ? { segnaZona: r.segna } : {}),
      ...(m.modo === 'zona' ? { riempi: !!r.riempi } : {}),
      ...(r.forza ? { forza: r.forza } : { forza: m.modo === 'zona' ? 1 : m.forza })
    })
    setRapidaTrasp(!!r.trasparente)
    if (r.completa) {
      setTimeout(() => {
        const t = prompt.current
        if (!t) return
        t.focus()
        const i = r.prompt.indexOf('…')
        t.setSelectionRange(i, i + 1)
      }, 30)
    }
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
    if (s.modo !== 'espandi' && !s.prompt.trim()) {
      avvisa('Scrivi cosa cambiare (o scegli un\'azione rapida)', 'errore')
      return
    }
    if (s.qualita === 'turbo' && !turbo.presente) {
      avvisa('Per il Turbo scarica prima il suo LoRA (il pulsante sotto Area di lavoro), o scegli Alta', 'errore')
      return
    }
    const q = {
      ...richiestaBase(),
      modalita: (s.modo === 'tutta' ? 'modifica' : s.modo) as 'modifica' | 'zona' | 'espandi',
      prompt: conParoleLora(s.prompt.trim()),
      immagini: [s.base.percorso, ...s.riferimenti.map((r) => r.percorso)],
      megapixel: s.mp,
      ...perQualita(s.qualita),
      quante: s.quante,
      origine: s.base.operaId,
      etichetta: s.prompt.trim().slice(0, 60) || 'Espandi'
    }
    if (s.modo === 'tutta') Object.assign(q, { trasparente: rapidaTrasp && /background/i.test(s.prompt) })
    if (s.modo === 'zona') {
      const e = tela.current?.esporta()
      if (!e) {
        avvisa('Segna prima la zona da cambiare col pennello', 'errore')
        return
      }
      const maschera = await api.file.salvaTemp(e.dataUrl)
      Object.assign(q, { maschera, riquadro: e.riquadro, contesto: s.contesto, ritaglia: s.ritaglia, segnaZona: s.segnaZona, riempi: s.riempi, forza: s.forza, sfuma: s.sfuma, allarga: s.allarga })
    }
    if (s.modo === 'espandi') {
      const b = s.bordi
      if (!b.sinistra && !b.destra && !b.sopra && !b.sotto) {
        avvisa('Scegli di quanto allargare la foto', 'errore')
        return
      }
      Object.assign(q, { bordi: b, forza: 1 })
    }
    const ids = await api.lavori.accoda(q)
    ids.forEach((id) => attesiModifica.add(id))
  }

  const aggiungiRif = async (): Promise<void> => {
    const ps = await api.file.scegliImmagini(true)
    const nuovi: FotoBase[] = []
    for (const p of ps.slice(0, 9 - m.riferimenti.length)) nuovi.push(await normalizza(p))
    if (nuovi.length) setModifica({ riferimenti: [...m.riferimenti, ...nuovi] })
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
  const rapide = m.modo === 'zona' ? RAPIDE_ZONA : m.modo === 'tutta' ? RAPIDE_TUTTA : []

  return (
    <div className="pagina">
      <div
        className="editor"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const f = e.dataTransfer.files[0]
          if (f) void apri(api.file.percorso(f))
        }}
      >
        <div className="attrezzi">
          <div style={{ width: 340 }}>
            <Segmenti<ModoModifica>
              valore={m.modo}
              cambia={(modo) => setModifica({ modo })}
              voci={[
                { id: 'tutta', nome: 'Tutta la foto' },
                { id: 'zona', nome: 'Solo una zona' },
                { id: 'espandi', nome: 'Espandi' }
              ]}
            />
          </div>
          {disegna && base && (
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
          {base && precedente && (
            <button className={`btn piccolo ${confronto ? 'attivo' : ''}`} onClick={() => setConfronto(!confronto)} title="Confronta con la versione prima">
              <I.occhio /> Prima/dopo
            </button>
          )}
          {base && <button className="btn piccolo icona" onClick={() => tela.current?.adatta()} title="Adatta alla finestra"><I.adatta /></button>}
          <button className="btn piccolo" onClick={async () => { const [p] = await api.file.scegliImmagini(false); if (p) void apri(p) }}>
            <I.immagine /> {base ? 'Cambia foto' : 'Apri foto'}
          </button>
        </div>

        {!base ? (
          <div className="tela" style={{ display: 'grid', placeItems: 'center', cursor: 'default' }}>
            <div className="vuoto">
              <div className="grosso">MODIFICA UNA <b>FOTO</b></div>
              <p>Trascina qui una foto, incollala con <kbd>Ctrl</kbd>+<kbd>V</kbd>, o aprila.</p>
              <p className="piccolo">Cambi tutta la foto con una frase, o segni col pennello solo la zona da cambiare: il resto resta identico al pixel.</p>
              <div className="riga" style={{ justifyContent: 'center', marginTop: 14 }}>
                <button className="btn primario" onClick={async () => { const [p] = await api.file.scegliImmagini(false); if (p) void apri(p) }}><I.immagine /> Apri una foto</button>
                <button className="btn" onClick={() => vai('galleria')}><I.galleria /> Dalla galleria</button>
              </div>
            </div>
          </div>
        ) : confronto && precedente && !inCorso ? (
          <div className="tela" style={{ display: 'grid', placeItems: 'center', padding: 20, cursor: 'default' }}>
            <PrimaDopo prima={urlFile(precedente.percorso)} dopo={urlFile(base.percorso)} stile={{ maxHeight: 'calc(100vh - 230px)', maxWidth: '100%' }} />
          </div>
        ) : (
          <TelaMaschera
            ref={tela}
            url={urlFile(base.percorso)}
            larghezza={base.larghezza}
            altezza={base.altezza}
            strumento={strumento}
            dimensione={pennello}
            disegna={disegna && !inCorso}
            bordi={qi?.modalita === 'espandi' && anteprima ? qi.bordi : m.modo === 'espandi' ? m.bordi : undefined}
            cambiaMaschera={setHaMaschera}
            cambiaDimensione={setPennello}
            anteprima={anteprima}
          >
            {inCorso && (
              <div className="in-corso-tela" onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
                <PannelloLavoro l={inCorso} />
              </div>
            )}
          </TelaMaschera>
        )}

        {m.versioni.length > 0 && (
          <div className="versioni">
            {m.versioni.map((v, i) => (
              <div key={v.percorso} className={`v ${v.percorso === base?.percorso ? 'su' : ''}`} style={{ ['--ar' as string]: `${v.larghezza} / ${v.altezza}` }} onClick={() => setModifica({ base: v })} title={v.prompt}>
                <img src={urlFile(v.percorso)} alt="" />
                <span>{i === 0 ? 'Originale' : `v${i + 1}`}</span>
              </div>
            ))}
            {inAttesa > 0 && <span className="piccolo oro">+{inAttesa} in arrivo…</span>}
            <span className="flex1" />
            {base && indice > 0 && <span className="piccolo tenue">Continua a modificare da qui: ogni modifica parte dalla versione scelta.</span>}
          </div>
        )}
      </div>

      <div className="colonna destra">
        <div className="scorri">
          <div className="sezione">
            <h3>
              {m.modo === 'espandi' ? 'Cosa c\'è fuori (facoltativo)' : m.modo === 'zona' ? 'Cosa fare nella zona' : 'Cosa cambiare'}
              {m.modo === 'zona' && <span className="dx">{haMaschera ? <span className="oro">zona segnata ✓</span> : 'segnala col pennello'}</span>}
            </h3>
            <textarea
              ref={prompt}
              value={m.prompt}
              onChange={(e) => setModifica({ prompt: e.target.value })}
              placeholder={m.modo === 'zona' ? 'es. "una camicia di lino bianca" o "rimuovi la persona"' : m.modo === 'espandi' ? 'es. "una spiaggia al tramonto"' : 'es. "fallo di notte con la neve", "metti la maglia di <image2>"'}
              style={{ minHeight: 100 }}
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
            {rapide.length > 0 && (
              <div className="riga a-capo" style={{ marginTop: 10, gap: 6 }}>
                {rapide.map((r) => (
                  <button key={r.nome} className={`chip ${m.prompt === r.prompt ? 'su' : ''}`} onClick={() => usaRapida(r)}>{r.nome}</button>
                ))}
              </div>
            )}
          </div>

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
            <h3>Riferimenti <span className="dx">{m.riferimenti.length}/9 · nel testo: &lt;image2&gt;…</span></h3>
            <div className="rif">
              {m.riferimenti.map((r, i) => (
                <div className="r" key={r.percorso}>
                  <img src={urlFile(r.percorso)} alt="" />
                  <span className="n" onClick={() => inserisci(`<image${i + 2}>`)}>&lt;image{i + 2}&gt;</span>
                  <button className="x" onClick={() => setModifica({ riferimenti: m.riferimenti.filter((_, j) => j !== i) })}><I.x /></button>
                </div>
              ))}
              {m.riferimenti.length < 9 && (
                <button
                  className="aggiungi"
                  onClick={aggiungiRif}
                  title="Aggiungi foto di riferimento (vestiti, persone, stili, oggetti)"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const fs = Array.from(e.dataTransfer.files).slice(0, 9 - m.riferimenti.length)
                    const n: FotoBase[] = []
                    for (const f of fs) n.push(await normalizza(api.file.percorso(f)))
                    setModifica({ riferimenti: [...usaStato.getState().modifica.riferimenti, ...n] })
                  }}
                >
                  +
                </button>
              )}
            </div>
            {m.riferimenti.length === 0 && <div className="piccolo spento" style={{ marginTop: 6 }}>Es. "metti a &lt;image1&gt; la giacca di &lt;image2&gt;". Fino a 9 foto in più (incollale con Ctrl+V).</div>}
          </div>

          {m.modo === 'zona' && (
            <div className="sezione col" style={{ gap: 10 }}>
              <h3 style={{ margin: 0 }}>Zona</h3>
              <Cursore etichetta="Forza (quanto ridisegnare)" valore={m.forza} min={0.2} max={1} passo={0.05} formato={(v) => `${Math.round(v * 100)}%`} cambia={(forza) => setModifica({ forza })} titolo="100% = ridisegna da zero; più basso tiene forme e colori di prima" />
              <Interruttore acceso={m.ritaglia} cambia={(ritaglia) => setModifica({ ritaglia })} sotto="Lavora solo attorno alla zona, più in grande: molto più dettaglio e più veloce">
                Dettaglio zona (ritaglia)
              </Interruttore>
              {m.ritaglia && <Cursore etichetta="Contesto attorno" valore={m.contesto} min={0.1} max={2} passo={0.1} formato={(v) => `${v.toFixed(1)}×`} cambia={(contesto) => setModifica({ contesto })} titolo="Quanto della foto attorno alla zona vede il modello" />}
              <Cursore etichetta="Bordo morbido" valore={m.sfuma} min={0} max={31} formato={(v) => `${v}px`} cambia={(sfuma) => setModifica({ sfuma })} />
              <Cursore etichetta="Allarga la zona" valore={m.allarga} min={0} max={64} formato={(v) => `${v}px`} cambia={(allarga) => setModifica({ allarga })} />
              <Interruttore acceso={m.riempi} cambia={(riempi) => setModifica({ riempi })} sotto="Per rimuovere: la zona si spalma coi colori attorno prima di ridisegnarla, così il modello non rifà l'oggetto">
                Riempi prima la zona
              </Interruttore>
              <Interruttore acceso={m.segnaZona} cambia={(segnaZona) => setModifica({ segnaZona })} sotto="Sperimentale: il modello vede la zona contornata di rosso (aiuta su 'rimuovi' e 'aggiungi')">
                Mostra la zona al modello
              </Interruttore>
            </div>
          )}

          <div className="sezione">
            <h3>Area di lavoro <span className="dx">{passi} passi · ~{durata(stima)}</span></h3>
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
            <div style={{ marginTop: 10 }}>
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
          </div>

          <div className="sezione">
            <h3>LoRA</h3>
            <SceltaLora />
          </div>
        </div>
        <div className="sezione" style={{ borderTop: '1px solid #1d1636' }}>
          <button className="btn primario grande" style={{ width: '100%' }} onClick={manda} disabled={!base}>
            {m.modo === 'zona' ? <I.zona /> : m.modo === 'espandi' ? <I.espandi /> : <I.modifica />}
            {m.modo === 'zona' ? 'Cambia la zona' : m.modo === 'espandi' ? 'Espandi' : 'Modifica'}
          </button>
          <div className="piccolo spento" style={{ textAlign: 'center', marginTop: 6 }}>Ctrl+Invio · ~{durata(stima)}</div>
        </div>
      </div>
    </div>
  )
}
