import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { NavigationProvider } from './context/navigation.context'

const root = document.getElementById('root')
if (!root) throw new Error('Root-Element nicht gefunden')

const queryClient = new QueryClient()

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <NavigationProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </NavigationProvider>
    </QueryClientProvider>
  </StrictMode>,
)
