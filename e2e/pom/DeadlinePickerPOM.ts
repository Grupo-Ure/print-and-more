import type { Locator, Page } from '@playwright/test'
import { BasePOM } from './BasePOM'

/**
 * A deadline field: a trigger button (carries `data-value` = the ISO date, or
 * nothing while unset) that opens a calendar popover. Shared by the order
 * settings row and the job settings dialog, so the test IDs come in.
 *
 * The calendar is third-party (react-day-picker) and portalled, so its parts
 * are located by role and data attribute inside the test-ID'd popover — the
 * documented exception to "test IDs only".
 */
export class DeadlinePickerPOM extends BasePOM {
  readonly trigger: Locator
  readonly calendar: Locator
  private readonly nextMonth: Locator

  constructor(page: Page, ids: { trigger: string; calendar: string }) {
    super(page)
    this.trigger = page.getByTestId(ids.trigger)
    this.calendar = page.getByTestId(ids.calendar)
    this.nextMonth = this.calendar.getByRole('button', { name: /next month/i })
  }

  /** The day button for an ISO date (`yyyy-MM-dd`); each day cell carries `data-day`. */
  day(isoDate: string): Locator {
    return this.calendar.locator(`[data-day="${isoDate}"]`).getByRole('button')
  }

  /**
   * Opens the calendar and picks the date. The popover opens on the current
   * month, so a date that falls just past the month's end may need one page
   * forward first.
   */
  async pick(isoDate: string): Promise<void> {
    await this.trigger.click()
    await this.calendar.waitFor()
    const day = this.day(isoDate)
    if ((await day.count()) === 0) await this.nextMonth.click()
    await day.click()
  }
}
