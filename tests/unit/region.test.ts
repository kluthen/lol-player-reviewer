import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PLATFORMS,
  matchIdPrefix,
  parseMatchId,
  parsePlatform,
  platformOfMatchId,
} from '../../shared/domain/platform.ts'
import { InvalidRiotId, parsePlayerSlug, playerSlug } from '../../shared/domain/riot-id.ts'
import { InvalidInput } from '../../shared/domain/invalid-input.ts'

test('every server maps to the match-v5 region that serves it', () => {
  assert.equal(Object.keys(PLATFORMS).length, 15)
  assert.equal(PLATFORMS.euw1.region, 'europe')
  assert.equal(PLATFORMS.na1.region, 'americas')
  assert.equal(PLATFORMS.kr.region, 'asia')
  assert.equal(PLATFORMS.oc1.region, 'sea')
  assert.equal(parsePlatform('eun1'), 'eun1')
  for (const value of ['EUW1', 'euw', '', null, 'toString'])
    assert.throws(
      () => parsePlatform(value),
      (error: InvalidInput) => error.code === 'INVALID_PLATFORM',
    )
})

test('match ids carry their platform as a prefix', () => {
  assert.equal(platformOfMatchId('EUW1_7212345678'), 'euw1')
  assert.equal(platformOfMatchId('KR_123'), 'kr')
  assert.equal(platformOfMatchId('XX9_123'), null)
  assert.equal(matchIdPrefix('eun1'), 'EUN1_')
  assert.equal(parseMatchId('EUW1_42'), 'EUW1_42')
  for (const value of ['euw1_42', 'EUW1-42', 'XX9_1', 'EUW1_', undefined])
    assert.throws(
      () => parseMatchId(value),
      (error: InvalidInput) => error.code === 'INVALID_MATCH_ID',
    )
})

test('player URL segment round-trips names with spaces, accents and hyphens', () => {
  assert.equal(playerSlug('Étoile Bleue', 'EUW'), 'Étoile Bleue-EUW')
  assert.deepEqual(parsePlayerSlug('Étoile Bleue-EUW'), {
    gameName: 'Étoile Bleue',
    tagLine: 'EUW',
  })
  assert.deepEqual(parsePlayerSlug('Jean-Luc-1234'), { gameName: 'Jean-Luc', tagLine: '1234' })
  for (const value of ['NamiMain', '-EUW', 'NamiMain-', 'ab-EUW', 42])
    assert.throws(() => parsePlayerSlug(value), InvalidRiotId)
})
