import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { DepartmentSettingsPOM } from './DepartmentSettingsPOM'
import { UserManagementPOM } from './UserManagementPOM'
import { AccessDeniedPOM } from './AccessDeniedPOM'
import { NavbarPOM } from './NavbarPOM'
import { BasePOM } from './BasePOM'

/** Mirrors `SettingsSection` in src/pages/SettingsPage.tsx (a .tsx module the e2e tsconfig can't import). */
export type SettingsSection = 'userManagement' | 'departments'

const IDS = TEST_IDS.settings

/**
 * The Settings page (admins): the section list on the left and the active
 * section on the right. User management is only listed for super admins.
 */
export class SettingsPOM extends BasePOM {
  readonly root: Locator
  readonly userManagement: UserManagementPOM
  readonly departments: DepartmentSettingsPOM
  readonly accessDenied: AccessDeniedPOM
  private readonly sectionLinks: Locator
  private readonly navbar: NavbarPOM

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.sectionLinks = this.root.getByTestId(IDS.sectionLink)
    this.userManagement = new UserManagementPOM(page)
    this.departments = new DepartmentSettingsPOM(page)
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
    const sectionRoot = section === 'userManagement' ? this.userManagement.root : this.departments.root
    await sectionRoot.waitFor()
  }
}
