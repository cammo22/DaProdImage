// Il comando "Camera": trascini la camera attorno al soggetto (vista dall'alto = giri, vista di lato = alzi o abbassi)
// e scegli quanto vicino. Il prompt si scrive da solo; se c'è il LoRA delle angolazioni (akhaliq, parola <mva>) lo usa,
// se no lo chiede in parole al modello.
import { useRef, useState, type JSX } from 'react'

export interface PosizioneCamera {
  /** giro attorno al soggetto in gradi: 0 = davanti, + = verso destra, ±180 = da dietro */
  az: number
  /** altezza in gradi: 0 = all'altezza degli occhi, 90 = a piombo dall'alto, negativo = dal basso */
  el: number
  /** -1 = campo largo, 0 = com'è, 1 = primo piano */
  dist: number
}

export const CAMERA0: PosizioneCamera = { az: 0, el: 0, dist: 0 }

const AZIMUT = ['front', 'front-right', 'front-right quarter', 'right side', 'back-right quarter', 'back-right', 'back', 'back-left', 'back-left quarter', 'left side', 'front-left quarter', 'front-left']

/** le posizioni che il LoRA ha imparato: 12 giri da 30° × eye-level / elevated / high-angle / top-down, più il primo piano */
export function conLora(c: PosizioneCamera): boolean {
  return c.el >= -8 && c.dist >= -0.3
}

export function componiCamera(c: PosizioneCamera, lora: boolean): string {
  const neutra = Math.abs(c.az) < 8 && Math.abs(c.el) < 8 && Math.abs(c.dist) < 0.2
  if (neutra) return ''
  if (lora && conLora(c)) {
    const i = Math.round((((c.az % 360) + 360) % 360) / 30) % 12
    const alt = c.el >= 75 ? 'top-down shot' : c.el >= 45 ? 'high-angle shot' : c.el >= 15 ? 'elevated shot' : 'eye-level shot'
    return `<mva> ${AZIMUT[i]} view, ${alt}${c.dist > 0.5 ? ' close-up' : ''}`
  }
  const parti: string[] = []
  const a = Math.abs(c.az)
  if (a >= 172) parti.push('show the subject from behind')
  else if (a >= 8) parti.push(`rotate the camera ${Math.round(a / 5) * 5} degrees to the ${c.az > 0 ? 'right' : 'left'} around the subject`)
  if (c.el >= 75) parti.push('from directly above, a top-down view')
  else if (c.el >= 40) parti.push('from a high angle looking down')
  else if (c.el >= 15) parti.push('from a slightly elevated angle')
  else if (c.el <= -40) parti.push('from a very low angle looking up')
  else if (c.el <= -12) parti.push('from a low angle looking up')
  if (c.dist > 0.6) parti.push('as a tight close-up')
  else if (c.dist > 0.2) parti.push('moving the camera closer')
  else if (c.dist < -0.6) parti.push('as a wide shot, much further away')
  else if (c.dist < -0.2) parti.push('moving the camera back a little')
  const frase = parti.join(', ')
  return `Change the camera viewpoint: ${frase.charAt(0).toUpperCase()}${frase.slice(1)}. Keep the same subject, outfit, colors, lighting and scene; only the camera position changes.`
}

export function descriviCamera(c: PosizioneCamera): string {
  const a = Math.abs(c.az)
  const giro = a < 8 ? 'davanti' : a >= 172 ? 'da dietro' : `${Math.round(a / 5) * 5}° a ${c.az > 0 ? 'destra' : 'sinistra'}`
  const alt = c.el >= 75 ? 'a piombo dall\'alto' : c.el >= 40 ? 'dall\'alto' : c.el >= 15 ? 'un po\' dall\'alto' : c.el <= -12 ? 'dal basso' : 'all\'altezza degli occhi'
  const dist = c.dist > 0.6 ? 'primo piano' : c.dist > 0.2 ? 'più vicino' : c.dist < -0.6 ? 'campo largo' : c.dist < -0.2 ? 'un po\' più lontano' : 'stessa distanza'
  return `${giro} · ${alt} · ${dist}`
}

const PRESET: { nome: string; c: PosizioneCamera }[] = [
  { nome: 'Davanti', c: { az: 0, el: 0, dist: 0 } },
  { nome: '¾ destra', c: { az: 45, el: 0, dist: 0 } },
  { nome: 'Lato destro', c: { az: 90, el: 0, dist: 0 } },
  { nome: 'Dietro', c: { az: 180, el: 0, dist: 0 } },
  { nome: 'Lato sinistro', c: { az: -90, el: 0, dist: 0 } },
  { nome: '¾ sinistra', c: { az: -45, el: 0, dist: 0 } },
  { nome: 'Dall\'alto', c: { az: 0, el: 45, dist: 0 } },
  { nome: 'Dal basso', c: { az: 0, el: -25, dist: 0 } },
  { nome: 'Primo piano', c: { az: 0, el: 0, dist: 1 } },
  { nome: 'Campo largo', c: { az: 0, el: 0, dist: -1 } }
]

const R = 52
const C = 70

export function ControlloCamera(p: { valore: PosizioneCamera; cambia: (c: PosizioneCamera) => void; lora: boolean }): JSX.Element {
  const { valore: v } = p
  const alto = useRef<SVGSVGElement>(null)
  const lato = useRef<SVGSVGElement>(null)
  const [trascina, setTrascina] = useState<'alto' | 'lato' | null>(null)

  const angolo = (e: React.PointerEvent, svg: SVGSVGElement): { x: number; y: number } => {
    const r = svg.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 140 - C, y: ((e.clientY - r.top) / r.height) * 140 - C }
  }
  const muovi = (e: React.PointerEvent): void => {
    if (trascina === 'alto' && alto.current) {
      const { x, y } = angolo(e, alto.current)
      // davanti = in basso: az 0 → (0, +R)
      let az = (Math.atan2(x, y) * 180) / Math.PI
      if (!e.shiftKey) az = Math.round(az / 5) * 5
      p.cambia({ ...v, az: Math.max(-180, Math.min(180, az)) })
    } else if (trascina === 'lato' && lato.current) {
      const { x, y } = angolo(e, lato.current)
      let el = (Math.atan2(-y, Math.max(1, x)) * 180) / Math.PI
      if (!e.shiftKey) el = Math.round(el / 5) * 5
      p.cambia({ ...v, el: Math.max(-40, Math.min(90, el)) })
    }
  }
  const finisci = (): void => setTrascina(null)

  const rAz = (v.az * Math.PI) / 180
  const cx = C + R * Math.sin(rAz)
  const cy = C + R * Math.cos(rAz)
  const rEl = (v.el * Math.PI) / 180
  const lx = C - 18 + R * Math.cos(rEl)
  const ly = C - R * Math.sin(rEl)

  return (
    <div className="camera" onPointerMove={muovi} onPointerUp={finisci} onPointerLeave={finisci}>
      <div className="camera-viste">
        <div className="vista-camera">
          <svg ref={alto} viewBox="0 0 140 140" onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); setTrascina('alto'); muovi(e) }}>
            <circle cx={C} cy={C} r={R} className="orbita" />
            <path d={`M${C} ${C} L${cx} ${cy}`} className="raggio" />
            <circle cx={C} cy={C} r={11} className="soggetto" />
            <path d={`M${C - 5} ${C + 4} L${C} ${C + 11} L${C + 5} ${C + 4}`} className="faccia" />
            <g transform={`translate(${cx} ${cy}) rotate(${180 - v.az})`}>
              <rect x={-9} y={-6} width={18} height={12} rx={3} className="cam" />
              <path d="M-4 -6 L0 -11 L4 -6" className="cam" />
            </g>
            <text x={C} y={14} textAnchor="middle">dietro</text>
            <text x={C} y={134} textAnchor="middle">davanti</text>
          </svg>
          <span>Gira attorno</span>
        </div>
        <div className="vista-camera">
          <svg ref={lato} viewBox="0 0 140 140" onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); setTrascina('lato'); muovi(e) }}>
            <path d={`M${C - 18 + R * Math.cos((-40 * Math.PI) / 180)} ${C - R * Math.sin((-40 * Math.PI) / 180)} A${R} ${R} 0 0 0 ${C - 18 + R * Math.cos(Math.PI / 2)} ${C - R}`} className="orbita" fill="none" />
            <path d={`M${C - 18} ${C} L${lx} ${ly}`} className="raggio" />
            <circle cx={C - 18} cy={C} r={11} className="soggetto" />
            <g transform={`translate(${lx} ${ly}) rotate(${-v.el - 90})`}>
              <rect x={-9} y={-6} width={18} height={12} rx={3} className="cam" />
              <path d="M-4 -6 L0 -11 L4 -6" className="cam" />
            </g>
            <text x={C + 30} y={14} textAnchor="middle">alto</text>
            <text x={C + 30} y={134} textAnchor="middle">basso</text>
          </svg>
          <span>Alza o abbassa</span>
        </div>
      </div>
      <div className="cursore" style={{ marginTop: 6 }}>
        <label>Distanza</label>
        <output>{v.dist > 0.6 ? 'primo piano' : v.dist < -0.6 ? 'campo largo' : v.dist === 0 ? 'com\'è' : v.dist > 0 ? 'più vicino' : 'più lontano'}</output>
        <input type="range" min={-1} max={1} step={0.1} value={v.dist} style={{ ['--p' as string]: `${((v.dist + 1) / 2) * 100}%` }} onChange={(e) => p.cambia({ ...v, dist: Number(e.target.value) })} />
      </div>
      <div className="riga a-capo" style={{ gap: 5, marginTop: 8 }}>
        {PRESET.map((x) => (
          <button key={x.nome} className="chip" onClick={() => p.cambia(x.c)}>{x.nome}</button>
        ))}
      </div>
      <div className="camera-testo">
        <b>{descriviCamera(v)}</b>
        <span className="piccolo spento">{p.lora && conLora(v) ? 'con il LoRA delle angolazioni' : 'a parole, senza LoRA (con il LoRA Camera la resa è più fedele)'}</span>
      </div>
    </div>
  )
}
