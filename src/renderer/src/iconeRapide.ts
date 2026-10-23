// Le azioni rapide di Modifica (rapide.ts) come tessere: ognuna ha un'icona (emoji, in attesa degli asset disegnati) e UNA parola.
// Il nome lungo resta nel tooltip. Niente chip di testo: le tessere sono quadrate, come la griglia delle Idee.
import type { Rapida } from './rapide'

/** id → [icona, parola] */
const ICONE: Record<string, [string, string]> = {
  'persona-rif': ['🔁', 'Cambia'], 'persona-agg': ['🧑‍🤝‍🧑', 'Aggiungi'], 'persona-togli': ['🫥', 'Togli'], sorriso: ['😊', 'Sorriso'], occhi: ['👀', 'Occhi'],
  giovane: ['🧒', 'Giovane'], anziano: ['🧓', 'Anziano'], capelli: ['💇', 'Capelli'], 'capelli-col': ['🌈', 'Colore'], occhiali: ['🕶️', 'Occhiali'], barba: ['🧔', 'Barba'], animale: ['🐕', 'Animale'],
  prova: ['👕', 'Prova'], vestito: ['👗', 'Vestito'], abito: ['🥂', 'Da sera'], elegante: ['🤵', 'Elegante'], casual: ['👖', 'Casual'], invernale: ['🧥', 'Inverno'], costume: ['🎭', 'Costume'],
  divisa: ['🎖️', 'Divisa'], armatura: ['🛡️', 'Armatura'], spazio: ['👨‍🚀', 'Astronauta'],
  sfondo: ['🏞️', 'Sfondo'], mettilo: ['📍', 'Mettilo in'], notte: ['🌙', 'Notte'], pioggia: ['🌧️', 'Pioggia'], neve: ['❄️', 'Neve'], nebbia: ['🌫️', 'Nebbia'], tramonto: ['🌇', 'Tramonto'],
  primavera: ['🌸', 'Primavera'], autunno: ['🍂', 'Autunno'], 'sott-acqua': ['🌊', 'Sott\'acqua'], 'spazio-sit': ['🪐', 'Spazio'], anni80: ['📼', 'Anni 80'], futuro: ['🔮', 'Futuro'], folla: ['👥', 'Folla'], svuota: ['🧹', 'Svuota'],
  alto: ['⬆️', 'Dall\'alto'], basso: ['⬇️', 'Dal basso'], 'dall-alto-top': ['🦅', 'Zenitale'], 'primo-piano': ['🔍', 'Primo piano'], largo: ['🏔️', 'Campo largo'], lato: ['↔️', 'Di lato'], dietro: ['🔙', 'Da dietro'],
  'tre-quarti': ['📐', 'Tre quarti'], grandangolo: ['🔭', 'Grandangolo'], tele: ['📷', 'Tele'],
  studio: ['💡', 'Studio'], oro: ['🌅', 'Ora d\'oro'], controluce: ['🌄', 'Controluce'], neon: ['🌃', 'Neon'], drammatica: ['🎬', 'Drammatica'], candela: ['🕯️', 'Candela'], 'bn-colora': ['🎨', 'Colora'], bn: ['⚫', 'B/N'],
  pellicola: ['🎞️', 'Pellicola'], vivace: ['🌈', 'Vivace'],
  anime: ['🌸', 'Anime'], 'pittura-anime': ['🏯', 'Ghibli'], acquerello: ['🖌️', 'Acquerello'], olio: ['🖼️', 'Olio'], cartoon: ['🐭', 'Cartoon'], lego: ['🧱', 'Mattoncini'], creta: ['🏺', 'Plastilina'],
  pixel: ['👾', 'Pixel'], matita: ['✏️', 'Matita'], fumetto: ['💬', 'Fumetto'], caricatura: ['🤪', 'Caricatura'], 'foto-real': ['📸', 'Realistica'], action: ['🦸', 'Action figure'],
  't-cambia': ['✍️', 'Cambia'], 't-traduci': ['🌐', 'Traduci'], 't-togli': ['🧽', 'Togli'], 't-aggiungi': ['🔤', 'Aggiungi'], 't-scrivi': ['🪧', 'Scrivi'], 't-cartello': ['🚏', 'Cartello'], 't-meme': ['😂', 'Meme'],
  'sfondo-via': ['✂️', 'Via sfondo'], 'sfondo-bianco': ['⬜', 'Su bianco'], restaura: ['🛠️', 'Restaura'], dettagli: ['🔎', 'Dettagli'], pelle: ['✨', 'Pelle'], 'foto-lavoro': ['💼', 'Foto CV'],
  'z-rimuovi': ['🗑️', 'Rimuovi'], 'z-sostituisci': ['🔄', 'Sostituisci'], 'z-colore': ['🎨', 'Colore'], 'z-aggiungi': ['➕', 'Aggiungi'], 'z-ritocca': ['🪄', 'Ritocca'], 'z-oggetto': ['📦', 'Oggetto'],
  'z-persona': ['🧍', 'Persona'], 'z-vestito': ['👚', 'Vestito'], 'z-sfoca': ['🫧', 'Sfoca']
}

/** l'icona e la parola di un'azione rapida (se non c'è nella tabella: la prima parola del nome) */
export function iconaRapida(r: Rapida, ripiego = '✨'): { icona: string; nome: string } {
  const x = ICONE[r.id]
  if (x) return { icona: x[0], nome: x[1] }
  return { icona: ripiego, nome: r.nome.replace('…', '').split(' ')[0] }
}
