import type { Locator, Page } from '@playwright/test'
import { TEST_IDS } from '../support/testIds'
import { UserMenuPOM } from './UserMenuPOM'
import { BasePOM } from './BasePOM'

/** Mirrors `AppView` in src/context/navigation.context.tsx (a .tsx module the e2e tsconfig can't import). */
export type AppView = 'orders' | 'stampStock' | 'textileStock' | 'userManagement' | 'profile'

/** The views that have a navbar link; `profile` is reached through the user menu instead. */
export type NavbarView = Exclude<AppView, 'profile'>

/** Every navbar view, in navbar order — the closed list a role's navigation is checked against. */
export const NAVBAR_VIEWS: readonly NavbarView[] = ['orders', 'stampStock', 'textileStock', 'userManagement']

const IDS = TEST_IDS.navbar

/** The top navigation bar (rendered only with a session). */
export class NavbarPOM extends BasePOM {
  readonly root: Locator
  readonly userMenu: UserMenuPOM
  /** All view switchers currently rendered, whatever the role. */
  readonly links: Locator

  constructor(page: Page) {
    super(page)
    this.root = page.getByTestId(IDS.root)
    this.links = this.root.getByTestId(IDS.link)
    this.userMenu = new UserMenuPOM(page)
  }

  /** The view switcher for one view; carries `aria-current="page"` when active. */
  link(view: NavbarView): Locator {
    return this.withAttr(this.links, 'data-view', view)
  }
}
