import type { Department } from '../types/database'
import {
  departmentAbbreviation,
  jobDepartmentLabel,
} from '../const/departmentAbbreviation'
import { cn } from '../lib/utils'
import { Badge } from './ui/badge'

export function DepartmentPill({ department }: { department: Department }) {
  return (
    <Badge
      variant="outline"
      title={jobDepartmentLabel(department)}
      className={cn(
        'inline-block h-auto rounded-none px-1.25 py-px text-[9px] font-normal text-sm',
        'bg-neutral-100 border-neutral-200 text-neutral-500',
      )}
    >
      {departmentAbbreviation(department)}
    </Badge>
  )
}
