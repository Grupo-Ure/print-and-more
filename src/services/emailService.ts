import { supabase } from '../supabase'
import type { Database, Tables } from '../types/supabase'

/**
 * A mail still waiting on the queue (`list_queued_emails`). `due_at` is when
 * the sender may next claim it — its delay, or the end of a claim that has not
 * finished; `attempts` counts the claims so far, so above zero it is being
 * retried.
 */
export type QueuedEmailRow = Omit<Database['public']['Functions']['list_queued_emails']['Returns'][number], 'product_id'> & {
  // The generator types every RPC column as non-null; a mail about the whole order has no product.
  product_id: string | null
}

/** A mail that went out, as it went out, with what the provider has reported of it since. */
export type SentEmailRow = Pick<
  Tables<'sent_emails'>,
  'id' | 'template' | 'product_id' | 'recipient' | 'subject' | 'body_html' | 'sent_at' | 'delivered_at' | 'bounced_at' | 'bounce_reason' | 'complained_at'
>

const SENT_EMAIL_COLUMNS =
  'id, template, product_id, recipient, subject, body_html, sent_at, delivered_at, bounced_at, bounce_reason, complained_at'

/**
 * A mail the sender gave up on: why (`reason`, one of the sender's codes), the
 * error's wording when there was one, and how many claims it had by then.
 * The recipient is null where the failure came before it was looked up.
 */
export type FailedEmailRow = Pick<
  Tables<'failed_emails'>,
  'id' | 'template' | 'product_id' | 'recipient' | 'reason' | 'error' | 'attempts' | 'failed_at'
>

const FAILED_EMAIL_COLUMNS = 'id, template, product_id, recipient, reason, error, attempts, failed_at'

/**
 * The order's mails, read-only: every mail is automatic, so the app only looks.
 * The queue is reached through `list_queued_emails`, never the pgmq schema;
 * what went is `sent_emails`, what the sender gave up on is `failed_emails`.
 * The order's history carries the same events as entries, but the mail
 * tables are the record every page reads mails from.
 */
class EmailService {
  async listQueued(orderId: string): Promise<QueuedEmailRow[]> {
    const { data, error } = await supabase.rpc('list_queued_emails', { order_id: orderId })
    if (error) throw error
    return data ?? []
  }

  async listSent(orderId: string): Promise<SentEmailRow[]> {
    const { data, error } = await supabase
      .from('sent_emails')
      .select(SENT_EMAIL_COLUMNS)
      .eq('order_id', orderId)
      .order('sent_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }

  /** The order's mails the sender gave up on, newest first. */
  async listFailed(orderId: string): Promise<FailedEmailRow[]> {
    const { data, error } = await supabase
      .from('failed_emails')
      .select(FAILED_EMAIL_COLUMNS)
      .eq('order_id', orderId)
      .order('failed_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }
}

export const emailService = new EmailService()
