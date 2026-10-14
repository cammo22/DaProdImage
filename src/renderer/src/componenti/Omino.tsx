// L'omino: un manichino con le ossa che trascini come vuoi (le articolazioni sono i pallini: il bacino sposta tutto, gli altri
// ruotano l'osso attorno al pallino prima). Clic su una mano per aprirla, chiuderla o muovere le dita una per una.
import { useRef, useState, type JSX } from 'react'
import { Cursore } from './Controlli'
import {
  ALTO, LARGO, MANI_PRONTE, NOMI_DITA, POSE_PRONTE, geometriaMano, posaDi, specchia, trascina,
  type Giunto, type Mano, type Posa, type Punto
} from '../omino'

const OSSA: [Giunto, Giunto, 'c' | 'sx' | 'dx'][] = [
  ['bacino', 'collo', 'c'], ['collo', 'testa', 'c'], ['collo', 'spSx', 'sx'], ['spSx', 'gomSx', 'sx'], ['gomSx', 'polSx', 'sx'],
  ['collo', 'spDx', 'dx'], ['spDx', 'gomDx', 'dx'], ['gomDx', 'polDx', 'dx'],
  ['bacino', 'ancaSx', 'sx'], ['ancaSx', 'ginSx', 'sx'], ['ginSx', 'cavSx', 'sx'], ['bacino', 'ancaDx', 'dx'], ['ancaDx', 'ginDx', 'dx'], ['ginDx', 'cavDx', 'dx']
]
const COLORE = { c: '#e9e4ff', sx: '#ffb24a', dx: '#5ec8ff' }
const SPIEGA: Partial<Record<Giunto, string>> = {
  bacino: 'Bacino: sposta tutto il corpo', collo: 'Busto: inclina il corpo', testa: 'Testa', polSx: 'Polso sinistro (clic = la mano)', polDx: 'Polso destro (clic = la mano)',
  gomSx: 'Gomito sinistro', gomDx: 'Gomito destro', ginSx: 'Ginocchio sinistro', ginDx: 'Ginocchio destro', cavSx: 'Caviglia sinistra', cavDx: 'Caviglia destra', spSx: 'Spalla sinistra', spDx: 'Spalla destra', ancaSx: 'Anca sinistra', ancaDx: 'Anca destra'
}

function Mano2({ p, lato, scala = 1 }: { p: Posa; lato: 'sx' | 'dx'; scala?: number }): JSX.Element {
  const g = geometriaMano(p, lato)
  const colore = COLORE[lato]
  return (
    <g stroke={colore} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth={1.5 * scala}>
      {g.dita.map((d, i) => (
        <polyline key={i} points={[g.polso, ...d.punti].map((q) => q.join(',')).join(' ')} />
      ))}
      {g.dita.map((d, i) => d.punti.map((q, k) => <circle key={`${i}-${k}`} cx={q[0]} cy={q[1]} r={0.9 * scala} fill={colore} stroke="none" />))}
    </g>
  )
}

export function Omino(p: { valore: Posa; cambia: (p: Posa) => void }): JSX.Element {
  const { valore: v } = p
  const svg = useRef<SVGSVGElement>(null)
  const [preso, setPreso] = useState<Giunto | null>(null)
  const [mano, setMano] = useState<'sx' | 'dx' | null>(null)
  const [suGiunto, setSuGiunto] = useState<Giunto | null>(null)

  const punto = (e: React.PointerEvent): Punto => {
    const s = svg.current!
    const pt = s.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const q = pt.matrixTransform(s.getScreenCTM()!.inverse())
    return [q.x, q.y]
  }
  const muovi = (e: React.PointerEvent): void => {
    if (!preso) return
    p.cambia(trascina(v, preso, punto(e)))
  }
  const cambiaMano = (lato: 'sx' | 'dx', m: Partial<Mano>): void => p.cambia({ ...v, mani: { ...v.mani, [lato]: { ...v.mani[lato], ...m } } })

  const giunti = Object.keys(v.p) as Giunto[]
  const ms = mano ? v.mani[mano] : null

  return (
    <div className="omino">
      <svg ref={svg} viewBox={`0 0 ${LARGO} ${ALTO}`} className="omino-svg" onPointerMove={muovi} onPointerUp={() => setPreso(null)} onPointerLeave={() => setPreso(null)}>
        <rect x={0} y={0} width={LARGO} height={ALTO} className="omino-fondo" />
        <line x1={LARGO / 2} y1={0} x2={LARGO / 2} y2={ALTO} className="omino-asse" />
        {OSSA.map(([a, b, l], i) => (
          <line key={i} x1={v.p[a][0]} y1={v.p[a][1]} x2={v.p[b][0]} y2={v.p[b][1]} stroke={COLORE[l]} strokeWidth={4} strokeLinecap="round" opacity={0.9} />
        ))}
        <circle cx={v.p.testa[0]} cy={v.p.testa[1]} r={13} fill="rgba(233,228,255,.12)" stroke={COLORE.c} strokeWidth={2.5} />
        <Mano2 p={v} lato="sx" />
        <Mano2 p={v} lato="dx" />
        {mano && <circle cx={v.p[mano === 'sx' ? 'polSx' : 'polDx'][0]} cy={v.p[mano === 'sx' ? 'polSx' : 'polDx'][1]} r={17} fill="none" stroke="#ffd54a" strokeWidth={1.4} strokeDasharray="3 3" />}
        {giunti.map((g) => (
          <circle
            key={g}
            cx={v.p[g][0]}
            cy={v.p[g][1]}
            r={g === 'bacino' ? 7.5 : g === 'testa' ? 5 : 5.2}
            className={`omino-giunto ${preso === g ? 'preso' : ''} ${suGiunto === g ? 'su' : ''}`}
            fill={g === 'bacino' ? '#ffd54a' : COLORE[g.endsWith('Sx') ? 'sx' : g.endsWith('Dx') ? 'dx' : 'c']}
            onPointerDown={(e) => {
              ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
              setPreso(g)
              if (g === 'polSx') setMano('sx')
              if (g === 'polDx') setMano('dx')
            }}
            onPointerEnter={() => setSuGiunto(g)}
            onPointerOut={() => setSuGiunto(null)}
          >
            <title>{SPIEGA[g] || g}</title>
          </circle>
        ))}
      </svg>

      <div className="riga a-capo" style={{ gap: 5, marginTop: 8 }}>
        {POSE_PRONTE.map((x) => (
          <button key={x.id} className="chip" onClick={() => p.cambia(x.posa())}>{x.nome}</button>
        ))}
      </div>
      <div className="riga a-capo" style={{ gap: 6, marginTop: 8 }}>
        <button className="btn piccolo" onClick={() => p.cambia(specchia(v))} title="Scambia destra e sinistra">⇋ Specchia</button>
        <button className="btn piccolo fantasma" onClick={() => p.cambia(posaDi('attenti'))}>Riparti</button>
        <span className="piccolo spento">Trascina i pallini. Il pallino giallo (bacino) sposta tutto.</span>
      </div>

      <div className="omino-mani">
        <div className="riga" style={{ gap: 6 }}>
          <span className="piccolo tenue">Mani:</span>
          <button className={`chip ${mano === 'dx' ? 'su' : ''}`} onClick={() => setMano(mano === 'dx' ? null : 'dx')}>Destra</button>
          <button className={`chip ${mano === 'sx' ? 'su' : ''}`} onClick={() => setMano(mano === 'sx' ? null : 'sx')}>Sinistra</button>
          <span className="piccolo spento">«destra» e «sinistra» sono quelle della persona (la destra sta a sinistra dello schermo)</span>
        </div>
        {mano && ms && (
          <div className="omino-mano">
            <div className="riga" style={{ gap: 10, alignItems: 'flex-start' }}>
              <svg className="omino-zoom" viewBox={`${v.p[mano === 'sx' ? 'polSx' : 'polDx'][0] - 24} ${v.p[mano === 'sx' ? 'polSx' : 'polDx'][1] - 8} 48 48`}>
                <rect x={-500} y={-500} width={1000} height={1000} className="omino-fondo" />
                <Mano2 p={v} lato={mano} scala={0.9} />
              </svg>
              <div className="col flex1" style={{ gap: 6 }}>
                <div className="riga a-capo" style={{ gap: 5 }}>
                  {MANI_PRONTE.map((m) => <button key={m.id} className="chip" onClick={() => cambiaMano(mano, m.mano())}>{m.nome}</button>)}
                </div>
                <button className="btn piccolo fantasma" style={{ alignSelf: 'flex-start' }} onClick={() => cambiaMano(mano === 'sx' ? 'dx' : 'sx', { ...ms, dita: [...ms.dita] })}>Copia sull'altra mano</button>
              </div>
            </div>
            {NOMI_DITA.map((n, i) => (
              <Cursore key={n} etichetta={n} valore={Math.round(ms.dita[i] * 100)} min={0} max={100} passo={5} formato={(x) => (x < 15 ? 'teso' : x > 85 ? 'chiuso' : `${x}%`)} cambia={(x) => cambiaMano(mano, { dita: ms.dita.map((d, j) => (j === i ? x / 100 : d)) })} />
            ))}
            <Cursore etichetta="Dita divaricate" valore={Math.round(ms.aperte * 100)} min={0} max={100} passo={5} formato={(x) => `${x}%`} cambia={(x) => cambiaMano(mano, { aperte: x / 100 })} />
            <Cursore etichetta="Polso piegato" valore={ms.polso} min={-80} max={80} passo={5} formato={(x) => `${x}°`} cambia={(x) => cambiaMano(mano, { polso: x })} />
          </div>
        )}
      </div>
    </div>
  )
}
