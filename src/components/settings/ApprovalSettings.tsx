import type { ReactNode } from 'react'
import {
  useCustomerApprovalSettings,
  useUpdateCustomerApprovalSettings,
} from '../../queries/customerApprovalSettingsQueries'
import type { CustomerApprovalSettingsPatch } from '../../services/customerApprovalSettingsService'
import { useToast } from '../Toast'
import { WholeNumberField } from '../fields/WholeNumberField'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.settings.approval

/** The longest an approval link may stay valid. */
const MAX_EXPIRY_DAYS = 365

/** The longest proof copies may be kept after billing: ten years. */
const MAX_RETENTION_DAYS = 3650

/**
 * Settings → Customer approval: how long a customer's approval link stays
 * valid, and how long the proof copies sent with it are kept once the order
 * is billed (`customer_approval_settings`). Each field saves on its own, the
 * moment it is left.
 */
export function ApprovalSettings() {
  const { showError } = useToast()
  const { data: settings } = useCustomerApprovalSettings()
  const updateSettings = useUpdateCustomerApprovalSettings()

  const save = (patch: CustomerApprovalSettingsPatch): Promise<unknown> =>
    updateSettings.mutateAsync(patch).catch(() => showError('Approval setting could not be saved'))

  const isSaving = (setting: keyof CustomerApprovalSettingsPatch): boolean =>
    updateSettings.isPending && updateSettings.variables?.[setting] !== undefined

  return (
    <>
      <h1>Customer approval</h1>

      <section data-testid={IDS.root} className="rounded-md border border-neutral-200">
        <SettingRow
          title="Link valid for (days)"
          description="How long a customer may answer an approval request. The expiry is fixed when a request is sent, so a change applies to requests sent afterwards."
        >
          <WholeNumberField
            testId={IDS.expiryDays}
            label="Approval link valid for so many days"
            value={settings?.expiry_days ?? null}
            min={1}
            max={MAX_EXPIRY_DAYS}
            disabled={!settings || isSaving('expiry_days')}
            onSave={next => save({ expiry_days: next ?? undefined })}
          />
        </SettingRow>
        <SettingRow
          title="Keep proofs for (days after billing)"
          description="How long the copies of the files sent for approval are kept once the order is billed. The files on the network share are not touched."
        >
          <WholeNumberField
            testId={IDS.retentionDays}
            label="Keep approval proofs for so many days after billing"
            value={settings?.retention_days ?? null}
            min={1}
            max={MAX_RETENTION_DAYS}
            disabled={!settings || isSaving('retention_days')}
            onSave={next => save({ retention_days: next ?? undefined })}
          />
        </SettingRow>
      </section>
    </>
  )
}

function SettingRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-neutral-200 px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs text-neutral-500 desktop:text-sm">{description}</p>
      </div>
      {children}
    </div>
  )
}
