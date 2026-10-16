import { createRoot } from 'react-dom/client'
import './stile.css'
import { App } from './App'
import { Component, type ReactNode } from 'react'
import { usaStato } from './stato'

/** se una pagina va in errore non resta la finestra bianca: si vede cosa è successo e si può ricaricare */
class Salvagente extends Component<{ children: ReactNode }, { errore: string | null }> {
  state = { errore: null as string | null }
  static getDerivedStateFromError(e: unknown): { errore: string } {
    return { errore: e instanceof Error ? e.message : String(e) }
  }
  render(): ReactNode {
    if (!this.state.errore) return this.props.children
    return (
      <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
        <h2>Qualcosa è andato storto</h2>
        <p style={{ color: '#666' }}>{this.state.errore}</p>
        <p>Le tue foto e la galleria sono al sicuro. Ricarica l'interfaccia per ripartire.</p>
        <button onClick={() => location.reload()}>Ricarica</button>
      </div>
    )
  }
}

// un errore in una promessa non attesa non deve passare in silenzio
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason
  usaStato.getState().avvisa(r instanceof Error ? r.message : String(r), 'errore')
  e.preventDefault()
})

createRoot(document.getElementById('app')!).render(
  <Salvagente>
    <App />
  </Salvagente>
)
