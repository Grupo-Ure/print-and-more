import { cn } from '@/lib/utils'
import { jobDepartmentLabel } from '../const/departmentAbbreviation'
import { departmentIcon, DEPARTMENT_ORDER } from '../const/departmentIcons'
import type { Department } from '../types/database'

type JobDepartmentIconsProps = {
  jobs: { department: Department; is_cancelled: boolean }[]
  className?: string
}

/** One icon per department present among `jobs`, badged with that department's job count. */
export function JobDepartmentIcons({ jobs, className }: JobDepartmentIconsProps) {
  const counts = new Map<Department, number>()
  for (const job of jobs) {
    if (job.is_cancelled) continue
    counts.set(job.department, (counts.get(job.department) ?? 0) + 1)
  }

  const present = DEPARTMENT_ORDER.filter(department => counts.has(department))
  if (present.length === 0) return null

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {present.map(department => {
        const { icon: Icon, colorClassName } = departmentIcon(department)
        const label = jobDepartmentLabel(department)
        return (
          <span key={department} className="relative inline-flex shrink-0" title={label}>
            <Icon size={14} className={colorClassName} aria-label={label} />
          </span>
        )
      })}
    </div>
  )
}
