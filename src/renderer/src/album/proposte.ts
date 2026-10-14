// I layout che si possono dare a uno spread: i modelli della libreria (abbinati alle foto per orientamento) e qualche
// impaginazione automatica a tagli. Ogni proposta è lo spread già pronto, così la miniatura si disegna uguale a come verrà.
import { candidati } from './layout'
import { abbina, celleModello, modelliPer } from './modelli'
import { geometria, mappaFoto } from './disegna'
import { spreadDi, type Album, type Spread } from './tipi'

export interface Proposta {
  id: string
  nome: string
  tipo: 'modello' | 'auto'
  /** lo spread con questo layout (foto già nell'ordine delle celle) */
  sp: Spread
  costo: number
}

/** i layout per questo spread, dal più adatto (meno foto tagliate) in poi */
export function proposte(a: Album, sp: Spread, conAuto = true, quanti = 18): Proposta[] {
  const foto = mappaFoto(a)
  const piazze = sp.piazze.filter((p) => foto.has(p.foto))
  const n = piazze.length
  if (!n) return []
  const ars = piazze.map((p) => foto.get(p.foto)!.w / foto.get(p.foto)!.h)
  const pref = piazze.map((p) => !!foto.get(p.foto)!.preferita)
  const s = spreadDi(a)
  const b = a.abbondanza
  const geo = geometria(a, { ...sp, piazze, modello: undefined }, foto)
  const tela = { x: 0, y: 0, w: s.w + 2 * b, h: s.h + 2 * b }
  const out: Proposta[] = []
  for (const m of modelliPer(n, a.doppie)) {
    const celle = celleModello(m, geo.area, tela, a.spazio)
    const { perm, costo } = abbina(ars, pref, celle, a.taglioMax)
    out.push({ id: m.id, nome: m.nome, tipo: 'modello', costo, sp: { ...sp, modello: m.id, layout: 0, stile: n === 1 && m.slot[0].vivo ? 'pieno' : 'classico', piazze: perm.map((i) => piazze[i]) } })
  }
  out.sort((x, y) => x.costo - y.costo)
  const fuori = out.slice(0, quanti)
  if (conAuto && n > 1) {
    // qualche impaginazione a tagli: celle che seguono le proporzioni delle foto
    for (const stile of ['classico', 'dinamico'] as const) {
      const c = candidati(ars, geo.area, { spazio: a.spazio, stile, piega: a.doppie && a.evitaPiega && n > 1, regina: pref.findIndex(Boolean), taglioMax: a.taglioMax }, 4)
      c.slice(0, 3).forEach((_, i) => fuori.push({ id: `auto-${stile}-${i}`, nome: stile === 'classico' ? 'Su misura' : 'Una in evidenza', tipo: 'auto', costo: 99, sp: { ...sp, modello: undefined, layout: i, stile, piazze } }))
    }
  }
  return fuori
}

/** è questa la proposta attualmente applicata allo spread? */
export function eAttiva(p: Proposta, sp: Spread): boolean {
  if (p.tipo === 'modello') return sp.modello === p.sp.modello
  return !sp.modello && sp.layout === p.sp.layout && sp.stile === p.sp.stile
}
