import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { NavigationProvider } from './context/navigation.context'
import { AppErrorFallback } from './components/AppErrorFallback'
import { initSentry, reportError, Sentry } from './lib/sentry'

// First thing, so errors thrown while the tree mounts are already captured.
initSentry()

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

const queryClient = new QueryClient({
  // TanStack Query swallows errors into state; surface them to Sentry as well.
  queryCache: new QueryCache({
    onError: (error, query) => reportError(error, { queryKey: query.queryKey }),
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) =>
      reportError(error, { mutationKey: mutation.options.mutationKey }),
  }),
})

createRoot(root, {
  // React 19 error hooks — reports render errors whether or not a boundary caught them.
  onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.error('Uncaught render error', error, errorInfo.componentStack)
  }),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={AppErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <NavigationProvider>
          <App />
        </NavigationProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
