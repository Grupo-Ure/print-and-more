import type { Page } from '@playwright/test'
import { OrderSidebarDeadlineFilterPOM } from './OrderSidebarDeadlineFilterPOM'
import { OrderSidebarDepartmentFilterPOM } from './OrderSidebarDepartmentFilterPOM'
import { OrderSidebarStatusFilterPOM } from './OrderSidebarStatusFilterPOM'

/**
 * The sidebar's filter popovers — one per group, each opened by its own
 * header toggle on {@link OrderSidebarPOM}.
 */
export class OrderSidebarFiltersPOM {
  readonly status: OrderSidebarStatusFilterPOM
  readonly department: OrderSidebarDepartmentFilterPOM
  readonly deadline: OrderSidebarDeadlineFilterPOM

  constructor(page: Page) {
    this.status = new OrderSidebarStatusFilterPOM(page)
    this.department = new OrderSidebarDepartmentFilterPOM(page)
    this.deadline = new OrderSidebarDeadlineFilterPOM(page)
  }
}
