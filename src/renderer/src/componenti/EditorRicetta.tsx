// L'editor di una ricetta del Laboratorio: nome, tipo, campi da compilare e passi con il loro prompt. Si usa per farne di nuove
// e per cambiare una copia di quelle che ci sono ({campo} nei prompt prende quello che scrivi, {riga} una riga alla volta).
import { useRef, useState, type JSX } from 'react'
import { I } from './Icone'
import { Interruttore, Segmenti } from './Controlli'
import { CATEGORIE_WF } from '../workflow'
import type { PassoUtente, RicettaUtente } from '../ricette'
import type { Ingresso } from '../workflow'

const FORMATI = ['1:1', '4:5', '3:2', '16:9', '9:16', '2:3']

const idDa = (nome: string, usati: string[]): string => {
  const base = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'campo'
  let id = base
  let n = 2
  while (usati.includes(id)) id = `${base}_${n++}`
  return id
}

export function EditorRicetta(p: { ricetta: RicettaUtente; chiudi: () => void; salvata: (r: RicettaUtente) => void }): JSX.Element {
  const [r, setR] = useState<RicettaUtente>(p.ricetta)
  const [errore, setErrore] = useState('')
  const caselle = useRef<Record<number, HTMLTextAreaElement | null>>({})
  const campi = r.ingressi.filter((i): i is Extract<Ingresso, { tipo: 'testo' | 'righe' }> => i.tipo !== 'scelta' && i.tipo !== 'camera' && i.tipo !== 'posa')

  const cambiaPasso = (i: number, m: Partial<PassoUtente>): void => setR({ ...r, passi: r.passi.map((x, j) => (j === i ? { ...x, ...m } : x)) })
  /** mette nel prompt del passo i (dove sta il cursore) una foto <imageN> o un {campo} */
  const inserisci = (i: number, testo: string): void => {
    const t = caselle.current[i]
    const v = r.passi[i].prompt
    const a = t ? t.selectionStart : v.length
    const b = t ? t.selectionEnd : v.length
    cambiaPasso(i, { prompt: v.slice(0, a) + testo + v.slice(b) })
    setTimeout(() => {
      t?.focus()
      t?.setSelectionRange(a + testo.length, a + testo.length)
    }, 0)
  }
  const sposta = (i: number, d: number): void => {
    const l = [...r.passi]
    const j = i + d
    if (j < 0 || j >= l.length) return
    ;[l[i], l[j]] = [l[j], l[i]]
    setR({ ...r, passi: l })
  }
  const salva = (): void => {
    if (!r.nome.trim()) return setErrore('Dai un nome alla ricetta')
    if (!r.passi.length || r.passi.some((x) => !x.prompt.trim())) return setErrore('Ogni passo ha bisogno di un prompt')
    if (r.passi.some((x) => !x.etichetta.trim() && !x.perRiga)) return setErrore('Ogni passo ha bisogno di un nome (anche breve)')
    const nomi = r.passi.filter((x) => !x.perRiga).map((x) => x.etichetta.trim())
    if (new Set(nomi).size !== nomi.length) return setErrore('Due passi hanno lo stesso nome: cambiane uno')
    p.salvata({ ...r, nome: r.nome.trim(), passi: r.passi.map((x) => ({ ...x, etichetta: x.etichetta.trim(), prompt: x.prompt.trim() })) })
  }

  return (
    <div className="album-modale" onClick={(e) => e.target === e.currentTarget && p.chiudi()}>
      <div className="pannello editor-ricetta">
        <header>
          <b>{p.ricetta.da ? 'MODIFICA LA TUA COPIA' : p.ricetta.nome === 'La mia ricetta' ? 'NUOVA RICETTA' : 'MODIFICA RICETTA'}</b>
          <span className="flex1" />
          <button className="btn fantasma piccolo icona" onClick={p.chiudi}><I.x /></button>
        </header>
        <div className="corpo">
          <label className="campo-preset"><span>Nome</span><input type="text" value={r.nome} onChange={(e) => setR({ ...r, nome: e.target.value })} /></label>
          <label className="campo-preset"><span>Cosa fa (una riga)</span><input type="text" value={r.descrizione} onChange={(e) => setR({ ...r, descrizione: e.target.value })} /></label>
          <div className="riga a-capo" style={{ gap: 12, alignItems: 'flex-start' }}>
            <label className="campo-preset" style={{ flex: 1, minWidth: 180 }}>
              <span>Categoria</span>
              <select value={r.categoria} onChange={(e) => setR({ ...r, categoria: e.target.value })}>
                {CATEGORIE_WF.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <div style={{ flex: 1, minWidth: 200 }}>
              <span className="piccolo tenue">Tipo</span>
              <Segmenti valore={r.modo} cambia={(modo) => setR({ ...r, modo })} voci={[{ id: 'serie', nome: 'Serie', sotto: 'tutti dalla stessa foto' }, { id: 'catena', nome: 'Catena', sotto: 'uno dopo l\'altro' }]} />
            </div>
          </div>
          <Interruttore acceso={r.foto} cambia={(foto) => setR({ ...r, foto })} sotto="Se è spento, la ricetta disegna da zero (con le foto di riferimento, se ci sono)">Parte da una foto da cambiare</Interruttore>
          <div>
            <span className="piccolo tenue">Foto di riferimento</span>
            <Segmenti valore={r.rif} cambia={(rif) => setR({ ...r, rif })} voci={[{ id: 'no', nome: 'Niente' }, { id: 'si', nome: 'Facoltative' }, { id: 'serve', nome: 'Serve' }, { id: 'ognuno', nome: 'Una per passo' }]} />
            {r.rif !== 'no' && <input type="text" style={{ marginTop: 6 }} value={r.rifNome || ''} onChange={(e) => setR({ ...r, rifNome: e.target.value })} placeholder="Cosa sono (es. le foto dei vestiti)" />}
          </div>

          <div>
            <div className="riga spazia"><b className="piccolo tenue">CAMPI DA COMPILARE</b><button className="btn piccolo" onClick={() => setR({ ...r, ingressi: [...r.ingressi, { id: idDa('campo', r.ingressi.map((i) => i.id)), tipo: 'testo', nome: 'Un campo', esempio: '' }] })}><I.piu /> Campo</button></div>
            <div className="piccolo spento" style={{ margin: '2px 0 6px' }}>Nei prompt scrivi <b>{'{nome_campo}'}</b> dove va quello che l'utente compila.</div>
            {campi.map((c) => (
              <div className="campo-editor" key={c.id}>
                <input type="text" value={c.nome} onChange={(e) => setR({ ...r, ingressi: r.ingressi.map((i) => (i.id === c.id ? { ...i, nome: e.target.value } : i)) })} placeholder="Nome che si vede" />
                <code title="Come si scrive nei prompt">{`{${c.id}}`}</code>
                <select value={c.tipo} onChange={(e) => setR({ ...r, ingressi: r.ingressi.map((i) => (i.id === c.id ? ({ ...i, tipo: e.target.value as 'testo' | 'righe' } as Ingresso) : i)) })}>
                  <option value="testo">una riga</option><option value="righe">più righe</option>
                </select>
                <input type="text" value={c.esempio} onChange={(e) => setR({ ...r, ingressi: r.ingressi.map((i) => (i.id === c.id ? ({ ...i, esempio: e.target.value } as Ingresso) : i)) })} placeholder="Esempio di partenza" />
                <button className="btn piccolo fantasma icona" onClick={() => setR({ ...r, ingressi: r.ingressi.filter((i) => i.id !== c.id), passi: r.passi.map((x) => (x.perRiga === c.id ? { ...x, perRiga: undefined } : x)) })}><I.x /></button>
              </div>
            ))}
          </div>

          <div>
            <div className="riga spazia"><b className="piccolo tenue">PASSI ({r.passi.length})</b><button className="btn piccolo" onClick={() => setR({ ...r, passi: [...r.passi, { etichetta: `Passo ${r.passi.length + 1}`, prompt: '' }] })}><I.piu /> Passo</button></div>
            <div className="piccolo spento" style={{ margin: '2px 0 6px' }}>In inglese funziona meglio. La foto da cambiare è <b>&lt;image1&gt;</b>, i riferimenti <b>&lt;image2&gt;</b>… Ogni passo è un'immagine.</div>
            {r.passi.map((x, i) => (
              <div className="passo-editor" key={i}>
                <div className="riga" style={{ gap: 6 }}>
                  <input type="text" value={x.etichetta} onChange={(e) => cambiaPasso(i, { etichetta: e.target.value })} placeholder={x.perRiga ? 'Nome ({riga} = il testo della riga)' : 'Nome del passo'} style={{ flex: 1, minWidth: 0 }} />
                  <button className="btn piccolo icona fantasma" onClick={() => sposta(i, -1)} disabled={i === 0} title="Su">▴</button>
                  <button className="btn piccolo icona fantasma" onClick={() => sposta(i, 1)} disabled={i === r.passi.length - 1} title="Giù">▾</button>
                  <button className="btn piccolo icona fantasma" onClick={() => setR({ ...r, passi: [...r.passi.slice(0, i + 1), { ...x, etichetta: x.etichetta + ' (copia)' }, ...r.passi.slice(i + 1)] })} title="Duplica"><I.copia /></button>
                  <button className="btn piccolo icona fantasma pericolo" onClick={() => setR({ ...r, passi: r.passi.filter((_, j) => j !== i) })} title="Togli"><I.x /></button>
                </div>
                <textarea ref={(el) => { caselle.current[i] = el }} value={x.prompt} onChange={(e) => cambiaPasso(i, { prompt: e.target.value })} placeholder="Il prompt di questo passo" style={{ minHeight: 70, marginTop: 6 }} />
                <div className="riga a-capo" style={{ gap: 5, marginTop: 6 }}>
                  <span className="piccolo tenue">Nel testo:</span>
                  {r.foto && <button className="chip principale" onClick={() => inserisci(i, '<image1>')} title="La foto principale, quella che la ricetta cambia">&lt;image1&gt; · principale</button>}
                  {r.rif !== 'no' && [2, 3, 4].map((n) => <button key={n} className="chip" onClick={() => inserisci(i, `<image${r.foto ? n : n - 1}>`)} title="Una foto di riferimento">&lt;image{r.foto ? n : n - 1}&gt;</button>)}
                  {campi.map((c) => <button key={c.id} className="chip" onClick={() => inserisci(i, `{${c.id}}`)} title={`Quello che scrivi in «${c.nome}»`}>{`{${c.id}}`}</button>)}
                  {campi.some((c) => c.tipo === 'righe') && <button className="chip" onClick={() => inserisci(i, '{riga}')} title="La riga di questo passo">{'{riga}'}</button>}
                </div>
                <div className="riga a-capo" style={{ gap: 10, marginTop: 6 }}>
                  {campi.some((c) => c.tipo === 'righe') && (
                    <label className="piccolo tenue">Uno per ogni riga di{' '}
                      <select value={x.perRiga || ''} onChange={(e) => cambiaPasso(i, { perRiga: e.target.value || undefined })}>
                        <option value="">— (un passo solo)</option>
                        {campi.filter((c) => c.tipo === 'righe').map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="piccolo tenue"><input type="checkbox" checked={!!x.crea} onChange={(e) => cambiaPasso(i, { crea: e.target.checked ? { formato: '1:1', ris: 1024 } : undefined })} /> Disegna da zero</label>
                  {x.crea && (
                    <select value={x.crea.formato} onChange={(e) => cambiaPasso(i, { crea: { ...x.crea!, formato: e.target.value } })}>
                      {FORMATI.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  )}
                  <label className="piccolo tenue"><input type="checkbox" checked={!!x.trasparente} onChange={(e) => cambiaPasso(i, { trasparente: e.target.checked })} /> Sfondo trasparente</label>
                </div>
              </div>
            ))}
          </div>
          <div className="piccolo spento">Ogni ricetta ha anche il passo <b>🎲 Sorpresa</b>: il modello inventa una variazione nuova nello stile dei tuoi passi.</div>
          {errore && <div className="avviso-box" style={{ padding: '8px 10px' }}>{errore}</div>}
        </div>
        <footer>
          <button className="btn" onClick={p.chiudi}>Annulla</button>
          <button className="btn primario" onClick={salva}>Salva la ricetta</button>
        </footer>
      </div>
    </div>
  )
}
