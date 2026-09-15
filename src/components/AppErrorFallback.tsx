import type { FallbackRender } from '@sentry/react'
import { errorToString } from '../lib/errorToString'
import { Button } from './ui/button'

/**
 * Last-resort screen rendered by the root Sentry.ErrorBoundary when a render
 * error escapes every other boundary. The error has already been reported by
 * the time this renders; `eventId` lets the user quote it to support.
 */
export const AppErrorFallback: FallbackRender = ({ error, eventId, resetError }) => (
  <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
    <h1>Something went wrong</h1>
    <p className="max-w-md text-muted-foreground">
      The page hit an unexpected error. It has been logged; you can try again or reload the app.
    </p>
    <pre className="max-w-lg overflow-x-auto rounded-md bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
      {errorToString(error)}
    </pre>
    {eventId && <p className="text-xs text-muted-foreground">Error ID: {eventId}</p>}
    <div className="flex gap-2">
      <Button variant="outline" onClick={resetError}>
        Try again
      </Button>
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </div>
  </div>
)
