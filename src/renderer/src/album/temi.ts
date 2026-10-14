// Gli stili dell'album: un clic cambia colori, margini, angoli, cornici e carattere a tutto l'album, come i temi di SmartAlbums.
import type { Album } from './tipi'

export type Tema = Pick<Album, 'sfondo' | 'margine' | 'spazio' | 'angoli' | 'font' | 'coloreTesto' | 'bordoFoto' | 'coloreBordo' | 'ombra'> & {
  id: string
  nome: string
  sotto: string
}

const C = (colore: string): Album['sfondo'] => ({ tipo: 'colore', colore })

export const TEMI: Tema[] = [
  { id: 'classico', nome: 'Classico', sotto: 'bianco pulito', sfondo: C('#ffffff'), margine: 10, spazio: 4, angoli: 0, font: 'Georgia', coloreTesto: '#222222', bordoFoto: 0, coloreBordo: '#ffffff', ombra: false },
  { id: 'galleria', nome: 'Galleria', sotto: 'nero, foto in luce', sfondo: C('#0d0d10'), margine: 12, spazio: 3, angoli: 0, font: 'Rajdhani', coloreTesto: '#f2f2f2', bordoFoto: 0, coloreBordo: '#ffffff', ombra: false },
  { id: 'crema', nome: 'Crema', sotto: 'elegante, carta calda', sfondo: C('#f6f1e7'), margine: 14, spazio: 5, angoli: 0, font: 'Georgia', coloreTesto: '#4a3f33', bordoFoto: 0, coloreBordo: '#ffffff', ombra: true },
  { id: 'polaroid', nome: 'Polaroid', sotto: 'cornice bianca e ombra', sfondo: C('#e9e4d8'), margine: 14, spazio: 9, angoli: 0, font: 'Segoe Script', coloreTesto: '#3a342b', bordoFoto: 4, coloreBordo: '#ffffff', ombra: true },
  { id: 'vivo', nome: 'A tutto foglio', sotto: 'quasi senza margini', sfondo: C('#ffffff'), margine: 3, spazio: 1.5, angoli: 0, font: 'Rajdhani', coloreTesto: '#111111', bordoFoto: 0, coloreBordo: '#ffffff', ombra: false },
  { id: 'minimal', nome: 'Minimal', sotto: 'tanto spazio bianco', sfondo: C('#ffffff'), margine: 24, spazio: 9, angoli: 0, font: 'Rajdhani', coloreTesto: '#333333', bordoFoto: 0, coloreBordo: '#ffffff', ombra: false },
  { id: 'moderno', nome: 'Moderno', sotto: 'angoli morbidi, grigio chiaro', sfondo: C('#eeeef2'), margine: 10, spazio: 5, angoli: 8, font: 'Rajdhani', coloreTesto: '#25252b', bordoFoto: 0, coloreBordo: '#ffffff', ombra: true },
  { id: 'notte', nome: 'Blu notte', sotto: 'matrimonio, oro tenue', sfondo: C('#1b2440'), margine: 12, spazio: 4, angoli: 0, font: 'Georgia', coloreTesto: '#e6d3a3', bordoFoto: 1.5, coloreBordo: '#e6d3a3', ombra: false },
  { id: 'rustico', nome: 'Rustico', sotto: 'marrone e avorio', sfondo: C('#3b2b25'), margine: 13, spazio: 5, angoli: 0, font: 'Georgia', coloreTesto: '#f3e8d3', bordoFoto: 3, coloreBordo: '#f3e8d3', ombra: true },
  { id: 'rosa', nome: 'Rosa antico', sotto: 'delicato, per le cerimonie', sfondo: C('#f3e3e1'), margine: 12, spazio: 5, angoli: 4, font: 'Segoe Script', coloreTesto: '#6b4a4a', bordoFoto: 2, coloreBordo: '#ffffff', ombra: true },
  { id: 'pellicola', nome: 'Pellicola', sotto: 'nero con filo bianco', sfondo: C('#050505'), margine: 11, spazio: 5, angoli: 0, font: 'Impact', coloreTesto: '#ffffff', bordoFoto: 1.2, coloreBordo: '#ffffff', ombra: false },
  { id: 'viaggio', nome: 'Viaggio', sotto: 'sabbia, ritagli di carta', sfondo: C('#e2d5bd'), margine: 11, spazio: 6, angoli: 0, font: 'Segoe Script', coloreTesto: '#5a4630', bordoFoto: 3, coloreBordo: '#fffdf6', ombra: true }
]

export const temaDi = (id: string | undefined): Tema => TEMI.find((t) => t.id === id) || TEMI[0]

/** applica lo stile all'album (le foto e le pagine non si toccano) */
export function applicaTema(a: Album, t: Tema): void {
  a.tema = t.id
  a.sfondo = { ...t.sfondo }
  a.margine = t.margine
  a.spazio = t.spazio
  a.angoli = t.angoli
  a.font = t.font
  a.coloreTesto = t.coloreTesto
  a.bordoFoto = t.bordoFoto
  a.coloreBordo = t.coloreBordo
  a.ombra = t.ombra
}
