import { type SubOrderDepartment, SUB_ORDER_DEPARTMENTS } from '../types/database'

const KNOWN_DEPARTMENTS = SUB_ORDER_DEPARTMENTS as readonly string[]

export function uniqueDepartments(
  subOrders: ReadonlyArray<{ department: string | null }> | null | undefined,
): SubOrderDepartment[] {
  const seen = new Set<string>()
  const result: SubOrderDepartment[] = []
  for (const subOrder of subOrders ?? []) {
    const dep = subOrder.department
    if (!dep || seen.has(dep)) continue
    if (!KNOWN_DEPARTMENTS.includes(dep)) continue
    seen.add(dep)
    result.push(dep as SubOrderDepartment)
  }
  return result
}
