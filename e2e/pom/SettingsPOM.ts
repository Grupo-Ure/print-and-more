import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { ApprovalSettingsPOM } from './ApprovalSettingsPOM'
import { DepartmentSettingsPOM } from './DepartmentSettingsPOM'
import { EmailSettingsPOM } from './EmailSettingsPOM'
import { UserManagementPOM } from './UserManagementPOM'
import { AccessDeniedPOM } from './AccessDeniedPOM'
import { NavbarPOM } from './NavbarPOM'
import { BasePOM } from './BasePOM'

/** Mirrors `SettingsSection` in src/pages/SettingsPage.tsx (a .tsx module the e2e tsconfig can't import). */
export type SettingsSection = 'userManagement' | 'departments' | 'emails' | 'approval'

const IDS = TEST_IDS.settings

/**
 * The Settings page (admins): the section list on the left and the active
 * section on the right. User management is only listed for super admins.
 */
export class SettingsPOM extends BasePOM {
  readonly root: Locator
  readonly userManagement: UserManagementPOM
  readonly departments: DepartmentSettingsPOM
  readonly emails: EmailSettingsPOM
  readonly approval: ApprovalSettingsPOM
  readonly accessDenied: AccessDeniedPOM
  private readonly sectionLinks: Locator
  private readonly navbar: NavbarPOM

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.sectionLinks = this.root.getByTestId(IDS.sectionLink)
    this.userManagement = new UserManagementPOM(page)
    this.departments = new DepartmentSettingsPOM(page)
    this.emails = new EmailSettingsPOM(page)
    this.approval = new ApprovalSettingsPOM(page)
    this.accessDenied = new AccessDeniedPOM(page)
    this.navbar = new NavbarPOM(page)
  }

  /** The link of one section; carries `aria-current="page"` when active. */
  sectionLink(section: SettingsSection): Locator {
    return this.withAttr(this.sectionLinks, 'data-section', section)
  }

  /** The sections currently listed, in sidebar order. */
  async renderedSections(): Promise<SettingsSection[]> {
    return this.sectionLinks.evaluateAll(els =>
      els.map(el => el.getAttribute('data-section') as SettingsSection),
    )
  }

  // ── Navigation (for a spec's Setup stage) ───────────────────────────────

  /** Switches to the Settings page through the navbar and waits for it. */
  async open(): Promise<void> {
    await this.navbar.link('settings').click()
    await this.root.waitFor()
  }

  /** Opens the page and selects a section, waiting for that section's root. */
  async openSection(section: SettingsSection): Promise<void> {
    await this.open()
    await this.sectionLink(section).click()
    await this.sectionRoot(section).waitFor()
  }

  private sectionRoot(section: SettingsSection): Locator {
    switch (section) {
      case 'userManagement':
        return this.userManagement.root
      case 'departments':
        return this.departments.root
      case 'emails':
        return this.emails.root
      case 'approval':
        return this.approval.root
    }
  }
}
