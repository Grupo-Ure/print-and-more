// The email provider, as the rest of the system sees it: the service that
// delivers a mail (the transport) and later reports what became of it (the
// delivery report). Both halves are one vendor's — the id a send returns is
// the key its reports come back under — so a provider is one file under
// emailProviders/, written against the types here, and nothing else in
// send-email, email-webhook or the e2e suite reads a vendor's format.
//
// Which provider is in use is the one line in emailProviders/active.ts.
// Reading the provider's secrets from the environment is
// emailProviderFromEnv.ts; this file and the providers stay free of Deno
// globals, because the e2e suite imports them under Node to sign its test
// reports.

export interface OutgoingMail {
  to: string
  subject: string
  html: string
  text: string
  /** `email/<queue message id>`: the same on every attempt, so the provider delivers it once. */
  idempotencyKey: string
  /** What the mail was about, attached where the provider can carry it, for finding the mail in its dashboard. */
  tags: Record<string, string>
  /** Honoured by the dry-run transport only: refuse this mail as a provider would. */
  dryRunRefuse: boolean
}

/**
 * Why a send was refused, as written into EMAIL_FAILED when the attempts are
 * spent. `message` is shown on the order's Emails tab; `code` is ours, not the
 * provider's, so the record reads the same whichever provider refused.
 */
export interface SendError {
  code:
    | 'rejected'
    | 'unauthorized'
    | 'rate_limited'
    | 'conflict'
    | 'provider_error'
    | 'network_error'
    | 'empty_response'
    | 'dry_run_refusal'
    | 'resolve_failed'
  message: string
  /** The provider's HTTP status, when there was a response. */
  status: number | null
}

export type SendOutcome = { ok: true; providerId: string } | { ok: false; error: SendError }

export interface Transport {
  send(mail: OutgoingMail): Promise<SendOutcome>
}

/** What a delivery report says happened to a sent mail. */
export type DeliveryEvent = 'delivered' | 'bounced' | 'complained'

/** What the provider says about a bounce. Every field is what it sent, or null when it sent none. */
export interface BounceDetail {
  /** The wording shown to the shop: the provider's reason for the bounce. */
  reason: string | null
  /** The provider's category of the bounce (e.g. an invalid recipient). */
  classification: string | null
  /** The receiving server's enhanced status code (e.g. 5.1.1). */
  statusCode: string | null
}

/** One delivery report, as the webhook acts on it. */
export interface DeliveryReport {
  event: DeliveryEvent
  /** When the provider recorded the event; the record is stamped with it. */
  occurredAt: string
  /** The id the transport returned for the mail — the sender stored it as sent_emails.provider_id. */
  providerId: string
  bounce: BounceDetail | null
}

/**
 * The webhook's reading of one posted report. A refusal means the signature
 * did not hold (answered 401). A null report is a genuine report the webhook
 * does not act on — another event type, or a shape it cannot read — and is
 * acknowledged so the provider does not retry it.
 */
export type ReadOutcome =
  | { ok: false; reason: string }
  | { ok: true; type: string | null; report: DeliveryReport | null }

export interface ReportReader {
  /** `body` is the raw request text, byte for byte as received: the signature covers it. */
  read(headers: Headers, body: string, nowMs?: number): Promise<ReadOutcome>
}

/** A report as the provider would post it: signed headers and the raw body. */
export interface SignedReport {
  headers: Record<string, string>
  body: string
}

/** How a provider reads its settings: the names are its own, the values come from the environment. */
export interface ProviderSettings {
  required(name: string): string
  optional(name: string): string | undefined
}

/** The provider id the dry-run transport returns; no report ever carries it. */
export const DRY_RUN_PROVIDER_ID = 'dry-run'

/**
 * The stand-in for every environment that must not send (CI, local
 * development): it accepts every mail with the provider id 'dry-run', so the
 * whole path — claim, check, render, record, archive, history — runs with no
 * mail leaving and no provider key present. It refuses a mail whose
 * `dryRunRefuse` flag is set, which is how the e2e suite exercises the retry
 * path.
 */
export const dryRunTransport: Transport = {
  send(mail) {
    if (mail.dryRunRefuse) {
      return Promise.resolve({
        ok: false,
        error: { code: 'dry_run_refusal', message: 'Refused by the dry-run transport', status: 500 },
      })
    }
    return Promise.resolve({ ok: true, providerId: DRY_RUN_PROVIDER_ID })
  },
}
