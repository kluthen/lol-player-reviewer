import type { Platform } from '../../shared/domain/platform.ts'
import type { RankedStanding } from '../../shared/types/review.ts'
import type { MatchRecord } from './match-record.ts'

export interface RiotAccount {
  puuid: string
  gameName: string
  tagLine: string
}

export interface RiotSummoner {
  level: number
  profileIconId: number
}

export interface MatchIdQuery {
  start: number
  count: number
  type?: 'ranked'
  // Epoch seconds.
  startTime?: number
}

export interface RiotPort {
  findAccount(gameName: string, tagLine: string): Promise<RiotAccount>
  findSummoner(platform: Platform, puuid: string): Promise<RiotSummoner>
  findRankedEntries(platform: Platform, puuid: string): Promise<RankedStanding[]>
  findMatchIds(platform: Platform, puuid: string, query: MatchIdQuery): Promise<string[]>
  findMatch(id: string): Promise<MatchRecord>
}
