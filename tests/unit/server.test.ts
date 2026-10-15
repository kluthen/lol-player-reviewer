import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TtlCache } from '../../server/infrastructure/ttl-cache.ts'
import { RiotTransport } from '../../server/infrastructure/riot-transport.ts'
import { RiotAdapter } from '../../server/infrastructure/riot-adapter.ts'
import { ReviewError } from '../../server/domain/review-error.ts'
import { GetPlayerProfile } from '../../server/application/get-player-profile.ts'
import { GetPlayerHistory } from '../../server/application/get-player-history.ts'
import { GetMatchDetail } from '../../server/application/get-match-detail.ts'
import type { MatchIdQuery, RiotPort } from '../../server/domain/riot-port.ts'
import type { MatchRecord } from '../../server/domain/match-record.ts'
import { InvalidInput } from '../../shared/domain/invalid-input.ts'
import { makeParticipant, makeRecord, rawMatch } from '../fixtures/review.ts'

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

test('Riot transport keeps its token in a server header, disables redirects and routes by host', async () => {
  const urls: string[] = []
  const transport = new RiotTransport(
    () => 'test-only-token',
    async (url, init) => {
      urls.push(String(url))
      assert.deepEqual(init?.headers, {
        'X-Riot-Token': 'test-only-token',
        Accept: 'application/json',
      })
      assert.equal(init?.redirect, 'error')
      assert.ok(init?.signal)
      return Response.json({ ok: true })
    },
  )
  assert.deepEqual(await transport.get('europe', '/riot/account/v1/example'), { ok: true })
  await transport.get('kr', '/lol/summoner/v4/example')
  assert.deepEqual(urls, [
    'https://europe.api.riotgames.com/riot/account/v1/example',
    'https://kr.api.riotgames.com/lol/summoner/v4/example',
  ])
  await assert.rejects(transport.get('evil.example.com/x?', '/x'))
  assert.equal(urls.length, 2)
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
    transport.get('europe', '/x'),
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
    transport.get('europe', '/x'),
    (error: ReviewError) => error.status === 429 && error.retryAfter === 120,
  )
  await assert.rejects(transport.get('euw1', '/x'), (error: ReviewError) => error.status === 429)
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
      transport.get('europe', '/x'),
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
    offline.get('europe', '/x'),
    (error: ReviewError) => error.code === 'RIOT_UNAVAILABLE' && !error.message.includes('secret'),
  )
})

function adapter(respond: (url: string) => Response) {
  const urls: string[] = []
  return {
    urls,
    riot: new RiotAdapter(
      new RiotTransport(
        () => 'test-only-token',
        async (url) => {
          urls.push(String(url))
          return respond(String(url))
        },
      ),
    ),
  }
}

test('account path segments are encoded and account results cached', async () => {
  const { riot, urls } = adapter(() =>
    Response.json({ puuid: 'target', gameName: 'Étoile Bleue', tagLine: 'EUW' }),
  )
  await riot.findAccount('Étoile Bleue', 'EUW')
  await riot.findAccount('Étoile Bleue', 'EUW')
  assert.deepEqual(urls, [
    'https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/%C3%89toile%20Bleue/EUW',
  ])
})

test('summoner and ranked standing come from the platform host; a missing summoner names the server', async () => {
  const { riot, urls } = adapter((url) => {
    if (url.includes('/summoner/')) return Response.json({ summonerLevel: 245, profileIconId: 6 })
    return Response.json([
      {
        queueType: 'RANKED_SOLO_5x5',
        tier: 'GOLD',
        rank: 'II',
        leaguePoints: 45,
        wins: 3,
        losses: 2,
      },
      { queueType: 'CHERRY', tier: 'X', rank: 'I', leaguePoints: 0, wins: 1, losses: 1 },
    ])
  })
  assert.deepEqual(await riot.findSummoner('na1', 'target'), { level: 245, profileIconId: 6 })
  assert.deepEqual(await riot.findRankedEntries('na1', 'target'), [
    {
      queue: 'RANKED_SOLO_5x5',
      tier: 'GOLD',
      division: 'II',
      leaguePoints: 45,
      wins: 3,
      losses: 2,
    },
  ])
  assert.ok(urls.every((url) => url.startsWith('https://na1.api.riotgames.com/lol/')))
  const missing = adapter(() => new Response(null, { status: 404 }))
  await assert.rejects(
    missing.riot.findSummoner('eun1', 'target'),
    (error: ReviewError) =>
      error.code === 'RIOT_NOT_FOUND' && error.status === 404 && error.message.includes('EUNE'),
  )
})

test('match ids use the regional host, Riot query parameters and a cache per query', async () => {
  const { riot, urls } = adapter(() => Response.json(['KR_2', 'KR_1']))
  const query: MatchIdQuery = { type: 'ranked', startTime: 1_700_000_000, start: 0, count: 20 }
  assert.deepEqual(await riot.findMatchIds('kr', 'target', query), ['KR_2', 'KR_1'])
  await riot.findMatchIds('kr', 'target', query)
  await riot.findMatchIds('kr', 'target', { start: 20, count: 20 })
  assert.deepEqual(urls, [
    'https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/target/ids?start=0&count=20&type=ranked&startTime=1700000000',
    'https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/target/ids?start=20&count=20',
  ])
})

test('a full match is fetched once from its region and cached; a missing one is reported', async () => {
  const { riot, urls } = adapter(() => Response.json(rawMatch()))
  const first = await riot.findMatch('EUW1_1')
  const second = await riot.findMatch('EUW1_1')
  assert.equal(first, second)
  assert.equal(first.participants.length, 2)
  assert.deepEqual(urls, ['https://europe.api.riotgames.com/lol/match/v5/matches/EUW1_1'])
  const missing = adapter(() => new Response(null, { status: 404 }))
  await assert.rejects(
    missing.riot.findMatch('EUW1_9'),
    (error: ReviewError) => error.code === 'MATCH_NOT_FOUND' && error.status === 404,
  )
})

const catalog = async () => ({
  version: '16.20.1',
  champions: { '267': { key: 'Nami', name: 'Nami' }, '62': { key: 'MonkeyKing', name: 'Wukong' } },
})
const NOW = Date.UTC(2026, 9, 15, 12, 2, 30)

function port(
  records: MatchRecord[] = [makeRecord('EUW1_1000')],
  overrides: Partial<RiotPort> = {},
) {
  const queries: MatchIdQuery[] = []
  const fetched: string[] = []
  const riot: RiotPort = {
    findAccount: async () => ({ puuid: 'target', gameName: 'NamiMain', tagLine: 'MDS' }),
    findSummoner: async () => ({ level: 245, profileIconId: 6 }),
    findRankedEntries: async () => [],
    findMatchIds: async (_platform, _puuid, query) => {
      queries.push(query)
      return records.map((record) => record.id)
    },
    findMatch: async (id) => {
      fetched.push(id)
      const record = records.find((candidate) => candidate.id === id)
      if (!record) throw new ReviewError('MATCH_NOT_FOUND', 'Missing', 404)
      return record
    },
    ...overrides,
  }
  return { riot, queries, fetched }
}

test('profile asks Riot for the period ranked games and counts only Solo/Duo and Flex, remakes excluded', async () => {
  const { riot, queries, fetched } = port([
    makeRecord('EUW1_1', { win: true }),
    makeRecord('EUW1_2', { win: false }, { queueId: 440 }),
    makeRecord('EUW1_3', { remake: true }),
    makeRecord('EUW1_4', {}, { queueId: 700 }),
    makeRecord('EUN1_5'),
  ])
  const profile = await new GetPlayerProfile(riot, catalog, () => NOW).execute({
    platform: 'euw1',
    riotId: 'NamiMain#MDS',
    period: '30-60',
  })
  assert.deepEqual(queries, [
    {
      type: 'ranked',
      startTime: Math.floor(Date.UTC(2026, 9, 15, 12, 0) / 1000) - 60 * 86_400,
      start: 0,
      count: 30,
    },
  ])
  assert.deepEqual(fetched, ['EUW1_1', 'EUW1_2', 'EUW1_3', 'EUW1_4'])
  assert.deepEqual(
    profile.matches.map((match) => match.id),
    ['EUW1_1', 'EUW1_2'],
  )
  assert.equal(profile.summary.games, 2)
  assert.equal(profile.summary.winRate, 50)
  assert.deepEqual(profile.sample, { found: 5, unavailable: 0, remakes: 1, excluded: 2 })
  assert.deepEqual(profile.period, { id: '30-60', count: 30, days: 60 })
  assert.deepEqual(profile.player, {
    gameName: 'NamiMain',
    tagLine: 'MDS',
    platform: 'euw1',
    level: 245,
    profileIconId: 6,
  })
  assert.equal(profile.matches[0]?.teamKills, 2 * 4 + 4)
  assert.ok(!JSON.stringify(profile).includes('puuid'))
  assert.ok(!JSON.stringify(profile).includes('target'))
})

test('profile defaults to 20 games in 30 days and names champions from Data Dragon', async () => {
  const { riot, queries } = port([
    makeRecord('EUW1_1', { championId: 62, championName: 'MonkeyKing' }),
  ])
  const profile = await new GetPlayerProfile(riot, catalog, () => NOW).execute({
    platform: 'euw1',
    riotId: 'NamiMain#MDS',
  })
  assert.equal(queries[0]?.count, 20)
  assert.equal(profile.matches[0]?.championName, 'Wukong')
  assert.equal(profile.matches[0]?.championKey, 'MonkeyKing')
})

test('profile keeps working without ranked standing, but not past a quota failure', async () => {
  const unavailable = port([], {
    findRankedEntries: async () => {
      throw new ReviewError('RIOT_UNAVAILABLE', 'Unavailable')
    },
  })
  const profile = await new GetPlayerProfile(unavailable.riot, catalog).execute({
    platform: 'euw1',
    riotId: 'NamiMain#MDS',
  })
  assert.equal(profile.ranked, null)
  assert.equal(profile.summary.games, 0)
  const limited = port([], {
    findRankedEntries: async () => {
      throw new ReviewError('RIOT_RATE_LIMITED', 'Wait', 429, 30)
    },
  })
  await assert.rejects(
    new GetPlayerProfile(limited.riot, catalog).execute({
      platform: 'euw1',
      riotId: 'NamiMain#MDS',
    }),
    (error: ReviewError) => error.code === 'RIOT_RATE_LIMITED',
  )
})

test('profile rejects bad input before any Riot call and reports a player missing on that server', async () => {
  let calls = 0
  const counting = port([], {
    findAccount: async () => {
      calls++
      return { puuid: 'target', gameName: 'NamiMain', tagLine: 'MDS' }
    },
  })
  for (const input of [
    { platform: 'xx1', riotId: 'NamiMain#MDS' },
    { platform: 'euw1', riotId: 'NamiMain' },
    { platform: 'euw1', riotId: 'NamiMain#MDS', period: '10-10' },
  ])
    await assert.rejects(new GetPlayerProfile(counting.riot, catalog).execute(input), InvalidInput)
  assert.equal(calls, 0)
  const missing = port([], {
    findSummoner: async () => {
      throw new ReviewError('RIOT_NOT_FOUND', 'Pas sur ce serveur', 404)
    },
  })
  await assert.rejects(
    new GetPlayerProfile(missing.riot, catalog).execute({ platform: 'kr', riotId: 'NamiMain#MDS' }),
    (error: ReviewError) => error.code === 'RIOT_NOT_FOUND',
  )
})

test('match details load three at a time, partial failures are counted, fatal ones stop', async () => {
  let active = 0
  let peak = 0
  const records = Array.from({ length: 30 }, (_, index) => makeRecord(`EUW1_${index}`))
  const slow = port(records, {
    findMatch: async (id) => {
      active++
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 1))
      active--
      if (id === 'EUW1_3') throw new ReviewError('RIOT_UNAVAILABLE', 'Unavailable')
      return records.find((record) => record.id === id)!
    },
  })
  const profile = await new GetPlayerProfile(slow.riot, catalog).execute({
    platform: 'euw1',
    riotId: 'NamiMain#MDS',
    period: '30-90',
  })
  assert.ok(peak <= 3)
  assert.equal(profile.summary.games, 29)
  assert.equal(profile.sample.unavailable, 1)
  let calls = 0
  const rejected = port(records, {
    findMatch: async () => {
      calls++
      throw new ReviewError('RIOT_KEY_REJECTED', 'Expired', 503)
    },
  })
  await assert.rejects(
    new GetPlayerProfile(rejected.riot, catalog).execute({
      platform: 'euw1',
      riotId: 'NamiMain#MDS',
    }),
    (error: ReviewError) => error.code === 'RIOT_KEY_REJECTED',
  )
  assert.equal(calls, 3)
  const offline = port(records, {
    findMatch: async () => {
      throw new Error('offline')
    },
  })
  await assert.rejects(
    new GetPlayerProfile(offline.riot, catalog).execute({
      platform: 'euw1',
      riotId: 'NamiMain#MDS',
    }),
    (error: ReviewError) => error.code === 'MATCHES_UNAVAILABLE',
  )
})

test('history pages through every queue 20 games at a time and marks remakes', async () => {
  const records = Array.from({ length: 20 }, (_, index) =>
    makeRecord(`EUW1_${index}`, { remake: index === 1 }, { queueId: index === 0 ? 450 : 420 }),
  )
  const { riot, queries } = port(records)
  const service = new GetPlayerHistory(riot, catalog)
  const history = await service.execute({ platform: 'euw1', riotId: 'NamiMain#MDS', start: '20' })
  assert.deepEqual(queries, [{ start: 20, count: 20 }])
  assert.equal(history.matches.length, 20)
  assert.equal(history.matches.find((match) => match.id === 'EUW1_0')?.mode, 'ARAM')
  assert.equal(history.matches.find((match) => match.id === 'EUW1_1')?.remake, true)
  assert.equal(history.page.next, 40)
  const last = await new GetPlayerHistory(port(records.slice(0, 3)).riot, catalog).execute({
    platform: 'euw1',
    riotId: 'NamiMain#MDS',
  })
  assert.equal(last.page.start, 0)
  assert.equal(last.page.next, null)
  for (const start of ['-20', 'abc', '5000'])
    await assert.rejects(
      service.execute({ platform: 'euw1', riotId: 'NamiMain#MDS', start }),
      (error: InvalidInput) => error.code === 'INVALID_START',
    )
})

test('game detail: both rosters, team totals, Riot winner, reviewed player, and no PUUID', async () => {
  const record = makeRecord('EUW1_1000', { win: false })
  const { riot } = port([record])
  const detail = await new GetMatchDetail(riot, catalog).execute({
    matchId: 'EUW1_1000',
    riotId: 'NamiMain#MDS',
  })
  assert.deepEqual(
    detail.teams.map((team) => [team.id, team.win, team.players.length]),
    [
      [100, false, 5],
      [200, true, 5],
    ],
  )
  const blue = detail.teams[0]!
  assert.deepEqual([blue.kills, blue.deaths, blue.assists], [12, 14, 34])
  assert.equal(blue.players.filter((player) => player.reviewed).length, 1)
  assert.deepEqual(
    blue.players.find((player) => player.reviewed),
    {
      gameName: 'NamiMain',
      tagLine: 'MDS',
      championKey: 'Nami',
      championName: 'Nami',
      role: 'UTILITY',
      kills: 4,
      deaths: 2,
      assists: 18,
      reviewed: true,
    },
  )
  assert.equal(detail.platform, 'euw1')
  assert.equal(detail.mode, 'Classée Solo/Duo')
  assert.ok(!JSON.stringify(detail).includes('puuid'))
  assert.ok(!JSON.stringify(detail).includes('ally-'))
})

test('game detail highlights by Riot ID when the account lookup fails, and rejects bad ids', async () => {
  const { riot, fetched } = port([makeRecord('EUW1_1000')], {
    findAccount: async () => {
      throw new ReviewError('RIOT_RATE_LIMITED', 'Wait', 429, 10)
    },
  })
  const service = new GetMatchDetail(riot, catalog)
  const detail = await service.execute({ matchId: 'EUW1_1000', riotId: 'naminain#mds' })
  assert.equal(detail.teams.flatMap((team) => team.players).filter((p) => p.reviewed).length, 0)
  const byName = await service.execute({ matchId: 'EUW1_1000', riotId: 'namimain#mds' })
  assert.equal(byName.teams.flatMap((team) => team.players).filter((p) => p.reviewed).length, 1)
  await assert.rejects(
    service.execute({ matchId: 'euw1_1000' }),
    (error: InvalidInput) => error.code === 'INVALID_MATCH_ID',
  )
  assert.deepEqual(fetched, ['EUW1_1000', 'EUW1_1000'])
})

test('Arena games show one roster per subteam, ordered by placement; ARAM has no role', async () => {
  const participants = [1, 2, 3, 4].flatMap((subteam) =>
    [0, 1].map((slot) =>
      makeParticipant({
        puuid: `p${subteam}-${slot}`,
        teamId: subteam <= 2 ? 100 : 200,
        subteamId: subteam,
        placement: 5 - subteam,
        role: null,
        win: subteam >= 3,
      }),
    ),
  )
  const arena = makeRecord('EUW1_7', {}, { queueId: 1700, mapId: 30, teams: [], participants })
  const detail = await new GetMatchDetail(port([arena]).riot, catalog).execute({
    matchId: 'EUW1_7',
  })
  assert.equal(detail.arena, true)
  assert.deepEqual(
    detail.teams.map((team) => [team.id, team.placement, team.win, team.players.length]),
    [
      [4, 1, true, 2],
      [3, 2, true, 2],
      [2, 3, false, 2],
      [1, 4, false, 2],
    ],
  )
  assert.equal(detail.mode, 'Arena')
  assert.ok(detail.teams.every((team) => team.players.every((player) => player.role === null)))
})
