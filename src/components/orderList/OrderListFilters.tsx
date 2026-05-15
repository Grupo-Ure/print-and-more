import { SUB_ORDER_DEPARTMENTS, type OrderStatus } from '../../types/database'
import { SUB_ORDER_DEPARTMENT_LABELS } from '../../const/departmentAbbreviation'
import { DateInput } from '../DateInput'
import { STATUS_ORDER, type FilterActions, type FilterState } from './useOrderListFilter'

/** Short label for the status filter checkboxes. */
const STATUS_CHECKBOX_SHORT: Record<OrderStatus, string> = {
  QUOTE: 'Quote',
  INCOMPLETE: 'Incomplete',
  PREPRESS_READY: 'PrePress',
  PRODUCTION_READY: 'In Prod.',
  DONE: 'Done',
  INVOICED: 'Invoiced',
}

type Props = {
  filter: FilterState
  actions: FilterActions
}

export function OrderListFilters({ filter, actions }: Props) {
  const { statusAll, statusToggles, deadlineFrom, deadlineTo, intakeFrom, intakeTo, department } = filter

  return (
    <div className="ol-filter-pop">
      <div className="ol-filter-inhalt">
        <div className="ol-filter-row">
          <span className="ol-label">Status</span>
          <div className="ol-status-row">
            <label className="ol-cb">
              <input
                type="checkbox"
                checked={statusAll}
                onChange={e => actions.setStatusAll(e.target.checked)}
              />
              All
            </label>
            {!statusAll &&
              STATUS_ORDER.map(status => (
                <label key={status} className="ol-cb" title={status}>
                  <input
                    type="checkbox"
                    checked={statusToggles[status]}
                    onChange={e => actions.toggleStatus(status, e.target.checked)}
                  />
                  {STATUS_CHECKBOX_SHORT[status]}
                </label>
              ))}
          </div>
        </div>

        <div className="ol-filter-row">
          <label className="ol-label" htmlFor="ol-bereich">
            Department
          </label>
          <select
            id="ol-bereich"
            className="input-compact"
            value={department}
            onChange={e => actions.setDepartment(e.target.value as FilterState['department'])}
            style={{ width: '100%', boxSizing: 'border-box' }}
          >
            <option value="All">All</option>
            {SUB_ORDER_DEPARTMENTS.map(dep => (
              <option key={dep} value={dep}>
                {SUB_ORDER_DEPARTMENT_LABELS[dep]}
              </option>
            ))}
          </select>
        </div>

        <div className="ol-filter-row">
          <span className="ol-label">Deadline (from / to)</span>
          <div className="ol-filter-dates">
            <DateInput
              className="input-compact"
              value={deadlineFrom}
              onChange={e => actions.setDeadlineFrom(e.target.value)}
            />
            <DateInput
              className="input-compact"
              value={deadlineTo}
              onChange={e => actions.setDeadlineTo(e.target.value)}
            />
          </div>
        </div>

        <div className="ol-filter-row">
          <span className="ol-label">Intake (from / to)</span>
          <div className="ol-filter-dates">
            <DateInput
              className="input-compact"
              value={intakeFrom}
              onChange={e => actions.setIntakeFrom(e.target.value)}
            />
            <DateInput
              className="input-compact"
              value={intakeTo}
              onChange={e => actions.setIntakeTo(e.target.value)}
            />
          </div>
        </div>

        <button type="button" className="ol-filter-reset" onClick={actions.reset}>
          Reset filters
        </button>
      </div>
    </div>
  )
}
