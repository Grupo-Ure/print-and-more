/**
 * Display names of the email templates (`supabase/functions/send-email/templates/<name>`),
 * shared by the order's Emails tab, its history and Settings → Emails. A feature that adds a
 * template adds its label here; a template without one shows its folder name.
 */
const EMAIL_TEMPLATE_LABELS: Record<string, string> = {
  'test-message': 'Test message',
  'approval-request': 'Approval request',
  'approval-decided': 'Approval decided',
  'approval-withdrawn': 'Approval withdrawn',
  'approval-expired': 'Approval expired',
}

export function emailTemplateLabel(template: string): string {
  return EMAIL_TEMPLATE_LABELS[template] ?? template
}
