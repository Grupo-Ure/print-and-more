import { SUB_ORDER_DEPARTMENTS, type OrderStatus } from '../../types/database'
import { SUB_ORDER_DEPARTMENT_LABELS } from '../../const/departmentAbbreviation'
import { DateInput } from '../DateInput'
import { STATUS_ORDER, type FilterActions, type FilterState } from './useOrderSidebarFilter'

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

export function OrderSidebarFilters({ filter, actions }: Props) {
  const { statusAll, statusToggles, deadlineFrom, deadlineTo, intakeFrom, intakeTo, department } = filter

  return (
    <div className="mt-2 p-2 bg-white border border-neutral-200 rounded-md text-xs">
      <div className="pb-2">
        <div className="mb-2">
          <span className="block text-xs text-neutral-600 mb-0.5">Status</span>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <label className="inline-flex items-center gap-1 text-[11px] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={statusAll}
                onChange={e => actions.setStatusAll(e.target.checked)}
              />
              All
            </label>
            {!statusAll &&
              STATUS_ORDER.map(status => (
                <label
                  key={status}
                  className="inline-flex items-center gap-1 text-[11px] cursor-pointer select-none"
                  title={status}
                >
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

        <div className="mb-2">
          <label className="block text-xs text-neutral-600 mb-0.5" htmlFor="orderlist-department">
            Department
          </label>
          <select
            id="orderlist-department"
            value={department}
            onChange={e => actions.setDepartment(e.target.value as FilterState['department'])}
            className="w-full box-border px-1.5 py-1 text-[13px] border border-neutral-200 rounded-md bg-white"
          >
            <option value="All">All</option>
            {SUB_ORDER_DEPARTMENTS.map(dep => (
              <option key={dep} value={dep}>
                {SUB_ORDER_DEPARTMENT_LABELS[dep]}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-2">
          <span className="block text-xs text-neutral-600 mb-0.5">Deadline (from / to)</span>
          <div className="grid grid-cols-2 gap-2">
            <DateInput
              className="px-2 py-1 text-xs border border-neutral-200 rounded-md bg-white"
              value={deadlineFrom}
              onChange={e => actions.setDeadlineFrom(e.target.value)}
            />
            <DateInput
              className="px-2 py-1 text-xs border border-neutral-200 rounded-md bg-white"
              value={deadlineTo}
              onChange={e => actions.setDeadlineTo(e.target.value)}
            />
          </div>
        </div>

        <div className="mb-2">
          <span className="block text-xs text-neutral-600 mb-0.5">Intake (from / to)</span>
          <div className="grid grid-cols-2 gap-2">
            <DateInput
              className="px-2 py-1 text-xs border border-neutral-200 rounded-md bg-white"
              value={intakeFrom}
              onChange={e => actions.setIntakeFrom(e.target.value)}
            />
            <DateInput
              className="px-2 py-1 text-xs border border-neutral-200 rounded-md bg-white"
              value={intakeTo}
              onChange={e => actions.setIntakeTo(e.target.value)}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={actions.reset}
          className="inline p-0 m-0 border-0 bg-transparent text-blue-600 hover:text-blue-700 text-xs underline underline-offset-2 cursor-pointer"
        >
          Reset filters
        </button>
      </div>
    </div>
  )
}
