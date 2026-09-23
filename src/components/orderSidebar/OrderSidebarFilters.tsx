import { useState, type ComponentType, type ReactNode } from 'react'
import { CalendarClock, LayoutGrid, ListFilter, RotateCcw, type LucideProps } from 'lucide-react'
import { ORDER_STATUS_LIST } from '../../types/database'
import { JOB_DEPARTMENT_LABELS } from '../../const/departmentAbbreviation'
import { departmentIcon, DEPARTMENT_ORDER } from '../../const/departmentIcons'
import { ORDER_STATUS_META } from '../../const/orderStatus'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Separator } from '../ui/separator'
import { DateInput } from '../DateInput'
import { TEST_IDS } from '@e2e/support/testIds'
import { ActiveDot } from './ActiveDot'
import {
  isDeadlineFilterActive,
  isDepartmentFilterActive,
  isStatusFilterActive,
  type FilterActions,
  type FilterState,
} from './useOrderSidebarFilter'

const TOGGLE_IDS = TEST_IDS.orders.sidebar
const IDS = TEST_IDS.orders.sidebar.filters

const DATE_INPUT_CLASSES =
  'h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

type Props = {
  filter: FilterState
  actions: FilterActions
}

function FilterSectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="block text-xs font-medium text-muted-foreground mb-1.5">{children}</span>
  )
}

type FilterPopoverButtonProps = {
  icon: ComponentType<LucideProps>
  label: string
  testId: string
  contentTestId: string
  /** True when this group differs from its defaults — shows the dot on the closed button. */
  active: boolean
  children: ReactNode
}

/** One header icon button that opens its filter group in a popover. */
function FilterPopoverButton({
  icon: Icon,
  label,
  testId,
  contentTestId,
  active,
  children,
}: FilterPopoverButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          title={label}
          aria-label={label}
          data-testid={testId}
          aria-pressed={open}
          className={cn(
            'relative',
            open && 'bg-muted text-blue-600 hover:text-blue-600 aria-expanded:text-blue-600',
          )}
        >
          <Icon className="size-3.5" />
          {active && !open && <ActiveDot />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 gap-0 border-gray-200" data-testid={contentTestId}>
        {children}
      </PopoverContent>
    </Popover>
  )
}

function ResetRow({ testId, disabled, onClick }: { testId: string; disabled: boolean; onClick: () => void }) {
  return (
    <>
      <Separator className="my-3" />
      <Button
        variant="ghost"
        size="sm"
        data-testid={testId}
        disabled={disabled}
        onClick={onClick}
        className="w-full text-muted-foreground"
      >
        <RotateCcw />
        Reset
      </Button>
    </>
  )
}

export function StatusFilterButton({ filter, actions }: Props) {
  const active = isStatusFilterActive(filter)
  const { statusAll, statusToggles } = filter
  return (
    <FilterPopoverButton
      icon={ListFilter}
      label="Filter by status"
      testId={TOGGLE_IDS.statusFilterToggle}
      contentTestId={IDS.status.root}
      active={active}
    >
      <FilterSectionLabel>Status</FilterSectionLabel>
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none pb-1.5">
        <Checkbox
          data-testid={IDS.status.allStatuses}
          checked={statusAll}
          onCheckedChange={checked => actions.setStatusAll(checked === true)}
        />
        All statuses
      </label>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
        {ORDER_STATUS_LIST.map(status => (
          <label
            key={status}
            className={cn(
              'flex items-center gap-2 text-sm cursor-pointer select-none',
              statusAll && 'opacity-50 cursor-default',
            )}
          >
            <Checkbox
              data-testid={IDS.status.status}
              data-status={status}
              checked={statusToggles[status]}
              disabled={statusAll}
              onCheckedChange={checked => actions.toggleStatus(status, checked === true)}
            />
            <span className={cn('size-2 shrink-0 rounded-full', ORDER_STATUS_META[status].color)} />
            {ORDER_STATUS_META[status].label}
          </label>
        ))}
      </div>
      <ResetRow testId={IDS.status.reset} disabled={!active} onClick={actions.resetStatus} />
    </FilterPopoverButton>
  )
}

export function DepartmentFilterButton({ filter, actions }: Props) {
  const active = isDepartmentFilterActive(filter)
  return (
    <FilterPopoverButton
      icon={LayoutGrid}
      label="Filter by department"
      testId={TOGGLE_IDS.departmentFilterToggle}
      contentTestId={IDS.department.root}
      active={active}
    >
      <FilterSectionLabel>Department</FilterSectionLabel>
      <div className="grid grid-cols-3 gap-1.5">
        {DEPARTMENT_ORDER.map(department => {
          const { icon: Icon, colorClassName } = departmentIcon(department)
          const label = JOB_DEPARTMENT_LABELS[department]
          const selected = filter.departments.includes(department)
          return (
            <button
              key={department}
              type="button"
              title={label}
              data-testid={IDS.department.option}
              data-department={department}
              aria-pressed={selected}
              onClick={() => actions.toggleDepartment(department, !selected)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-md border px-1.5 py-2 text-[11px] leading-tight transition-colors',
                selected
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-muted',
              )}
            >
              <Icon className={cn('size-4', colorClassName)} />
              <span className="w-full truncate text-center">{label}</span>
            </button>
          )
        })}
      </div>
      <ResetRow testId={IDS.department.reset} disabled={!active} onClick={actions.resetDepartments} />
    </FilterPopoverButton>
  )
}

export function DeadlineFilterButton({ filter, actions }: Props) {
  const active = isDeadlineFilterActive(filter)
  const { deadlineFrom, deadlineTo, intakeFrom, intakeTo } = filter
  return (
    <FilterPopoverButton
      icon={CalendarClock}
      label="Filter by deadline"
      testId={TOGGLE_IDS.deadlineFilterToggle}
      contentTestId={IDS.deadline.root}
      active={active}
    >
      <div className="space-y-3.5">
        <div>
          <FilterSectionLabel>Deadline (from / to)</FilterSectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <DateInput
              className={DATE_INPUT_CLASSES}
              aria-label="Deadline from"
              data-testid={IDS.deadline.deadlineFrom}
              value={deadlineFrom}
              onChange={e => actions.setDeadlineFrom(e.target.value)}
            />
            <DateInput
              className={DATE_INPUT_CLASSES}
              aria-label="Deadline to"
              data-testid={IDS.deadline.deadlineTo}
              value={deadlineTo}
              onChange={e => actions.setDeadlineTo(e.target.value)}
            />
          </div>
        </div>
        <div>
          <FilterSectionLabel>Intake (from / to)</FilterSectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <DateInput
              className={DATE_INPUT_CLASSES}
              aria-label="Intake from"
              data-testid={IDS.deadline.intakeFrom}
              value={intakeFrom}
              onChange={e => actions.setIntakeFrom(e.target.value)}
            />
            <DateInput
              className={DATE_INPUT_CLASSES}
              aria-label="Intake to"
              data-testid={IDS.deadline.intakeTo}
              value={intakeTo}
              onChange={e => actions.setIntakeTo(e.target.value)}
            />
          </div>
        </div>
      </div>
      <ResetRow testId={IDS.deadline.reset} disabled={!active} onClick={actions.resetDeadline} />
    </FilterPopoverButton>
  )
}
