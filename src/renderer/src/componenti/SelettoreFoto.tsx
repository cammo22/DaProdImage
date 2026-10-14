// Scegliere una foto: dalla galleria (tutto quello che hai creato o importato) o dal PC.
// Si apre da `scegliFoto()` (stato.ts) e chi lo ha aperto riceve le foto scelte, o niente se si chiude.
import { useEffect, useMemo, useState, type JSX } from 'react'
import { usaStato } from '../stato'
import { api, urlFile } from '../api'
import { I } from './Icone'
import { fotoDaOpera } from '../azioni'
import { normalizza } from '../util'
import type { Opera } from '@shared/tipi'

export function SelettoreFoto(): JSX.Element | null {
  const { selettore, avvisa } = usaStato()
  const [opere, setOpere] = useState<Opera[]>([])
  const [testo, setTesto] = useState('')
  const [scelte, setScelte] = useState<string[]>([])
  const [lavoro, setLavoro] = useState(false)

  useEffect(() => {
    if (!selettore) return
    setScelte([])
    setTesto('')
    void api.galleria.elenco({ modalita: 'tutte' }).then(setOpere)
  }, [selettore])

  useEffect(() => {
    if (!selettore) return
    const t = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') selettore.ok([])
    }
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  }, [selettore])

  const visibili = useMemo(() => {
    const q = testo.trim().toLowerCase()
    return q ? opere.filter((o) => (o.prompt + ' ' + (o.etichetta || '') + ' ' + o.seed).toLowerCase().includes(q)) : opere
  }, [opere, testo])

  if (!selettore) return null

  const dalPc = async (): Promise<void> => {
    const ps = await api.file.scegliImmagini(selettore.multi)
    if (!ps.length) return
    setLavoro(true)
    try {
      const f = []
      for (const p of ps) f.push(await normalizza(p))
      selettore.ok(f)
    } catch (e) {
      avvisa((e as Error).message, 'errore')
    } finally {
      setLavoro(false)
    }
  }

  const clic = (o: Opera): void => {
    if (!selettore.multi) {
      selettore.ok([fotoDaOpera(o)])
      return
    }
    setScelte((s) => (s.includes(o.id) ? s.filter((x) => x !== o.id) : [...s, o.id]))
  }

  return (
    <div className="velo-selettore" onClick={(e) => e.target === e.currentTarget && selettore.ok([])}>
      <div className="selettore pannello">
        <header>
          <b>{selettore.multi ? 'SCEGLI LE FOTO' : 'SCEGLI UNA FOTO'}</b>
          <input type="search" placeholder="Cerca nei prompt…" value={testo} onChange={(e) => setTesto(e.target.value)} autoFocus />
          <span className="flex1" />
          <button className="btn" onClick={dalPc} disabled={lavoro}><I.immagine /> {lavoro ? 'Converto…' : 'Dal PC…'}</button>
          <button className="btn fantasma icona" onClick={() => selettore.ok([])} title="Chiudi (Esc)"><I.x /></button>
        </header>
        <div className="griglia-selettore">
          {visibili.length === 0 && <div className="spento" style={{ gridColumn: '1 / -1', padding: 30, textAlign: 'center' }}>{opere.length ? 'Niente con questa ricerca.' : 'La galleria è vuota: scegli una foto dal PC.'}</div>}
          {visibili.map((o) => {
            const n = scelte.indexOf(o.id)
            return (
              <button key={o.id} className={`miniatura ${n >= 0 ? 'su' : ''} ${o.trasparente ? 'scacchi' : ''}`} onClick={() => clic(o)} title={o.prompt || o.etichetta}>
                <img src={urlFile(o.miniatura || o.file)} alt="" loading="lazy" />
                {n >= 0 && <span className="num">{n + 1}</span>}
              </button>
            )
          })}
        </div>
        {selettore.multi && (
          <footer>
            <span className="tenue">{scelte.length ? `${scelte.length} ${scelte.length === 1 ? 'scelta' : 'scelte'}` : 'Tocca le foto da usare'}</span>
            <button
              className="btn primario"
              disabled={!scelte.length}
              onClick={() => selettore.ok(scelte.map((id) => opere.find((o) => o.id === id)).filter((o): o is Opera => !!o).map(fotoDaOpera))}
            >
              Usa {scelte.length || ''} {scelte.length === 1 ? 'foto' : 'foto'}
            </button>
          </footer>
        )}
      </div>
    </div>
  )
}
