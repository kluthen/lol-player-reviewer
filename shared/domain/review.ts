import type { PlayerRole, ReviewFilters, ReviewMatch, ReviewSummary } from '../types/review.ts'

export const ROLE_LABELS: Record<PlayerRole, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'ADC',
  UTILITY: 'Support',
}

export function summarizeMatches(matches: readonly ReviewMatch[]): ReviewSummary {
  const wins = matches.filter((match) => match.win).length
  const deaths = matches.reduce((sum, match) => sum + match.deaths, 0)
  const contributions = matches.reduce((sum, match) => sum + match.kills + match.assists, 0)
  const champions = new Map<string, ReviewSummary['champions'][number]>()
  const roles = new Map<PlayerRole, number>()
  for (const match of matches) {
    const champion = champions.get(match.championKey) ?? {
      key: match.championKey,
      name: match.championName,
      games: 0,
      wins: 0,
    }
    champions.set(match.championKey, {
      ...champion,
      games: champion.games + 1,
      wins: champion.wins + Number(match.win),
    })
    if (match.role) roles.set(match.role, (roles.get(match.role) ?? 0) + 1)
  }
  const sortedRoles = [...roles].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  // A tied sample does not establish a predominant role.
  const mainRole =
    sortedRoles[0] && sortedRoles[0][1] !== sortedRoles[1]?.[1] ? sortedRoles[0][0] : null
  return {
    games: matches.length,
    wins,
    winRate: matches.length ? Math.round((wins / matches.length) * 100) : null,
    kda: matches.length && deaths ? contributions / deaths : null,
    deathless: matches.length > 0 && deaths === 0,
    mainRole,
    champions: [...champions.values()]
      .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name, 'fr'))
      .slice(0, 3),
    // A discussion starter, not an automatic assessment of individual skill.
    reviewIds: matches
      .filter((match) => !match.win)
      .sort((a, b) => b.deaths - a.deaths || b.startedAt - a.startedAt)
      .slice(0, 2)
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
