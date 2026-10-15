import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GetPlayerReview } from '../../server/application/get-player-review.ts'
import { makeMatch } from '../fixtures/review.ts'

test('EUW sample excludes other-platform history without fetching it', async () => {
  const fetched: string[] = []
  const service = new GetPlayerReview(
    {
      findAccount: async () => ({ puuid: 'target', gameName: 'NamiMain', tagLine: 'MDS' }),
      findMatchIds: async () => ['EUW1_1000', 'EUN1_1001'],
      findMatch: async (id) => {
        fetched.push(id)
        return makeMatch({ id })
      },
    },
    async () => ({ version: '16.20.1', champions: {} }),
  )
  const result = await service.execute('NamiMain#MDS')
  assert.deepEqual(fetched, ['EUW1_1000'])
  assert.equal(result.sample.found, 2)
  assert.equal(result.sample.excluded, 1)
  assert.equal(result.summary.games, 1)
})
