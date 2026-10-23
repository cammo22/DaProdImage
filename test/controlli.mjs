// Prova del catalogo dei controlli di Modifica (controlli.ts) e dei 28 stili: ogni valore produce una frase non vuota, in inglese,
// con al massimo una foto di riferimento; i valori stanno nell'id dell'idea e tornano uguali; i controlli spenti non producono nulla.
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'
mkdirSync('test/.out', { recursive: true })
buildSync({
  stdin: { contents: "export * from './src/renderer/src/controlli'; export * from './src/renderer/src/stili'; export { CATEGORIE } from './src/renderer/src/rapide'", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, platform: 'node', format: 'cjs', alias: { '@shared': resolve('src/shared') }, outfile: 'test/.out/controlli.cjs'
})
const m = createRequire(import.meta.url)('./.out/controlli.cjs')
const { CONTROLLI, controlliDi, ideaDa, valoreDa, conControllo, scriviMulti, leggiMulti, STILI, SCAFFALI, CATEGORIE } = m

// ---- ogni controllo, ogni valore
let frasi = 0
const buona = (f, dove) => {
  assert.ok(f && f.trim().length > 12, `${dove}: frase troppo corta`)
  assert.ok((f.match(/<image\d+>/g) || []).length <= 1, `${dove}: più di una foto di riferimento`)
  assert.ok(!/[àèéìòù]/i.test(f), `${dove}: la frase deve essere in inglese`)
  frasi++
}
const idCategorie = new Set(CATEGORIE.map((c) => c.id))
for (const c of CONTROLLI) {
  assert.ok(idCategorie.has(c.categoria), `${c.id}: categoria ${c.categoria} che non esiste`)
  assert.ok(c.nome && c.tooltip && c.icona, `${c.id}: manca nome, tooltip o icona`)
  if (c.tipo === 'cursore') {
    assert.equal(c.compila(c.neutro), null, `${c.id}: il neutro deve essere spento`)
    for (let v = c.min; v <= c.max; v++) if (v !== c.neutro) buona(c.compila(v)?.frase, `${c.id}=${v}`)
    if (c.etichette) assert.equal(c.etichette.length, c.max - c.min + 1, `${c.id}: un'etichetta per ogni valore`)
  } else {
    assert.equal(c.compila({}), null, `${c.id}: vuoto = spento`)
    const prima = c.parti[0]
    if (prima.tipo === 'testo') buona(c.compila({ [prima.id]: 'CIAO' })?.frase, c.id)
    for (const parte of c.parti) {
      if (parte.tipo === 'testo') {
        // il testo da solo basta (le altre righe sono facoltative)
        const base = Object.fromEntries(c.parti.filter((x) => x.tipo === 'testo').map((x) => [x.id, 'CIAO "bello"']))
        buona(c.compila(base)?.frase, `${c.id}/testo`)
        assert.ok(/"bello"/.test(c.compila(base).frase), `${c.id}: i testi tra virgolette restano identici`)
        continue
      }
      const vistiId = new Set()
      for (const o of parte.opzioni) {
        assert.ok(!vistiId.has(o.id), `${c.id}/${parte.id}: id doppio ${o.id}`)
        vistiId.add(o.id)
        assert.ok(o.nome && o.icona && o.frase, `${c.id}/${parte.id}/${o.id}: manca nome, icona o frase`)
        // le righe che non bastano da sole (es. materiale senza capo) si provano con una base che le attiva
        const base = c.id === 'capo' && parte.id !== 'capo' ? { capo: 'giacca' } : {}
        const testi = c.parti.filter((x) => x.tipo === 'testo')
        const extra = Object.fromEntries(testi.map((x) => [x.id, 'CIAO']))
        buona(c.compila({ ...base, ...extra, [parte.id]: o.id })?.frase, `${c.id}/${parte.id}/${o.id}`)
      }
    }
  }
}

// ---- il valore sta nell'id dell'idea e torna uguale
const eta = CONTROLLI.find((c) => c.id === 'eta')
const luce = CONTROLLI.find((c) => c.id === 'luce')
let idee = conControllo([{ id: 'altra' }], eta, '10')
assert.equal(idee.length, 2)
assert.equal(valoreDa(eta, idee), '10')
idee = conControllo(idee, eta, '-20')
assert.equal(idee.length, 2, 'cambiare il valore sostituisce, non aggiunge')
assert.equal(valoreDa(eta, idee), '-20')
assert.match(idee.find((r) => r.id.startsWith('ctl-eta:')).prompt, /younger/)
idee = conControllo(idee, eta, '0')
assert.equal(idee.length, 1, 'il neutro toglie l\'idea')
assert.equal(valoreDa(eta, idee), '0')
const v = { dir: 'tl', qualita: 'dura', colore: '#ec4899' }
idee = conControllo(idee, luce, scriviMulti(v))
assert.deepEqual(leggiMulti(valoreDa(luce, idee)), v, 'i valori multipli tornano uguali')
assert.match(ideaDa(luce, scriviMulti(v)).prompt, /upper left.*hard direct light.*pink/s)
assert.equal(ideaDa(luce, ''), null)
// un testo con ; e = non deve rompere la lettura
const t = CONTROLLI.find((c) => c.id === 'titolo')
assert.equal(leggiMulti(scriviMulti({ testo: 'a;b=c', dove: 'c' })).testo, 'a;b=c')
assert.ok(controlliDi('luce').length >= 2 && controlliDi('persone').length >= 3)
assert.ok(ideaDa(t, scriviMulti({ testo: 'CIAO', dove: 't', come: 'meme' })).prompt.includes('"CIAO" across the top'))

// ---- gli stili: 28, 4 scaffali da 7, id unici, frammenti in inglese e le tre intensità
assert.equal(STILI.length, 28)
assert.equal(new Set(STILI.map((s) => s.id)).size, 28, 'id degli stili doppi')
for (const sc of SCAFFALI) assert.equal(STILI.filter((s) => s.scaffale === sc.id).length, 7, `scaffale ${sc.id}`)
for (const s of STILI) {
  assert.ok(s.frammento.length > 20 && s.nome && s.icona && s.fondo, `stile ${s.id} incompleto`)
  for (const i of [0, 1, 2]) { buona(m.fraseStileCrea(s, i), `stile ${s.id} Crea ${i}`); buona(m.frasiStileModifica(s, i), `stile ${s.id} Modifica ${i}`) }
}
assert.notEqual(m.fraseStileCrea(STILI[0], 0), m.fraseStileCrea(STILI[0], 2), 'le intensità devono differire')
// Le scelte non sono più campi «…» da completare: tutte le categorie hanno controlli tipizzati.
for (const id of ['capelli', 'animale', 'costume', 'luogo', 'meteo', 'stagione', 'inquadratura', 'mood', 'grading']) assert.ok(CONTROLLI.some((c) => c.id === id), `manca il controllo ${id}`)
console.log(`OK: ${CONTROLLI.length} controlli, ${frasi} frasi controllate, 28 stili in 4 scaffali, valori nell'id che tornano uguali`)

// LocalStorage rovinato e input fuori catalogo non devono produrre prompt NaN o bloccare la pagina.
assert.equal(ideaDa(eta, 'NaN'), null)
assert.equal(ideaDa(eta, '1000'), null)
assert.deepEqual(leggiMulti('testo=%ZZ;senzaSeparatore'), {})
assert.equal(ideaDa(luce, 'dir=inesistente'), null)
assert.ok(ideaDa(t, scriviMulti({ testo: 'CIAO "MONDO"' })).prompt.includes('CIAO "MONDO"'), 'i testi da disegnare restano letterali')
