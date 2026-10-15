import type {
  MatchDetail,
  PlayerHistory,
  PlayerProfile,
  PlayerRole,
  ReviewMatch,
} from '../../shared/types/review.ts'
import type { MatchParticipantRecord, MatchRecord } from '../../server/domain/match-record.ts'
import { summarizeProfile } from '../../shared/domain/review.ts'

// Synthetic data for automated tests only. Never imported by the application.
const ranked = [
  ['Nami', 267, true, 4, 2, 18, 420, 'UTILITY'],
  ['Thresh', 412, false, 1, 7, 12, 420, 'UTILITY'],
  ['Ahri', 103, true, 12, 5, 14, 440, 'MIDDLE'],
  ['Nautilus', 111, false, 0, 6, 8, 420, 'UTILITY'],
  ['Lulu', 117, true, 2, 3, 16, 440, 'UTILITY'],
  ['Nami', 267, true, 5, 4, 12, 420, 'UTILITY'],
  ['Thresh', 412, false, 3, 8, 8, 420, 'UTILITY'],
  ['Nami', 267, true, 10, 2, 9, 420, 'UTILITY'],
  ['Lulu', 117, false, 4, 5, 10, 420, 'UTILITY'],
  ['Nami', 267, true, 11, 3, 12, 420, 'UTILITY'],
] as const

const MODES: Record<number, string> = {
  420: 'Classée Solo/Duo',
  440: 'Classée Flex',
  450: 'ARAM',
  1700: 'Arena',
}

export function makeMatch(overrides: Partial<ReviewMatch> = {}): ReviewMatch {
  return {
    id: 'EUW1_1000',
    championId: 267,
    championKey: 'Nami',
    championName: 'Nami',
    queueId: 420,
    mode: 'Classée Solo/Duo',
    role: 'UTILITY',
    win: true,
    remake: false,
    kills: 4,
    deaths: 2,
    assists: 18,
    startedAt: Date.UTC(2026, 9, 14, 18),
    duration: 1800,
    timePlayed: 1800,
    vision: 42,
    cs: 31,
    gold: 10250,
    damage: 8460,
    teamKills: 30,
    teamDamage: 84600,
    ...overrides,
  }
}

function rankedMatches(): ReviewMatch[] {
  return ranked.map(([champion, championId, win, kills, deaths, assists, queueId, role], index) =>
    makeMatch({
      id: `EUW1_${1000 + index}`,
      championId,
      championKey: champion,
      championName: champion,
      win,
      kills,
      deaths,
      assists,
      queueId,
      role,
      mode: MODES[queueId],
      startedAt: Date.UTC(2026, 9, 14 - index, 18),
    }),
  )
}

export function makeProfile(): PlayerProfile {
  const matches = rankedMatches()
  return {
    player: {
      gameName: 'NamiMain',
      tagLine: 'MDS',
      platform: 'euw1',
      level: 245,
      profileIconId: 6,
    },
    ranked: [
      {
        queue: 'RANKED_SOLO_5x5',
        tier: 'GOLD',
        division: 'II',
        leaguePoints: 45,
        wins: 30,
        losses: 25,
      },
    ],
    period: { id: '20-30', count: 20, days: 30 },
    matches,
    summary: summarizeProfile(matches),
    sample: { found: 10, unavailable: 0, remakes: 0, excluded: 0 },
    assetVersion: '16.20.1',
    updatedAt: Date.UTC(2026, 9, 15),
  }
}

export function makeEmptyProfile(): PlayerProfile {
  return {
    ...makeProfile(),
    matches: [],
    summary: summarizeProfile([]),
    sample: { found: 0, unavailable: 0, remakes: 0, excluded: 0 },
  }
}

// One history page: the ranked games plus an ARAM win and a remake, newest first.
export function makeHistory(start = 0, next: number | null = 20): PlayerHistory {
  const matches =
    start === 0
      ? [
          ...rankedMatches().slice(0, 2),
          makeMatch({
            id: 'EUW1_2000',
            championKey: 'Ahri',
            championName: 'Ahri',
            championId: 103,
            queueId: 450,
            mode: 'ARAM',
            role: null,
            kills: 12,
            deaths: 5,
            assists: 14,
            startedAt: Date.UTC(2026, 9, 12, 20),
          }),
          makeMatch({
            id: 'EUW1_2001',
            remake: true,
            win: false,
            kills: 0,
            deaths: 0,
            assists: 0,
            startedAt: Date.UTC(2026, 9, 12, 19),
          }),
          ...rankedMatches().slice(2),
        ]
      : rankedMatches().map((match, index) => ({
          ...match,
          id: `EUW1_${3000 + start + index}`,
          startedAt: Date.UTC(2026, 8, 20 - index, 18),
        }))
  return {
    player: { gameName: 'NamiMain', tagLine: 'MDS', platform: 'euw1' },
    matches,
    page: { start, count: 20, found: matches.length, unavailable: 0, excluded: 0, next },
    assetVersion: '16.20.1',
    updatedAt: Date.UTC(2026, 9, 15),
  }
}

const ROSTER: [string, string, number, PlayerRole][] = [
  ['Darius', 'Darius', 122, 'TOP'],
  ['Vi', 'Vi', 254, 'JUNGLE'],
  ['Ahri', 'Ahri', 103, 'MIDDLE'],
  ['Jinx', 'Jinx', 222, 'BOTTOM'],
  ['Nami', 'Nami', 267, 'UTILITY'],
]

export function makeMatchDetail(): MatchDetail {
  const team = (id: number, win: boolean, scores: [number, number, number][]) => ({
    id,
    win,
    placement: null,
    kills: scores.reduce((sum, score) => sum + score[0], 0),
    deaths: scores.reduce((sum, score) => sum + score[1], 0),
    assists: scores.reduce((sum, score) => sum + score[2], 0),
    players: ROSTER.map(([key, name, , role], index) => ({
      gameName: id === 100 && index === 4 ? 'NamiMain' : `${id === 100 ? 'Bleu' : 'Rouge'} ${name}`,
      tagLine: id === 100 && index === 4 ? 'MDS' : 'EUW',
      championKey: key,
      championName: name,
      role,
      kills: scores[index]![0],
      deaths: scores[index]![1],
      assists: scores[index]![2],
      reviewed: id === 100 && index === 4,
    })),
  })
  return {
    id: 'EUW1_1000',
    platform: 'euw1',
    queueId: 420,
    mode: 'Classée Solo/Duo',
    startedAt: Date.UTC(2026, 9, 14, 18),
    duration: 1835,
    remake: false,
    arena: false,
    teams: [
      team(100, true, [
        [5, 3, 4],
        [6, 2, 10],
        [8, 4, 7],
        [7, 3, 6],
        [4, 2, 18],
      ]),
      team(200, false, [
        [3, 6, 2],
        [2, 5, 4],
        [4, 7, 3],
        [3, 6, 5],
        [2, 6, 7],
      ]),
    ],
    assetVersion: '16.20.1',
    updatedAt: Date.UTC(2026, 9, 15),
  }
}

// Server-side match records, as the Riot adapter returns them.
export function makeParticipant(
  overrides: Partial<MatchParticipantRecord> = {},
): MatchParticipantRecord {
  return {
    puuid: 'other',
    gameName: 'Someone',
    tagLine: 'EUW',
    teamId: 200,
    subteamId: null,
    placement: null,
    championId: 103,
    championName: 'Ahri',
    role: 'MIDDLE',
    win: false,
    remake: false,
    kills: 2,
    deaths: 3,
    assists: 4,
    cs: 150,
    gold: 9000,
    damage: 15000,
    vision: 20,
    timePlayed: 1800,
    ...overrides,
  }
}

export function makeRecord(
  id: string,
  target: Partial<MatchParticipantRecord> = {},
  overrides: Partial<MatchRecord> = {},
): MatchRecord {
  const win = target.win ?? true
  const players = ROSTER.flatMap(([, championName, championId, role], index) => [
    makeParticipant({
      puuid: `ally-${index}`,
      gameName: `Allié ${index}`,
      teamId: 100,
      championId,
      championName,
      role,
      win,
    }),
    makeParticipant({
      puuid: `enemy-${index}`,
      gameName: `Adversaire ${index}`,
      teamId: 200,
      championId,
      championName,
      role,
      win: !win,
    }),
  ])
  players[8] = makeParticipant({
    puuid: 'target',
    gameName: 'NamiMain',
    tagLine: 'MDS',
    teamId: 100,
    championId: 267,
    championName: 'Nami',
    role: 'UTILITY',
    win,
    kills: 4,
    deaths: 2,
    assists: 18,
    ...target,
  })
  return {
    id,
    platform: 'euw1',
    queueId: 420,
    mapId: 11,
    custom: false,
    startedAt: Date.UTC(2026, 9, 14, 18),
    duration: 1800,
    teams: [
      { teamId: 100, win },
      { teamId: 200, win: !win },
    ],
    participants: players,
    ...overrides,
  }
}

// A raw match-v5 MatchDto, as Riot sends it.
export function rawMatch() {
  return {
    metadata: { matchId: 'EUW1_1' },
    info: {
      platformId: 'EUW1',
      mapId: 11,
      queueId: 420,
      gameType: 'MATCHED_GAME',
      gameDuration: 1800,
      gameStartTimestamp: 1000,
      teams: [
        { teamId: 100, win: true },
        { teamId: 200, win: false },
      ],
      participants: [
        {
          puuid: 'other',
          riotIdGameName: 'Rival',
          riotIdTagline: 'EUW',
          teamId: 200,
          championName: 'Ahri',
          championId: 103,
          kills: 99,
          deaths: 1,
          assists: 0,
          win: false,
          teamPosition: 'MIDDLE',
          gameEndedInEarlySurrender: false,
        },
        {
          puuid: 'target',
          riotIdGameName: 'NamiMain',
          riotIdTagline: 'MDS',
          teamId: 100,
          championName: 'Nami',
          championId: 267,
          kills: 4,
          deaths: 2,
          assists: 18,
          win: true,
          teamPosition: 'UTILITY',
          totalMinionsKilled: 20,
          neutralMinionsKilled: 2,
          timePlayed: 1790,
          gameEndedInEarlySurrender: false,
        } as Record<string, unknown>,
      ],
    },
  }
}
