// Le sezioni di Crea fatte a tessere/pulsanti, condivise con il modo Box (stesso formato, stessa misura, stesso sfondo):
// Formato (la forma del rettangolo in scala), Misura (S · M · L · XL · MAX coi pixel veri), Sfondo, Quante + Seed, e il HUD con il suo popover.
import { useState, type JSX } from 'react'
import { usaStato } from '../stato'
import { I } from './Icone'
import { Hud } from './Hud'
import { Tessera, Tessere, PulsanteS } from './Tessere'
import { SceltaMisura, ScegliMp, MISURA0, Uscita } from './Misura'
import { FORMATI, dimensioniRis } from '../util'
import { misuraCrea } from '../misura'

export const TAGLIE: { ris: number; nome: string; titolo: string }[] = [
  { ris: 512, nome: 'S', titolo: 'Lato corto 512 px: veloce, per provare' },
  { ris: 768, nome: 'M', titolo: 'Lato corto 768 px' },
  { ris: 1024, nome: 'L', titolo: 'Lato corto 1024 px: l\'equilibrio giusto' },
  { ris: 1440, nome: 'XL', titolo: 'Lato corto 1440 px: per testi piccoli, poster e infografiche' },
  { ris: 2048, nome: 'MAX', titolo: 'Il massimo nativo (4,2 MP): lento su 6-8 GB' }
]
/** le misure «bozza» di prima (256 … 1080), dietro il lampo */
const BOZZE: number[] = [256, 384, 480, 576, 720, 1080]

export function SezFormato(): JSX.Element {
  const { crea, setCrea } = usaStato()
  return (
    <div className="formati" role="radiogroup" aria-label="Formato">
      {FORMATI.map((f) => {
        const k = 24 / Math.max(f.w, f.h)
        return (
          <button key={f.id} type="button" role="radio" aria-checked={crea.formato === f.id} className={`formato ${crea.formato === f.id ? 'su' : ''}`} onClick={() => setCrea({ formato: f.id, misura: crea.misura?.tipo === 'custom' ? MISURA0 : crea.misura })} title={`${f.nome} (${f.id})`} data-formato={f.id}>
            <i style={{ width: f.w * k, height: f.h * k }} />
            {f.id}
          </button>
        )
      })}
    </div>
  )
}

export function SezMisura(): JSX.Element {
  const { crea, setCrea } = usaStato()
  const [bozze, setBozze] = useState(false)
  const bozzaAttiva = BOZZE.includes(crea.ris) || !TAGLIE.some((t) => t.ris === crea.ris)
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="riga-s">
        {TAGLIE.map((t) => {
          const d = dimensioniRis(crea.formato, t.ris)
          return <PulsanteS key={t.ris} nome={t.nome} sotto={`${d.w}×${d.h}`} su={crea.ris === t.ris} titolo={`${t.titolo}: ${d.w} × ${d.h} px`} onClick={() => setCrea({ ris: t.ris, misura: crea.misura?.tipo === 'custom' ? MISURA0 : crea.misura })} />
        })}
        <PulsanteS nome="⚡" sotto="bozza" su={bozzaAttiva} onClick={() => setBozze(!bozze)} titolo="Bozze veloci: 256p … 1080p" />
      </div>
      {(bozze || (bozzaAttiva && BOZZE.includes(crea.ris))) && (
        <div className="riga-s">
          {BOZZE.map((r) => {
            const d = dimensioniRis(crea.formato, r)
            return <PulsanteS key={r} nome={r === 1080 ? 'FHD' : `${r}p`} sotto={`${d.w}×${d.h}`} su={crea.ris === r} onClick={() => setCrea({ ris: r, misura: crea.misura?.tipo === 'custom' ? MISURA0 : crea.misura })} />
          })}
        </div>
      )}
    </div>
  )
}

const TINTE = ['#ffffff', '#f2f2f2', '#000000', '#e63946', '#f4a261', '#ffd54a', '#2a9d8f', '#3fe0ff', '#8a5cff', '#ff3df2']

export function SezSfondo(): JSX.Element {
  const { crea, setCrea, imp } = usaStato()
  const klein = (imp?.famiglia || 'qwen') !== 'qwen'
  const scegli = (sfondo: 'scena' | 'trasparente' | 'tinta'): void => setCrea({ sfondo, trasparente: sfondo === 'trasparente' })
  return (
    <div className="col" style={{ gap: 8 }}>
      <Tessere colonne={3}>
        <Tessera id="sfondo-scena" icona={<I.scena />} nome="Scena" titolo="L'immagine con il suo sfondo" su={crea.sfondo === 'scena'} onClick={() => scegli('scena')} />
        <Tessera id="sfondo-trasparente" icona={<I.scacchi />} nome="Senza sfondo" titolo="PNG con trasparenza vera: solo il soggetto" su={crea.sfondo === 'trasparente'} onClick={() => scegli('trasparente')} />
        <Tessera id="sfondo-tinta" icona={<I.tinta />} nome="Tinta unita" titolo="Il soggetto su un colore pieno (prodotti, sticker)" su={crea.sfondo === 'tinta'} onClick={() => scegli('tinta')} />
      </Tessere>
      {crea.sfondo === 'tinta' && (
        <div className="campioni" role="radiogroup" aria-label="Colore dello sfondo">
          {TINTE.map((c) => (
            <button key={c} type="button" className={crea.tinta === c ? 'su' : ''} style={{ background: c, outline: '1px solid #4a3f8a' }} onClick={() => setCrea({ tinta: c })} title={c} />
          ))}
          <input type="color" value={crea.tinta} onChange={(e) => setCrea({ tinta: e.target.value })} aria-label="Altro colore" style={{ width: 28, height: 24, padding: 0, border: 0, background: 'none' }} />
        </div>
      )}
      {crea.sfondo === 'trasparente' && (
        <div className="riga-s" role="radiogroup" aria-label="Come guardare la trasparenza">
          {([['scacchi', 'Scacchi'], ['bianco', 'Bianco'], ['nero', 'Nero'], ['colore', 'Colore']] as const).map(([id, nome]) => (
            <PulsanteS key={id} nome={<span style={{ fontSize: 12.5 }}>{nome}</span>} su={crea.anteSfondo === id} onClick={() => setCrea({ anteSfondo: id })} titolo="Cambia solo la vista, non il file" />
          ))}
        </div>
      )}
      {crea.sfondo === 'trasparente' && klein && (
        <div className="avviso-box" style={{ margin: 0, fontSize: 13 }}>Klein non disegna la trasparenza da sé: crea il soggetto su fondo pulito e il motore toglie lo sfondo dopo (serve il motore v2). Con Qwen il PNG è già trasparente.</div>
      )}
    </div>
  )
}

export function SezQuante(): JSX.Element {
  const { crea, setCrea } = usaStato()
  return (
    <div className="riga-s" style={{ alignItems: 'stretch' }}>
      {[1, 2, 4, 8].map((n) => (
        <PulsanteS key={n} nome={String(n)} su={crea.quante === n || (n === 4 && crea.quante === 3)} onClick={() => setCrea({ quante: n })} titolo={n === 1 ? 'Una immagine' : `${n} immagini, una dopo l'altra`} />
      ))}
      <button type="button" className="pulsante-s" onClick={() => setCrea({ casuale: !crea.casuale })} title={crea.casuale ? 'Seed casuale a ogni immagine (clic: fissa il seed)' : 'Seed fisso (clic: torna casuale)'} aria-pressed={!crea.casuale}>
        {crea.casuale ? <I.dado /> : <I.lucchetto />}
        <small>{crea.casuale ? 'dado' : 'fisso'}</small>
      </button>
    </div>
  )
}

/** Il HUD con il popover «Misura»: la cifra che vedi è quella che esce, e un clic apre le scelte */
export function HudCrea(): JSX.Element {
  const { crea, setCrea } = usaStato()
  const [aperto, setAperto] = useState(false)
  const m = misuraCrea(crea)
  const mis = crea.misura?.tipo === 'custom' ? crea.misura : null
  return (
    <>
      <Hud d={{ w: m.finale.w, h: m.finale.h, rapporto: m.rapporto, mp: m.mp, stato: m.stato, nota: m.nota }} onClick={() => setAperto(!aperto)} titolo="Clic per cambiare formato e misura" />
      {aperto && (
        <div className="hud-pop" onMouseLeave={() => undefined}>
          <div className="riga spazia"><b className="tenue" style={{ letterSpacing: 1.2, fontSize: 12 }}>MISURA</b><button className="btn piccolo fantasma icona" onClick={() => setAperto(false)} aria-label="Chiudi"><I.x /></button></div>
          <SezFormato />
          <SezMisura />
          <div>
            <span className="piccolo tenue">Megapixel a cui disegna il modello</span>
            <ScegliMp mp={crea.mpLavoro} cambia={(mpLavoro) => setCrea({ mpLavoro })} ar={{ w: m.finale.w, h: m.finale.h }} auto="come la misura" />
          </div>
          <div>
            <span className="piccolo tenue">Misura precisa {mis ? '(attiva)' : ''}</span>
            <SceltaMisura valore={crea.misura ?? MISURA0} cambia={(misura) => setCrea({ misura })} base={null} mp={Math.round((m.lav.w * m.lav.h) / 1e5) / 10} ammetti={['auto', 'custom']} auto={{ w: m.lav.w, h: m.lav.h }} senzaUscita />
          </div>
          <Uscita w={m.finale.w} h={m.finale.h} nota={m.stato !== 'nativa' ? m.nota : undefined} />
        </div>
      )}
    </>
  )
}
