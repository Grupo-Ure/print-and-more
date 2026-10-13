// The one place a mail leaves the system: Resend's SDK behind a small
// interface, with a dry-run stand-in for every environment that must not
// send (CI, local development).
//
// EMAIL_DRY_RUN=true selects the stand-in. It accepts every mail with the
// provider id 'dry-run' so the whole path — claim, check, render, record,
// archive, history — runs with no mail leaving and no Resend key present.
// It refuses a mail whose `dryRunRefuse` flag is set, which is how the e2e
// suite exercises the retry path.

import { Resend } from 'resend'

export interface OutgoingMail {
  to: string
  subject: string
  html: string
  text: string
  /** `email/<queue message id>`: the same on every attempt, so Resend delivers it once. */
  idempotencyKey: string
  /** What the mail was about, attached as Resend tags so a delivery report can be placed even without its record. */
  tags: Record<string, string>
  /** Honoured by the dry-run transport only: refuse this mail as a provider would. */
  dryRunRefuse: boolean
}

/** Resend's refusal, as written into EMAIL_FAILED when the attempts are spent. */
export interface SendError {
  name: string
  message: string
  statusCode: number | null
}

export type SendOutcome = { ok: true; providerId: string } | { ok: false; error: SendError }

export interface Transport {
  send(mail: OutgoingMail): Promise<SendOutcome>
}

export const DRY_RUN_PROVIDER_ID = 'dry-run'

const dryRunTransport: Transport = {
  send(mail) {
    if (mail.dryRunRefuse) {
      return Promise.resolve({
        ok: false,
        error: { name: 'dry_run_refusal', message: 'Refused by the dry-run transport', statusCode: 500 },
      })
    }
    return Promise.resolve({ ok: true, providerId: DRY_RUN_PROVIDER_ID })
  },
}

function requiredVariable(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`send-email: ${name} is not set`)
  return value
}

// Reads its variables once, when the function starts, so a missing one shows
// on deploy rather than on the first send.
function createResendTransport(): Transport {
  const resend = new Resend(requiredVariable('RESEND_API_KEY'))
  const from = requiredVariable('EMAIL_FROM')
  const replyTo = Deno.env.get('EMAIL_REPLY_TO') || undefined

  return {
    async send(mail) {
      const { data, error } = await resend.emails.send(
        {
          from,
          to: [mail.to],
          replyTo,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          tags: Object.entries(mail.tags).map(([name, value]) => ({ name, value })),
        },
        { idempotencyKey: mail.idempotencyKey },
      )
      if (error) {
        return {
          ok: false,
          error: { name: error.name, message: error.message, statusCode: error.statusCode ?? null },
        }
      }
      if (!data) {
        return { ok: false, error: { name: 'empty_response', message: 'Resend returned neither data nor error', statusCode: null } }
      }
      return { ok: true, providerId: data.id }
    },
  }
}

export function createTransport(): Transport {
  return Deno.env.get('EMAIL_DRY_RUN') === 'true' ? dryRunTransport : createResendTransport()
}
