import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Inter (OFL) com eixo óptico: reserva do SF Pro fora dos aparelhos Apple.
import '@fontsource-variable/inter/opsz.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
