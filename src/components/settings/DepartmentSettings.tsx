import { jobDepartmentLabel } from '../../const/departmentAbbreviation'
import { departmentIcon, DEPARTMENT_ORDER } from '../../const/departmentIcons'
import {
  useDepartmentDefaultAssignees,
  useSetDepartmentDefaultAssignee,
} from '../../queries/departmentSettingsQueries'
import type { DefaultAssigneeStatus, Department } from '../../types/database'
import { EmployeeCombobox } from '../fields/EmployeeCombobox'
import { useToast } from '../Toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TEST_IDS } from '@e2e/support/testIds'

const IDS = TEST_IDS.settings.departments

/**
 * Settings → Departments: the default assignee of each department per stage.
 * A job entering pre-press or production is handed to that stage's user;
 * without a default it keeps whoever holds it.
 */
export function DepartmentSettings() {
  const { showError } = useToast()
  const { data: defaults, isLoading } = useDepartmentDefaultAssignees()
  const setDefault = useSetDepartmentDefaultAssignee()

  const defaultFor = (department: Department, status: DefaultAssigneeStatus): string | null =>
    defaults?.find(row => row.department === department && row.status === status)?.user_id ?? null

  const handleChange = (
    department: Department,
    status: DefaultAssigneeStatus,
    user: { id: string } | null,
  ) => {
    if ((user?.id ?? null) === defaultFor(department, status)) return
    setDefault.mutate(
      { department, status, userId: user?.id ?? null },
      { onError: () => showError('Default assignee could not be saved') },
    )
  }

  return (
    <>
      <h1>Departments</h1>

      <section data-testid={IDS.root} className="rounded-md border border-neutral-200">
        <div className="border-b border-neutral-200 px-4 py-3">
          <h2 className="font-semibold">Default assignees</h2>
          <p className="text-xs text-neutral-500 desktop:text-sm">
            When a job enters pre-press or production it is assigned to that stage&apos;s user.
            Without a default it keeps its current assignee.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Department</TableHead>
              <TableHead>Pre-press</TableHead>
              <TableHead>Production</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={3} className="pl-4 text-neutral-500">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              DEPARTMENT_ORDER.map(department => {
                const { icon: Icon, colorClassName } = departmentIcon(department)
                return (
                  <TableRow key={department} data-testid={IDS.row} data-department={department}>
                    <TableCell className="pl-4">
                      <span className="flex items-center gap-2">
                        <Icon className={`size-4 ${colorClassName}`} aria-hidden />
                        {jobDepartmentLabel(department)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <EmployeeCombobox
                        testId={IDS.rowPrepressAssignee}
                        value={defaultFor(department, 'PREPRESS')}
                        emptyOptionTestId={IDS.rowAssigneeEmptyOption}
                        userOptionTestId={IDS.rowAssigneeUserOption}
                        onChange={user => handleChange(department, 'PREPRESS', user)}
                        disabled={setDefault.isPending}
                      />
                    </TableCell>
                    <TableCell>
                      <EmployeeCombobox
                        testId={IDS.rowProductionAssignee}
                        value={defaultFor(department, 'IN_PRODUCTION')}
                        emptyOptionTestId={IDS.rowAssigneeEmptyOption}
                        userOptionTestId={IDS.rowAssigneeUserOption}
                        onChange={user => handleChange(department, 'IN_PRODUCTION', user)}
                        disabled={setDefault.isPending}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>
      </section>
    </>
  )
}
