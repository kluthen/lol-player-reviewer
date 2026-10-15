import type { PlayerHistory, ReviewMatch } from '../../shared/types/review.ts'
import type { RiotPort } from '../domain/riot-port.ts'
import type { ChampionCatalog } from '../domain/catalog-port.ts'
import { InvalidInput } from '../../shared/domain/invalid-input.ts'
import { parseRiotId } from '../../shared/domain/riot-id.ts'
import { matchIdPrefix, parsePlatform } from '../../shared/domain/platform.ts'
import { loadMatches, toReviewMatch } from './load-matches.ts'

export const HISTORY_PAGE = 20

function parseStart(value: unknown): number {
  if (value === undefined || value === '') return 0
  if (typeof value !== 'string' || !/^\d{1,4}$/.test(value) || Number(value) > 1000)
    throw new InvalidInput('INVALID_START', 'Cette page de l’historique n’existe pas.')
  return Number(value)
}

// History: every queue, newest first, one page of 20 game ids per call.
export class GetPlayerHistory {
  constructor(
    private readonly riot: RiotPort,
    private readonly catalog: () => Promise<ChampionCatalog>,
    private readonly now: () => number = Date.now,
  ) {}

  async execute(input: {
    platform: unknown
    riotId: unknown
    start?: unknown
  }): Promise<PlayerHistory> {
    const platform = parsePlatform(input.platform)
    const { gameName, tagLine } = parseRiotId(input.riotId)
    const start = parseStart(input.start)
    const account = await this.riot.findAccount(gameName, tagLine)
    await this.riot.findSummoner(platform, account.puuid)
    const ids = await this.riot.findMatchIds(platform, account.puuid, {
      start,
      count: HISTORY_PAGE,
    })
    const own = ids.filter((id) => id.startsWith(matchIdPrefix(platform)))
    const { records, unavailable: failed } = await loadMatches(this.riot, own)
    const assets = await this.catalog()
    let unavailable = failed
    let excluded = ids.length - own.length
    const matches: ReviewMatch[] = []
    for (const record of records) {
      const match = toReviewMatch(record, account.puuid, assets)
      if (!match) unavailable++
      else if (record.custom) excluded++
      else matches.push(match)
    }
    matches.sort((a, b) => b.startedAt - a.startedAt)
    return {
      player: { gameName: account.gameName, tagLine: account.tagLine, platform },
      matches,
      page: {
        start,
        count: HISTORY_PAGE,
        found: ids.length,
        unavailable,
        excluded,
        next: ids.length === HISTORY_PAGE ? start + HISTORY_PAGE : null,
      },
      assetVersion: assets.version,
      updatedAt: this.now(),
    }
  }
}
