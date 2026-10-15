import type { PlayerReview, ReviewMatch } from '../../shared/types/review.ts'
import type { RiotPort } from '../domain/riot-port.ts'
import type { ChampionCatalog } from '../domain/catalog-port.ts'
import { parseRiotId } from '../../shared/domain/riot-id.ts'
import { summarizeMatches } from '../../shared/domain/review.ts'
import { ReviewError } from '../domain/review-error.ts'

export class GetPlayerReview {
  constructor(
    private readonly riot: RiotPort,
    private readonly catalog: () => Promise<ChampionCatalog>,
  ) {}

  async execute(riotId: unknown): Promise<PlayerReview> {
    const { gameName, tagLine } = parseRiotId(riotId)
    const account = await this.riot.findAccount(gameName, tagLine)
    const allIds = (await this.riot.findMatchIds(account.puuid)).slice(0, 20)
    const ids = allIds.filter((id) => id.startsWith('EUW1_'))
    const matches: ReviewMatch[] = []
    let unavailable = 0
    let excluded = allIds.length - ids.length
    // Three requests at a time; fatal quota/credential errors stop further batches.
    for (let start = 0; start < ids.length; start += 3) {
      const results = await Promise.allSettled(
        ids.slice(start, start + 3).map((id) => this.riot.findMatch(id, account.puuid)),
      )
      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value) matches.push(result.value)
          else excluded++
        } else if (
          result.reason instanceof ReviewError &&
          ['RIOT_KEY_REJECTED', 'RIOT_RATE_LIMITED', 'RIOT_NOT_CONFIGURED'].includes(
            result.reason.code,
          )
        ) {
          throw result.reason
        } else unavailable++
      }
    }
    if (unavailable && matches.length === 0)
      throw new ReviewError(
        'MATCHES_UNAVAILABLE',
        'Les parties de ce joueur sont momentanément indisponibles. Réessayez plus tard.',
      )
    const assets = await this.catalog()
    const enriched = matches
      .map((match) => {
        const champion = assets.champions[String(match.championId)]
        return champion
          ? { ...match, championKey: champion.key, championName: champion.name }
          : match
      })
      .sort((a, b) => b.startedAt - a.startedAt)
    return {
      player: { gameName: account.gameName, tagLine: account.tagLine, region: 'EUW' },
      matches: enriched,
      summary: summarizeMatches(enriched),
      sample: { requested: 20, found: allIds.length, unavailable, excluded },
      assetVersion: assets.version,
      updatedAt: Date.now(),
    }
  }
}
