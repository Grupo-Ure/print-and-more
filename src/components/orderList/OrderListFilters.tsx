import type { Dispatch, SetStateAction } from 'react'
import { SUB_ORDER_DEPARTMENTS } from '../../types/database'
import { SUB_ORDER_DEPARTMENT_LABELS } from '../../const/departmentAbbreviation'
import { DateInput } from '../DateInput'
import { STATUS_CHECKBOX_SHORT, STATUS_ORDER, type FilterState } from './filterState'

type Props = {
  filter: FilterState
  setFilter: Dispatch<SetStateAction<FilterState>>
  onReset: () => void
}

export function OrderListFilters({ filter, setFilter, onReset }: Props) {
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
                onChange={e => {
                  const checked = e.target.checked
                  setFilter(f => ({ ...f, statusAll: checked }))
                }}
              />
              All
            </label>
            {!statusAll &&
              STATUS_ORDER.map(status => (
                <label key={status} className="ol-cb" title={status}>
                  <input
                    type="checkbox"
                    checked={statusToggles[status]}
                    onChange={e => {
                      const checked = e.target.checked
                      setFilter(f => ({
                        ...f,
                        statusAll: false,
                        statusToggles: { ...f.statusToggles, [status]: checked },
                      }))
                    }}
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
            onChange={e =>
              setFilter(f => ({ ...f, department: e.target.value as FilterState['department'] }))
            }
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
              onChange={e => setFilter(f => ({ ...f, deadlineFrom: e.target.value }))}
            />
            <DateInput
              className="input-compact"
              value={deadlineTo}
              onChange={e => setFilter(f => ({ ...f, deadlineTo: e.target.value }))}
            />
          </div>
        </div>

        <div className="ol-filter-row">
          <span className="ol-label">Intake (from / to)</span>
          <div className="ol-filter-dates">
            <DateInput
              className="input-compact"
              value={intakeFrom}
              onChange={e => setFilter(f => ({ ...f, intakeFrom: e.target.value }))}
            />
            <DateInput
              className="input-compact"
              value={intakeTo}
              onChange={e => setFilter(f => ({ ...f, intakeTo: e.target.value }))}
            />
          </div>
        </div>

        <button type="button" className="ol-filter-reset" onClick={onReset}>
          Reset filters
        </button>
      </div>
    </div>
  )
}
