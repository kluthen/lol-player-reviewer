import type { Platform } from '../../shared/domain/platform.ts'
import type { PlayerRole } from '../../shared/types/review.ts'

// A validated match-v5 game with every participant. Server-only: it holds PUUIDs.
export interface MatchParticipantRecord {
  puuid: string
  gameName: string | null
  tagLine: string | null
  teamId: number
  subteamId: number | null
  placement: number | null
  championId: number
  championName: string
  role: PlayerRole | null
  win: boolean
  remake: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  gold: number
  damage: number
  vision: number
  timePlayed: number
}

export interface MatchRecord {
  id: string
  platform: Platform | null
  queueId: number
  mapId: number
  custom: boolean
  startedAt: number
  duration: number
  teams: { teamId: number; win: boolean }[]
  participants: MatchParticipantRecord[]
}
