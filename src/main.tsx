import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { TooltipProvider } from './components/ui/tooltip'
import { initializeSupabase } from './lib/supabase'
import './index.css'

async function startApplication() {
  await initializeSupabase()

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <TooltipProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </TooltipProvider>
      </BrowserRouter>
    </React.StrictMode>,
  )
}

void startApplication()
