export const DEPARTMENT_ABBREVIATIONS: Record<string, string> = {
  LFP: 'LFP',
  COPYSHOP: 'CP',
  TEXTIL: 'TX',
  STEMPEL: 'ST',
  LASERGRAVUR: 'LA',
  SONSTIGE: 'SO',
}

export function departmentAbbreviation(department: string): string {
  return DEPARTMENT_ABBREVIATIONS[department] ?? department
}
