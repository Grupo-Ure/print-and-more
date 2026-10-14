import { ArrowUp, CalendarX, CircleAlert, MailX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTimeDe } from '../lib/formatDate'

/**
 * Row flags shared by the order sidebar, the product list and the production feed.
 * All are the same red; the shape tells them apart.
 */
type FlagProps = {
  /** Icon size in px — each list sizes its flags to its own row. */
  size: number
  testId?: string
}

/** Something the product needs is missing (`isMissingInfo`). */
export function MissingInfoFlag({ size, testId }: FlagProps) {
  return (
    <span data-testid={testId} title="Missing information" className="inline-flex shrink-0">
      <CircleAlert size={size} className="text-red-600" aria-label="Missing information" />
    </span>
  )
}

/** The deadline has passed while work is still open (`isDeadlineMissed`). */
export function DeadlineMissedFlag({ size, testId }: FlagProps) {
  return (
    <span data-testid={testId} title="Deadline missed" className="inline-flex shrink-0">
      <CalendarX size={size} className="text-red-600" aria-label="Deadline missed" />
    </span>
  )
}

/**
 * A mail to the customer's address bounced (`customers.email_bounced_at`); the
 * address is the problem, and changing it on the customer clears the flag.
 */
export function EmailBouncedFlag({ size, testId, bouncedAt }: FlagProps & { bouncedAt: string }) {
  const title = `Email bounced on ${formatDateTimeDe(bouncedAt)} — mail to this address does not arrive`
  return (
    <span data-testid={testId} title={title} className="inline-flex shrink-0">
      <MailX size={size} className="text-red-600" aria-label="Email bounced" />
    </span>
  )
}

/** The order or product has high priority (effective priority for a product). */
export function HighPriorityFlag({ size, testId, animate = false }: FlagProps & {
  /** Bounce the arrow — for lists where high priority must catch the eye. */
  animate?: boolean
}) {
  return (
    <span data-testid={testId} title="High priority" className="inline-flex shrink-0">
      <ArrowUp
        size={size}
        className={cn('text-red-600', animate && 'animate-bounce')}
        aria-label="High priority"
      />
    </span>
  )
}
