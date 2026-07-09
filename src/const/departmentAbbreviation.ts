export const DEPARTMENT_ABBREVIATIONS: Record<string, string> = {
  LFP: 'LFP',
  COPYSHOP: 'CP',
  TEXTILE: 'TX',
  STAMP: 'ST',
  LASER_ENGRAVING: 'LA',
  OTHER: 'SO',
}

export const JOB_DEPARTMENT_LABELS: Record<string, string> = {
  LFP: 'LFP',
  COPYSHOP: 'Copy Shop',
  TEXTILE: 'Textile',
  STAMP: 'Stamp',
  LASER_ENGRAVING: 'Laser Engraving',
  OTHER: 'Other',
}

export function departmentAbbreviation(department: string): string {
  return DEPARTMENT_ABBREVIATIONS[department] ?? department
}

export function jobDepartmentLabel(department: string): string {
  return JOB_DEPARTMENT_LABELS[department] ?? department
}
