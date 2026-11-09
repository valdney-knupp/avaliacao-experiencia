import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { initGoogleAds } from './lib/googleAds'
import './main.css'

// Inicializa o rastreamento de conversões do Google Ads (compras via Stripe)
initGoogleAds()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
