import type { RiotAccount, RiotPort } from '../domain/riot-port.ts'
import type { PlayerRole, ReviewMatch } from '../../shared/types/review.ts'
import { ReviewError } from '../domain/review-error.ts'
import { RiotTransport } from './riot-transport.ts'
import { TtlCache } from './ttl-cache.ts'

const QUEUES: Record<number, string> = {
  400: 'Normal Draft',
  420: 'Classée Solo/Duo',
  430: 'Normal',
  440: 'Classée Flex',
  450: 'ARAM',
  490: 'Partie rapide',
  700: 'Clash',
  900: 'URF',
  1700: 'Arena',
}
const ROLES = new Set(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'])

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function nonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function invalid(): never {
  throw new ReviewError(
    'RIOT_INVALID_RESPONSE',
    'Les données reçues de Riot sont incomplètes. Réessayez plus tard.',
  )
}

export function extractMatch(raw: unknown, id: string, puuid: string): ReviewMatch | null {
  const info = record(record(raw).info)
  if (info.queueId === 0 || info.gameType === 'CUSTOM_GAME') return null
  if (!Array.isArray(info.participants)) invalid()
  const player = info.participants.map(record).find((participant) => participant.puuid === puuid)
  if (
    !player ||
    !['kills', 'deaths', 'assists', 'championId'].every((key) => nonnegative(player[key])) ||
    typeof player.win !== 'boolean' ||
    typeof player.championName !== 'string' ||
    !/^[A-Za-z0-9]+$/.test(player.championName) ||
    !nonnegative(info.queueId) ||
    !nonnegative(info.gameStartTimestamp) ||
    !nonnegative(info.gameDuration)
  )
    invalid()
  const stat = (key: string): number => (nonnegative(player[key]) ? player[key] : 0)
  return {
    id,
    championId: stat('championId'),
    championKey: player.championName === 'FiddleSticks' ? 'Fiddlesticks' : player.championName,
    championName: player.championName,
    queueId: info.queueId,
    mode: QUEUES[info.queueId] ?? `Autre mode (${info.queueId})`,
    role:
      info.mapId === 11 && ROLES.has(String(player.teamPosition))
        ? (player.teamPosition as PlayerRole)
        : null,
    win: player.win,
    kills: stat('kills'),
    deaths: stat('deaths'),
    assists: stat('assists'),
    startedAt: info.gameStartTimestamp,
    duration: info.gameDuration,
    vision: stat('visionScore'),
    cs: stat('totalMinionsKilled') + stat('neutralMinionsKilled'),
    gold: stat('goldEarned'),
    damage: stat('totalDamageDealtToChampions'),
    items: Array.from({ length: 7 }, (_, index) => stat(`item${index}`)),
  }
}

export class RiotAdapter implements RiotPort {
  private readonly accounts = new TtlCache<RiotAccount>(256)
  private readonly ids = new TtlCache<string[]>(256)
  private readonly matches = new TtlCache<unknown>(256)

  constructor(private readonly transport: RiotTransport) {}

  findAccount(gameName: string, tagLine: string): Promise<RiotAccount> {
    return this.accounts.remember(
      `${gameName.toLocaleLowerCase('fr')}#${tagLine.toLocaleLowerCase('fr')}`,
      300_000,
      async () => {
        const data = record(
          await this.transport.get(
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

  findMatchIds(puuid: string): Promise<string[]> {
    return this.ids.remember(`europe:${puuid}`, 120_000, async () => {
      const data = await this.transport.get(
        `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=20`,
      )
      if (
        !Array.isArray(data) ||
        !data.every((id) => typeof id === 'string' && /^[A-Z0-9]+_\d+$/.test(id))
      )
        invalid()
      return [...new Set(data as string[])].slice(0, 20)
    })
  }

  async findMatch(id: string, puuid: string): Promise<ReviewMatch | null> {
    const data = await this.matches.remember(`europe:${id}`, 86_400_000, async () => {
      const raw = await this.transport.get(`/lol/match/v5/matches/${encodeURIComponent(id)}`)
      extractMatch(raw, id, puuid)
      return raw
    })
    return extractMatch(data, id, puuid)
  }
}
