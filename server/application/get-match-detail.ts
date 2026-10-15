import type { MatchDetail, MatchTeam } from '../../shared/types/review.ts'
import type { RiotPort } from '../domain/riot-port.ts'
import type { ChampionCatalog } from '../domain/catalog-port.ts'
import type { MatchParticipantRecord, MatchRecord } from '../domain/match-record.ts'
import { parseRiotId } from '../../shared/domain/riot-id.ts'
import { parseMatchId } from '../../shared/domain/platform.ts'
import { queueLabel } from '../../shared/domain/queues.ts'
import { championOf, isArena, teamKey } from './load-matches.ts'

const total = (players: MatchParticipantRecord[], key: 'kills' | 'deaths' | 'assists') =>
  players.reduce((sum, player) => sum + player[key], 0)

// Game detail: every roster of one game. PUUIDs never leave the server.
export class GetMatchDetail {
  constructor(
    private readonly riot: RiotPort,
    private readonly catalog: () => Promise<ChampionCatalog>,
    private readonly now: () => number = Date.now,
  ) {}

  async execute(input: { matchId: unknown; riotId?: unknown }): Promise<MatchDetail> {
    const id = parseMatchId(input.matchId)
    const record = await this.riot.findMatch(id)
    const reviewed = await this.reviewedPlayer(record, input.riotId)
    const assets = await this.catalog()
    const arena = isArena(record)
    const groups = new Map<number, MatchParticipantRecord[]>()
    for (const participant of record.participants) {
      const key = teamKey(record, participant)
      groups.set(key, [...(groups.get(key) ?? []), participant])
    }
    const teams: MatchTeam[] = [...groups].map(([teamId, players]) => {
      const placements = players.flatMap((player) => player.placement ?? [])
      return {
        id: teamId,
        win: arena
          ? players.some((player) => player.win)
          : (record.teams.find((team) => team.teamId === teamId)?.win ??
            players.some((player) => player.win)),
        placement: arena && placements.length ? Math.min(...placements) : null,
        kills: total(players, 'kills'),
        deaths: total(players, 'deaths'),
        assists: total(players, 'assists'),
        players: players.map((player) => {
          const champion = championOf(assets, player.championId, player.championName)
          return {
            gameName: player.gameName,
            tagLine: player.tagLine,
            championKey: champion.key,
            championName: champion.name,
            role: player.role,
            kills: player.kills,
            deaths: player.deaths,
            assists: player.assists,
            reviewed: player === reviewed,
          }
        }),
      }
    })
    teams.sort((a, b) => (arena ? (a.placement ?? 99) - (b.placement ?? 99) : a.id - b.id))
    return {
      id,
      platform: record.platform,
      queueId: record.queueId,
      mode: queueLabel(record.queueId),
      startedAt: record.startedAt,
      duration: record.duration,
      remake: record.participants.some((participant) => participant.remake),
      arena,
      teams,
      assetVersion: assets.version,
      updatedAt: this.now(),
    }
  }

  // The player whose history the game was opened from: by PUUID when the account resolves
  // (usually cached), otherwise by the Riot ID recorded in the game.
  private async reviewedPlayer(
    record: MatchRecord,
    riotId: unknown,
  ): Promise<MatchParticipantRecord | null> {
    if (typeof riotId !== 'string' || !riotId) return null
    let name: { gameName: string; tagLine: string }
    try {
      name = parseRiotId(riotId)
    } catch {
      return null
    }
    const account = await this.riot.findAccount(name.gameName, name.tagLine).catch(() => null)
    const same = (a: string | null, b: string) =>
      a?.toLocaleLowerCase('fr') === b.toLocaleLowerCase('fr')
    return (
      record.participants.find((participant) => participant.puuid === account?.puuid) ??
      record.participants.find(
        (participant) =>
          same(participant.gameName, name.gameName) && same(participant.tagLine, name.tagLine),
      ) ??
      null
    )
  }
}
