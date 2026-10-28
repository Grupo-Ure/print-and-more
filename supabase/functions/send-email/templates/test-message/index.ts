// test-message — the email system's own template. It belongs to no feature
// and exists to drive the whole path (queue, render, send, record) in the
// e2e suite and in a by-hand smoke test.
//
// The recipient is `context.to` when the message carries one, otherwise the
// shop's own inbox (EMAIL_SHOP_TO).
//
// Two context switches exist for the suite, so every fork of the sender can
// be driven without a feature's template: `still_needed: false` answers the
// sender's "still needed?" with no, and `dry_run_refuse: true` makes the
// dry-run transport refuse the mail (see transport.ts).
//
// Its wording is its email_settings row, with orderId, productId and
// renderedAt as slots; `context.note`, when given, is a fixed paragraph the
// folder's html.hbs and text.hbs add below it.

import type { EmailTemplate } from '../registry.ts'

const testMessage: EmailTemplate = {
  stillNeeded(message) {
    return Promise.resolve(message.context.still_needed !== false)
  },
  resolve(message) {
    const to = message.context.to
    const recipient = typeof to === 'string' && to !== '' ? to : Deno.env.get('EMAIL_SHOP_TO')
    if (!recipient) {
      return Promise.reject(new Error('test-message: no context.to and EMAIL_SHOP_TO is not set'))
    }
    const note = message.context.note
    return Promise.resolve({
      recipient,
      data: {
        orderId: message.order_id,
        productId: message.product_id,
        note: typeof note === 'string' ? note : null,
        renderedAt: new Date().toISOString(),
      },
    })
  },
}

export default testMessage
