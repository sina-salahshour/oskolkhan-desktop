import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Font faces (OFL variable fonts) — JS-imported so Vite emits the woff2 assets.
// Family names are referenced by the tokens in styles/tailwind.css.
import '@fontsource-variable/vazirmatn'
import '@fontsource-variable/estedad'
import '@fontsource-variable/inter'
import './styles/tailwind.css'
import App from './app/App'

// window.oskol is typed ambiently by src/lib/oskol.d.ts (its shape is produced
// by the preload bridge in electron/preload/index.ts).

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
)
