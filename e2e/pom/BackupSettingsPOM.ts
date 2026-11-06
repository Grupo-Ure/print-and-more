import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.settings.backups
const JOB_IDS = IDS.jobs

/**
 * Settings → Backups: the list of backups (`backup_jobs`), then a switch, six
 * number fields and the three parts of the shop folder (`backup_settings`),
 * each saving when it is left.
 */
export class BackupSettingsPOM extends BasePOM {
  readonly root: Locator
  /** Whether backups are made; `data-state` = checked | unchecked, the stored value. */
  readonly enabled: Locator
  /** Each number field: `data-value` = the stored value, empty while loading. */
  readonly dumpIntervalDays: Locator
  readonly leaseMinutes: Locator
  readonly reannounceMinutes: Locator
  readonly holdingRetentionDays: Locator
  readonly undeliveredAlertDays: Locator
  readonly missingBackupAlertDays: Locator
  /** Each text field: `data-value` = the stored text, empty while unset. */
  readonly shareServer: Locator
  readonly shareName: Locator
  readonly shareFolder: Locator
  /** The list of backups; a sibling of `root`, not inside it. */
  readonly jobs: Locator
  private readonly jobRows: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.enabled = this.root.getByTestId(IDS.enabled)
    this.dumpIntervalDays = this.root.getByTestId(IDS.dumpIntervalDays)
    this.leaseMinutes = this.root.getByTestId(IDS.leaseMinutes)
    this.reannounceMinutes = this.root.getByTestId(IDS.reannounceMinutes)
    this.holdingRetentionDays = this.root.getByTestId(IDS.holdingRetentionDays)
    this.undeliveredAlertDays = this.root.getByTestId(IDS.undeliveredAlertDays)
    this.missingBackupAlertDays = this.root.getByTestId(IDS.missingBackupAlertDays)
    this.shareServer = this.root.getByTestId(IDS.shareServer)
    this.shareName = this.root.getByTestId(IDS.shareName)
    this.shareFolder = this.root.getByTestId(IDS.shareFolder)
    this.jobs = page.getByTestId(JOB_IDS.root)
    this.jobRows = this.jobs.getByTestId(JOB_IDS.row)
  }

  /** One backup's row; `data-state` = WAITING | TAKEN | DELIVERED. */
  jobRow(jobId: string): Locator {
    return this.withAttr(this.jobRows, 'data-job-id', jobId)
  }

  /** The machine holding the job's claim, or the last one to hold it. */
  jobTakenBy(jobId: string): Locator {
    return this.jobRow(jobId).getByTestId(JOB_IDS.rowTakenBy)
  }

  /** The machine that brought the job to the shop folder. */
  jobDeliveredBy(jobId: string): Locator {
    return this.jobRow(jobId).getByTestId(JOB_IDS.rowDeliveredBy)
  }

  /** Failed deliveries; `data-value` = attempts. */
  jobAttempts(jobId: string): Locator {
    return this.jobRow(jobId).getByTestId(JOB_IDS.rowAttempts)
  }

  /** Why the job's last delivery failed. */
  jobLastError(jobId: string): Locator {
    return this.jobRow(jobId).getByTestId(JOB_IDS.rowLastError)
  }

  /** Whether the job's online copy is kept; `data-purged` = true | false. */
  jobHoldingCopy(jobId: string): Locator {
    return this.jobRow(jobId).getByTestId(JOB_IDS.rowHoldingCopy)
  }

  /** A field once the database holds that value — a draft being typed does not match. */
  stored(field: Locator, value: number | string): Locator {
    return this.withAttr(field, 'data-value', String(value))
  }
}
