import type { PlayerProfile, ReviewMatch } from '../../shared/types/review.ts'
import type { RiotPort } from '../domain/riot-port.ts'
import type { ChampionCatalog } from '../domain/catalog-port.ts'
import { parseRiotId } from '../../shared/domain/riot-id.ts'
import { matchIdPrefix, parsePlatform } from '../../shared/domain/platform.ts'
import { parsePeriod } from '../../shared/domain/period.ts'
import { RANKED_QUEUES } from '../../shared/domain/queues.ts'
import { summarizeProfile } from '../../shared/domain/review.ts'
import { isFatal, loadMatches, toReviewMatch } from './load-matches.ts'

// Profile: the period's ranked games (Solo/Duo and Flex), remakes excluded.
export class GetPlayerProfile {
  constructor(
    private readonly riot: RiotPort,
    private readonly catalog: () => Promise<ChampionCatalog>,
    private readonly now: () => number = Date.now,
  ) {}

  async execute(input: {
    platform: unknown
    riotId: unknown
    period?: unknown
  }): Promise<PlayerProfile> {
    const platform = parsePlatform(input.platform)
    const { gameName, tagLine } = parseRiotId(input.riotId)
    const period = parsePeriod(input.period)
    const account = await this.riot.findAccount(gameName, tagLine)
    // Fails with a 404 when the Riot ID has no profile on this server.
    const summoner = await this.riot.findSummoner(platform, account.puuid)
    // Rounded down to five minutes so a repeated lookup reuses the cached id list.
    const startTime = Math.floor(this.now() / 300_000) * 300 - period.days * 86_400
    const [ids, ranked] = await Promise.all([
      this.riot.findMatchIds(platform, account.puuid, {
        type: 'ranked',
        startTime,
        start: 0,
        count: period.count,
      }),
      // Ranked standing is optional: the profile works without it.
      this.riot.findRankedEntries(platform, account.puuid).catch((error: unknown) => {
        if (isFatal(error)) throw error
        return null
      }),
    ])
    const own = ids.filter((id) => id.startsWith(matchIdPrefix(platform)))
    const { records, unavailable: failed } = await loadMatches(this.riot, own)
    const assets = await this.catalog()
    let unavailable = failed
    let remakes = 0
    let excluded = ids.length - own.length
    const matches: ReviewMatch[] = []
    for (const record of records) {
      const match = toReviewMatch(record, account.puuid, assets)
      if (!match) unavailable++
      else if (record.custom || !RANKED_QUEUES.has(match.queueId)) excluded++
      else if (match.remake) remakes++
      else matches.push(match)
    }
    matches.sort((a, b) => b.startedAt - a.startedAt)
    return {
      player: {
        gameName: account.gameName,
        tagLine: account.tagLine,
        platform,
        level: summoner.level,
        profileIconId: summoner.profileIconId,
      },
      ranked,
      period: { id: period.id, count: period.count, days: period.days },
      matches,
      summary: summarizeProfile(matches),
      sample: { found: ids.length, unavailable, remakes, excluded },
      assetVersion: assets.version,
      updatedAt: this.now(),
    }
  }
}
