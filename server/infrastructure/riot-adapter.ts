import type { MatchIdQuery, RiotAccount, RiotPort, RiotSummoner } from '../domain/riot-port.ts'
import type { MatchParticipantRecord, MatchRecord } from '../domain/match-record.ts'
import type { PlayerRole, RankedStanding } from '../../shared/types/review.ts'
import {
  PLATFORMS,
  isPlatform,
  platformOfMatchId,
  type Platform,
} from '../../shared/domain/platform.ts'
import { ReviewError } from '../domain/review-error.ts'
import { RiotTransport } from './riot-transport.ts'
import { TtlCache } from './ttl-cache.ts'

const ROLES = new Set(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'])
const RANKED_QUEUE_TYPES = new Set(['RANKED_SOLO_5x5', 'RANKED_FLEX_SR'])
// account-v1 answers for every player from any of these hosts.
const ACCOUNT_HOST = 'europe'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function nonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.normalize('NFC').trim() : null
}

function invalid(): never {
  throw new ReviewError(
    'RIOT_INVALID_RESPONSE',
    'Les données reçues de Riot sont incomplètes. Réessayez plus tard.',
  )
}

function parseParticipant(
  value: unknown,
  info: Record<string, unknown>,
  duration: number,
): MatchParticipantRecord {
  const player = record(value)
  if (
    typeof player.puuid !== 'string' ||
    !player.puuid ||
    !['kills', 'deaths', 'assists', 'championId', 'teamId'].every((key) =>
      nonnegative(player[key]),
    ) ||
    typeof player.win !== 'boolean'
  )
    invalid()
  const stat = (key: string): number => (nonnegative(player[key]) ? player[key] : 0)
  const positive = (key: string) => (stat(key) > 0 ? stat(key) : null)
  const championName =
    typeof player.championName === 'string' && /^[A-Za-z0-9]+$/.test(player.championName)
      ? player.championName === 'FiddleSticks'
        ? 'Fiddlesticks'
        : player.championName
      : ''
  return {
    puuid: player.puuid,
    gameName: text(player.riotIdGameName),
    tagLine: text(player.riotIdTagline),
    teamId: stat('teamId'),
    subteamId: positive('playerSubteamId'),
    // Arena: the subteam's final placement.
    placement: positive('subteamPlacement') ?? positive('placement'),
    championId: stat('championId'),
    championName,
    role:
      info.mapId === 11 && ROLES.has(String(player.teamPosition))
        ? (player.teamPosition as PlayerRole)
        : null,
    win: player.win,
    remake: player.gameEndedInEarlySurrender === true,
    kills: stat('kills'),
    deaths: stat('deaths'),
    assists: stat('assists'),
    cs: stat('totalMinionsKilled') + stat('neutralMinionsKilled'),
    gold: stat('goldEarned'),
    damage: stat('totalDamageDealtToChampions'),
    vision: stat('visionScore'),
    timePlayed: positive('timePlayed') ?? duration,
  }
}

// Validates a match-v5 MatchDto and keeps every participant, so one cached game serves
// the profile, the history and the game detail.
export function parseMatch(raw: unknown, id: string): MatchRecord {
  const info = record(record(raw).info)
  if (
    !Array.isArray(info.participants) ||
    !info.participants.length ||
    !nonnegative(info.queueId) ||
    !nonnegative(info.gameStartTimestamp) ||
    !nonnegative(info.gameDuration)
  )
    invalid()
  const duration = info.gameDuration
  const platform = typeof info.platformId === 'string' ? info.platformId.toLowerCase() : ''
  return {
    id,
    platform: isPlatform(platform) ? platform : platformOfMatchId(id),
    queueId: info.queueId,
    mapId: nonnegative(info.mapId) ? info.mapId : 0,
    custom: info.queueId === 0 || info.gameType === 'CUSTOM_GAME',
    startedAt: info.gameStartTimestamp,
    duration,
    teams: (Array.isArray(info.teams) ? info.teams : [])
      .map(record)
      .filter((team) => nonnegative(team.teamId) && typeof team.win === 'boolean')
      .map((team) => ({ teamId: team.teamId as number, win: team.win as boolean })),
    participants: info.participants.map((participant) =>
      parseParticipant(participant, info, duration),
    ),
  }
}

function notFound(code: string, message: string) {
  return (error: unknown): never => {
    if (error instanceof ReviewError && error.code === 'RIOT_NOT_FOUND')
      throw new ReviewError(code, message, 404)
    throw error
  }
}

export class RiotAdapter implements RiotPort {
  private readonly accounts = new TtlCache<RiotAccount>(256)
  private readonly summoners = new TtlCache<RiotSummoner>(256)
  private readonly leagues = new TtlCache<RankedStanding[]>(256)
  private readonly ids = new TtlCache<string[]>(512)
  // A finished game never changes: kept for 30 days, bounded by entry count.
  private readonly matches = new TtlCache<MatchRecord>(2000)

  constructor(private readonly transport: RiotTransport) {}

  findAccount(gameName: string, tagLine: string): Promise<RiotAccount> {
    return this.accounts.remember(
      `${gameName.toLocaleLowerCase('fr')}#${tagLine.toLocaleLowerCase('fr')}`,
      300_000,
      async () => {
        const data = record(
          await this.transport.get(
            ACCOUNT_HOST,
            `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
          ),
        )
        if (
          typeof data.puuid !== 'string' ||
          !data.puuid ||
          typeof data.gameName !== 'string' ||
          typeof data.tagLine !== 'string'
        )
          invalid()
        return { puuid: data.puuid, gameName: data.gameName, tagLine: data.tagLine }
      },
    )
  }

  findSummoner(platform: Platform, puuid: string): Promise<RiotSummoner> {
    return this.summoners.remember(`${platform}:${puuid}`, 300_000, async () => {
      const data = record(
        await this.transport
          .get(platform, `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`)
          .catch(
            notFound(
              'RIOT_NOT_FOUND',
              `Ce Riot ID n’a pas de profil League of Legends sur ${PLATFORMS[platform].label}. Vérifiez le serveur choisi.`,
            ),
          ),
      )
      if (!nonnegative(data.summonerLevel) || !nonnegative(data.profileIconId)) invalid()
      return { level: data.summonerLevel, profileIconId: data.profileIconId }
    })
  }

  findRankedEntries(platform: Platform, puuid: string): Promise<RankedStanding[]> {
    return this.leagues.remember(`${platform}:${puuid}`, 300_000, async () => {
      const data = await this.transport.get(
        platform,
        `/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`,
      )
      if (!Array.isArray(data)) invalid()
      return data
        .map(record)
        .filter(
          (entry) =>
            RANKED_QUEUE_TYPES.has(String(entry.queueType)) &&
            typeof entry.tier === 'string' &&
            ['leaguePoints', 'wins', 'losses'].every((key) => nonnegative(entry[key])),
        )
        .map((entry) => ({
          queue: entry.queueType as RankedStanding['queue'],
          tier: entry.tier as string,
          division: typeof entry.rank === 'string' ? entry.rank : '',
          leaguePoints: entry.leaguePoints as number,
          wins: entry.wins as number,
          losses: entry.losses as number,
        }))
    })
  }

  findMatchIds(platform: Platform, puuid: string, query: MatchIdQuery): Promise<string[]> {
    const region = PLATFORMS[platform].region
    const params = new URLSearchParams({ start: String(query.start), count: String(query.count) })
    if (query.type) params.set('type', query.type)
    if (query.startTime !== undefined) params.set('startTime', String(query.startTime))
    return this.ids.remember(`${region}:${puuid}:${params}`, 120_000, async () => {
      const data = await this.transport.get(
        region,
        `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?${params}`,
      )
      if (
        !Array.isArray(data) ||
        !data.every((id) => typeof id === 'string' && /^[A-Z0-9]+_\d+$/.test(id))
      )
        invalid()
      return [...new Set(data as string[])].slice(0, query.count)
    })
  }

  // Async so an invalid id rejects instead of throwing before Promise.allSettled sees it.
  async findMatch(id: string): Promise<MatchRecord> {
    const platform = platformOfMatchId(id)
    if (!platform) invalid()
    const region = PLATFORMS[platform].region
    return this.matches.remember(`${region}:${id}`, 30 * 86_400_000, async () =>
      parseMatch(
        await this.transport
          .get(region, `/lol/match/v5/matches/${encodeURIComponent(id)}`)
          .catch(notFound('MATCH_NOT_FOUND', 'Cette partie est introuvable chez Riot.')),
        id,
      ),
    )
  }
}
