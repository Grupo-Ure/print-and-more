import { cn } from '@/lib/utils'
import { departmentLabel } from '../lib/departmentLabels'
import { departmentIcon, DEPARTMENT_ORDER } from '../lib/departmentIcons'
import type { Department } from '../types/database'

type ProductDepartmentIconsProps = {
  products: { department: Department; is_cancelled: boolean }[]
  className?: string
}

/** One icon per department present among `products`. */
export function ProductDepartmentIcons({ products, className }: ProductDepartmentIconsProps) {
  const present = DEPARTMENT_ORDER.filter(department =>
    products.some(product => !product.is_cancelled && product.department === department),
  )
  if (present.length === 0) return null

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {present.map(department => {
        const { icon: Icon } = departmentIcon(department)
        const label = departmentLabel(department)
        return (
          <span key={department} className="relative inline-flex shrink-0" title={label}>
            <Icon size={18} className="text-neutral-500" aria-label={label} />
          </span>
        )
      })}
    </div>
  )
}
