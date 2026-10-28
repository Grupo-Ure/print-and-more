import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { BasePOM } from './BasePOM'
import { EmailWordingDialogPOM } from './EmailWordingDialogPOM'

const IDS = TEST_IDS.settings.emails

/**
 * Settings → Emails: one row per mail type — an on/off switch and three
 * number fields (delay, repeat interval, most sends), each saving when it is
 * left, and *Edit wording*, which opens the wording dialog.
 */
export class EmailSettingsPOM extends BasePOM {
  readonly root: Locator
  /** Every template row; each carries `data-template`. */
  readonly rows: Locator
  readonly empty: Locator
  readonly wordingDialog: EmailWordingDialogPOM

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.rows = this.root.getByTestId(IDS.row)
    this.empty = this.root.getByTestId(IDS.empty)
    this.wordingDialog = new EmailWordingDialogPOM(page)
  }

  row(template: string): Locator {
    return this.withAttr(this.rows, 'data-template', template)
  }

  /** The templates currently listed, in table order. */
  async renderedTemplates(): Promise<string[]> {
    return this.rows.evaluateAll(els => els.map(el => el.getAttribute('data-template') ?? ''))
  }

  /** The row's button that opens its wording dialog. */
  rowEditWording(row: Locator): Locator {
    return row.getByTestId(IDS.rowEditWording)
  }

  /** The row's on/off switch; `data-state` = checked | unchecked, the stored value. */
  rowEnabled(row: Locator): Locator {
    return row.getByTestId(IDS.rowEnabled)
  }

  /** The row's switch once the database holds it off. */
  rowSwitchedOff(row: Locator): Locator {
    return this.withAttr(this.rowEnabled(row), 'data-state', 'unchecked')
  }

  /** The row's delay field; `data-value` = the stored delay in days. */
  rowDelay(row: Locator): Locator {
    return row.getByTestId(IDS.rowDelay)
  }

  /** The row's repeat-interval field; `data-value` = the stored interval in days, empty while it does not repeat. */
  rowRepeat(row: Locator): Locator {
    return row.getByTestId(IDS.rowRepeat)
  }

  /** The row's most-sends field; `data-value` = the stored maximum. */
  rowMaxSends(row: Locator): Locator {
    return row.getByTestId(IDS.rowMaxSends)
  }

  /** A number field once the database holds that value — a draft being typed does not match. */
  stored(field: Locator, value: number): Locator {
    return this.withAttr(field, 'data-value', String(value))
  }
}
