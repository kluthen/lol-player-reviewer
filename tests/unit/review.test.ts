import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRiotId, InvalidRiotId } from '../../shared/domain/riot-id.ts'
import {
  summarizeProfile,
  filterMatches,
  mostPlayedRoles,
  rankChampions,
} from '../../shared/domain/review.ts'
import { parsePeriod, DEFAULT_PERIOD } from '../../shared/domain/period.ts'
import { InvalidInput } from '../../shared/domain/invalid-input.ts'
import { parseMatch } from '../../server/infrastructure/riot-adapter.ts'
import { makeHistory, makeMatch, makeProfile, rawMatch } from '../fixtures/review.ts'

test('Riot ID: normalizes whitespace and preserves names with spaces and Unicode', () => {
  assert.deepEqual(parseRiotId('  Étoile Bleue # EUW  '), {
    gameName: 'Étoile Bleue',
    tagLine: 'EUW',
  })
})

test('Riot ID: rejects missing/extra separators, control characters, invalid lengths and non-strings', () => {
  for (const value of [
    null,
    [],
    'NamiMain',
    'Nami#',
    'ab#EUW',
    'Nami#EU',
    'Nami#EUW#123',
    'Nami\nMain#EUW',
    'Nami#../',
    `${'x'.repeat(17)}#EUW`,
  ]) {
    assert.throws(() => parseRiotId(value), InvalidRiotId)
  }
})

test('period: three presets, the default when absent, and a client error otherwise', () => {
  assert.equal(parsePeriod(undefined), DEFAULT_PERIOD)
  assert.deepEqual(
    { ...DEFAULT_PERIOD },
    { id: '20-30', count: 20, days: 30, label: '20 parties · 30 jours' },
  )
  assert.equal(parsePeriod('30-60').count, 30)
  assert.equal(parsePeriod('30-90').days, 90)
  assert.throws(
    () => parsePeriod('100-365'),
    (error: InvalidInput) => error.code === 'INVALID_PERIOD',
  )
})

test('profile figures: win rate, games and KDA over the whole period', () => {
  const summary = makeProfile().summary
  assert.equal(summary.games, 10)
  assert.equal(summary.wins, 6)
  assert.equal(summary.winRate, 60)
  // (52 kills + 119 assists) / 45 deaths
  assert.equal(summary.kda, 3.8)
  assert.equal(
    summarizeProfile([
      makeMatch({ kills: 10, assists: 0, deaths: 1 }),
      makeMatch({ kills: 0, assists: 0, deaths: 9 }),
    ]).kda,
    1,
  )
})

test('KDA divides by at least one death', () => {
  assert.equal(summarizeProfile([makeMatch({ kills: 5, deaths: 0, assists: 7 })]).kda, 12)
})

test('empty period never invents percentages, roles or champions', () => {
  const summary = summarizeProfile([])
  assert.equal(summary.games, 0)
  assert.equal(summary.winRate, null)
  assert.equal(summary.kda, null)
  assert.deepEqual(summary.mainRoles, [])
  assert.equal(summary.topChampion, null)
  assert.equal(summary.averages, null)
  assert.deepEqual(summary.recentIds, [])
  assert.deepEqual(summary.reviewIds, [])
})

test('main role: the most played one, or every tied role, most recently played first', () => {
  assert.deepEqual(makeProfile().summary.mainRoles, ['UTILITY'])
  assert.deepEqual(mostPlayedRoles([makeMatch({ role: null })]), [])
  const day = (n: number) => Date.UTC(2026, 9, n)
  const tied = [
    ...[1, 2, 3, 9].map((n) => makeMatch({ role: 'UTILITY', startedAt: day(n) })),
    ...[4, 5, 6, 7].map((n) => makeMatch({ role: 'JUNGLE', startedAt: day(n) })),
    makeMatch({ role: 'TOP', startedAt: day(10) }),
  ]
  assert.deepEqual(mostPlayedRoles(tied), ['UTILITY', 'JUNGLE'])
})

test('favorite champions: most games, ties broken alphabetically ignoring case and accents', () => {
  const games = (championName: string, count: number, win = true) =>
    Array.from({ length: count }, () => makeMatch({ championKey: championName, championName, win }))
  // Nami 4 games, Lulu 4 games → Lulu.
  assert.deepEqual(
    rankChampions([...games('Nami', 4), ...games('Lulu', 4)]).map((c) => c.name),
    ['Lulu', 'Nami'],
  )
  assert.deepEqual(
    rankChampions([...games('Ezreal', 2), ...games('Évelynn', 2), ...games('lulu', 2)]).map(
      (c) => c.name,
    ),
    ['Évelynn', 'Ezreal', 'lulu'],
  )
  const profile = makeProfile().summary
  assert.deepEqual(
    profile.champions.map(({ name, games, winRate }) => [name, games, winRate]),
    [
      ['Nami', 4, 100],
      ['Lulu', 2, 50],
      ['Thresh', 2, 0],
    ],
  )
  assert.equal(profile.champions[0]?.kda.toFixed(2), '7.36')
  assert.deepEqual(profile.topChampion, { key: 'Nami', name: 'Nami' })
})

test('profile lists: the last five games and the last three losses, newest first', () => {
  const summary = makeProfile().summary
  assert.deepEqual(summary.recentIds, [
    'EUW1_1000',
    'EUW1_1001',
    'EUW1_1002',
    'EUW1_1003',
    'EUW1_1004',
  ])
  assert.deepEqual(summary.reviewIds, ['EUW1_1001', 'EUW1_1003', 'EUW1_1006'])
  assert.deepEqual(summarizeProfile(makeProfile().matches.filter((m) => m.win)).reviewIds, [])
})

test('average performance per game and per minute played', () => {
  const averages = summarizeProfile([
    makeMatch({ kills: 4, deaths: 2, assists: 6, cs: 180, timePlayed: 1800, teamKills: 20 }),
    makeMatch({ kills: 2, deaths: 4, assists: 8, cs: 120, timePlayed: 1200, teamKills: 20 }),
  ]).averages!
  assert.equal(averages.kills, 3)
  assert.equal(averages.csPerMinute, 6)
  assert.equal(averages.killParticipation, 0.5)
  assert.equal(averages.damageShare, 0.1)
})

test('history filters combine mode, role and result over every loaded game', () => {
  const matches = makeHistory().matches
  assert.equal(
    filterMatches(matches, { queue: '420', role: 'UTILITY', result: 'loss', order: 'oldest' })
      .length,
    5,
  )
  assert.equal(
    filterMatches(matches, { queue: '450', role: 'NONE', result: '', order: 'recent' })[0]?.id,
    'EUW1_2000',
  )
  assert.equal(
    filterMatches(matches, { queue: '450', role: 'UTILITY', result: '', order: 'recent' }).length,
    0,
  )
  assert.equal(matches[0]?.id, 'EUW1_1000')
})

test('match parsing keeps every participant, their Riot ID, team result and remake flag', () => {
  const match = parseMatch(rawMatch(), 'EUW1_1')
  assert.equal(match.platform, 'euw1')
  assert.equal(match.participants.length, 2)
  const target = match.participants.find((participant) => participant.puuid === 'target')!
  assert.equal(target.gameName, 'NamiMain')
  assert.equal(target.tagLine, 'MDS')
  assert.equal(target.cs, 22)
  assert.equal(target.role, 'UTILITY')
  assert.equal(target.timePlayed, 1790)
  assert.equal(target.remake, false)
  assert.deepEqual(match.teams, [
    { teamId: 100, win: true },
    { teamId: 200, win: false },
  ])
  const remake = rawMatch()
  remake.info.participants[1]!.gameEndedInEarlySurrender = true
  assert.equal(parseMatch(remake, 'EUW1_1').participants[1]?.remake, true)
})

test('Arena participants keep their subteam and its placement', () => {
  const raw = rawMatch()
  raw.info.queueId = 1700
  raw.info.mapId = 30
  Object.assign(raw.info.participants[1]!, {
    playerSubteamId: 3,
    subteamPlacement: 2,
    placement: 5,
  })
  const target = parseMatch(raw, 'EUW1_1').participants[1]!
  assert.equal(target.subteamId, 3)
  assert.equal(target.placement, 2)
  assert.equal(target.role, null)
})

test('ARAM never inherits an unrelated team position', () => {
  const raw = rawMatch()
  raw.info.mapId = 12
  raw.info.queueId = 450
  assert.ok(parseMatch(raw, 'EUW1_1').participants.every((participant) => !participant.role))
})

test('malformed match data fails explicitly; custom games are flagged', () => {
  const raw = rawMatch()
  raw.info.participants[1]!.kills = NaN
  assert.throws(() => parseMatch(raw, 'EUW1_1'))
  assert.throws(() => parseMatch({ info: {} }, 'EUW1_1'))
  const custom = rawMatch()
  custom.info.queueId = 0
  assert.equal(parseMatch(custom, 'EUW1_1').custom, true)
})
