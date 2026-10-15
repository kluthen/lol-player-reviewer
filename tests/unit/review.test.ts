import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRiotId, InvalidRiotId } from '../../shared/domain/riot-id.ts'
import { summarizeMatches, filterMatches } from '../../shared/domain/review.ts'
import { extractMatch } from '../../server/infrastructure/riot-adapter.ts'
import { makeMatch, makeReview } from '../fixtures/review.ts'

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

test('summary is computed from the loaded sample, using global rather than average KDA', () => {
  const summary = makeReview().summary
  assert.equal(summary.games, 10)
  assert.equal(summary.wins, 6)
  assert.equal(summary.winRate, 60)
  assert.equal(summary.kda, 3.8)
  const matches = [
    makeMatch({ kills: 10, assists: 0, deaths: 1 }),
    makeMatch({ kills: 0, assists: 0, deaths: 9 }),
  ]
  assert.equal(summarizeMatches(matches).kda, 1)
})

test('empty sample never invents percentages, roles or a deathless performance', () => {
  const summary = summarizeMatches([])
  assert.equal(summary.winRate, null)
  assert.equal(summary.kda, null)
  assert.equal(summary.deathless, false)
  assert.equal(summary.mainRole, null)
  assert.deepEqual(summary.reviewIds, [])
})

test('zero deaths is explicit, finite and does not divide by zero', () => {
  const summary = summarizeMatches([makeMatch({ deaths: 0 })])
  assert.equal(summary.deathless, true)
  assert.equal(summary.kda, null)
})

test('roles ignore inapplicable games and avoid claiming a predominant tied role', () => {
  assert.equal(summarizeMatches([makeMatch({ role: null })]).mainRole, null)
  assert.equal(
    summarizeMatches([makeMatch({ role: 'TOP' }), makeMatch({ role: 'UTILITY' })]).mainRole,
    null,
  )
  assert.equal(makeReview().summary.mainRole, 'UTILITY')
})

test('review suggestions select losses with most deaths and never mutate source data', () => {
  const matches = makeReview().matches
  const before = structuredClone(matches)
  assert.deepEqual(summarizeMatches(matches).reviewIds, ['EUW1_1006', 'EUW1_1001'])
  assert.deepEqual(matches, before)
  assert.deepEqual(summarizeMatches(matches.filter((match) => match.win)).reviewIds, [])
})

test('filters combine mode, role and result within the loaded sample', () => {
  const matches = makeReview().matches
  const filtered = filterMatches(matches, {
    queue: '420',
    role: 'UTILITY',
    result: 'loss',
    order: 'oldest',
  })
  assert.equal(filtered.length, 4)
  assert.equal(filtered[0]?.id, 'EUW1_1008')
  assert.equal(
    filterMatches(matches, { queue: '450', role: 'NONE', result: '', order: 'recent' }).length,
    1,
  )
  assert.equal(
    filterMatches(matches, { queue: '450', role: 'UTILITY', result: '', order: 'recent' }).length,
    0,
  )
  assert.equal(matches[0]?.id, 'EUW1_1000')
})

function rawMatch() {
  return {
    info: {
      mapId: 11,
      queueId: 420,
      gameDuration: 1800,
      gameStartTimestamp: 1000,
      participants: [
        {
          puuid: 'other',
          championName: 'Ahri',
          championId: 103,
          kills: 99,
          deaths: 1,
          assists: 0,
          win: false,
        },
        {
          puuid: 'target',
          championName: 'Nami',
          championId: 267,
          kills: 4,
          deaths: 2,
          assists: 18,
          win: true,
          teamPosition: 'UTILITY',
          totalMinionsKilled: 20,
          neutralMinionsKilled: 2,
        },
      ],
    },
  }
}

test('match extraction selects the participant by PUUID rather than array position', () => {
  const match = extractMatch(rawMatch(), 'EUW1_1', 'target')!
  assert.equal(match.championName, 'Nami')
  assert.equal(match.kills, 4)
  assert.equal(match.cs, 22)
  assert.equal(match.role, 'UTILITY')
})

test('ARAM never inherits an unrelated team position', () => {
  const raw = rawMatch()
  raw.info.mapId = 12
  raw.info.queueId = 450
  assert.equal(extractMatch(raw, 'EUW1_1', 'target')?.role, null)
})

test('malformed match data and a missing participant fail explicitly', () => {
  assert.throws(() => extractMatch(rawMatch(), 'EUW1_1', 'missing'))
  const raw = rawMatch()
  raw.info.participants[1]!.kills = NaN
  assert.throws(() => extractMatch(raw, 'EUW1_1', 'target'))
})

test('private/custom matches are excluded', () => {
  const raw = rawMatch()
  raw.info.queueId = 0
  assert.equal(extractMatch(raw, 'EUW1_1', 'target'), null)
})
