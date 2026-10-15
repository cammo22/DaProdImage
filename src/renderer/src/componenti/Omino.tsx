// L'omino: un manichino con le ossa che trascini come vuoi (le articolazioni sono i pallini: il bacino sposta tutto, gli altri
// ruotano l'osso attorno al pallino prima). Clic su una mano per aprirla, chiuderla o muovere le dita una per una.
import { useEffect, useRef, useState, type JSX } from 'react'
import { Cursore } from './Controlli'
import {
  ALTO, LARGO, MANI_PRONTE, NOMI_DITA, POSE_PRONTE, VISO0, disegnaManichino, geometriaMano, posaDi, specchia, trascina, visoDi,
  type Giunto, type Mano, type Posa, type Punto, type Viso
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

/** i modi pronti per la testa */
const TESTE: { nome: string; v: Viso }[] = [
  { nome: 'Dritta', v: VISO0 },
  { nome: '¾ a sinistra', v: { gira: -38, su: 0, inclina: 0 } },
  { nome: '¾ a destra', v: { gira: 38, su: 0, inclina: 0 } },
  { nome: 'Profilo ◀', v: { gira: -80, su: 0, inclina: 0 } },
  { nome: 'Profilo ▶', v: { gira: 80, su: 0, inclina: 0 } },
  { nome: 'Su', v: { gira: 0, su: 28, inclina: 0 } },
  { nome: 'Giù', v: { gira: 0, su: -28, inclina: 0 } }
]

/** il manichino come lo vede il modello (anteprima piccola) */
function Anteprima({ posa }: { posa: Posa }): JSX.Element {
  const c = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const g = c.current?.getContext('2d')
    if (g) disegnaManichino(g, posa, 280, 300)
  }, [posa])
  return <canvas ref={c} width={280} height={300} className="omino-anteprima" />
}

export function Omino(p: { valore: Posa; cambia: (p: Posa) => void }): JSX.Element {
  const { valore: v } = p
  const svg = useRef<SVGSVGElement>(null)
  const [preso, setPreso] = useState<Giunto | null>(null)
  const [mano, setMano] = useState<'sx' | 'dx' | null>(null)
  const [suGiunto, setSuGiunto] = useState<Giunto | null>(null)
  const [vedi, setVedi] = useState(false)
  const viso = visoDi(v)
  const cambiaViso = (m: Partial<Viso>): void => p.cambia({ ...v, viso: { ...viso, ...m } })

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
        <g transform={`translate(${v.p.testa[0]} ${v.p.testa[1]}) rotate(${(Math.atan2(v.p.testa[0] - v.p.collo[0], v.p.collo[1] - v.p.testa[1]) * 180) / Math.PI + viso.inclina})`} pointerEvents="none">
          <ellipse cx={0} cy={0} rx={Math.max(0.8, Math.abs(Math.cos((viso.gira * Math.PI) / 180)) * 13)} ry={13} fill="none" stroke={COLORE.c} strokeWidth={1} opacity={0.7} />
          <circle cx={Math.sin((viso.gira * Math.PI) / 180) * 11} cy={-Math.sin((viso.su * Math.PI) / 180) * 9 + 1} r={2.6} fill="#ffd54a" />
        </g>
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
          <button key={x.id} className="chip" onClick={() => p.cambia({ ...x.posa(), viso: v.viso })}>{x.nome}</button>
        ))}
      </div>
      <div className="riga a-capo" style={{ gap: 6, marginTop: 8 }}>
        <button className="btn piccolo" onClick={() => p.cambia(specchia(v))} title="Scambia destra e sinistra">⇋ Specchia</button>
        <button className="btn piccolo fantasma" onClick={() => p.cambia(posaDi('attenti'))}>Riparti</button>
        <span className="piccolo spento">Trascina i pallini. Il pallino giallo (bacino) sposta tutto.</span>
      </div>

      <div className="omino-mani">
        <div className="riga a-capo" style={{ gap: 5 }}>
          <span className="piccolo tenue">Testa:</span>
          {TESTE.map((t) => (
            <button key={t.nome} className={`chip ${viso.gira === t.v.gira && viso.su === t.v.su && viso.inclina === t.v.inclina ? 'su' : ''}`} onClick={() => cambiaViso(t.v)}>{t.nome}</button>
          ))}
        </div>
        <Cursore etichetta="Testa girata" valore={Math.round(viso.gira)} min={-90} max={90} passo={5} formato={(x) => (Math.abs(x) < 6 ? 'dritta' : x < 0 ? `◀ ${-x}°` : `${x}° ▶`)} cambia={(gira) => cambiaViso({ gira })} />
        <Cursore etichetta="Testa su / giù" valore={Math.round(viso.su)} min={-45} max={45} passo={5} formato={(x) => (Math.abs(x) < 6 ? 'dritta' : x > 0 ? `su ${x}°` : `giù ${-x}°`)} cambia={(su) => cambiaViso({ su })} />
        <Cursore etichetta="Testa inclinata" valore={Math.round(viso.inclina)} min={-40} max={40} passo={5} formato={(x) => (Math.abs(x) < 6 ? 'dritta' : x < 0 ? `◀ ${-x}°` : `${x}° ▶`)} cambia={(inclina) => cambiaViso({ inclina })} />
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

      <div style={{ marginTop: 8 }}>
        <button className="btn piccolo fantasma" onClick={() => setVedi(!vedi)}>{vedi ? 'Nascondi' : 'Mostra'} il manichino che vede il modello</button>
        {vedi && <Anteprima posa={v} />}
      </div>
    </div>
  )
}
