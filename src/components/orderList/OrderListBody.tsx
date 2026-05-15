import { customerName } from '../../lib/customer'
import { formatDateDe } from '../../lib/formatDate'
import { departmentAbbreviation } from '../../const/departmentAbbreviation'
import type { OrderListEntry } from '../../services/orderService'
import type { OrderStatus } from '../../types/database'

const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  QUOTE: 'badge-grau',
  INCOMPLETE: 'badge-orange',
  PREPRESS_READY: 'badge-blau',
  PRODUCTION_READY: 'badge-lila',
  DONE: 'badge-gruen',
  INVOICED: 'badge-grau',
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  QUOTE: 'Quote',
  INCOMPLETE: 'Incomplete',
  PREPRESS_READY: 'PrePress',
  PRODUCTION_READY: 'In Production',
  DONE: 'Done',
  INVOICED: 'Invoiced',
}

type Props = {
  orders: OrderListEntry[]
  activeOrderId: string | null
  onSelectOrder: (id: string) => void
  isLoading: boolean
  isFetching: boolean
  isEmpty: boolean
  onResetFilters: () => void
  onDuplicate: (orderId: string) => void
  duplicateBusy: boolean
}

const MAX_DEPARTMENT_TAGS = 4

export function OrderListBody({
  orders,
  activeOrderId,
  onSelectOrder,
  isLoading,
  isFetching,
  isEmpty,
  onResetFilters,
  onDuplicate,
  duplicateBusy,
}: Props) {
  return (
    <div
      className="ol-body"
      style={{ opacity: isFetching && !isLoading ? 0.5 : 1, transition: 'opacity 0.15s' }}
    >
      {isLoading && <div className="ol-leer">Loading...</div>}
      {isEmpty && (
        <div className="ol-leer">
          <div style={{ marginBottom: 8 }}>No orders found</div>
          <button type="button" className="ol-filter-reset" onClick={onResetFilters}>
            Reset filters
          </button>
        </div>
      )}
      {isFetching && !isLoading && <div className="ol-aktual">Refreshing…</div>}
      {!isLoading &&
        orders.map(order => {
          const isActive = order.id === activeOrderId
          const seenDepartments = new Set<string>()
          const uniqueDepartments: string[] = []
          for (const subOrder of order.sub_orders ?? []) {
            const dep = subOrder.department
            if (!dep || seenDepartments.has(dep)) continue
            seenDepartments.add(dep)
            uniqueDepartments.push(dep)
          }
          const tagLabels = uniqueDepartments.map(dep => departmentAbbreviation(dep))
          const visibleTags = tagLabels.slice(0, MAX_DEPARTMENT_TAGS)
          const extraCount = tagLabels.length - MAX_DEPARTMENT_TAGS
          return (
            <div
              key={order.id}
              className={isActive ? 'ol-eintrag ol-eintrag--aktiv' : 'ol-eintrag'}
              onClick={() => onSelectOrder(order.id)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectOrder(order.id)
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="ol-eintrag-in">
                <div className="ol-ze1">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      minWidth: 0,
                      flex: 1,
                      gap: 4,
                    }}
                  >
                    <span className="ol-kunde">{customerName(order.customers)}</span>
                    {order.is_emergency && (
                      <span className="ol-alarm" title="Emergency" aria-label="Emergency">
                        !
                      </span>
                    )}
                    {order.priority === 'HIGH' && (
                      <span className="ol-prio" title="High priority" aria-label="High priority">
                        ↑
                      </span>
                    )}
                  </div>
                  <span className="ol-datum">{formatDateDe(order.created_at)}</span>
                </div>
                <div className="ol-ze2">
                  <span className={`badge ${STATUS_BADGE_CLASS[order.status]}`}>{STATUS_LABEL[order.status]}</span>
                  {visibleTags.map(tag => (
                    <span key={tag} className="ol-bereich-tag">
                      {tag}
                    </span>
                  ))}
                  {extraCount > 0 && <span className="ol-bereich-tag">+{extraCount}</span>}
                </div>

                {isActive && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="ol-icon-btn"
                      title="Duplicate order"
                      aria-label="Duplicate order"
                      disabled={duplicateBusy}
                      onClick={e => {
                        e.stopPropagation()
                        onDuplicate(order.id)
                      }}
                    >
                      ⎘
                    </button>
                    <button
                      type="button"
                      className="ol-filter-reset"
                      disabled={duplicateBusy}
                      onClick={e => {
                        e.stopPropagation()
                        onDuplicate(order.id)
                      }}
                      style={{ padding: '6px 10px' }}
                    >
                      Duplicate order
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
    </div>
  )
}
