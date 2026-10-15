import { InvalidInput } from './invalid-input.ts'

// The profile's only periods: the last N ranked games played within the last D days.
export const PERIODS = [
  { id: '20-30', count: 20, days: 30, label: '20 parties · 30 jours' },
  { id: '30-60', count: 30, days: 60, label: '30 parties · 60 jours' },
  { id: '30-90', count: 30, days: 90, label: '30 parties · 90 jours' },
] as const

export type Period = (typeof PERIODS)[number]
export type PeriodId = Period['id']

export const DEFAULT_PERIOD: Period = PERIODS[0]

export function findPeriod(value: unknown): Period | undefined {
  return PERIODS.find((period) => period.id === value)
}

// A missing period means the default one; an unknown one is a client error.
export function parsePeriod(value: unknown): Period {
  if (value === undefined || value === '') return DEFAULT_PERIOD
  const period = findPeriod(value)
  if (!period) throw new InvalidInput('INVALID_PERIOD', 'Choisissez une période proposée.')
  return period
}
