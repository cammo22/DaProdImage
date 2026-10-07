// I LoRA attivi (con la loro forza) e il menu per accenderne altri con un clic.
import { useEffect, useRef, useState, type JSX } from 'react'
import { usaStato } from '../stato'
import { urlFile } from '../api'
import { I } from './Icone'
import type { InfoLora } from '@shared/tipi'

export function coloreDa(nome: string): string {
  let h = 0
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const a = h % 360
  return `linear-gradient(135deg, hsl(${a} 70% 42%), hsl(${(a + 60) % 360} 75% 30%))`
}
/** due lettere dal nome, saltando "qwen", "image", "lora" e i numeri di versione */
export const sigla = (nome: string): string => {
  const parole = nome.replace(/[_\-.()]+/g, ' ').split(' ').filter(Boolean)
  const utili = parole.filter((p) => !/^(qwen\d*|image|img|lora|v?\d+(\.\d+)*|uc)$/i.test(p))
  return (utili.length ? utili : parole).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

export function Copertina({ l, grande }: { l: InfoLora; grande?: boolean }): JSX.Element {
  return l.anteprima ? (
    <img src={urlFile(l.anteprima)} alt="" />
  ) : (
    <div style={{ background: coloreDa(l.nome), width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
      <span className={grande ? 'sigla' : ''}>{sigla(l.nome)}</span>
    </div>
  )
}

export function SceltaLora(): JSX.Element {
  const { lore, loraAttive, setLoraAttive, toggleLora, vai } = usaStato()
  const [aperto, setAperto] = useState(false)
  const rif = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aperto) return
    const chiudi = (e: MouseEvent): void => {
      if (rif.current && !rif.current.contains(e.target as Node)) setAperto(false)
    }
    window.addEventListener('mousedown', chiudi)
    return () => window.removeEventListener('mousedown', chiudi)
  }, [aperto])

  return (
    <div className="col" ref={rif} style={{ position: 'relative' }}>
      {loraAttive.length > 0 && (
        <div className="lora-attive">
          {loraAttive.map((a) => {
            const info = lore.find((l) => l.file === a.file)
            return (
              <div className="lora-attiva" key={a.file} title={info?.parole ? 'Parole chiave: ' + info.parole : a.file}>
                <span className="n">{info?.nome || a.file}</span>
                <input
                  type="range"
                  min={-1}
                  max={2}
                  step={0.05}
                  value={a.forza}
                  style={{ ['--p' as string]: `${((a.forza + 1) / 3) * 100}%` }}
                  onChange={(e) => setLoraAttive(loraAttive.map((x) => (x.file === a.file ? { ...x, forza: Number(e.target.value) } : x)))}
                />
                <output>{a.forza.toFixed(2)}</output>
                <button className="btn fantasma piccolo icona" onClick={() => toggleLora(a.file)} title="Togli">
                  <I.x />
                </button>
              </div>
            )
          })}
        </div>
      )}
      <div className="riga">
        <button className="btn piccolo" onClick={() => setAperto(!aperto)}>
          <I.piu /> LoRA
        </button>
        {lore.length === 0 && <span className="piccolo spento">Nessun LoRA: aggiungili dalla pagina LoRA.</span>}
      </div>
      {aperto && (
        <div className="scelta-lora pannello" style={{ top: '100%', left: 0, marginTop: 6 }}>
          {lore.length === 0 && (
            <div className="col" style={{ padding: 10 }}>
              <span className="tenue">Non hai ancora LoRA.</span>
              <button className="btn piccolo" onClick={() => vai('lora')}>Vai ai LoRA</button>
            </div>
          )}
          {lore.map((l) => {
            const su = loraAttive.some((a) => a.file === l.file)
            return (
              <div key={l.file} className="voce" onClick={() => toggleLora(l.file, l.forza)}>
                <div className="q">
                  <Copertina l={l} />
                </div>
                <div className="flex1">
                  <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nome}</div>
                  <div className="piccolo spento" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.compatibile === 'no' ? '⚠ ' + (l.base || 'altro modello') : l.parole || l.file}
                  </div>
                </div>
                {su && <span className="oro" style={{ fontWeight: 700 }}>✓</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** aggiunge al prompt le parole chiave dei LoRA attivi che non ci sono già */
export function conParoleLora(prompt: string): string {
  const { lore, loraAttive } = usaStato.getState()
  const extra: string[] = []
  for (const a of loraAttive) {
    const p = lore.find((l) => l.file === a.file)?.parole?.trim()
    if (p && !prompt.toLowerCase().includes(p.toLowerCase())) extra.push(p)
  }
  return extra.length ? `${extra.join(', ')}, ${prompt}` : prompt
}
