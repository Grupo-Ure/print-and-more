import { type Department, DEPARTMENTS } from '../types/database'

const KNOWN_DEPARTMENTS = DEPARTMENTS as readonly string[]

export function uniqueDepartments(
  jobs: ReadonlyArray<{ department: string | null }> | null | undefined,
): Department[] {
  const seen = new Set<string>()
  const result: Department[] = []
  for (const job of jobs ?? []) {
    const dep = job.department
    if (!dep || seen.has(dep)) continue
    if (!KNOWN_DEPARTMENTS.includes(dep)) continue
    seen.add(dep)
    result.push(dep as Department)
  }
  return result
}
