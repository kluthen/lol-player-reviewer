import type {
  ChampionSummary,
  PerformanceAverages,
  PlayerRole,
  ProfileSummary,
  ReviewFilters,
  ReviewMatch,
} from '../types/review.ts'

export const ROLE_LABELS: Record<PlayerRole, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'ADC',
  UTILITY: 'Support',
}

// Desktop "Dernières parties" and mobile "À revoir" sizes (the spec allows 3 to 5).
export const RECENT_GAMES = 5
export const REVIEW_GAMES = 3

// Display names compared without case or accents: "Élise" sorts with "Elise".
const names = new Intl.Collator('fr', { sensitivity: 'base' })
export const compareNames = (a: string, b: string) => names.compare(a, b)

export const kdaRatio = (kills: number, deaths: number, assists: number) =>
  (kills + assists) / Math.max(deaths, 1)

const sum = (matches: readonly ReviewMatch[], value: (match: ReviewMatch) => number) =>
  matches.reduce((total, match) => total + value(match), 0)

const ratio = (value: number, total: number) => (total > 0 ? value / total : null)

// Every role tied for the most games, the most recently played first.
export function mostPlayedRoles(matches: readonly ReviewMatch[]): PlayerRole[] {
  const roles = new Map<PlayerRole, { games: number; last: number }>()
  for (const match of matches) {
    if (!match.role) continue
    const role = roles.get(match.role) ?? { games: 0, last: 0 }
    roles.set(match.role, {
      games: role.games + 1,
      last: Math.max(role.last, match.startedAt),
    })
  }
  const top = Math.max(0, ...[...roles.values()].map((role) => role.games))
  return [...roles]
    .filter(([, role]) => role.games === top)
    .sort((a, b) => b[1].last - a[1].last || a[0].localeCompare(b[0]))
    .map(([role]) => role)
}

// Most games first; on a tie, the display name that comes first alphabetically.
export function rankChampions(matches: readonly ReviewMatch[]): ChampionSummary[] {
  const champions = new Map<string, ReviewMatch[]>()
  for (const match of matches)
    champions.set(match.championKey, [...(champions.get(match.championKey) ?? []), match])
  return [...champions.values()]
    .map((games) => {
      const wins = games.filter((match) => match.win).length
      return {
        key: games[0]!.championKey,
        name: games[0]!.championName,
        games: games.length,
        wins,
        winRate: Math.round((wins / games.length) * 100),
        kda: kdaRatio(
          sum(games, (match) => match.kills),
          sum(games, (match) => match.deaths),
          sum(games, (match) => match.assists),
        ),
      }
    })
    .sort((a, b) => b.games - a.games || compareNames(a.name, b.name) || a.key.localeCompare(b.key))
}

function averages(matches: readonly ReviewMatch[]): PerformanceAverages | null {
  if (!matches.length) return null
  const minutes = sum(matches, (match) => match.timePlayed) / 60
  return {
    kills: sum(matches, (match) => match.kills) / matches.length,
    deaths: sum(matches, (match) => match.deaths) / matches.length,
    assists: sum(matches, (match) => match.assists) / matches.length,
    csPerMinute: ratio(
      sum(matches, (match) => match.cs),
      minutes,
    ),
    goldPerMinute: ratio(
      sum(matches, (match) => match.gold),
      minutes,
    ),
    damagePerMinute: ratio(
      sum(matches, (match) => match.damage),
      minutes,
    ),
    visionPerMinute: ratio(
      sum(matches, (match) => match.vision),
      minutes,
    ),
    killParticipation: ratio(
      sum(matches, (match) => match.kills + match.assists),
      sum(matches, (match) => match.teamKills),
    ),
    damageShare: ratio(
      sum(matches, (match) => match.damage),
      sum(matches, (match) => match.teamDamage),
    ),
  }
}

// Figures for the profile. The caller passes only the period's ranked games, remakes excluded.
export function summarizeProfile(matches: readonly ReviewMatch[]): ProfileSummary {
  const newest = [...matches].sort((a, b) => b.startedAt - a.startedAt)
  const wins = matches.filter((match) => match.win).length
  const champions = rankChampions(matches)
  return {
    games: matches.length,
    wins,
    winRate: matches.length ? Math.round((wins / matches.length) * 100) : null,
    kda: matches.length
      ? kdaRatio(
          sum(matches, (match) => match.kills),
          sum(matches, (match) => match.deaths),
          sum(matches, (match) => match.assists),
        )
      : null,
    mainRoles: mostPlayedRoles(matches),
    topChampion: champions[0] ? { key: champions[0].key, name: champions[0].name } : null,
    champions: champions.slice(0, 3),
    averages: averages(matches),
    recentIds: newest.slice(0, RECENT_GAMES).map((match) => match.id),
    reviewIds: newest
      .filter((match) => !match.win)
      .slice(0, REVIEW_GAMES)
      .map((match) => match.id),
  }
}

export function filterMatches(
  matches: readonly ReviewMatch[],
  filters: ReviewFilters,
): ReviewMatch[] {
  return matches
    .filter(
      (match) =>
        (!filters.queue || String(match.queueId) === filters.queue) &&
        (!filters.role ||
          (filters.role === 'NONE' ? match.role === null : match.role === filters.role)) &&
        (!filters.result || match.win === (filters.result === 'win')),
    )
    .sort((a, b) =>
      filters.order === 'oldest' ? a.startedAt - b.startedAt : b.startedAt - a.startedAt,
    )
}
