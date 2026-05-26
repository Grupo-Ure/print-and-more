import { departmentAbbreviation, subOrderDepartmentLabel } from '../const/departmentAbbreviation'
import type { OrderStatus, SubOrderRow } from '../types/database'

function subOrderStatusDotClass(status: OrderStatus): string {
  switch (status) {
    case 'QUOTE':
      return 'td-dot td-dot--grau'
    case 'INCOMPLETE':
      return 'td-dot td-dot--orange'
    case 'PREPRESS_READY':
      return 'td-dot td-dot--blau'
    case 'PRODUCTION_READY':
      return 'td-dot td-dot--lila'
    case 'DONE':
      return 'td-dot td-dot--gruen'
    default:
      return 'td-dot td-dot--grau'
  }
}

type SubOrderTabsProps = {
  subOrders: SubOrderRow[]
  activeSubOrderId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
}

export function SubOrderTabs({ subOrders, activeSubOrderId, onSelect, onAdd }: SubOrderTabsProps) {
  return (
    <div className="work-area__tabs b-dev" role="tablist" aria-label="Sub-orders">
      {subOrders.map(subOrder => {
        const isActive = subOrder.id === activeSubOrderId
        const abbreviation = departmentAbbreviation(subOrder.department)
        const tabTitle = `${subOrderDepartmentLabel(subOrder.department)} · ${subOrder.status}`
        return (
          <button
            key={subOrder.id}
            type="button"
            role="tab"
            className={isActive ? 'tab-btn tab-btn--active' : 'tab-btn'}
            aria-selected={isActive}
            onClick={() => onSelect(subOrder.id)}
            title={tabTitle}
          >
            <span className="wa-tab-kz">{abbreviation}</span>
            <span className="wa-tab-sep" aria-hidden>
              {' '}
              ·{' '}
            </span>
            <span
              className={subOrderStatusDotClass(subOrder.status)}
              title={subOrder.status}
              aria-label={subOrder.status}
            />
          </button>
        )
      })}
      <button
        type="button"
        className="tab-add-btn"
        onClick={onAdd}
        aria-label="Add sub-order"
      >
        +
      </button>
    </div>
  )
}
