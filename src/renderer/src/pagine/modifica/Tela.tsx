// Modifica, la parte a sinistra: barra degli attrezzi, tela (o griglia di Fusion/Esempio, o palco di Estrai) e striscia delle versioni.
// Lo stato vive in Modifica.tsx: qui si disegna e basta.
import { type JSX, type RefObject } from 'react'
import { usaStato, scegliFoto, type FotoBase } from '../../stato'
import { api, urlFile } from '../../api'
import { I } from '../../componenti/Icone'
import { Cursore } from '../../componenti/Controlli'
import { TelaMaschera, type AnteprimaTela, type ComandiTela, type Strumento } from '../../componenti/TelaMaschera'
import { Fusion } from '../../componenti/Fusion'
import { PalcoEstrai } from '../../componenti/Estrai'
import { normalizza } from '../../util'
import { usaLab, usaSpeciale } from '../../workflow'
import { SelettoreModo } from './SelettoreModo'
import { apriInModifica, fotoDaOpera } from '../../azioni'
import type { Lavoro, Opera } from '@shared/tipi'

interface Props {
  tela: RefObject<ComandiTela | null>
  strumento: Strumento
  setStrumento: (s: Strumento) => void
  pennello: number
  setPennello: (n: number) => void
  setHaMaschera: (v: boolean) => void
  confronto: boolean
  setConfronto: (v: boolean) => void
  confrontoAttivo: boolean
  disegna: boolean
  griglia: boolean
  esempioMode: boolean
  estraiMode: boolean
  base: FotoBase | null
  indice: number
  precedente: FotoBase | null
  successiva: FotoBase | null
  inCorso: Lavoro | undefined
  inAttesa: number
  anteprima: AnteprimaTela | undefined
  ris: Opera[]
  fusInCorso: Lavoro | undefined
  fusInAttesa: number
  daGalleria: () => Promise<void>
  daPc: () => Promise<void>
  togliFoto: () => void
  inserisci: (testo: string) => void
  aggiungiFusion: (f: FotoBase[]) => void
}

export function TelaModifica(p: Props): JSX.Element {
  const { modifica: m, setModifica, avvisa } = usaStato()
  const { tela, strumento, setStrumento, pennello, setPennello, setHaMaschera, confronto, setConfronto, confrontoAttivo, disegna, griglia, esempioMode, estraiMode, base, indice, precedente, successiva, inCorso, inAttesa, anteprima, ris, fusInCorso, fusInAttesa, daGalleria, daPc, togliFoto, inserisci, aggiungiFusion } = p
  const qi = inCorso?.richiesta
  const speciale = usaSpeciale()

  return (
    <>
      <div className="attrezzi">
        <SelettoreModo />
        {speciale && (
          <button className="btn piccolo" onClick={() => usaLab.setState({ scelto: null })} title="Torna al catalogo delle ricette">
            ‹ {speciale === 'unisci' ? 'Unisci foto' : "Come l'esempio"} · tutte le ricette
          </button>
        )}
        {disegna && base && !confrontoAttivo && (
          <>
            <span className="sep" />
            <span className="piccolo tenue" title="Segna col pennello la zona da cambiare: senza zona cambia tutta la foto">Zona</span>
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
          apriInModifica={(o) => { apriInModifica(fotoDaOpera(o)); setModifica({ modo: 'scrivi' }) }}
          mostra={(o) => void api.galleria.mostra(o.id)}
        />
      ) : null}
      {griglia || estraiMode ? null : !base ? (
        <div className="tela" style={{ display: 'grid', placeItems: 'center', cursor: 'default' }}>
          <div className="vuoto">
            <div className="grosso">MODIFICA UNA <b>FOTO</b></div>
            <p>Trascina qui una foto, incollala con <kbd>Ctrl</kbd>+<kbd>V</kbd>, o scegline una.</p>
            <p className="piccolo">Scrivi cosa cambiare, o scegli un'idea: cambia tutta la foto. Se prima segni col pennello una zona, cambia solo quella e il resto resta identico al pixel.</p>
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
    </>
  )
}
