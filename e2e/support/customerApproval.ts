import type { ApprovalDecision, ApprovalView } from '../../supabase/functions/customer-approval/contract'
import { requiredEnv } from './database'

/** What the function answered: the status, and the JSON body when there is one. */
export type FunctionAnswer<T> = {
  status: number
  body: T | null
}

/** A downloaded proof: the status, the Content-Disposition header and the bytes as text. */
export type DownloadAnswer = {
  status: number
  disposition: string | null
  content: string
}

/**
 * The runner's handle on the `customer-approval` edge function, called the
 * way the customer app's page calls it: plain `fetch`, no Supabase session,
 * the link's token as the only credential.
 *
 * It returns what the function answered and reads nothing else; what a
 * decision did to the request is read from the database
 * (`TestDatabase.approvalRequestDecision`). The function's CORS headers are
 * not asserted: the local gateway answers the preflight itself and rewrites
 * the allowed origin to `*`, so they are only observable on the hosted
 * project.
 */
export class CustomerApprovalFunction {
  private readonly url: string

  constructor() {
    this.url = `${requiredEnv('VITE_SUPABASE_URL')}/functions/v1/customer-approval`
  }

  /** `GET ?token=…`: the request the link belongs to. */
  async read(token: string): Promise<FunctionAnswer<ApprovalView>> {
    const response = await fetch(`${this.url}?${new URLSearchParams({ token })}`)
    return { status: response.status, body: response.ok ? ((await response.json()) as ApprovalView) : null }
  }

  /** `GET ?token=…&file=…`: one proof, as the page's download link fetches it. */
  async download(token: string, fileId: string): Promise<DownloadAnswer> {
    const response = await fetch(`${this.url}?${new URLSearchParams({ token, file: fileId })}`)
    return {
      status: response.status,
      disposition: response.headers.get('Content-Disposition'),
      content: await response.text(),
    }
  }

  /** `POST { token, decision, note }`: the customer's answer, as the page posts it. */
  async decide(token: string, decision: ApprovalDecision, note: string | null): Promise<FunctionAnswer<ApprovalView>> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, decision, note }),
    })
    return { status: response.status, body: response.ok ? ((await response.json()) as ApprovalView) : null }
  }
}
