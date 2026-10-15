import { ROLE_LABELS } from '#shared/domain/review'
import type { PlayerRole } from '#shared/types/review'

const integers = new Intl.NumberFormat('fr-FR')
const decimals = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
})
const dates = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Paris',
})

export const formatNumber = (value: number) => integers.format(value)
export const formatKda = (value: number | null) => (value === null ? '—' : decimals.format(value))
export const formatDate = (timestamp: number) => dates.format(timestamp)
export const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
export const roleLabel = (role: PlayerRole | null) => (role ? ROLE_LABELS[role] : 'Non applicable')
export const championPortrait = (key: string, version: string) =>
  ['Nami', 'Thresh', 'Lulu', 'Nautilus', 'Ahri'].includes(key)
    ? `/images/${key}-portrait.png`
    : `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${key}.png`
export const championSplash = (key: string) =>
  ['Nami', 'Thresh', 'Lulu', 'Nautilus', 'Ahri'].includes(key)
    ? `/images/${key}-splash.jpg`
    : `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${key}_0.jpg`
