import type { Platform } from '../domain/platform.ts'
import type { PeriodId } from '../domain/period.ts'

export type PlayerRole = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY'

export interface PlayerRef {
  gameName: string
  tagLine: string
  platform: Platform
}

// The reviewed player's entry in one game.
export interface ReviewMatch {
  id: string
  championId: number
  championKey: string
  championName: string
  queueId: number
  mode: string
  role: PlayerRole | null
  win: boolean
  remake: boolean
  kills: number
  deaths: number
  assists: number
  startedAt: number
  duration: number
  timePlayed: number
  vision: number
  cs: number
  gold: number
  damage: number
  teamKills: number
  teamDamage: number
}

export interface ChampionSummary {
  key: string
  name: string
  games: number
  wins: number
  winRate: number
  kda: number
}

export interface PerformanceAverages {
  kills: number
  deaths: number
  assists: number
  csPerMinute: number | null
  goldPerMinute: number | null
  damagePerMinute: number | null
  visionPerMinute: number | null
  killParticipation: number | null
  damageShare: number | null
}

export interface ProfileSummary {
  games: number
  wins: number
  winRate: number | null
  kda: number | null
  mainRoles: PlayerRole[]
  topChampion: { key: string; name: string } | null
  champions: ChampionSummary[]
  averages: PerformanceAverages | null
  recentIds: string[]
  reviewIds: string[]
}

export interface RankedStanding {
  queue: 'RANKED_SOLO_5x5' | 'RANKED_FLEX_SR'
  tier: string
  division: string
  leaguePoints: number
  wins: number
  losses: number
}

export interface PlayerProfile {
  player: PlayerRef & { level: number; profileIconId: number }
  ranked: RankedStanding[] | null
  period: { id: PeriodId; count: number; days: number }
  matches: ReviewMatch[]
  summary: ProfileSummary
  sample: { found: number; unavailable: number; remakes: number; excluded: number }
  assetVersion: string
  updatedAt: number
}

export interface PlayerHistory {
  player: PlayerRef
  matches: ReviewMatch[]
  page: {
    start: number
    count: number
    found: number
    unavailable: number
    excluded: number
    next: number | null
  }
  assetVersion: string
  updatedAt: number
}

export interface MatchPlayer {
  gameName: string | null
  tagLine: string | null
  championKey: string
  championName: string
  role: PlayerRole | null
  kills: number
  deaths: number
  assists: number
  reviewed: boolean
}

export interface MatchTeam {
  id: number
  win: boolean
  placement: number | null
  kills: number
  deaths: number
  assists: number
  players: MatchPlayer[]
}

export interface MatchDetail {
  id: string
  platform: Platform | null
  queueId: number
  mode: string
  startedAt: number
  duration: number
  remake: boolean
  arena: boolean
  teams: MatchTeam[]
  assetVersion: string
  updatedAt: number
}

export interface ReviewFilters {
  queue: string
  role: string
  result: string
  order: 'recent' | 'oldest'
}
