export type PlayerRole = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY'

export interface ReviewMatch {
  id: string
  championId: number
  championKey: string
  championName: string
  queueId: number
  mode: string
  role: PlayerRole | null
  win: boolean
  kills: number
  deaths: number
  assists: number
  startedAt: number
  duration: number
  vision: number
  cs: number
  gold: number
  damage: number
  items: number[]
}

export interface ReviewSummary {
  games: number
  wins: number
  winRate: number | null
  kda: number | null
  deathless: boolean
  mainRole: PlayerRole | null
  champions: { key: string; name: string; games: number; wins: number }[]
  reviewIds: string[]
}

export interface PlayerReview {
  player: { gameName: string; tagLine: string; region: 'EUW' }
  matches: ReviewMatch[]
  summary: ReviewSummary
  sample: { requested: number; found: number; unavailable: number; excluded: number }
  assetVersion: string
  updatedAt: number
}

export interface ReviewFilters {
  queue: string
  role: string
  result: string
  order: 'recent' | 'oldest'
}
