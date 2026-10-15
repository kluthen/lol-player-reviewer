import { ROLE_LABELS } from '#shared/domain/review'
import type { PlayerRole, RankedStanding } from '#shared/types/review'

const integers = new Intl.NumberFormat('fr-FR')
const decimals = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
})
const percents = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 })
const dates = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Paris',
})
const dateTimes = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
})
const TIERS: Record<string, string> = {
  IRON: 'Fer',
  BRONZE: 'Bronze',
  SILVER: 'Argent',
  GOLD: 'Or',
  PLATINUM: 'Platine',
  EMERALD: 'Émeraude',
  DIAMOND: 'Diamant',
  MASTER: 'Maître',
  GRANDMASTER: 'Grand Maître',
  CHALLENGER: 'Challenger',
}

export const formatNumber = (value: number) => integers.format(value)
export const formatKda = (value: number | null) => (value === null ? '—' : decimals.format(value))
export const formatPercent = (value: number | null) =>
  value === null ? '—' : percents.format(value)
export const formatDate = (timestamp: number) => dates.format(timestamp)
export const formatDateTime = (timestamp: number) => dateTimes.format(timestamp)
export const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
export const roleLabel = (role: PlayerRole | null) => (role ? ROLE_LABELS[role] : 'Aucun')
export const roleList = (roles: readonly PlayerRole[]) =>
  roles.map((role) => ROLE_LABELS[role]).join(' · ')
export const formatScore = (score: { kills: number; deaths: number; assists: number }) =>
  `${score.kills} / ${score.deaths} / ${score.assists}`
export const rankedLabel = (entry: RankedStanding) =>
  [
    `${TIERS[entry.tier] ?? entry.tier}${['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(entry.tier) ? '' : ` ${entry.division}`}`,
    `${entry.leaguePoints} LP`,
    `${entry.wins} V – ${entry.losses} D`,
  ].join(' · ')
export const profileIcon = (id: number, version: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${id}.png`
export const championPortrait = (key: string, version: string) =>
  ['Nami', 'Thresh', 'Lulu', 'Nautilus', 'Ahri'].includes(key)
    ? `/images/${key}-portrait.png`
    : `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${key}.png`
export const championSplash = (key: string) =>
  ['Nami', 'Thresh', 'Lulu', 'Nautilus', 'Ahri'].includes(key)
    ? `/images/${key}-splash.jpg`
    : `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${key}_0.jpg`
