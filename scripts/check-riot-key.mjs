// Checks that RIOT_API_KEY works against the Riot API.
//
// Usage: npm run check:riot-key -- [platform] [GameName#TAG]
//   platform     a LoL server, e.g. euw1 (default), na1, kr
//   GameName#TAG optional; also checks the account and match history APIs for that player

const REGION_BY_PLATFORM = {
  na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas',
  kr: 'asia', jp1: 'asia',
  euw1: 'europe', eun1: 'europe', tr1: 'europe', ru: 'europe', me1: 'europe',
  oc1: 'sea', sg2: 'sea', tw2: 'sea', vn2: 'sea',
}

const key = process.env.RIOT_API_KEY?.trim()
const platform = (process.argv[2] ?? 'euw1').toLowerCase()
const riotId = process.argv[3]
const region = REGION_BY_PLATFORM[platform]

if (!key) fail('RIOT_API_KEY is not set. Copy .env.example to .env and fill it in.')
if (!region) fail(`Unknown platform "${platform}". Use one of: ${Object.keys(REGION_BY_PLATFORM).join(', ')}`)

async function riot(host, path) {
  const res = await fetch(`https://${host}.api.riotgames.com${path}`, {
    headers: { 'X-Riot-Token': key },
  })
  const limits = res.headers.get('x-app-rate-limit-count')
  console.log(`  ${res.status} GET ${host} ${path}${limits ? `  (app rate limit used: ${limits})` : ''}`)
  if (res.status === 401 || res.status === 403) fail('The key was rejected. Development keys expire every 24 hours: regenerate it at https://developer.riotgames.com/')
  if (res.status === 404) fail('Not found. Check the Riot ID and the platform.')
  if (!res.ok) fail(`Unexpected ${res.status}: ${await res.text()}`)
  return res.json()
}

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

console.log('Checking the key with the server status API...')
const status = await riot(platform, '/lol/status/v4/platform-data')
console.log(`✓ Key accepted. ${status.name} (${status.id}): ${status.incidents.length} incident(s), ${status.maintenances.length} maintenance(s).`)

if (riotId) {
  const [gameName, tagLine] = riotId.split('#')
  if (!gameName || !tagLine) fail(`Riot ID must look like GameName#TAG, got "${riotId}".`)

  console.log(`\nLooking up ${gameName}#${tagLine}...`)
  const account = await riot(region, `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`)
  const ids = await riot(region, `/lol/match/v5/matches/by-puuid/${account.puuid}/ids?count=5`)
  console.log(`✓ Found ${account.gameName}#${account.tagLine}. Last ${ids.length} match id(s): ${ids.join(', ') || 'none'}`)
}
