import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'

const IDS = TEST_IDS.settings.backups

/**
 * Settings → Backups: a switch, six number fields and the three parts of the
 * shop folder (`backup_settings`), each saving when it is left.
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
  }

  /** A field once the database holds that value — a draft being typed does not match. */
  stored(field: Locator, value: number | string): Locator {
    return this.withAttr(field, 'data-value', String(value))
  }
}
