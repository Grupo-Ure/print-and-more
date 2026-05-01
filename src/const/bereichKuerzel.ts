export const BEREICH_KUERZEL: Record<string, string> = {
  LFP: 'LFP',
  COPYSHOP: 'CP',
  TEXTIL: 'TX',
  STEMPEL: 'ST',
  LASERGRAVUR: 'LA',
  SONSTIGE: 'SO',
}

export function bereichKuerzel(b: string): string {
  return BEREICH_KUERZEL[b] ?? b
}
