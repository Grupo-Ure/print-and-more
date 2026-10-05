import type { ComponentType } from 'react'
import { Image, Package, Printer, Shirt, Stamp, Zap, type LucideProps } from 'lucide-react'
import { DEPARTMENTS, type Department } from '../types/database'

export type DepartmentIconMeta = {
  icon: ComponentType<LucideProps>
  colorClassName: string
}

/**
 * Icon + colour per production department. Keyed as `Record<Department, ...>`
 * against the DB-generated `Department` enum (see `types/database.ts`), so a
 * department added in a migration fails the build here until it gets an icon
 * — this file, not a hardcoded list, is the source of truth for callers.
 */
const DEPARTMENT_ICONS: Record<Department, DepartmentIconMeta> = {
  LFP: { icon: Image, colorClassName: 'text-sky-600' },
  COPYSHOP: { icon: Printer, colorClassName: 'text-violet-600' },
  TEXTILE: { icon: Shirt, colorClassName: 'text-emerald-600' },
  STAMP: { icon: Stamp, colorClassName: 'text-amber-600' },
  LASER_ENGRAVING: { icon: Zap, colorClassName: 'text-rose-600' },
  OTHER: { icon: Package, colorClassName: 'text-neutral-500' },
}

export function departmentIcon(department: Department): DepartmentIconMeta {
  return DEPARTMENT_ICONS[department]
}

/** All departments in the DB enum's declared order — for stable icon-row layout. */
export const DEPARTMENT_ORDER: readonly Department[] = DEPARTMENTS
