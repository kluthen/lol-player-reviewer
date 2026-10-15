import type { ReviewMatch } from '../../shared/types/review.ts'

export interface RiotAccount {
  puuid: string
  gameName: string
  tagLine: string
}

export interface RiotPort {
  findAccount(gameName: string, tagLine: string): Promise<RiotAccount>
  findMatchIds(puuid: string): Promise<string[]>
  findMatch(id: string, puuid: string): Promise<ReviewMatch | null>
}
