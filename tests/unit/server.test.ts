import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TtlCache } from '../../server/infrastructure/ttl-cache.ts'
import { RiotTransport } from '../../server/infrastructure/riot-transport.ts'
import { RiotAdapter } from '../../server/infrastructure/riot-adapter.ts'
import { ReviewError } from '../../server/domain/review-error.ts'
import { GetPlayerReview } from '../../server/application/get-player-review.ts'
import type { RiotPort } from '../../server/domain/riot-port.ts'
import { makeMatch } from '../fixtures/review.ts'

test('cache coalesces simultaneous loads, expires and evicts at its bounded capacity', async () => {
  let now = 0
  let loads = 0
  const cache = new TtlCache<number>(1, () => now)
  const loader = async () => ++loads
  assert.deepEqual(
    await Promise.all([cache.remember('a', 10, loader), cache.remember('a', 10, loader)]),
    [1, 1],
  )
  assert.equal(loads, 1)
  now = 11
  assert.equal(await cache.remember('a', 10, loader), 2)
  await cache.remember('b', 10, loader)
  assert.equal(await cache.remember('a', 10, loader), 4)
})

test('cache never retains a failed request', async () => {
  const cache = new TtlCache<number>(1)
  await assert.rejects(
    cache.remember('x', 100, async () => {
      throw new Error('temporary')
    }),
  )
  assert.equal(await cache.remember('x', 100, async () => 42), 42)
})

test('Riot transport keeps its token in a server header and disables redirects', async () => {
  const transport = new RiotTransport(
    () => 'test-only-token',
    async (url, init) => {
      assert.equal(url, 'https://europe.api.riotgames.com/riot/account/v1/example')
      assert.deepEqual(init?.headers, {
        'X-Riot-Token': 'test-only-token',
        Accept: 'application/json',
      })
      assert.equal(init?.redirect, 'error')
      assert.ok(init?.signal)
      return Response.json({ ok: true })
    },
  )
  assert.deepEqual(await transport.get('/riot/account/v1/example'), { ok: true })
})

test('no configured key prevents external calls', async () => {
  let calls = 0
  const transport = new RiotTransport(
    () => '',
    async () => {
      calls++
      return Response.json({})
    },
  )
  await assert.rejects(
    transport.get('/x'),
    (error: ReviewError) => error.code === 'RIOT_NOT_CONFIGURED',
  )
  assert.equal(calls, 0)
})

test('Riot 429 honors Retry-After and blocks subsequent requests without retrying early', async () => {
  let calls = 0
  const transport = new RiotTransport(
    () => 'test-only-token',
    async () => {
      calls++
      return new Response(null, { status: 429, headers: { 'Retry-After': '120' } })
    },
  )
  await assert.rejects(
    transport.get('/x'),
    (error: ReviewError) => error.status === 429 && error.retryAfter === 120,
  )
  await assert.rejects(transport.get('/x'), (error: ReviewError) => error.status === 429)
  assert.equal(calls, 1)
})

test('Riot authentication, not-found, network and malformed responses have safe errors', async () => {
  for (const [status, code] of [
    [403, 'RIOT_KEY_REJECTED'],
    [401, 'RIOT_KEY_REJECTED'],
    [404, 'RIOT_NOT_FOUND'],
    [500, 'RIOT_UNAVAILABLE'],
  ] as const) {
    const transport = new RiotTransport(
      () => 'test-only-token',
      async () => new Response('upstream private body', { status }),
    )
    await assert.rejects(
      transport.get('/x'),
      (error: ReviewError) => error.code === code && !error.message.includes('private'),
    )
  }
  const offline = new RiotTransport(
    () => 'test-only-token',
    async () => {
      throw new Error('secret detail')
    },
  )
  await assert.rejects(
    offline.get('/x'),
    (error: ReviewError) => error.code === 'RIOT_UNAVAILABLE' && !error.message.includes('secret'),
  )
})

test('account path segments are encoded and account results cached', async () => {
  let calls = 0
  const adapter = new RiotAdapter(
    new RiotTransport(
      () => 'test-only-token',
      async (url) => {
        calls++
        assert.ok(String(url).endsWith('/by-riot-id/%C3%89toile%20Bleue/EUW'))
        return Response.json({ puuid: 'target', gameName: 'Étoile Bleue', tagLine: 'EUW' })
      },
    ),
  )
  await adapter.findAccount('Étoile Bleue', 'EUW')
  await adapter.findAccount('Étoile Bleue', 'EUW')
  assert.equal(calls, 1)
})

const catalog = async () => ({ version: '16.20.1', champions: {} })
function port(overrides: Partial<RiotPort> = {}): RiotPort {
  return {
    findAccount: async () => ({ puuid: 'target', gameName: 'NamiMain', tagLine: 'MDS' }),
    findMatchIds: async () => ['EUW1_1000'],
    findMatch: async (id) => makeMatch({ id }),
    ...overrides,
  }
}

test('service caps the sample at 20 and limits concurrent detail calls to three', async () => {
  let active = 0,
    peak = 0,
    calls = 0
  const service = new GetPlayerReview(
    port({
      findMatchIds: async () => Array.from({ length: 30 }, (_, index) => `EUW1_${index}`),
      findMatch: async (id) => {
        active++
        calls++
        peak = Math.max(peak, active)
        await new Promise((resolve) => setTimeout(resolve, 1))
        active--
        return makeMatch({ id })
      },
    }),
    catalog,
  )
  const review = await service.execute('NamiMain#MDS')
  assert.equal(review.matches.length, 20)
  assert.equal(calls, 20)
  assert.ok(peak <= 3)
})

test('service exposes partial data and computes only on available matches', async () => {
  const service = new GetPlayerReview(
    port({
      findMatchIds: async () => ['EUW1_1', 'EUW1_2'],
      findMatch: async (id) => {
        if (id === 'EUW1_2') throw new ReviewError('RIOT_UNAVAILABLE', 'Unavailable')
        return makeMatch({ id })
      },
    }),
    catalog,
  )
  const review = await service.execute('NamiMain#MDS')
  assert.equal(review.sample.unavailable, 1)
  assert.equal(review.summary.games, 1)
  assert.equal(review.summary.winRate, 100)
})

test('service distinguishes an empty history from a completely failed history', async () => {
  const empty = await new GetPlayerReview(port({ findMatchIds: async () => [] }), catalog).execute(
    'NamiMain#MDS',
  )
  assert.equal(empty.summary.games, 0)
  const failed = new GetPlayerReview(
    port({
      findMatch: async () => {
        throw new Error('offline')
      },
    }),
    catalog,
  )
  await assert.rejects(
    failed.execute('NamiMain#MDS'),
    (error: ReviewError) => error.code === 'MATCHES_UNAVAILABLE',
  )
})

test('fatal credential failures stop later detail batches', async () => {
  let calls = 0
  const service = new GetPlayerReview(
    port({
      findMatchIds: async () => Array.from({ length: 20 }, (_, index) => `EUW1_${index}`),
      findMatch: async () => {
        calls++
        throw new ReviewError('RIOT_KEY_REJECTED', 'Expired', 503)
      },
    }),
    catalog,
  )
  await assert.rejects(
    service.execute('NamiMain#MDS'),
    (error: ReviewError) => error.code === 'RIOT_KEY_REJECTED',
  )
  assert.equal(calls, 3)
})
