import type { ReviewMatch } from '../../shared/types/review.ts'
import type { ChampionCatalog } from '../domain/catalog-port.ts'
import type { MatchParticipantRecord, MatchRecord } from '../domain/match-record.ts'
import type { RiotPort } from '../domain/riot-port.ts'
import { ARENA_QUEUES, queueLabel } from '../../shared/domain/queues.ts'
import { ReviewError } from '../domain/review-error.ts'

const FATAL = new Set(['RIOT_KEY_REJECTED', 'RIOT_RATE_LIMITED', 'RIOT_NOT_CONFIGURED'])

// Quota and credential failures stop the whole request; anything else affects one game.
export const isFatal = (error: unknown) => error instanceof ReviewError && FATAL.has(error.code)

export async function loadMatches(
  riot: RiotPort,
  ids: readonly string[],
): Promise<{ records: MatchRecord[]; unavailable: number }> {
  const records: MatchRecord[] = []
  let unavailable = 0
  // Three requests at a time; fatal quota/credential errors stop further batches.
  for (let start = 0; start < ids.length; start += 3) {
    const results = await Promise.allSettled(
      ids.slice(start, start + 3).map((id) => riot.findMatch(id)),
    )
    for (const result of results) {
      if (result.status === 'fulfilled') records.push(result.value)
      else if (isFatal(result.reason)) throw result.reason
      else unavailable++
    }
  }
  if (ids.length && !records.length)
    throw new ReviewError(
      'MATCHES_UNAVAILABLE',
      'Les parties de ce joueur sont momentanément indisponibles. Réessayez plus tard.',
    )
  return { records, unavailable }
}

export function championOf(catalog: ChampionCatalog, championId: number, fallback: string) {
  return catalog.champions[String(championId)] ?? { key: fallback, name: fallback }
}

export const isArena = (record: MatchRecord) =>
  ARENA_QUEUES.has(record.queueId) &&
  record.participants.some((participant) => participant.subteamId !== null)

// Arena teams are the subteams of two; every other mode uses teamId.
export const teamKey = (record: MatchRecord, participant: MatchParticipantRecord) =>
  isArena(record) ? (participant.subteamId ?? 0) : participant.teamId

export function toReviewMatch(
  record: MatchRecord,
  puuid: string,
  catalog: ChampionCatalog,
): ReviewMatch | null {
  const player = record.participants.find((participant) => participant.puuid === puuid)
  if (!player) return null
  const team = record.participants.filter(
    (participant) => teamKey(record, participant) === teamKey(record, player),
  )
  const champion = championOf(catalog, player.championId, player.championName)
  return {
    id: record.id,
    championId: player.championId,
    championKey: champion.key,
    championName: champion.name,
    queueId: record.queueId,
    mode: queueLabel(record.queueId),
    role: player.role,
    win: player.win,
    remake: player.remake,
    kills: player.kills,
    deaths: player.deaths,
    assists: player.assists,
    startedAt: record.startedAt,
    duration: record.duration,
    timePlayed: player.timePlayed,
    vision: player.vision,
    cs: player.cs,
    gold: player.gold,
    damage: player.damage,
    teamKills: team.reduce((total, participant) => total + participant.kills, 0),
    teamDamage: team.reduce((total, participant) => total + participant.damage, 0),
  }
}
