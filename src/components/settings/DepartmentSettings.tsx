import { jobDepartmentLabel } from '../../const/departmentAbbreviation'
import { departmentIcon, DEPARTMENT_ORDER } from '../../const/departmentIcons'
import {
  useDepartmentDefaultAssignees,
  useSetDepartmentDefaultAssignee,
} from '../../queries/departmentSettingsQueries'
import type { Department } from '../../types/database'
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
 * Settings → Departments: the default assignee of each department. A new job
 * goes to that user; without a default it goes to whoever creates it.
 */
export function DepartmentSettings() {
  const { showError } = useToast()
  const { data: defaults, isLoading } = useDepartmentDefaultAssignees()
  const setDefault = useSetDepartmentDefaultAssignee()

  const defaultFor = (department: Department): string | null =>
    defaults?.find(row => row.department === department)?.user_id ?? null

  const handleChange = (department: Department, user: { id: string } | null) => {
    if ((user?.id ?? null) === defaultFor(department)) return
    setDefault.mutate(
      { department, userId: user?.id ?? null },
      { onError: () => showError('Default assignee could not be saved') },
    )
  }

  return (
    <>
      <h1>Departments</h1>

      <section data-testid={IDS.root} className="rounded-md border border-neutral-200">
        <div className="border-b border-neutral-200 px-4 py-3">
          <h2 className="font-semibold">Default assignee</h2>
          <p className="text-xs text-neutral-500 desktop:text-sm">
            A new job of the department is assigned to this user. Without a default it goes to
            whoever creates it.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Department</TableHead>
              <TableHead>Default assignee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={2} className="pl-4 text-neutral-500">
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
                        testId={IDS.rowAssignee}
                        value={defaultFor(department)}
                        emptyLabel="Creator"
                        onChange={user => handleChange(department, user)}
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
