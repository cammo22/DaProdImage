// Album: impaginazione automatica di foto (anche RAW) in spread pronti per la stampa, come SmartAlbums.
// Scegli le foto (dalla galleria o dal PC), il formato, e "Impagina tutto": le foto vanno nell'ordine di scatto, divise in
// spread, con layout che tagliano il meno possibile. Poi ritocchi a mano (sposta, scambia, ingrandisci, altro layout) ed esporti.
import { useEffect, useRef, useState, type JSX } from 'react'
import { usaStato, scegliFoto, ascoltatoriLavoro } from '../stato'
import { api, urlFile } from '../api'
import { I } from '../componenti/Icone'
import { Contatore, Cursore, Interruttore, Segmenti } from '../componenti/Controlli'
import { richiestaBase, perQualita } from '../azioni'
import { usaAlbum } from '../album/stato'
import { disegnaSpread, geometria, mappaFoto, adatta } from '../album/disegna'
import { COLORI_SFONDO, FONT_ALBUM, FORMATI, spreadDi, paginaDi, type Album as TipoAlbum, type Spread } from '../album/tipi'
import { esporta } from '../album/esporta'
import { piazza, raggruppa } from '../album/costruisci'

export function Album(): JSX.Element {
  const { album, elenco, corrente, cella, lavoro, storia, futuro } = usaAlbum()
  const [esportando, setEsportando] = useState(false)
  const [guide, setGuide] = useState(false)
  const [ia, setIa] = useState('')
  const [iaInCorso, setIaInCorso] = useState(false)
  const avvisa = usaStato((s) => s.avvisa)

  // all'apertura: l'ultimo album, o uno nuovo
  useEffect(() => {
    void (async () => {
      await usaAlbum.getState().aggiornaElenco()
      // se un album è già aperto (si è solo cambiata pagina) resta quello, con il suo annulla
      if (usaAlbum.getState().album) return
      const l = usaAlbum.getState().elenco
      if (l.length) await usaAlbum.getState().apri(l[0].id)
      else await usaAlbum.getState().nuovo('Il mio primo album')
    })()
  }, [])

  // tasti: Ctrl+Z / Ctrl+Y, frecce fra gli spread
  useEffect(() => {
    const t = (e: KeyboardEvent): void => {
      if (usaStato.getState().pagina !== 'album') return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      const s = usaAlbum.getState()
      if (e.ctrlKey && e.key.toLowerCase() === 'z') s.annulla()
      else if (e.ctrlKey && e.key.toLowerCase() === 'y') s.ripeti()
      else if (e.key === 'ArrowLeft' && s.album) s.scegli(Math.max(0, s.corrente - 1))
      else if (e.key === 'ArrowRight' && s.album) s.scegli(Math.min(s.album.spreads.length - 1, s.corrente + 1))
      else if ((e.key === 'Delete' || e.key === 'Backspace') && s.cella !== null) togliCella()
    }
    window.addEventListener('keydown', t)
    return () => window.removeEventListener('keydown', t)
  }, [])

  // lo sfondo fatto dall'AI: quando il lavoro finisce diventa lo sfondo dell'album
  useEffect(() => {
    const h = (uno: { id: string; stato: string; risultati: string[]; richiesta: { etichetta?: string } }): void => {
      if (uno.richiesta.etichetta !== 'Sfondo album') return
      if (uno.stato === 'fatto' && uno.risultati[0]) {
        void api.galleria.opera(uno.risultati[0]).then((o) => {
          if (o) usaAlbum.getState().mod((a) => { a.sfondo = { tipo: 'immagine', percorso: o.file, colore: a.sfondo.colore } })
          setIaInCorso(false)
        })
      } else if (uno.stato === 'errore' || uno.stato === 'annullato') setIaInCorso(false)
    }
    ascoltatoriLavoro.push(h as never)
    return () => {
      const i = ascoltatoriLavoro.indexOf(h as never)
      if (i >= 0) ascoltatoriLavoro.splice(i, 1)
    }
  }, [])

  if (!album) return <div className="pagina"><div className="vuoto"><div className="grosso">ALBUM</div><p>Apro…</p></div></div>

  const mod = usaAlbum.getState().mod
  const foto = mappaFoto(album)
  const spread = album.spreads[corrente]
  const usate = new Map<string, number>()
  for (const s of album.spreads) for (const p of s.piazze) usate.set(p.foto, (usate.get(p.foto) || 0) + 1)
  const nonUsate = album.foto.filter((f) => !usate.has(f.id))
  const dimSpread = spreadDi(album)

  function togliCella(): void {
    const s = usaAlbum.getState()
    if (!s.album || s.cella === null) return
    const idx = s.corrente
    const c = s.cella
    s.mod((a) => {
      const sp = a.spreads[idx]
      if (!sp) return
      sp.piazze.splice(c, 1)
      if (sp.piazze.length === 0) a.spreads.splice(idx, 1)
      else if (sp.piazze.length === 1 && sp.stile !== 'pieno') sp.stile = 'classico'
    })
    usaAlbum.setState({ cella: null })
  }

  const daGalleria = async (): Promise<void> => {
    const f = await scegliFoto(true)
    if (!f.length) return
    const n = await usaAlbum.getState().importa(f.map((x) => x.percorso))
    if (n) avvisa(`${n} foto nell'album`, 'ok')
  }
  const daPc = async (): Promise<void> => {
    const ps = await api.file.scegliImmagini(true)
    if (!ps.length) return
    const n = await usaAlbum.getState().importa(ps)
    if (n) avvisa(`${n} foto nell'album`, 'ok')
  }

  const aggiungiNonUsate = (): void => {
    if (!nonUsate.length) return
    mod((a) => {
      const gruppi = raggruppa(nonUsate, { ...a, copertina: false, seme: Date.now() })
      for (const g of gruppi) a.spreads.push({ id: crypto.randomUUID(), piazze: g.ids.map(piazza), layout: 0, stile: g.ids.length === 1 ? 'pieno' : 'classico' })
    })
    usaAlbum.getState().scegli(album.spreads.length)
  }

  const impagina = (): void => {
    if (!album.foto.length) {
      avvisa('Prima aggiungi le foto', 'errore')
      return
    }
    if (album.spreads.length && !confirm('Rifaccio tutta l\'impaginazione? I ritocchi che hai fatto agli spread si perdono (puoi annullare con Ctrl+Z).')) return
    usaAlbum.getState().costruisci()
  }

  const sfondoDaGalleria = async (): Promise<void> => {
    const [f] = await scegliFoto(false)
    if (f) mod((a) => { a.sfondo = { tipo: 'immagine', percorso: f.percorso, colore: a.sfondo.colore } })
  }
  const sfondoIa = async (): Promise<void> => {
    if (!ia.trim()) return
    setIaInCorso(true)
    const ar = dimSpread.w / dimSpread.h
    const m32 = (x: number): number => Math.max(512, Math.round(x / 32) * 32)
    const w = m32(Math.sqrt(1048576 * 1.3 * ar))
    const h = m32(Math.sqrt((1048576 * 1.3) / ar))
    try {
      await api.lavori.accoda({
        ...richiestaBase(),
        modalita: 'crea',
        prompt: `${ia.trim()}. A seamless, subtle, elegant background texture for a photo album page, no text, no objects, no people, soft and uncluttered.`,
        larghezza: w,
        altezza: h,
        megapixel: (w * h) / 1048576,
        quante: 1,
        etichetta: 'Sfondo album',
        ...perQualita('alta')
      })
      avvisa('Genero lo sfondo: lo trovi nella coda; appena è pronto lo metto nell\'album', 'ok')
    } catch (e) {
      setIaInCorso(false)
      avvisa((e as Error).message, 'errore')
    }
  }

  return (
    <div className="pagina"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const fs = Array.from(e.dataTransfer.files)
        if (!fs.length) return
        e.preventDefault()
        e.stopPropagation()
        void usaAlbum.getState().importa(fs.map((f) => api.file.percorso(f)))
      }}
    >
      <div className="colonna">
        <div className="scorri">
          <div className="sezione">
            <h3>Album <span className="dx">{album.foto.length} foto · {album.spreads.length} spread</span></h3>
            <input type="text" value={album.nome} onChange={(e) => mod((a) => { a.nome = e.target.value }, true)} placeholder="Nome dell'album" />
            <div className="riga a-capo" style={{ marginTop: 8, gap: 6 }}>
              <select value={album.id} onChange={(e) => void usaAlbum.getState().apri(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
                {!elenco.some((x) => x.id === album.id) && <option value={album.id}>{album.nome}</option>}
                {elenco.map((x) => <option key={x.id} value={x.id}>{x.nome} · {x.foto} foto</option>)}
              </select>
              <button className="btn piccolo" onClick={() => void usaAlbum.getState().nuovo()} title="Un album nuovo"><I.piu /> Nuovo</button>
              <button className="btn piccolo fantasma pericolo icona" title="Elimina questo album (le foto originali restano dove sono)" onClick={() => confirm(`Elimino l'album "${album.nome}"? Le tue foto originali non si toccano.`) && void usaAlbum.getState().elimina(album.id).then(async () => {
                const l = usaAlbum.getState().elenco
                if (l.length) await usaAlbum.getState().apri(l[0].id)
                else await usaAlbum.getState().nuovo()
              })}><I.cestino /></button>
            </div>
          </div>

          <div className="sezione">
            <h3>Foto <span className="dx">{nonUsate.length ? `${nonUsate.length} non usate` : album.foto.length ? 'tutte usate' : ''}</span></h3>
            <div className="riga a-capo" style={{ gap: 6 }}>
              <button className="btn" onClick={daGalleria}><I.galleria /> Dalla galleria</button>
              <button className="btn" onClick={daPc} title="JPG, PNG, HEIC, TIFF e i RAW di tutte le fotocamere (CR2, CR3, NEF, ARW, DNG, RAF, ORF…)"><I.immagine /> Dal PC · anche RAW</button>
            </div>
            <div className="piccolo spento" style={{ marginTop: 6 }}>Oppure trascinale qui. I RAW diventano JPEG ad alta qualità (6000 px): gli originali non si toccano.</div>
            <div style={{ marginTop: 10 }}>
              <span className="piccolo tenue">Ordine delle foto</span>
              <Segmenti valore={album.ordine} cambia={(ordine) => mod((a) => { a.ordine = ordine })} voci={[{ id: 'data', nome: 'Data di scatto' }, { id: 'nome', nome: 'Nome' }, { id: 'scelta', nome: 'Come le ho messe' }]} />
            </div>
          </div>

          <div className="sezione">
            <h3>Formato <span className="dx">{dimSpread.w / 10} × {dimSpread.h / 10} cm {album.doppie ? 'aperto' : ''}</span></h3>
            <select value={album.formato} onChange={(e) => mod((a) => {
              a.formato = e.target.value
              const f = FORMATI.find((x) => x.id === e.target.value)
              if (f && f.id !== 'custom') a.pagina = { w: f.w, h: f.h }
            })}>
              {FORMATI.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            {album.formato === 'custom' && (
              <div className="riga" style={{ gap: 8, marginTop: 8 }}>
                <input type="number" min={5} max={80} step={0.5} value={album.pagina.w / 10} onChange={(e) => mod((a) => { a.pagina.w = Math.round(Number(e.target.value) * 10) }, true)} />
                <span className="tenue">×</span>
                <input type="number" min={5} max={80} step={0.5} value={album.pagina.h / 10} onChange={(e) => mod((a) => { a.pagina.h = Math.round(Number(e.target.value) * 10) }, true)} />
                <span className="piccolo tenue">cm (una pagina)</span>
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <Segmenti valore={album.doppie ? 'doppie' : 'singola'} cambia={(v) => mod((a) => { a.doppie = v === 'doppie' })} voci={[{ id: 'doppie', nome: 'Aperto', sotto: '2 pagine' }, { id: 'singola', nome: 'Pagina singola' }]} />
            </div>
          </div>

          <div className="sezione">
            <h3>Impaginazione automatica</h3>
            <div className="riga spazia"><span className="tenue">Foto per spread: da</span><Contatore valore={album.min} min={1} max={album.max} cambia={(v) => mod((a) => { a.min = v })} /></div>
            <div className="riga spazia" style={{ marginTop: 6 }}><span className="tenue">fino a</span><Contatore valore={album.max} min={album.min} max={8} cambia={(v) => mod((a) => { a.max = v })} /></div>
            <div style={{ marginTop: 10 }}>
              <Segmenti valore={album.stileAuto} cambia={(v) => mod((a) => { a.stileAuto = v })} voci={[{ id: 'classico', nome: 'Ordinato', sotto: 'celle simili' }, { id: 'misto', nome: 'Misto' }, { id: 'dinamico', nome: 'Dinamico', sotto: 'una grande' }]} />
            </div>
            <div className="col" style={{ gap: 8, marginTop: 10 }}>
              <Interruttore acceso={album.preferiteGrandi} cambia={(v) => mod((a) => { a.preferiteGrandi = v })} sotto="Le foto con la ★ hanno una pagina tutta per loro">Preferite a tutta pagina</Interruttore>
              <Interruttore acceso={album.copertina} cambia={(v) => mod((a) => { a.copertina = v })} sotto="La prima foto (o una ★) con il titolo">Copertina</Interruttore>
              <Interruttore acceso={album.evitaPiega} cambia={(v) => mod((a) => { a.evitaPiega = v })} sotto="Le foto non attraversano la piega al centro">Evita la piega</Interruttore>
            </div>
            <Cursore etichetta="Nuovo spread dopo una pausa di" valore={album.momento} min={0} max={180} passo={5} formato={(v) => (v ? `${v} min` : 'spento')} cambia={(v) => mod((a) => { a.momento = v }, true)} titolo="Se fra due scatti passa più tempo, comincia una pagina nuova (un altro momento della giornata)" />
            <button className="btn primario grande" style={{ width: '100%', marginTop: 10 }} onClick={impagina} disabled={!album.foto.length}>
              <I.crea /> Impagina tutto
            </button>
          </div>

          <div className="sezione">
            <h3>Aspetto</h3>
            <Cursore etichetta="Margine" valore={album.margine} min={0} max={40} passo={1} formato={(v) => `${v} mm`} cambia={(v) => mod((a) => { a.margine = v }, true)} />
            <Cursore etichetta="Spazio fra le foto" valore={album.spazio} min={0} max={30} passo={1} formato={(v) => `${v} mm`} cambia={(v) => mod((a) => { a.spazio = v }, true)} />
            <Cursore etichetta="Angoli arrotondati" valore={album.angoli} min={0} max={20} passo={1} formato={(v) => (v ? `${v} mm` : 'no')} cambia={(v) => mod((a) => { a.angoli = v }, true)} />
            <Cursore etichetta="Taglio massimo delle foto" valore={Math.round(album.taglioMax * 100)} min={0} max={50} passo={5} formato={(v) => `${v}%`} cambia={(v) => mod((a) => { a.taglioMax = v / 100 }, true)} titolo="Una foto si taglia al massimo di così per riempire la sua cella; oltre resta intera, con lo sfondo attorno" />
            <Cursore etichetta="Abbondanza (vivo)" valore={album.abbondanza} min={0} max={10} passo={1} formato={(v) => `${v} mm`} cambia={(v) => mod((a) => { a.abbondanza = v }, true)} titolo="Quanto si estende il disegno oltre il taglio, come lo vuole il laboratorio di stampa" />
            <div style={{ marginTop: 10 }}>
              <span className="piccolo tenue">Sfondo</span>
              <div className="colori-album">
                {COLORI_SFONDO.map((c) => (
                  <button key={c} className={album.sfondo.tipo === 'colore' && album.sfondo.colore === c ? 'su' : ''} style={{ background: c }} onClick={() => mod((a) => { a.sfondo = { tipo: 'colore', colore: c } })} title={c} />
                ))}
                <input type="color" value={album.sfondo.colore} onChange={(e) => mod((a) => { a.sfondo = { tipo: 'colore', colore: e.target.value } }, true)} title="Un colore a scelta" />
              </div>
              <div className="riga a-capo" style={{ gap: 6, marginTop: 8 }}>
                <button className="btn piccolo" onClick={sfondoDaGalleria}><I.galleria /> Immagine dalla galleria</button>
                {album.sfondo.tipo === 'immagine' && <button className="btn piccolo fantasma" onClick={() => mod((a) => { a.sfondo = { tipo: 'colore', colore: a.sfondo.colore } })}><I.x /> Togli</button>}
              </div>
              <div className="riga" style={{ gap: 6, marginTop: 8 }}>
                <input type="text" value={ia} onChange={(e) => setIa(e.target.value)} placeholder="Sfondo con l'AI: es. carta color crema, acquerello" style={{ flex: 1, minWidth: 0 }} onKeyDown={(e) => e.key === 'Enter' && void sfondoIa()} />
                <button className="btn piccolo" onClick={() => void sfondoIa()} disabled={iaInCorso || !ia.trim()} title="Qwen-Image disegna uno sfondo delle proporzioni dello spread">{iaInCorso ? '…' : <I.bacchetta />}</button>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <span className="piccolo tenue">Carattere dei testi</span>
              <Segmenti valore={album.font} cambia={(v) => mod((a) => { a.font = v })} voci={FONT_ALBUM.map((f) => ({ id: f.id, nome: <span style={{ fontFamily: f.id }}>{f.nome}</span> }))} />
            </div>
          </div>
        </div>
        <div className="sezione" style={{ borderTop: '1px solid #1d1636' }}>
          <button className="btn primario grande" style={{ width: '100%' }} onClick={() => setEsportando(true)} disabled={!album.spreads.length}>
            <I.scarica /> Esporta per la stampa
          </button>
          <div className="piccolo spento" style={{ textAlign: 'center', marginTop: 6 }}>JPEG o PDF · 150–300 dpi · con abbondanza</div>
        </div>
      </div>

      <div className="palco palco-album">
        <div className="barra-album">
          <button className="btn icona piccolo" onClick={() => usaAlbum.getState().annulla()} disabled={!storia.length} title="Annulla (Ctrl+Z)"><I.annulla /></button>
          <button className="btn icona piccolo" onClick={() => usaAlbum.getState().ripeti()} disabled={!futuro.length} title="Ripeti (Ctrl+Y)"><I.ripeti /></button>
          <span className="sep" />
          {spread ? (
            <>
              <span className="piccolo tenue">Spread {corrente + 1} di {album.spreads.length}</span>
              <button className="btn piccolo" onClick={() => mod((a) => { a.spreads[corrente].layout += 1 })} disabled={spread.piazze.length < 2 && spread.stile === 'pieno'} title="Un altro modo di mettere le foto"><I.ricicla /> Altro layout</button>
              <Segmenti
                valore={spread.stile}
                cambia={(stile) => mod((a) => { a.spreads[corrente].stile = stile; a.spreads[corrente].layout = 0 })}
                voci={[{ id: 'classico', nome: 'Ordinato' }, { id: 'dinamico', nome: 'Dinamico' }, { id: 'pieno', nome: 'Una grande' }]}
              />
              <input
                type="text"
                value={spread.testo || ''}
                placeholder="Testo (facoltativo)"
                style={{ width: 180 }}
                onChange={(e) => mod((a) => { a.spreads[corrente].testo = e.target.value; a.spreads[corrente].posTesto ??= 'basso' }, true)}
              />
              {spread.testo && (
                <select value={spread.posTesto || 'basso'} onChange={(e) => mod((a) => { a.spreads[corrente].posTesto = e.target.value as Spread['posTesto'] }, true)}>
                  <option value="basso">in basso</option><option value="alto">in alto</option><option value="centro">al centro</option>
                </select>
              )}
              <span className="flex1" />
              <button className={`btn piccolo ${guide ? 'attivo' : ''}`} onClick={() => setGuide(!guide)} title="Mostra il vivo (rosa), i margini (azzurro) e la piega"><I.rettangolo /> Guide</button>
              <button className="btn piccolo fantasma pericolo" onClick={() => mod((a) => { a.spreads.splice(corrente, 1) })} title="Toglie questo spread (le foto restano nell'album)"><I.cestino /> Spread</button>
            </>
          ) : <span className="piccolo spento">Aggiungi le foto e premi «Impagina tutto»</span>}
        </div>

        {spread && cella !== null && spread.piazze[cella] && (
          <div className="barra-cella">
            <img src={urlFile(foto.get(spread.piazze[cella].foto)?.mini)} alt="" />
            <b>{foto.get(spread.piazze[cella].foto)?.nome}</b>
            <button className="btn piccolo icona" disabled={cella === 0} onClick={() => { mod((a) => { const p = a.spreads[corrente].piazze; [p[cella - 1], p[cella]] = [p[cella], p[cella - 1]] }); usaAlbum.setState({ cella: cella - 1 }) }} title="Scambia con la foto prima">◂</button>
            <button className="btn piccolo icona" disabled={cella >= spread.piazze.length - 1} onClick={() => { mod((a) => { const p = a.spreads[corrente].piazze; [p[cella + 1], p[cella]] = [p[cella], p[cella + 1]] }); usaAlbum.setState({ cella: cella + 1 }) }} title="Scambia con la foto dopo">▸</button>
            <button className={`btn piccolo icona ${foto.get(spread.piazze[cella].foto)?.preferita ? 'attivo' : ''}`} onClick={() => mod((a) => { const f = a.foto.find((x) => x.id === spread.piazze[cella].foto); if (f) f.preferita = !f.preferita })} title="Preferita: può avere una pagina tutta sua">
              {foto.get(spread.piazze[cella].foto)?.preferita ? <I.stellaPiena /> : <I.stella />}
            </button>
            <div style={{ width: 150 }}>
              <Cursore etichetta="Zoom" valore={Math.round(spread.piazze[cella].zoom * 100)} min={100} max={300} passo={5} formato={(v) => `${v}%`} cambia={(v) => mod((a) => { a.spreads[corrente].piazze[cella].zoom = v / 100 }, true)} />
            </div>
            <button className="btn piccolo" onClick={() => mod((a) => { const p = a.spreads[corrente].piazze[cella]; p.fx = 0.5; p.fy = 0.5; p.zoom = 1 })} title="Rimette la foto com'era"><I.ripristina /> Centra</button>
            <button className="btn piccolo fantasma pericolo" onClick={togliCella}><I.x /> Togli dallo spread</button>
            <span className="piccolo spento">Trascina la foto per spostare l'inquadratura</span>
          </div>
        )}

        <Palco spread={spread} album={album} cella={cella} guide={guide} />

        <div className="strisce-album">
          <div className="spreads-album">
            {album.spreads.map((s, i) => (
              <MiniSpread key={s.id} album={album} spread={s} su={i === corrente} numero={i + 1}
                scegli={() => usaAlbum.getState().scegli(i)}
                sposta={(d) => { mod((a) => { const j = i + d; if (j < 0 || j >= a.spreads.length) return; [a.spreads[i], a.spreads[j]] = [a.spreads[j], a.spreads[i]] }); usaAlbum.getState().scegli(Math.max(0, Math.min(album.spreads.length - 1, i + d))) }}
                elimina={() => mod((a) => { a.spreads.splice(i, 1) })}
                aggiungiFoto={(id) => mod((a) => { const sp = a.spreads[i]; if (sp.piazze.length < 8 && !sp.piazze.some((p) => p.foto === id)) { sp.piazze.push(piazza(id)); sp.layout = 0; if (sp.stile === 'pieno') sp.stile = 'classico' } })}
              />
            ))}
            <button className="nuovo-spread" onClick={() => { mod((a) => { a.spreads.push({ id: crypto.randomUUID(), piazze: [], layout: 0, stile: 'classico' }) }); usaAlbum.getState().scegli(album.spreads.length) }} title="Uno spread vuoto: poi ci trascini le foto"><I.piu /></button>
          </div>
          <div className="pool-album">
            <div className="pool-testa">
              <b>FOTO</b>
              <span className="piccolo tenue">{album.foto.length} · clic = aggiungi allo spread · trascina sullo spread o su una cella</span>
              <span className="flex1" />
              {nonUsate.length > 0 && <button className="btn piccolo" onClick={aggiungiNonUsate}><I.piu /> Impagina le {nonUsate.length} non usate</button>}
            </div>
            <div className="pool-foto">
              {ordinaPool(album).map((f) => (
                <div key={f.id} className={`foto-pool ${usate.has(f.id) ? '' : 'non-usata'}`} draggable onDragStart={(e) => { e.dataTransfer.setData('application/x-foto-album', f.id); e.dataTransfer.effectAllowed = 'copy' }}
                  onClick={() => spread && mod((a) => { const sp = a.spreads[corrente]; if (sp.piazze.length < 8 && !sp.piazze.some((p) => p.foto === f.id)) { sp.piazze.push(piazza(f.id)); sp.layout = 0; if (sp.stile === 'pieno') sp.stile = 'classico' } })}
                  title={`${f.nome} · ${f.w}×${f.h}${f.data ? ' · ' + new Date(f.data).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : ''}`}>
                  <img src={urlFile(f.mini)} alt="" draggable={false} />
                  {usate.get(f.id) ? <span className="n">{usate.get(f.id)}×</span> : <span className="n nuova">nuova</span>}
                  <button className={`st ${f.preferita ? 'si' : ''}`} onClick={(e) => { e.stopPropagation(); mod((a) => { const x = a.foto.find((y) => y.id === f.id); if (x) x.preferita = !x.preferita }) }} title="Preferita">{f.preferita ? <I.stellaPiena /> : <I.stella />}</button>
                  <button className="x" onClick={(e) => { e.stopPropagation(); mod((a) => { a.foto = a.foto.filter((y) => y.id !== f.id); for (const s of a.spreads) s.piazze = s.piazze.filter((p) => p.foto !== f.id); a.spreads = a.spreads.filter((s) => s.piazze.length) }) }} title="Toglie la foto dall'album"><I.x /></button>
                </div>
              ))}
              {album.foto.length === 0 && <div className="spento piccolo" style={{ padding: 12 }}>Nessuna foto ancora: aggiungile dalla galleria o dal PC (anche RAW), oppure trascinale qui.</div>}
            </div>
          </div>
        </div>

        {lavoro && (
          <div className="lavoro-album">
            <div className="barra-progresso"><i style={{ width: `${(lavoro.fatto / Math.max(1, lavoro.totale)) * 100}%` }} /></div>
            <span>{lavoro.testo}</span>
          </div>
        )}
      </div>

      {esportando && <PannelloEsporta album={album} chiudi={() => setEsportando(false)} />}
    </div>
  )
}

/** le foto nell'ordine scelto per l'album */
function ordinaPool(a: TipoAlbum): TipoAlbum['foto'] {
  if (a.ordine === 'scelta') return a.foto
  return [...a.foto].sort((x, y) => (a.ordine === 'nome' ? x.nome.localeCompare(y.nome, 'it', { numeric: true }) : x.data - y.data))
}

/** lo spread in grande: si disegna da solo, si riempie, si sposta l'inquadratura trascinando */
function Palco(p: { spread: Spread | undefined; album: TipoAlbum; cella: number | null; guide: boolean }): JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [dim, setDim] = useState({ w: 0, h: 0 })
  const token = useRef(0)
  const trascina = useRef<{ x: number; y: number; fx: number; fy: number; cella: number; ox: number; oy: number } | null>(null)
  const { album, spread } = p

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setDim({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setDim({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const s = spreadDi(album)
  const tw = s.w + 2 * album.abbondanza
  const th = s.h + 2 * album.abbondanza
  const scala = Math.max(0.1, Math.min((dim.w - 40) / tw, (dim.h - 30) / th))
  const dpr = window.devicePixelRatio || 1

  useEffect(() => {
    const c = canvas.current
    if (!c || !spread || dim.w < 50) return
    const mio = ++token.current
    void (async () => {
      const t = document.createElement('canvas')
      await disegnaSpread(t, album, spread, { px: scala * dpr, grande: false, guide: p.guide, selezione: p.cella ?? undefined })
      if (mio !== token.current) return
      c.width = t.width
      c.height = t.height
      c.getContext('2d')!.drawImage(t, 0, 0)
    })()
  }, [album, spread, scala, dpr, p.guide, p.cella, dim.w])

  const dove = (e: React.PointerEvent | React.DragEvent): { mx: number; my: number; i: number } | null => {
    const c = canvas.current
    if (!c || !spread) return null
    const r = c.getBoundingClientRect()
    const mx = ((e.clientX - r.left) / r.width) * tw
    const my = ((e.clientY - r.top) / r.height) * th
    const geo = geometria(album, spread, mappaFoto(album))
    const i = geo.celle.findIndex((k) => mx >= k.x && mx <= k.x + k.w && my >= k.y && my <= k.y + k.h)
    return { mx, my, i }
  }

  const giu = (e: React.PointerEvent): void => {
    const d = dove(e)
    if (!d || !spread) return
    if (d.i < 0 || !spread.piazze[d.i]) {
      usaAlbum.setState({ cella: null })
      return
    }
    usaAlbum.setState({ cella: d.i })
    const pz = spread.piazze[d.i]
    trascina.current = { x: e.clientX, y: e.clientY, fx: pz.fx, fy: pz.fy, cella: d.i, ox: 0, oy: 0 }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    // un solo passo di "annulla" per tutto il trascinamento
    usaAlbum.getState().mod(() => undefined)
  }
  const muovi = (e: React.PointerEvent): void => {
    const t = trascina.current
    if (!t || !spread) return
    const foto = mappaFoto(album)
    const geo = geometria(album, spread, foto)
    const cl = geo.celle[t.cella]
    const pz = spread.piazze[t.cella]
    const f = foto.get(pz.foto)
    if (!cl || !f) return
    const pos = adatta(cl, f.w, f.h, pz.fx, pz.fy, pz.zoom, spread.stile === 'pieno' && spread.piazze.length === 1 ? 0.95 : album.taglioMax)
    const mmPerPx = tw / (canvas.current!.getBoundingClientRect().width || 1)
    const dx = (e.clientX - t.x) * mmPerPx
    const dy = (e.clientY - t.y) * mmPerPx
    const ecc = { x: pos.w - cl.w, y: pos.h - cl.h }
    usaAlbum.getState().mod((a) => {
      const q = a.spreads[usaAlbum.getState().corrente].piazze[t.cella]
      if (ecc.x > 0.5) q.fx = Math.max(0, Math.min(1, t.fx - dx / ecc.x))
      if (ecc.y > 0.5) q.fy = Math.max(0, Math.min(1, t.fy - dy / ecc.y))
    }, true)
  }
  const su = (): void => {
    trascina.current = null
  }
  const ruota = (e: React.WheelEvent): void => {
    if (p.cella === null || !spread?.piazze[p.cella]) return
    const c = p.cella
    usaAlbum.getState().mod((a) => {
      const q = a.spreads[usaAlbum.getState().corrente].piazze[c]
      q.zoom = Math.max(1, Math.min(3, +(q.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)).toFixed(3)))
    }, true)
  }
  const rilascia = (e: React.DragEvent): void => {
    const id = e.dataTransfer.getData('application/x-foto-album')
    if (!id || !spread) return
    e.preventDefault()
    e.stopPropagation()
    const d = dove(e)
    const idx = usaAlbum.getState().corrente
    usaAlbum.getState().mod((a) => {
      const sp = a.spreads[idx]
      if (!sp) return
      const gia = sp.piazze.findIndex((q) => q.foto === id)
      if (d && d.i >= 0 && sp.piazze[d.i]) {
        // sopra una cella: la foto prende il suo posto (se era già qui, si scambiano)
        if (gia >= 0) [sp.piazze[gia], sp.piazze[d.i]] = [sp.piazze[d.i], sp.piazze[gia]]
        else sp.piazze[d.i] = piazza(id)
      } else if (gia < 0 && sp.piazze.length < 8) {
        sp.piazze.push(piazza(id))
        sp.layout = 0
        if (sp.stile === 'pieno') sp.stile = 'classico'
      }
    })
  }

  return (
    <div className="stage-album" ref={box}>
      {spread ? (
        <canvas
          ref={canvas}
          style={{ width: tw * scala, height: th * scala }}
          onPointerDown={giu}
          onPointerMove={muovi}
          onPointerUp={su}
          onPointerCancel={su}
          onWheel={ruota}
          onDragOver={(e) => e.dataTransfer.types.includes('application/x-foto-album') && e.preventDefault()}
          onDrop={rilascia}
        />
      ) : (
        <div className="vuoto"><div className="grosso">ALBUM <b>{paginaDi(album).w / 10}×{paginaDi(album).h / 10}</b></div><p>Aggiungi le foto (anche RAW) e premi <b className="oro">Impagina tutto</b>.</p></div>
      )}
    </div>
  )
}

function MiniSpread(p: { album: TipoAlbum; spread: Spread; su: boolean; numero: number; scegli: () => void; sposta: (d: number) => void; elimina: () => void; aggiungiFoto: (id: string) => void }): JSX.Element {
  const c = useRef<HTMLCanvasElement>(null)
  const s = spreadDi(p.album)
  const larg = 150
  const scala = larg / (s.w + 2 * p.album.abbondanza)
  useEffect(() => {
    const el = c.current
    if (!el) return
    let vivo = true
    const t = document.createElement('canvas')
    void disegnaSpread(t, p.album, p.spread, { px: scala * 2, grande: false }).then(() => {
      if (!vivo) return
      el.width = t.width
      el.height = t.height
      el.getContext('2d')!.drawImage(t, 0, 0)
    })
    return () => {
      vivo = false
    }
  }, [p.album, p.spread, scala])
  return (
    <div className={`mini-spread ${p.su ? 'su' : ''}`} onClick={p.scegli}
      onDragOver={(e) => e.dataTransfer.types.includes('application/x-foto-album') && e.preventDefault()}
      onDrop={(e) => { const id = e.dataTransfer.getData('application/x-foto-album'); if (id) { e.preventDefault(); e.stopPropagation(); p.aggiungiFoto(id) } }}>
      <canvas ref={c} style={{ width: larg, height: (s.h + 2 * p.album.abbondanza) * scala }} />
      <span className="num">{p.numero}</span>
      <div className="az">
        <button onClick={(e) => { e.stopPropagation(); p.sposta(-1) }} title="Sposta prima">◂</button>
        <button onClick={(e) => { e.stopPropagation(); p.sposta(1) }} title="Sposta dopo">▸</button>
        <button onClick={(e) => { e.stopPropagation(); p.elimina() }} title="Toglie lo spread"><I.x /></button>
      </div>
    </div>
  )
}

function PannelloEsporta(p: { album: TipoAlbum; chiudi: () => void }): JSX.Element {
  const { album } = p
  const [formato, setFormato] = useState<'pdf' | 'jpeg'>('pdf')
  const [pagine, setPagine] = useState<'doppie' | 'singole'>(album.doppie ? 'doppie' : 'singole')
  const [dpi, setDpi] = useState(300)
  const [abb, setAbb] = useState(album.abbondanza > 0)
  const [qualita, setQualita] = useState(92)
  const [cartella, setCartella] = useState('')
  const [nome, setNome] = useState(album.nome.replace(/[\\/:*?"<>|]+/g, '_'))
  const [stato, setStato] = useState<{ fatto: number; totale: number; testo: string } | null>(null)
  const [usciti, setUsciti] = useState<string[]>([])
  const fermo = useRef({ si: false })
  const avvisa = usaStato((s) => s.avvisa)
  const s = spreadDi(album)
  const lato = (pagine === 'singole' && album.doppie ? s.w / 2 : s.w) + (abb ? 2 * album.abbondanza : 0)
  const px = Math.round((lato / 25.4) * dpi)
  const lavora = !!stato && stato.fatto < stato.totale

  const scegliCartella = async (): Promise<void> => {
    const c = await api.file.scegliCartella(cartella || undefined)
    if (c) setCartella(c)
  }
  const vai = async (): Promise<void> => {
    if (!cartella) {
      avvisa('Scegli la cartella dove salvare', 'errore')
      return
    }
    fermo.current.si = false
    setUsciti([])
    try {
      const out = await esporta(album, { cartella, nome: nome || 'album', formato, pagine, dpi, abbondanza: abb, qualita: qualita / 100 }, (fatto, totale, testo) => setStato({ fatto, totale, testo }), fermo.current)
      setUsciti(out)
      if (out.length) avvisa(formato === 'pdf' ? 'PDF pronto' : `${out.length} immagini esportate`, 'ok')
    } catch (e) {
      avvisa((e as Error).message, 'errore')
      setStato(null)
    }
  }

  return (
    <div className="album-modale" onClick={(e) => e.target === e.currentTarget && !lavora && p.chiudi()}>
      <div className="pannello">
        <header>
          <b>ESPORTA PER LA STAMPA</b>
          <span className="flex1" />
          <button className="btn fantasma piccolo icona" onClick={p.chiudi} disabled={lavora}><I.x /></button>
        </header>
        <div className="corpo">
          <div>
            <span className="piccolo tenue">Formato del file</span>
            <Segmenti valore={formato} cambia={setFormato} voci={[{ id: 'pdf', nome: 'PDF', sotto: 'un file solo' }, { id: 'jpeg', nome: 'JPEG', sotto: 'un file per spread' }]} />
          </div>
          {album.doppie && (
            <div>
              <span className="piccolo tenue">Pagine</span>
              <Segmenti valore={pagine} cambia={setPagine} voci={[{ id: 'doppie', nome: 'Doppie', sotto: 'come le vedi' }, { id: 'singole', nome: 'Singole', sotto: 'una per pagina' }]} />
            </div>
          )}
          <div>
            <span className="piccolo tenue">Risoluzione</span>
            <Segmenti valore={dpi} cambia={setDpi} voci={[{ id: 150, nome: '150 dpi', sotto: 'bozza' }, { id: 200, nome: '200 dpi' }, { id: 300, nome: '300 dpi', sotto: 'stampa' }]} />
            <div className="piccolo spento" style={{ marginTop: 4 }}>Ogni file è largo circa {px} px</div>
          </div>
          <Interruttore acceso={abb} cambia={setAbb} sotto={`${album.abbondanza} mm di vivo attorno, come lo chiede il laboratorio`}>Con l'abbondanza</Interruttore>
          {formato === 'jpeg' && <Cursore etichetta="Qualità JPEG" valore={qualita} min={70} max={100} passo={1} formato={(v) => `${v}`} cambia={setQualita} />}
          <div>
            <span className="piccolo tenue">Cartella</span>
            <div className="riga" style={{ gap: 6 }}>
              <input type="text" value={cartella} readOnly placeholder="Scegli dove salvare" style={{ flex: 1, minWidth: 0 }} />
              <button className="btn" onClick={scegliCartella}><I.cartella /> Scegli</button>
            </div>
          </div>
          <label className="campo-preset"><span>Nome del file</span><input type="text" value={nome} onChange={(e) => setNome(e.target.value)} /></label>
          {stato && (
            <div>
              <div className="barra-progresso"><i style={{ width: `${(stato.fatto / Math.max(1, stato.totale)) * 100}%` }} /></div>
              <div className="piccolo tenue" style={{ marginTop: 4 }}>{stato.testo}</div>
            </div>
          )}
          {usciti.length > 0 && !lavora && (
            <div className="riga a-capo" style={{ gap: 8 }}>
              <span className="oro">✓ {usciti.length} {usciti.length === 1 ? 'file' : 'file'}</span>
              <button className="btn piccolo" onClick={() => void api.album.mostra(usciti[0])}><I.cartella /> Mostra</button>
            </div>
          )}
        </div>
        <footer>
          {lavora ? <button className="btn pericolo" onClick={() => { fermo.current.si = true }}>Ferma</button> : <button className="btn" onClick={p.chiudi}>Chiudi</button>}
          <button className="btn primario" onClick={() => void vai()} disabled={lavora}><I.scarica /> Esporta {album.spreads.length} {album.spreads.length === 1 ? 'spread' : 'spread'}</button>
        </footer>
      </div>
    </div>
  )
}
