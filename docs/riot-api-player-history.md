# Riot API: player history and stats (League of Legends)

An excerpt of the [Riot Games API](https://developer.riotgames.com/apis) covering what this project needs to review a player's recent games: finding the player, their ranked standing, their match history with every per-player stat, match timelines, and champion mastery.

- **Source:** endpoint and field data come from the [riotapi-schema](https://github.com/MingweiSamuel/riotapi-schema) OpenAPI spec, which is generated daily from Riot's official API reference. Queue IDs come from Riot's [queues.json](https://static.developer.riotgames.com/docs/lol/queues.json).
- **Retrieved:** 2026-10-15. Current game patch on Data Dragon: `16.20.1`.
- The official reference at <https://developer.riotgames.com/apis> is authoritative. Riot adds and retires fields, so check it if something here looks wrong.

## Contents

- [Getting access](#getting-access)
- [Routing](#routing)
- [Fetching a player's recent stats](#fetching-a-players-recent-stats)
- [Endpoints](#endpoints)
- [Data models](#data-models)
- [Static data and game constants](#static-data-and-game-constants)

## Getting access

- Sign in at <https://developer.riotgames.com/> with a Riot account to get a **development key**. It expires every 24 hours and is only meant for development.
- A product that's open to the public needs a **personal** or **production** key, which you request by registering the product on the developer portal.
- Send the key in the `X-Riot-Token` request header. Never ship it to the browser: in this Nuxt app, calls to Riot go through server routes (`server/api/...`) and the key lives in runtime config (`NUXT_RIOT_API_KEY` env var).

### Rate limits

Limits apply per key and per region, at two levels:

- **Application limit:** shared by all calls made with the key. Development keys get 20 requests per second and 100 requests per 2 minutes.
- **Method limit:** a separate limit for each endpoint.

Every response reports the limits and current usage in the `X-App-Rate-Limit`, `X-App-Rate-Limit-Count`, `X-Method-Rate-Limit` and `X-Method-Rate-Limit-Count` headers. A `429` response includes a `Retry-After` header (seconds). Fetching one match is one call, so looking at 20 games costs at least 21 calls: one for the id list and one per match. Cache aggressively: a finished match never changes.

## Routing

Riot serves each API either from a **platform** host (the player's server) or a **regional** host (a group of servers).

| API                                                       | Routing  | Host values                                                                                  |
| --------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| account-v1                                                | regional | `americas`, `asia`, `europe`. Any of them works for any player; use the closest one.         |
| match-v5                                                  | regional | `americas`, `asia`, `europe`, `sea`. Must be the region that contains the player's platform. |
| summoner-v4, league-v4, champion-mastery-v4, spectator-v5 | platform | the player's server, for example `euw1`                                                      |

Host format: `https://{routing}.api.riotgames.com`, for example `https://europe.api.riotgames.com` or `https://euw1.api.riotgames.com`.

Platform to region mapping for match-v5:

| Region     | Platforms                                                      |
| ---------- | -------------------------------------------------------------- |
| `americas` | `na1` (NA), `br1` (BR), `la1` (LAN), `la2` (LAS)               |
| `asia`     | `kr` (KR), `jp1` (JP)                                          |
| `europe`   | `euw1` (EUW), `eun1` (EUNE), `tr1` (TR), `ru` (RU), `me1` (ME) |
| `sea`      | `oc1` (OCE), `sg2` (SG/PH/TH), `tw2` (TW), `vn2` (VN)          |

Match ids carry their platform as a prefix, for example `EUW1_7212345678`.

## Fetching a player's recent stats

The PUUID is the only player identifier needed across these APIs. It's stable and is never shown to the player.

1. **Riot ID → PUUID.** `GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` on a regional host. URL-encode the game name: it can contain spaces and non-ASCII characters.
2. _(Optional)_ **Find the player's platform** if the user didn't pick one: `GET /riot/account/v1/region/by-game/lol/by-puuid/{puuid}`.
3. **Profile:** `GET /lol/summoner/v4/summoners/by-puuid/{puuid}` on the platform host gives level and profile icon.
4. **Ranked standing:** `GET /lol/league/v4/entries/by-puuid/{puuid}` on the platform host gives tier, division, LP and the season's wins and losses for each ranked queue.
5. **Recent match ids:** `GET /lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count=20` on the regional host. Filter with `queue` (for example `420` for ranked solo), `type`, `startTime` and `endTime`, and page with `start`. Results are newest first, at most 100 per call.
6. **Match details:** `GET /lol/match/v5/matches/{matchId}` for each id. Find the player's entry in `info.participants` by `puuid`. It holds every end-of-game stat: KDA, CS, gold, damage, vision, items, runes, pings, and the `challenges` object with about 150 derived stats such as `kda`, `killParticipation`, `damagePerMinute` and `laneMinionsFirst10Minutes`.
7. _(Optional)_ **Timeline:** `GET /lol/match/v5/matches/{matchId}/timeline` gives a snapshot of every participant each minute (gold, XP, CS, level, position, damage) plus every event (kills, item purchases, skill level-ups, objectives, wards). Use it for things like gold difference at 15 minutes or build order. `participantFrames` is keyed by participant id as a string (`"1"` to `"10"`); match it to `participantId` in the match's `ParticipantDto`.
8. _(Optional)_ **Champion mastery:** `GET /lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}/top` on the platform host.

Common per-game stats and where they come from (`p` is the player's `ParticipantDto`):

| Stat                | Source                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Win / loss          | `p.win`                                                                                                             |
| Champion            | `p.championId`, `p.championName`                                                                                    |
| Role                | `p.teamPosition` (`TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY`); `p.individualPosition` is Riot's guess           |
| KDA                 | `p.kills`, `p.deaths`, `p.assists`, or `p.challenges.kda`                                                           |
| CS                  | `p.totalMinionsKilled + p.neutralMinionsKilled`                                                                     |
| CS per minute       | CS / (`p.timePlayed` / 60)                                                                                          |
| Gold                | `p.goldEarned`, `p.challenges.goldPerMinute`                                                                        |
| Damage to champions | `p.totalDamageDealtToChampions`, `p.challenges.damagePerMinute`, `p.challenges.teamDamagePercentage`                |
| Kill participation  | `p.challenges.killParticipation`                                                                                    |
| Vision              | `p.visionScore`, `p.wardsPlaced`, `p.wardsKilled`, `p.visionWardsBoughtInGame`, `p.challenges.visionScorePerMinute` |
| Items               | `p.item0` … `p.item6` (`item6` is the trinket; `0` means an empty slot)                                             |
| Runes               | `p.perks.styles[].selections[].perk`, `p.perks.statPerks`                                                           |
| Summoner spells     | `p.summoner1Id`, `p.summoner2Id`                                                                                    |
| Game length         | `info.gameDuration` in seconds (see the note on that field)                                                         |
| Remakes             | `p.gameEndedInEarlySurrender` is `true` for games ended by an early surrender (remake); usually excluded from stats |
| Queue / patch       | `info.queueId`, `info.gameVersion` (first two parts are the patch)                                                  |

## Endpoints

Every endpoint takes the API key in the `X-Riot-Token` header. Paths are relative to the host given under "Routing".

All endpoints share the same error codes: `400` bad request, `401` unauthorized (no key), `403` forbidden (invalid or expired key, or an endpoint the key may not use), `404` data not found, `405` method not allowed, `415` unsupported media type, `429` rate limit exceeded, `500` internal server error, `502` bad gateway, `503` service unavailable, `504` gateway timeout.

### Account (Riot ID ↔ PUUID)

#### `GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}`

`account-v1.getByRiotId` · [official reference](https://developer.riotgames.com/api-methods/#account-v1/GET_getByRiotId)

Get account by riot id

- **Routing:** regional — `https://{regional}.api.riotgames.com` with `{regional}` ∈ `americas`, `asia`, `europe`

| Parameter  | In   | Required | Type     | Description                                                                                      |
| ---------- | ---- | -------- | -------- | ------------------------------------------------------------------------------------------------ |
| `tagLine`  | path | yes      | `string` | When querying for a player by their riot id, the gameName and tagLine query params are required. |
| `gameName` | path | yes      | `string` | When querying for a player by their riot id, the gameName and tagLine query params are required. |

**200 response:** [AccountDto](#account-v1accountdto)

#### `GET /riot/account/v1/accounts/by-puuid/{puuid}`

`account-v1.getByPuuid` · [official reference](https://developer.riotgames.com/api-methods/#account-v1/GET_getByPuuid)

Get account by puuid

- **Routing:** regional — `https://{regional}.api.riotgames.com` with `{regional}` ∈ `americas`, `asia`, `europe`

| Parameter | In   | Required | Type     | Description |
| --------- | ---- | -------- | -------- | ----------- |
| `puuid`   | path | yes      | `string` |             |

**200 response:** [AccountDto](#account-v1accountdto)

#### `GET /riot/account/v1/region/by-game/{game}/by-puuid/{puuid}`

`account-v1.getActiveRegion` · [official reference](https://developer.riotgames.com/api-methods/#account-v1/GET_getActiveRegion)

Get active region (lol and tft)

- **Routing:** regional — `https://{regional}.api.riotgames.com` with `{regional}` ∈ `americas`, `asia`, `europe`

| Parameter | In   | Required | Type                  | Description |
| --------- | ---- | -------- | --------------------- | ----------- |
| `puuid`   | path | yes      | `string`              |             |
| `game`    | path | yes      | string (`lol`, `tft`) |             |

**200 response:** [AccountRegionDTO](#account-v1accountregiondto)

### Summoner profile

#### `GET /lol/summoner/v4/summoners/by-puuid/{encryptedPUUID}`

`summoner-v4.getByPUUID` · [official reference](https://developer.riotgames.com/api-methods/#summoner-v4/GET_getByPUUID)

Get a summoner by PUUID.

- **Routing:** platform — `https://{platform}.api.riotgames.com` with `{platform}` ∈ `br1`, `eun1`, `euw1`, `jp1`, `kr`, `la1`, `la2`, `me1`, `na1`, `oc1`, `ru`, `sg2`, `tr1`, `tw2`, `vn2`

| Parameter        | In   | Required | Type     | Description |
| ---------------- | ---- | -------- | -------- | ----------- |
| `encryptedPUUID` | path | yes      | `string` | Summoner ID |

**200 response:** [SummonerDTO](#summoner-v4summonerdto)

### Ranked standing

#### `GET /lol/league/v4/entries/by-puuid/{encryptedPUUID}`

`league-v4.getLeagueEntriesByPUUID` · [official reference](https://developer.riotgames.com/api-methods/#league-v4/GET_getLeagueEntriesByPUUID)

Get league entries in all queues for a given puuid

- **Routing:** platform — `https://{platform}.api.riotgames.com` with `{platform}` ∈ `br1`, `eun1`, `euw1`, `jp1`, `kr`, `la1`, `la2`, `me1`, `na1`, `oc1`, `ru`, `sg2`, `tr1`, `tw2`, `vn2`

| Parameter        | In   | Required | Type     | Description |
| ---------------- | ---- | -------- | -------- | ----------- |
| `encryptedPUUID` | path | yes      | `string` |             |

**200 response:** [LeagueEntryDTO](#league-v4leagueentrydto)[]

### Match history

#### `GET /lol/match/v5/matches/by-puuid/{puuid}/ids`

`match-v5.getMatchIdsByPUUID` · [official reference](https://developer.riotgames.com/api-methods/#match-v5/GET_getMatchIdsByPUUID)

Get a list of match ids by puuid

- **Routing:** regional — `https://{regional}.api.riotgames.com` with `{regional}` ∈ `americas`, `asia`, `europe`, `sea`

| Parameter   | In    | Required | Type                                               | Description                                                                                                                                                                                         |
| ----------- | ----- | -------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `puuid`     | path  | yes      | `String`                                           |                                                                                                                                                                                                     |
| `startTime` | query | no       | `long`                                             | Epoch timestamp in seconds. The matchlist started storing timestamps on June 16th, 2021. Any matches played before June 16th, 2021 won't be included in the results if the startTime filter is set. |
| `endTime`   | query | no       | `long`                                             | Epoch timestamp in seconds.                                                                                                                                                                         |
| `queue`     | query | no       | `int`                                              | Filter the list of match ids by a specific queue id. This filter is mutually inclusive of the type filter meaning any match ids returned must match both the queue and type filters.                |
| `type`      | query | no       | string (`ranked`, `normal`, `tourney`, `tutorial`) | Filter the list of match ids by the type of match. This filter is mutually inclusive of the queue filter meaning any match ids returned must match both the queue and type filters.                 |
| `start`     | query | no       | `int`                                              | Defaults to 0. Start index.                                                                                                                                                                         |
| `count`     | query | no       | `int`                                              | Defaults to 20. Valid values: 0 to 100. Number of match ids to return.                                                                                                                              |

**200 response:** `string`[]

#### `GET /lol/match/v5/matches/{matchId}`

`match-v5.getMatch` · [official reference](https://developer.riotgames.com/api-methods/#match-v5/GET_getMatch)

Get a match by match id

- **Routing:** regional — `https://{regional}.api.riotgames.com` with `{regional}` ∈ `americas`, `asia`, `europe`, `sea`

| Parameter | In   | Required | Type     | Description |
| --------- | ---- | -------- | -------- | ----------- |
| `matchId` | path | yes      | `String` |             |

**200 response:** [MatchDto](#match-v5matchdto)

#### `GET /lol/match/v5/matches/{matchId}/timeline`

`match-v5.getTimeline` · [official reference](https://developer.riotgames.com/api-methods/#match-v5/GET_getTimeline)

Get a match timeline by match id

- **Routing:** regional — `https://{regional}.api.riotgames.com` with `{regional}` ∈ `americas`, `asia`, `europe`, `sea`

| Parameter | In   | Required | Type     | Description |
| --------- | ---- | -------- | -------- | ----------- |
| `matchId` | path | yes      | `String` |             |

**200 response:** [TimelineDto](#match-v5timelinedto)

### Champion mastery

#### `GET /lol/champion-mastery/v4/champion-masteries/by-puuid/{encryptedPUUID}`

`champion-mastery-v4.getAllChampionMasteriesByPUUID` · [official reference](https://developer.riotgames.com/api-methods/#champion-mastery-v4/GET_getAllChampionMasteriesByPUUID)

Get all champion mastery entries sorted by number of champion points descending.

- **Routing:** platform — `https://{platform}.api.riotgames.com` with `{platform}` ∈ `br1`, `eun1`, `euw1`, `jp1`, `kr`, `la1`, `la2`, `me1`, `na1`, `oc1`, `ru`, `sg2`, `tr1`, `tw2`, `vn2`

| Parameter        | In   | Required | Type     | Description |
| ---------------- | ---- | -------- | -------- | ----------- |
| `encryptedPUUID` | path | yes      | `string` |             |

**200 response:** [ChampionMasteryDto](#champion-mastery-v4championmasterydto)[]

#### `GET /lol/champion-mastery/v4/champion-masteries/by-puuid/{encryptedPUUID}/top`

`champion-mastery-v4.getTopChampionMasteriesByPUUID` · [official reference](https://developer.riotgames.com/api-methods/#champion-mastery-v4/GET_getTopChampionMasteriesByPUUID)

Get specified number of top champion mastery entries sorted by number of champion points descending.

- **Routing:** platform — `https://{platform}.api.riotgames.com` with `{platform}` ∈ `br1`, `eun1`, `euw1`, `jp1`, `kr`, `la1`, `la2`, `me1`, `na1`, `oc1`, `ru`, `sg2`, `tr1`, `tw2`, `vn2`

| Parameter        | In    | Required | Type     | Description                                   |
| ---------------- | ----- | -------- | -------- | --------------------------------------------- |
| `encryptedPUUID` | path  | yes      | `string` |                                               |
| `count`          | query | no       | `int`    | Number of entries to retrieve, defaults to 3. |

**200 response:** [ChampionMasteryDto](#champion-mastery-v4championmasterydto)[]

#### `GET /lol/champion-mastery/v4/champion-masteries/by-puuid/{encryptedPUUID}/by-champion/{championId}`

`champion-mastery-v4.getChampionMasteryByPUUID` · [official reference](https://developer.riotgames.com/api-methods/#champion-mastery-v4/GET_getChampionMasteryByPUUID)

Get a champion mastery by puuid and champion ID.

- **Routing:** platform — `https://{platform}.api.riotgames.com` with `{platform}` ∈ `br1`, `eun1`, `euw1`, `jp1`, `kr`, `la1`, `la2`, `me1`, `na1`, `oc1`, `ru`, `sg2`, `tr1`, `tw2`, `vn2`

| Parameter        | In   | Required | Type     | Description                               |
| ---------------- | ---- | -------- | -------- | ----------------------------------------- |
| `encryptedPUUID` | path | yes      | `string` |                                           |
| `championId`     | path | yes      | `int`    | Champion ID to retrieve Champion Mastery. |

**200 response:** [ChampionMasteryDto](#champion-mastery-v4championmasterydto)

#### `GET /lol/champion-mastery/v4/scores/by-puuid/{encryptedPUUID}`

`champion-mastery-v4.getChampionMasteryScoreByPUUID` · [official reference](https://developer.riotgames.com/api-methods/#champion-mastery-v4/GET_getChampionMasteryScoreByPUUID)

Get a player's total champion mastery score, which is the sum of individual champion mastery levels.

- **Routing:** platform — `https://{platform}.api.riotgames.com` with `{platform}` ∈ `br1`, `eun1`, `euw1`, `jp1`, `kr`, `la1`, `la2`, `me1`, `na1`, `oc1`, `ru`, `sg2`, `tr1`, `tw2`, `vn2`

| Parameter        | In   | Required | Type     | Description |
| ---------------- | ---- | -------- | -------- | ----------- |
| `encryptedPUUID` | path | yes      | `string` |             |

**200 response:** `int`

### Live game

#### `GET /lol/spectator/v5/active-games/by-summoner/{encryptedPUUID}`

`spectator-v5.getCurrentGameInfoByPuuid` · [official reference](https://developer.riotgames.com/api-methods/#spectator-v5/GET_getCurrentGameInfoByPuuid)

Get current game information for the given puuid.

- **Routing:** platform — `https://{platform}.api.riotgames.com` with `{platform}` ∈ `br1`, `eun1`, `euw1`, `jp1`, `kr`, `la1`, `la2`, `me1`, `na1`, `oc1`, `ru`, `sg2`, `tr1`, `tw2`, `vn2`

| Parameter        | In   | Required | Type     | Description                |
| ---------------- | ---- | -------- | -------- | -------------------------- |
| `encryptedPUUID` | path | yes      | `string` | The puuid of the summoner. |

**200 response:** [CurrentGameInfo](#spectator-v5currentgameinfo)

## Data models

All fields as published in the API reference. "Req." marks fields the schema lists as always present; others can be missing (older matches, other game modes, or fields Riot added later).

### account-v1.AccountDto

<a id="account-v1accountdto"></a>

3 fields.

| Field      | Type     | Req. | Description                                                                          |
| ---------- | -------- | ---- | ------------------------------------------------------------------------------------ |
| `puuid`    | `string` | ✓    | Encrypted PUUID. Exact length of 78 characters.                                      |
| `gameName` | `string` |      | This field may be excluded from the response if the account doesn't have a gameName. |
| `tagLine`  | `string` |      | This field may be excluded from the response if the account doesn't have a tagLine.  |

### account-v1.AccountRegionDTO

<a id="account-v1accountregiondto"></a>

Account region

3 fields.

| Field    | Type     | Req. | Description                                                                    |
| -------- | -------- | ---- | ------------------------------------------------------------------------------ |
| `puuid`  | `string` | ✓    | Player Universal Unique Identifier. Exact length of 78 characters. (Encrypted) |
| `game`   | `string` | ✓    | Game to lookup active region                                                   |
| `region` | `string` | ✓    | Player active region                                                           |

### summoner-v4.SummonerDTO

<a id="summoner-v4summonerdto"></a>

represents a summoner

5 fields.

| Field           | Type     | Req. | Description                                                                                                                                                                                                               |
| --------------- | -------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profileIconId` | `int`    | ✓    | ID of the summoner icon associated with the summoner.                                                                                                                                                                     |
| `revisionDate`  | `long`   | ✓    | Date summoner was last modified specified as epoch milliseconds. The following events will update this timestamp: profile icon change, playing the tutorial or advanced tutorial, finishing a game, summoner name change. |
| `puuid`         | `string` | ✓    | Encrypted PUUID. Exact length of 78 characters.                                                                                                                                                                           |
| `summonerLevel` | `long`   | ✓    | Summoner level associated with the summoner.                                                                                                                                                                              |
| `id`            | `string` |      | Encrypted summoner ID. This field is deprecated and will be removed. Use `puuid` instead.                                                                                                                                 |

### league-v4.LeagueEntryDTO

<a id="league-v4leagueentrydto"></a>

14 fields.

| Field          | Type                                     | Req. | Description                                                                               |
| -------------- | ---------------------------------------- | ---- | ----------------------------------------------------------------------------------------- |
| `leagueId`     | `string`                                 |      |                                                                                           |
| `puuid`        | `string`                                 | ✓    | Player's encrypted puuid.                                                                 |
| `queueType`    | `string`                                 | ✓    |                                                                                           |
| `tier`         | `string`                                 |      |                                                                                           |
| `rank`         | `string`                                 |      | The player's division within a tier.                                                      |
| `leaguePoints` | `int`                                    | ✓    |                                                                                           |
| `wins`         | `int`                                    | ✓    | Winning team on Summoners Rift.                                                           |
| `losses`       | `int`                                    | ✓    | Losing team on Summoners Rift.                                                            |
| `hotStreak`    | `boolean`                                | ✓    |                                                                                           |
| `veteran`      | `boolean`                                | ✓    |                                                                                           |
| `freshBlood`   | `boolean`                                | ✓    |                                                                                           |
| `inactive`     | `boolean`                                | ✓    |                                                                                           |
| `miniSeries`   | [MiniSeriesDTO](#league-v4miniseriesdto) |      |                                                                                           |
| `summonerId`   | `string`                                 |      | Encrypted summoner ID. This field is deprecated and will be removed. Use `puuid` instead. |

### league-v4.MiniSeriesDTO

<a id="league-v4miniseriesdto"></a>

4 fields.

| Field      | Type     | Req. | Description |
| ---------- | -------- | ---- | ----------- |
| `losses`   | `int`    | ✓    |             |
| `progress` | `string` | ✓    |             |
| `target`   | `int`    | ✓    |             |
| `wins`     | `int`    | ✓    |             |

### match-v5.MatchDto

<a id="match-v5matchdto"></a>

2 fields.

| Field      | Type                                | Req. | Description     |
| ---------- | ----------------------------------- | ---- | --------------- |
| `metadata` | [MetadataDto](#match-v5metadatadto) | ✓    | Match metadata. |
| `info`     | [InfoDto](#match-v5infodto)         | ✓    | Match info.     |

### match-v5.MetadataDto

<a id="match-v5metadatadto"></a>

3 fields.

| Field          | Type       | Req. | Description                   |
| -------------- | ---------- | ---- | ----------------------------- |
| `dataVersion`  | `string`   | ✓    | Match data version.           |
| `matchId`      | `string`   | ✓    | Match id.                     |
| `participants` | `string`[] | ✓    | A list of participant PUUIDs. |

### match-v5.InfoDto

<a id="match-v5infodto"></a>

17 fields.

| Field                | Type                                        | Req. | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `endOfGameResult`    | `string`                                    |      | Refer to indicate if the game ended in termination.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `gameCreation`       | `long`                                      | ✓    | Unix timestamp for when the game is created on the game server (i.e., the loading screen).                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `gameDuration`       | `long`                                      | ✓    | Prior to patch 11.20, this field returns the game length in milliseconds calculated from gameEndTimestamp - gameStartTimestamp. Post patch 11.20, this field returns the max timePlayed of any participant in the game in seconds, which makes the behavior of this field consistent with that of match-v4. The best way to handling the change in this field is to treat the value as milliseconds if the gameEndTimestamp field isn't in the response and to treat the value as seconds if gameEndTimestamp is in the response. |
| `gameEndTimestamp`   | `long`                                      |      | Unix timestamp for when match ends on the game server. This timestamp can occasionally be significantly longer than when the match "ends". The most reliable way of determining the timestamp for the end of the match would be to add the max time played of any participant to the gameStartTimestamp. This field was added to match-v5 in patch 11.20 on Oct 5th, 2021.                                                                                                                                                        |
| `gameId`             | `long`                                      | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `gameMode`           | `string`                                    | ✓    | Refer to the Game Constants documentation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `gameName`           | `string`                                    | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `gameStartTimestamp` | `long`                                      | ✓    | Unix timestamp for when match starts on the game server.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `gameType`           | `string`                                    | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `gameVersion`        | `string`                                    | ✓    | The first two parts can be used to determine the patch a game was played on.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `mapId`              | `int`                                       | ✓    | Refer to the Game Constants documentation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `participants`       | [ParticipantDto](#match-v5participantdto)[] | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `platformId`         | `string`                                    | ✓    | Platform where the match was played.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `queueId`            | `int`                                       | ✓    | Refer to the Game Constants documentation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `teams`              | [TeamDto](#match-v5teamdto)[]               | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `tournamentCode`     | `string`                                    |      | Tournament code used to generate the match. This field was added to match-v5 in patch 11.13 on June 23rd, 2021.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `gameModeMutators`   | `string`[]                                  |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

### match-v5.ParticipantDto

<a id="match-v5participantdto"></a>

159 fields.

| Field                              | Type                                                                  | Req. | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allInPings`                       | `int`                                                                 |      | Yellow crossed swords                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `assistMePings`                    | `int`                                                                 |      | Green flag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `assists`                          | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `baronKills`                       | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `bountyLevel`                      | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `champExperience`                  | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `champLevel`                       | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `championId`                       | `int`                                                                 | ✓    | Prior to patch 11.4, on Feb 18th, 2021, this field returned invalid championIds. We recommend determining the champion based on the championName field for matches played prior to patch 11.4.                                                                                                                                                                                                                                                                                                                                                             |
| `championName`                     | `string`                                                              | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `commandPings`                     | `int`                                                                 |      | Blue generic ping (ALT+click)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `championTransform`                | `int`                                                                 | ✓    | This field is currently only utilized for Kayn's transformations. (Legal values: 0 - None, 1 - Slayer, 2 - Assassin)                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `consumablesPurchased`             | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `challenges`                       | [ChallengesDto](#match-v5challengesdto)                               |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `damageDealtToBuildings`           | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `damageDealtToObjectives`          | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `damageDealtToTurrets`             | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `damageSelfMitigated`              | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `deaths`                           | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `detectorWardsPlaced`              | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `doubleKills`                      | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `dragonKills`                      | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `eligibleForProgression`           | `boolean`                                                             |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `enemyMissingPings`                | `int`                                                                 |      | Yellow questionmark                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `enemyVisionPings`                 | `int`                                                                 |      | Red eyeball                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `firstBloodAssist`                 | `boolean`                                                             | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `firstBloodKill`                   | `boolean`                                                             | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `firstTowerAssist`                 | `boolean`                                                             | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `firstTowerKill`                   | `boolean`                                                             | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `gameEndedInEarlySurrender`        | `boolean`                                                             | ✓    | This is an offshoot of the OneStone challenge. The code checks if a spell with the same instance ID does the final point of damage to at least 2 Champions. It doesn't matter if they're enemies, but you cannot hurt your friends.                                                                                                                                                                                                                                                                                                                        |
| `gameEndedInSurrender`             | `boolean`                                                             | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `holdPings`                        | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `getBackPings`                     | `int`                                                                 |      | Yellow circle with horizontal line                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `goldEarned`                       | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `goldSpent`                        | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `individualPosition`               | `string`                                                              | ✓    | Both individualPosition and teamPosition are computed by the game server and are different versions of the most likely position played by a player. The individualPosition is the best guess for which position the player actually played in isolation of anything else. The teamPosition is the best guess for which position the player actually played if we add the constraint that each team must have one top player, one jungle, one middle, etc. Generally the recommendation is to use the teamPosition field over the individualPosition field. |
| `inhibitorKills`                   | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `inhibitorTakedowns`               | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `inhibitorsLost`                   | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `item0`                            | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `item1`                            | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `item2`                            | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `item3`                            | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `item4`                            | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `item5`                            | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `item6`                            | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `itemsPurchased`                   | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `killingSprees`                    | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `kills`                            | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `lane`                             | `string`                                                              | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `largestCriticalStrike`            | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `largestKillingSpree`              | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `largestMultiKill`                 | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `longestTimeSpentLiving`           | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `magicDamageDealt`                 | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `magicDamageDealtToChampions`      | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `magicDamageTaken`                 | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `missions`                         | [MissionsDto](#match-v5missionsdto)                                   |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `neutralMinionsKilled`             | `int`                                                                 | ✓    | neutralMinionsKilled = mNeutralMinionsKilled, which is incremented on kills of kPet and kJungleMonster                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `needVisionPings`                  | `int`                                                                 |      | Green ward                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `nexusKills`                       | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `nexusTakedowns`                   | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `nexusLost`                        | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `objectivesStolen`                 | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `objectivesStolenAssists`          | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `onMyWayPings`                     | `int`                                                                 |      | Blue arrow pointing at ground                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `participantId`                    | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playerScore0`                     | `float`                                                               |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playerScore1`                     | `float`                                                               |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playerScore2`                     | `float`                                                               |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playerScore3`                     | `float`                                                               |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playerScore4`                     | `float`                                                               |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playerScore5`                     | `float`                                                               |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playerScore6`                     | `float`                                                               |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playerScore7`                     | `float`                                                               |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playerScore8`                     | `float`                                                               |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playerScore9`                     | `float`                                                               |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playerScore10`                    | `float`                                                               |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playerScore11`                    | `float`                                                               |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `pentaKills`                       | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `perks`                            | [PerksDto](#match-v5perksdto)                                         | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `physicalDamageDealt`              | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `physicalDamageDealtToChampions`   | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `physicalDamageTaken`              | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `placement`                        | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playerAugment1`                   | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playerAugment2`                   | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playerAugment3`                   | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playerAugment4`                   | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playerSubteamId`                  | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `pushPings`                        | `int`                                                                 |      | Green minion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `profileIcon`                      | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `puuid`                            | `string`                                                              | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `quadraKills`                      | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `riotIdGameName`                   | `string`                                                              |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `riotIdTagline`                    | `string`                                                              |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `role`                             | `string`                                                              | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `sightWardsBoughtInGame`           | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `spell1Casts`                      | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `spell2Casts`                      | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `spell3Casts`                      | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `spell4Casts`                      | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `subteamPlacement`                 | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `summoner1Casts`                   | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `summoner1Id`                      | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `summoner2Casts`                   | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `summoner2Id`                      | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `summonerId`                       | `string`                                                              | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `summonerLevel`                    | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `summonerName`                     | `string`                                                              | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `teamEarlySurrendered`             | `boolean`                                                             | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `teamId`                           | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `teamPosition`                     | `string`                                                              | ✓    | Both individualPosition and teamPosition are computed by the game server and are different versions of the most likely position played by a player. The individualPosition is the best guess for which position the player actually played in isolation of anything else. The teamPosition is the best guess for which position the player actually played if we add the constraint that each team must have one top player, one jungle, one middle, etc. Generally the recommendation is to use the teamPosition field over the individualPosition field. |
| `timeCCingOthers`                  | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `timePlayed`                       | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `totalAllyJungleMinionsKilled`     | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `totalDamageDealt`                 | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `totalDamageDealtToChampions`      | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `totalDamageShieldedOnTeammates`   | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `totalDamageTaken`                 | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `totalEnemyJungleMinionsKilled`    | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `totalHeal`                        | `int`                                                                 | ✓    | Whenever positive health is applied (which translates to all heals in the game but not things like regeneration), totalHeal is incremented by the amount of health received. This includes healing enemies, jungle monsters, yourself, etc                                                                                                                                                                                                                                                                                                                 |
| `totalHealsOnTeammates`            | `int`                                                                 | ✓    | Whenever positive health is applied (which translates to all heals in the game but not things like regeneration), totalHealsOnTeammates is incremented by the amount of health received. This is post modified, so if you heal someone missing 5 health for 100 you will get +5 totalHealsOnTeammates                                                                                                                                                                                                                                                      |
| `totalMinionsKilled`               | `int`                                                                 | ✓    | totalMillionsKilled = mMinionsKilled, which is only incremented on kills of kTeamMinion, kMeleeLaneMinion, kSuperLaneMinion, kRangedLaneMinion and kSiegeLaneMinion                                                                                                                                                                                                                                                                                                                                                                                        |
| `totalTimeCCDealt`                 | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `totalTimeSpentDead`               | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `totalUnitsHealed`                 | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `tripleKills`                      | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `trueDamageDealt`                  | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `trueDamageDealtToChampions`       | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `trueDamageTaken`                  | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `turretKills`                      | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `turretTakedowns`                  | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `turretsLost`                      | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `unrealKills`                      | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `visionScore`                      | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `visionClearedPings`               | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `visionWardsBoughtInGame`          | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `wardsKilled`                      | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `wardsPlaced`                      | `int`                                                                 | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `win`                              | `boolean`                                                             | ✓    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `baitPings`                        | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `dangerPings`                      | `int`                                                                 |      | https://github.com/RiotGames/developer-relations/issues/870                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `basicPings`                       | `int`                                                                 |      | https://github.com/RiotGames/developer-relations/issues/814                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `playerAugment5`                   | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `playerAugment6`                   | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `riotIdName`                       | `string`                                                              |      | Deprecated, use `riotIdGameName`. This field name was briefly used instead of `riotIdGameName`, prior to patch 14.5.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `retreatPings`                     | `int`                                                                 |      | https://github.com/RiotGames/developer-relations/issues/814                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `championSkinId`                   | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `damageDealtToEpicMonsters`        | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `roleBoundItem`                    | `int`                                                                 |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `PlayerBehavior`                   | [ParticipantPlayerBehaviorDto](#match-v5participantplayerbehaviordto) |      | https://github.com/RiotGames/developer-relations/issues/754#issuecomment-3940157820                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `causedGameEndFromIGNBSurrender`   | `boolean`                                                             |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `gameEndedInIGNBSurrender`         | `boolean`                                                             |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `positionAssignedByMatchmaking`    | `string`                                                              |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `selectedRolePreferences`          | `string`                                                              |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `teamIGNBSurrendered`              | `boolean`                                                             |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `wasPremadeWithIGNBGameEndCauser`  | `boolean`                                                             |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `wasPremadeWithSevereTransgressor` | `boolean`                                                             |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `wasSevereTransgressor`            | `boolean`                                                             |      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

### match-v5.ChallengesDto

<a id="match-v5challengesdto"></a>

Challenges DTO

147 fields.

| Field                                       | Type           | Req. | Description                                                                                                                                                                                                                         |
| ------------------------------------------- | -------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `12AssistStreakCount`                       | `int`          |      |                                                                                                                                                                                                                                     |
| `baronBuffGoldAdvantageOverThreshold`       | `int`          |      |                                                                                                                                                                                                                                     |
| `controlWardTimeCoverageInRiverOrEnemyHalf` | `float`        |      |                                                                                                                                                                                                                                     |
| `earliestBaron`                             | `double`       |      |                                                                                                                                                                                                                                     |
| `earliestDragonTakedown`                    | `double`       |      |                                                                                                                                                                                                                                     |
| `earliestElderDragon`                       | `double`       |      |                                                                                                                                                                                                                                     |
| `earlyLaningPhaseGoldExpAdvantage`          | `double`       |      |                                                                                                                                                                                                                                     |
| `fasterSupportQuestCompletion`              | int (`0`, `1`) |      |                                                                                                                                                                                                                                     |
| `fastestLegendary`                          | `double`       |      |                                                                                                                                                                                                                                     |
| `hadAfkTeammate`                            | int (`0`, `1`) |      |                                                                                                                                                                                                                                     |
| `highestChampionDamage`                     | `int`          |      |                                                                                                                                                                                                                                     |
| `highestCrowdControlScore`                  | int (`0`, `1`) |      |                                                                                                                                                                                                                                     |
| `highestWardKills`                          | int (`0`, `1`) |      |                                                                                                                                                                                                                                     |
| `junglerKillsEarlyJungle`                   | `int`          |      |                                                                                                                                                                                                                                     |
| `killsOnLanersEarlyJungleAsJungler`         | `int`          |      |                                                                                                                                                                                                                                     |
| `laningPhaseGoldExpAdvantage`               | int (`0`, `1`) |      |                                                                                                                                                                                                                                     |
| `legendaryCount`                            | `int`          |      |                                                                                                                                                                                                                                     |
| `maxCsAdvantageOnLaneOpponent`              | `float`        |      |                                                                                                                                                                                                                                     |
| `maxLevelLeadLaneOpponent`                  | `int`          |      |                                                                                                                                                                                                                                     |
| `mostWardsDestroyedOneSweeper`              | `int`          |      |                                                                                                                                                                                                                                     |
| `mythicItemUsed`                            | `int`          |      |                                                                                                                                                                                                                                     |
| `playedChampSelectPosition`                 | int (`0`, `1`) |      |                                                                                                                                                                                                                                     |
| `soloTurretsLategame`                       | `int`          |      |                                                                                                                                                                                                                                     |
| `takedownsFirst25Minutes`                   | `int`          |      |                                                                                                                                                                                                                                     |
| `teleportTakedowns`                         | `int`          |      |                                                                                                                                                                                                                                     |
| `thirdInhibitorDestroyedTime`               | `double`       |      |                                                                                                                                                                                                                                     |
| `threeWardsOneSweeperCount`                 | `int`          |      |                                                                                                                                                                                                                                     |
| `visionScoreAdvantageLaneOpponent`          | `float`        |      |                                                                                                                                                                                                                                     |
| `InfernalScalePickup`                       | `int`          |      |                                                                                                                                                                                                                                     |
| `fistBumpParticipation`                     | `int`          |      |                                                                                                                                                                                                                                     |
| `voidMonsterKill`                           | `int`          |      |                                                                                                                                                                                                                                     |
| `abilityUses`                               | `int`          |      |                                                                                                                                                                                                                                     |
| `acesBefore15Minutes`                       | `int`          |      |                                                                                                                                                                                                                                     |
| `alliedJungleMonsterKills`                  | `float`        |      |                                                                                                                                                                                                                                     |
| `baronTakedowns`                            | `int`          |      |                                                                                                                                                                                                                                     |
| `blastConeOppositeOpponentCount`            | `int`          |      |                                                                                                                                                                                                                                     |
| `bountyGold`                                | `double`       |      |                                                                                                                                                                                                                                     |
| `buffsStolen`                               | `int`          |      |                                                                                                                                                                                                                                     |
| `completeSupportQuestInTime`                | `int`          |      |                                                                                                                                                                                                                                     |
| `controlWardsPlaced`                        | `int`          |      |                                                                                                                                                                                                                                     |
| `damagePerMinute`                           | `float`        |      |                                                                                                                                                                                                                                     |
| `damageTakenOnTeamPercentage`               | `float`        |      |                                                                                                                                                                                                                                     |
| `dancedWithRiftHerald`                      | `int`          |      |                                                                                                                                                                                                                                     |
| `deathsByEnemyChamps`                       | `int`          |      |                                                                                                                                                                                                                                     |
| `dodgeSkillShotsSmallWindow`                | `int`          |      |                                                                                                                                                                                                                                     |
| `doubleAces`                                | `int`          |      |                                                                                                                                                                                                                                     |
| `dragonTakedowns`                           | `int`          |      |                                                                                                                                                                                                                                     |
| `legendaryItemUsed`                         | `int`[]        |      |                                                                                                                                                                                                                                     |
| `effectiveHealAndShielding`                 | `float`        |      |                                                                                                                                                                                                                                     |
| `elderDragonKillsWithOpposingSoul`          | `int`          |      |                                                                                                                                                                                                                                     |
| `elderDragonMultikills`                     | `int`          |      |                                                                                                                                                                                                                                     |
| `enemyChampionImmobilizations`              | `int`          |      |                                                                                                                                                                                                                                     |
| `enemyJungleMonsterKills`                   | `float`        |      |                                                                                                                                                                                                                                     |
| `epicMonsterKillsNearEnemyJungler`          | `int`          |      |                                                                                                                                                                                                                                     |
| `epicMonsterKillsWithin30SecondsOfSpawn`    | `int`          |      |                                                                                                                                                                                                                                     |
| `epicMonsterSteals`                         | `int`          |      |                                                                                                                                                                                                                                     |
| `epicMonsterStolenWithoutSmite`             | `int`          |      |                                                                                                                                                                                                                                     |
| `firstTurretKilled`                         | `double`       |      |                                                                                                                                                                                                                                     |
| `firstTurretKilledTime`                     | `float`        |      |                                                                                                                                                                                                                                     |
| `flawlessAces`                              | `int`          |      |                                                                                                                                                                                                                                     |
| `fullTeamTakedown`                          | `int`          |      |                                                                                                                                                                                                                                     |
| `gameLength`                                | `float`        |      |                                                                                                                                                                                                                                     |
| `getTakedownsInAllLanesEarlyJungleAsLaner`  | `int`          |      |                                                                                                                                                                                                                                     |
| `goldPerMinute`                             | `float`        |      |                                                                                                                                                                                                                                     |
| `hadOpenNexus`                              | `int`          |      |                                                                                                                                                                                                                                     |
| `immobilizeAndKillWithAlly`                 | `int`          |      |                                                                                                                                                                                                                                     |
| `initialBuffCount`                          | `int`          |      |                                                                                                                                                                                                                                     |
| `initialCrabCount`                          | `int`          |      |                                                                                                                                                                                                                                     |
| `jungleCsBefore10Minutes`                   | `float`        |      |                                                                                                                                                                                                                                     |
| `junglerTakedownsNearDamagedEpicMonster`    | `int`          |      |                                                                                                                                                                                                                                     |
| `kda`                                       | `float`        |      |                                                                                                                                                                                                                                     |
| `killAfterHiddenWithAlly`                   | `int`          |      |                                                                                                                                                                                                                                     |
| `killedChampTookFullTeamDamageSurvived`     | `int`          |      |                                                                                                                                                                                                                                     |
| `killingSprees`                             | `int`          |      |                                                                                                                                                                                                                                     |
| `killParticipation`                         | `float`        |      |                                                                                                                                                                                                                                     |
| `killsNearEnemyTurret`                      | `int`          |      |                                                                                                                                                                                                                                     |
| `killsOnOtherLanesEarlyJungleAsLaner`       | `int`          |      |                                                                                                                                                                                                                                     |
| `killsOnRecentlyHealedByAramPack`           | `int`          |      |                                                                                                                                                                                                                                     |
| `killsUnderOwnTurret`                       | `int`          |      |                                                                                                                                                                                                                                     |
| `killsWithHelpFromEpicMonster`              | `int`          |      |                                                                                                                                                                                                                                     |
| `knockEnemyIntoTeamAndKill`                 | `int`          |      |                                                                                                                                                                                                                                     |
| `kTurretsDestroyedBeforePlatesFall`         | `int`          |      |                                                                                                                                                                                                                                     |
| `landSkillShotsEarlyGame`                   | `int`          |      |                                                                                                                                                                                                                                     |
| `laneMinionsFirst10Minutes`                 | `int`          |      |                                                                                                                                                                                                                                     |
| `lostAnInhibitor`                           | `int`          |      |                                                                                                                                                                                                                                     |
| `maxKillDeficit`                            | `int`          |      |                                                                                                                                                                                                                                     |
| `mejaisFullStackInTime`                     | `int`          |      |                                                                                                                                                                                                                                     |
| `moreEnemyJungleThanOpponent`               | `float`        |      |                                                                                                                                                                                                                                     |
| `multiKillOneSpell`                         | `int`          |      | This is an offshoot of the OneStone challenge. The code checks if a spell with the same instance ID does the final point of damage to at least 2 Champions. It doesn't matter if they're enemies, but you cannot hurt your friends. |
| `multikills`                                | `int`          |      |                                                                                                                                                                                                                                     |
| `multikillsAfterAggressiveFlash`            | `int`          |      |                                                                                                                                                                                                                                     |
| `multiTurretRiftHeraldCount`                | `int`          |      |                                                                                                                                                                                                                                     |
| `outerTurretExecutesBefore10Minutes`        | `int`          |      |                                                                                                                                                                                                                                     |
| `outnumberedKills`                          | `int`          |      |                                                                                                                                                                                                                                     |
| `outnumberedNexusKill`                      | `int`          |      |                                                                                                                                                                                                                                     |
| `perfectDragonSoulsTaken`                   | `int`          |      |                                                                                                                                                                                                                                     |
| `perfectGame`                               | `int`          |      |                                                                                                                                                                                                                                     |
| `pickKillWithAlly`                          | `int`          |      |                                                                                                                                                                                                                                     |
| `poroExplosions`                            | `int`          |      |                                                                                                                                                                                                                                     |
| `quickCleanse`                              | `int`          |      |                                                                                                                                                                                                                                     |
| `quickFirstTurret`                          | `int`          |      |                                                                                                                                                                                                                                     |
| `quickSoloKills`                            | `int`          |      |                                                                                                                                                                                                                                     |
| `riftHeraldTakedowns`                       | `int`          |      |                                                                                                                                                                                                                                     |
| `saveAllyFromDeath`                         | `int`          |      |                                                                                                                                                                                                                                     |
| `scuttleCrabKills`                          | `int`          |      |                                                                                                                                                                                                                                     |
| `shortestTimeToAceFromFirstTakedown`        | `float`        |      |                                                                                                                                                                                                                                     |
| `skillshotsDodged`                          | `int`          |      |                                                                                                                                                                                                                                     |
| `skillshotsHit`                             | `int`          |      |                                                                                                                                                                                                                                     |
| `snowballsHit`                              | `int`          |      |                                                                                                                                                                                                                                     |
| `soloBaronKills`                            | `int`          |      |                                                                                                                                                                                                                                     |
| `SWARM_DefeatAatrox`                        | `int`          |      |                                                                                                                                                                                                                                     |
| `SWARM_DefeatBriar`                         | `int`          |      |                                                                                                                                                                                                                                     |
| `SWARM_DefeatMiniBosses`                    | `int`          |      |                                                                                                                                                                                                                                     |
| `SWARM_EvolveWeapon`                        | `int`          |      |                                                                                                                                                                                                                                     |
| `SWARM_Have3Passives`                       | `int`          |      |                                                                                                                                                                                                                                     |
| `SWARM_KillEnemy`                           | `int`          |      |                                                                                                                                                                                                                                     |
| `SWARM_PickupGold`                          | `float`        |      |                                                                                                                                                                                                                                     |
| `SWARM_ReachLevel50`                        | `int`          |      |                                                                                                                                                                                                                                     |
| `SWARM_Survive15Min`                        | `int`          |      |                                                                                                                                                                                                                                     |
| `SWARM_WinWith5EvolvedWeapons`              | `int`          |      |                                                                                                                                                                                                                                     |
| `soloKills`                                 | `int`          |      |                                                                                                                                                                                                                                     |
| `stealthWardsPlaced`                        | `int`          |      |                                                                                                                                                                                                                                     |
| `survivedSingleDigitHpCount`                | `int`          |      |                                                                                                                                                                                                                                     |
| `survivedThreeImmobilizesInFight`           | `int`          |      |                                                                                                                                                                                                                                     |
| `takedownOnFirstTurret`                     | `int`          |      |                                                                                                                                                                                                                                     |
| `takedowns`                                 | `int`          |      |                                                                                                                                                                                                                                     |
| `takedownsAfterGainingLevelAdvantage`       | `int`          |      |                                                                                                                                                                                                                                     |
| `takedownsBeforeJungleMinionSpawn`          | `int`          |      |                                                                                                                                                                                                                                     |
| `takedownsFirstXMinutes`                    | `int`          |      |                                                                                                                                                                                                                                     |
| `takedownsInAlcove`                         | `int`          |      |                                                                                                                                                                                                                                     |
| `takedownsInEnemyFountain`                  | `int`          |      |                                                                                                                                                                                                                                     |
| `teamBaronKills`                            | `int`          |      |                                                                                                                                                                                                                                     |
| `teamDamagePercentage`                      | `float`        |      |                                                                                                                                                                                                                                     |
| `teamElderDragonKills`                      | `int`          |      |                                                                                                                                                                                                                                     |
| `teamRiftHeraldKills`                       | `int`          |      |                                                                                                                                                                                                                                     |
| `tookLargeDamageSurvived`                   | `int`          |      |                                                                                                                                                                                                                                     |
| `turretPlatesTaken`                         | `int`          |      |                                                                                                                                                                                                                                     |
| `turretsTakenWithRiftHerald`                | `int`          |      | Any player who damages a tower that is destroyed within 30 seconds of a Rift Herald charge will receive credit. A player who does not damage the tower will not receive credit.                                                     |
| `turretTakedowns`                           | `int`          |      |                                                                                                                                                                                                                                     |
| `twentyMinionsIn3SecondsCount`              | `int`          |      |                                                                                                                                                                                                                                     |
| `twoWardsOneSweeperCount`                   | `int`          |      |                                                                                                                                                                                                                                     |
| `unseenRecalls`                             | `int`          |      |                                                                                                                                                                                                                                     |
| `visionScorePerMinute`                      | `float`        |      |                                                                                                                                                                                                                                     |
| `wardsGuarded`                              | `int`          |      |                                                                                                                                                                                                                                     |
| `wardTakedowns`                             | `int`          |      |                                                                                                                                                                                                                                     |
| `wardTakedownsBefore20M`                    | `int`          |      |                                                                                                                                                                                                                                     |
| `HealFromMapSources`                        | `double`       |      |                                                                                                                                                                                                                                     |

### match-v5.MissionsDto

<a id="match-v5missionsdto"></a>

Missions DTO

12 fields.

| Field           | Type    | Req. | Description |
| --------------- | ------- | ---- | ----------- |
| `playerScore0`  | `float` |      |             |
| `playerScore1`  | `float` |      |             |
| `playerScore2`  | `float` |      |             |
| `playerScore3`  | `float` |      |             |
| `playerScore4`  | `float` |      |             |
| `playerScore5`  | `float` |      |             |
| `playerScore6`  | `float` |      |             |
| `playerScore7`  | `float` |      |             |
| `playerScore8`  | `float` |      |             |
| `playerScore9`  | `float` |      |             |
| `playerScore10` | `float` |      |             |
| `playerScore11` | `float` |      |             |

### match-v5.PerksDto

<a id="match-v5perksdto"></a>

2 fields.

| Field       | Type                                    | Req. | Description |
| ----------- | --------------------------------------- | ---- | ----------- |
| `statPerks` | [PerkStatsDto](#match-v5perkstatsdto)   | ✓    |             |
| `styles`    | [PerkStyleDto](#match-v5perkstyledto)[] | ✓    |             |

### match-v5.PerkStatsDto

<a id="match-v5perkstatsdto"></a>

3 fields.

| Field     | Type  | Req. | Description |
| --------- | ----- | ---- | ----------- |
| `defense` | `int` | ✓    |             |
| `flex`    | `int` | ✓    |             |
| `offense` | `int` | ✓    |             |

### match-v5.PerkStyleDto

<a id="match-v5perkstyledto"></a>

3 fields.

| Field         | Type                                                      | Req. | Description |
| ------------- | --------------------------------------------------------- | ---- | ----------- |
| `description` | `string`                                                  | ✓    |             |
| `selections`  | [PerkStyleSelectionDto](#match-v5perkstyleselectiondto)[] | ✓    |             |
| `style`       | `int`                                                     | ✓    |             |

### match-v5.PerkStyleSelectionDto

<a id="match-v5perkstyleselectiondto"></a>

4 fields.

| Field  | Type  | Req. | Description |
| ------ | ----- | ---- | ----------- |
| `perk` | `int` | ✓    |             |
| `var1` | `int` | ✓    |             |
| `var2` | `int` | ✓    |             |
| `var3` | `int` | ✓    |             |

### match-v5.ParticipantPlayerBehaviorDto

<a id="match-v5participantplayerbehaviordto"></a>

1 fields.

| Field                           | Type  | Req. | Description |
| ------------------------------- | ----- | ---- | ----------- |
| `PlayerBehavior_IsHeroInCombat` | `int` |      |             |

### match-v5.TeamDto

<a id="match-v5teamdto"></a>

5 fields.

| Field        | Type                                    | Req. | Description |
| ------------ | --------------------------------------- | ---- | ----------- |
| `bans`       | [BanDto](#match-v5bandto)[]             | ✓    |             |
| `objectives` | [ObjectivesDto](#match-v5objectivesdto) | ✓    |             |
| `teamId`     | `int`                                   | ✓    |             |
| `win`        | `boolean`                               | ✓    |             |
| `feats`      | [FeatsDto](#match-v5featsdto)           |      |             |

### match-v5.BanDto

<a id="match-v5bandto"></a>

2 fields.

| Field        | Type  | Req. | Description |
| ------------ | ----- | ---- | ----------- |
| `championId` | `int` | ✓    |             |
| `pickTurn`   | `int` | ✓    |             |

### match-v5.ObjectivesDto

<a id="match-v5objectivesdto"></a>

8 fields.

| Field        | Type                                  | Req. | Description |
| ------------ | ------------------------------------- | ---- | ----------- |
| `baron`      | [ObjectiveDto](#match-v5objectivedto) | ✓    |             |
| `champion`   | [ObjectiveDto](#match-v5objectivedto) | ✓    |             |
| `dragon`     | [ObjectiveDto](#match-v5objectivedto) | ✓    |             |
| `horde`      | [ObjectiveDto](#match-v5objectivedto) |      |             |
| `inhibitor`  | [ObjectiveDto](#match-v5objectivedto) | ✓    |             |
| `riftHerald` | [ObjectiveDto](#match-v5objectivedto) | ✓    |             |
| `tower`      | [ObjectiveDto](#match-v5objectivedto) | ✓    |             |
| `atakhan`    | [ObjectiveDto](#match-v5objectivedto) |      |             |

### match-v5.ObjectiveDto

<a id="match-v5objectivedto"></a>

2 fields.

| Field   | Type      | Req. | Description |
| ------- | --------- | ---- | ----------- |
| `first` | `boolean` | ✓    |             |
| `kills` | `int`     | ✓    |             |

### match-v5.FeatsDto

<a id="match-v5featsdto"></a>

3 fields.

| Field               | Type                        | Req. | Description |
| ------------------- | --------------------------- | ---- | ----------- |
| `EPIC_MONSTER_KILL` | [FeatDto](#match-v5featdto) |      |             |
| `FIRST_BLOOD`       | [FeatDto](#match-v5featdto) |      |             |
| `FIRST_TURRET`      | [FeatDto](#match-v5featdto) |      |             |

### match-v5.FeatDto

<a id="match-v5featdto"></a>

1 fields.

| Field       | Type  | Req. | Description |
| ----------- | ----- | ---- | ----------- |
| `featState` | `int` |      |             |

### match-v5.TimelineDto

<a id="match-v5timelinedto"></a>

2 fields.

| Field      | Type                                                | Req. | Description     |
| ---------- | --------------------------------------------------- | ---- | --------------- |
| `metadata` | [MetadataTimeLineDto](#match-v5metadatatimelinedto) | ✓    | Match metadata. |
| `info`     | [InfoTimeLineDto](#match-v5infotimelinedto)         | ✓    | Match info.     |

### match-v5.MetadataTimeLineDto

<a id="match-v5metadatatimelinedto"></a>

3 fields.

| Field          | Type       | Req. | Description                   |
| -------------- | ---------- | ---- | ----------------------------- |
| `dataVersion`  | `string`   | ✓    | Match data version.           |
| `matchId`      | `string`   | ✓    | Match id.                     |
| `participants` | `string`[] | ✓    | A list of participant PUUIDs. |

### match-v5.InfoTimeLineDto

<a id="match-v5infotimelinedto"></a>

5 fields.

| Field             | Type                                                        | Req. | Description                                         |
| ----------------- | ----------------------------------------------------------- | ---- | --------------------------------------------------- |
| `endOfGameResult` | `string`                                                    |      | Refer to indicate if the game ended in termination. |
| `frameInterval`   | `long`                                                      | ✓    |                                                     |
| `gameId`          | `long`                                                      |      |                                                     |
| `participants`    | [ParticipantTimeLineDto](#match-v5participanttimelinedto)[] |      |                                                     |
| `frames`          | [FramesTimeLineDto](#match-v5framestimelinedto)[]           | ✓    |                                                     |

### match-v5.ParticipantTimeLineDto

<a id="match-v5participanttimelinedto"></a>

2 fields.

| Field           | Type     | Req. | Description |
| --------------- | -------- | ---- | ----------- |
| `participantId` | `int`    | ✓    |             |
| `puuid`         | `string` | ✓    |             |

### match-v5.FramesTimeLineDto

<a id="match-v5framestimelinedto"></a>

3 fields.

| Field               | Type                                                                   | Req. | Description |
| ------------------- | ---------------------------------------------------------------------- | ---- | ----------- |
| `events`            | [EventsTimeLineDto](#match-v5eventstimelinedto)[]                      | ✓    |             |
| `participantFrames` | map&lt;string, [ParticipantFrameDto](#match-v5participantframedto)&gt; |      |             |
| `timestamp`         | `int`                                                                  | ✓    |             |

### match-v5.EventsTimeLineDto

<a id="match-v5eventstimelinedto"></a>

40 fields.

| Field                           | Type                                                              | Req. | Description |
| ------------------------------- | ----------------------------------------------------------------- | ---- | ----------- |
| `timestamp`                     | `long`                                                            | ✓    |             |
| `realTimestamp`                 | `long`                                                            |      |             |
| `type`                          | `string`                                                          | ✓    |             |
| `itemId`                        | `int`                                                             |      |             |
| `participantId`                 | `int`                                                             |      |             |
| `levelUpType`                   | `string`                                                          |      |             |
| `skillSlot`                     | `int`                                                             |      |             |
| `creatorId`                     | `int`                                                             |      |             |
| `wardType`                      | `string`                                                          |      |             |
| `level`                         | `int`                                                             |      |             |
| `assistingParticipantIds`       | `int`[]                                                           |      |             |
| `bounty`                        | `int`                                                             |      |             |
| `killStreakLength`              | `int`                                                             |      |             |
| `killerId`                      | `int`                                                             |      |             |
| `position`                      | [PositionDto](#match-v5positiondto)                               |      |             |
| `victimDamageDealt`             | [MatchTimelineVictimDamage](#match-v5matchtimelinevictimdamage)[] |      |             |
| `victimDamageReceived`          | [MatchTimelineVictimDamage](#match-v5matchtimelinevictimdamage)[] |      |             |
| `victimId`                      | `int`                                                             |      |             |
| `killType`                      | `string`                                                          |      |             |
| `laneType`                      | `string`                                                          |      |             |
| `teamId`                        | `int`                                                             |      |             |
| `multiKillLength`               | `int`                                                             |      |             |
| `killerTeamId`                  | `int`                                                             |      |             |
| `monsterType`                   | `string`                                                          |      |             |
| `monsterSubType`                | `string`                                                          |      |             |
| `buildingType`                  | `string`                                                          |      |             |
| `towerType`                     | `string`                                                          |      |             |
| `afterId`                       | `int`                                                             |      |             |
| `beforeId`                      | `int`                                                             |      |             |
| `goldGain`                      | `int`                                                             |      |             |
| `gameId`                        | `long`                                                            |      |             |
| `winningTeam`                   | `int`                                                             |      |             |
| `transformType`                 | `string`                                                          |      |             |
| `name`                          | `string`                                                          |      |             |
| `shutdownBounty`                | `int`                                                             |      |             |
| `actualStartTime`               | `long`                                                            |      |             |
| `featType`                      | `int`                                                             |      |             |
| `featValue`                     | `int`                                                             |      |             |
| `victimTeamfightDamageDealt`    | [MatchTimelineVictimDamage](#match-v5matchtimelinevictimdamage)[] |      |             |
| `victimTeamfightDamageReceived` | [MatchTimelineVictimDamage](#match-v5matchtimelinevictimdamage)[] |      |             |

### match-v5.PositionDto

<a id="match-v5positiondto"></a>

2 fields.

| Field | Type  | Req. | Description |
| ----- | ----- | ---- | ----------- |
| `x`   | `int` | ✓    |             |
| `y`   | `int` | ✓    |             |

### match-v5.MatchTimelineVictimDamage

<a id="match-v5matchtimelinevictimdamage"></a>

9 fields.

| Field            | Type      | Req. | Description |
| ---------------- | --------- | ---- | ----------- |
| `basic`          | `boolean` | ✓    |             |
| `magicDamage`    | `int`     | ✓    |             |
| `name`           | `string`  | ✓    |             |
| `participantId`  | `int`     | ✓    |             |
| `physicalDamage` | `int`     | ✓    |             |
| `spellName`      | `string`  | ✓    |             |
| `spellSlot`      | `int`     | ✓    |             |
| `trueDamage`     | `int`     | ✓    |             |
| `type`           | `string`  | ✓    |             |

### match-v5.ParticipantFrameDto

<a id="match-v5participantframedto"></a>

12 fields.

| Field                      | Type                                          | Req. | Description |
| -------------------------- | --------------------------------------------- | ---- | ----------- |
| `championStats`            | [ChampionStatsDto](#match-v5championstatsdto) | ✓    |             |
| `currentGold`              | `int`                                         | ✓    |             |
| `damageStats`              | [DamageStatsDto](#match-v5damagestatsdto)     | ✓    |             |
| `goldPerSecond`            | `int`                                         | ✓    |             |
| `jungleMinionsKilled`      | `int`                                         | ✓    |             |
| `level`                    | `int`                                         | ✓    |             |
| `minionsKilled`            | `int`                                         | ✓    |             |
| `participantId`            | `int`                                         | ✓    |             |
| `position`                 | [PositionDto](#match-v5positiondto)           | ✓    |             |
| `timeEnemySpentControlled` | `int`                                         | ✓    |             |
| `totalGold`                | `int`                                         | ✓    |             |
| `xp`                       | `int`                                         | ✓    |             |

### match-v5.ChampionStatsDto

<a id="match-v5championstatsdto"></a>

25 fields.

| Field                  | Type  | Req. | Description |
| ---------------------- | ----- | ---- | ----------- |
| `abilityHaste`         | `int` |      |             |
| `abilityPower`         | `int` | ✓    |             |
| `armor`                | `int` | ✓    |             |
| `armorPen`             | `int` | ✓    |             |
| `armorPenPercent`      | `int` | ✓    |             |
| `attackDamage`         | `int` | ✓    |             |
| `attackSpeed`          | `int` | ✓    |             |
| `bonusArmorPenPercent` | `int` | ✓    |             |
| `bonusMagicPenPercent` | `int` | ✓    |             |
| `ccReduction`          | `int` | ✓    |             |
| `cooldownReduction`    | `int` | ✓    |             |
| `health`               | `int` | ✓    |             |
| `healthMax`            | `int` | ✓    |             |
| `healthRegen`          | `int` | ✓    |             |
| `lifesteal`            | `int` | ✓    |             |
| `magicPen`             | `int` | ✓    |             |
| `magicPenPercent`      | `int` | ✓    |             |
| `magicResist`          | `int` | ✓    |             |
| `movementSpeed`        | `int` | ✓    |             |
| `omnivamp`             | `int` |      |             |
| `physicalVamp`         | `int` |      |             |
| `power`                | `int` | ✓    |             |
| `powerMax`             | `int` | ✓    |             |
| `powerRegen`           | `int` | ✓    |             |
| `spellVamp`            | `int` | ✓    |             |

### match-v5.DamageStatsDto

<a id="match-v5damagestatsdto"></a>

12 fields.

| Field                           | Type  | Req. | Description |
| ------------------------------- | ----- | ---- | ----------- |
| `magicDamageDone`               | `int` | ✓    |             |
| `magicDamageDoneToChampions`    | `int` | ✓    |             |
| `magicDamageTaken`              | `int` | ✓    |             |
| `physicalDamageDone`            | `int` | ✓    |             |
| `physicalDamageDoneToChampions` | `int` | ✓    |             |
| `physicalDamageTaken`           | `int` | ✓    |             |
| `totalDamageDone`               | `int` | ✓    |             |
| `totalDamageDoneToChampions`    | `int` | ✓    |             |
| `totalDamageTaken`              | `int` | ✓    |             |
| `trueDamageDone`                | `int` | ✓    |             |
| `trueDamageDoneToChampions`     | `int` | ✓    |             |
| `trueDamageTaken`               | `int` | ✓    |             |

### champion-mastery-v4.ChampionMasteryDto

<a id="champion-mastery-v4championmasterydto"></a>

This object contains single Champion Mastery information for player and champion combination.

13 fields.

| Field                          | Type                                                                   | Req. | Description                                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| `puuid`                        | `string`                                                               | ✓    | Player Universal Unique Identifier. Exact length of 78 characters. (Encrypted)                                                    |
| `championPointsUntilNextLevel` | `long`                                                                 | ✓    | Number of points needed to achieve next level. Zero if player reached maximum champion level for this champion.                   |
| `chestGranted`                 | `boolean`                                                              |      | Is chest granted for this champion or not in current season.                                                                      |
| `championId`                   | `long`                                                                 | ✓    | Champion ID for this entry.                                                                                                       |
| `lastPlayTime`                 | `long`                                                                 | ✓    | Last time this champion was played by this player - in Unix milliseconds time format.                                             |
| `championLevel`                | `int`                                                                  | ✓    | Champion level for specified player and champion combination.                                                                     |
| `championPoints`               | `int`                                                                  | ✓    | Total number of champion points for this player and champion combination - they are used to determine championLevel.              |
| `championPointsSinceLastLevel` | `long`                                                                 | ✓    | Number of points earned since current level has been achieved.                                                                    |
| `markRequiredForNextLevel`     | `int`                                                                  | ✓    |                                                                                                                                   |
| `championSeasonMilestone`      | `int`                                                                  | ✓    |                                                                                                                                   |
| `nextSeasonMilestone`          | [NextSeasonMilestonesDto](#champion-mastery-v4nextseasonmilestonesdto) | ✓    |                                                                                                                                   |
| `tokensEarned`                 | `int`                                                                  | ✓    | The token earned for this champion at the current championLevel. When the championLevel is advanced the tokensEarned resets to 0. |
| `milestoneGrades`              | `string`[]                                                             |      |                                                                                                                                   |

### champion-mastery-v4.NextSeasonMilestonesDto

<a id="champion-mastery-v4nextseasonmilestonesdto"></a>

This object contains required next season milestone information.

5 fields.

| Field                | Type                                                   | Req. | Description           |
| -------------------- | ------------------------------------------------------ | ---- | --------------------- |
| `requireGradeCounts` | map&lt;string, `int`&gt;                               | ✓    |                       |
| `rewardMarks`        | `int`                                                  | ✓    | Reward marks.         |
| `bonus`              | `boolean`                                              | ✓    | Bonus.                |
| `rewardConfig`       | [RewardConfigDto](#champion-mastery-v4rewardconfigdto) |      | Reward configuration. |
| `totalGamesRequires` | `int`                                                  | ✓    |                       |

### champion-mastery-v4.RewardConfigDto

<a id="champion-mastery-v4rewardconfigdto"></a>

This object contains required reward config information.

3 fields.

| Field           | Type     | Req. | Description    |
| --------------- | -------- | ---- | -------------- |
| `rewardValue`   | `string` | ✓    | Reward value   |
| `rewardType`    | `string` | ✓    | Reward type    |
| `maximumReward` | `int`    | ✓    | Maximun reward |

### spectator-v5.CurrentGameInfo

<a id="spectator-v5currentgameinfo"></a>

11 fields.

| Field               | Type                                                            | Req. | Description                                                            |
| ------------------- | --------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `gameId`            | `long`                                                          | ✓    | The ID of the game                                                     |
| `gameType`          | `string`                                                        | ✓    | The game type                                                          |
| `gameStartTime`     | `long`                                                          | ✓    | The game start time represented in epoch milliseconds                  |
| `mapId`             | `long`                                                          | ✓    | The ID of the map                                                      |
| `gameLength`        | `long`                                                          | ✓    | The amount of time in seconds that has passed since the game started   |
| `platformId`        | `string`                                                        | ✓    | The ID of the platform on which the game is being played               |
| `gameMode`          | `string`                                                        | ✓    | The game mode                                                          |
| `bannedChampions`   | [BannedChampion](#spectator-v5bannedchampion)[]                 | ✓    | Banned champion information                                            |
| `gameQueueConfigId` | `long`                                                          |      | The queue type (queue types are documented on the Game Constants page) |
| `observers`         | [Observer](#spectator-v5observer)                               | ✓    | The observer information                                               |
| `participants`      | [CurrentGameParticipant](#spectator-v5currentgameparticipant)[] | ✓    | The participant information                                            |

### spectator-v5.BannedChampion

<a id="spectator-v5bannedchampion"></a>

3 fields.

| Field        | Type   | Req. | Description                                   |
| ------------ | ------ | ---- | --------------------------------------------- |
| `pickTurn`   | `int`  | ✓    | The turn during which the champion was banned |
| `championId` | `long` | ✓    | The ID of the banned champion                 |
| `teamId`     | `long` | ✓    | The ID of the team that banned the champion   |

### spectator-v5.Observer

<a id="spectator-v5observer"></a>

1 fields.

| Field           | Type     | Req. | Description                                                   |
| --------------- | -------- | ---- | ------------------------------------------------------------- |
| `encryptionKey` | `string` | ✓    | Key used to decrypt the spectator grid game data for playback |

### spectator-v5.CurrentGameParticipant

<a id="spectator-v5currentgameparticipant"></a>

10 fields.

| Field                      | Type                                                              | Req. | Description                                                              |
| -------------------------- | ----------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `championId`               | `long`                                                            | ✓    | The ID of the champion played by this participant                        |
| `perks`                    | [Perks](#spectator-v5perks)                                       |      | Perks/Runes Reforged Information                                         |
| `profileIconId`            | `long`                                                            | ✓    | The ID of the profile icon used by this participant                      |
| `bot`                      | `boolean`                                                         | ✓    | Flag indicating whether or not this participant is a bot                 |
| `teamId`                   | `long`                                                            | ✓    | The team ID of this participant, indicating the participant's team       |
| `puuid`                    | `string`                                                          |      | The encrypted puuid of this participant. null when the player is anonym. |
| `spell1Id`                 | `long`                                                            | ✓    | The ID of the first summoner spell used by this participant              |
| `spell2Id`                 | `long`                                                            | ✓    | The ID of the second summoner spell used by this participant             |
| `gameCustomizationObjects` | [GameCustomizationObject](#spectator-v5gamecustomizationobject)[] | ✓    | List of Game Customizations                                              |
| `riotId`                   | `string`                                                          |      |                                                                          |

### spectator-v5.Perks

<a id="spectator-v5perks"></a>

3 fields.

| Field          | Type     | Req. | Description                      |
| -------------- | -------- | ---- | -------------------------------- |
| `perkIds`      | `long`[] | ✓    | IDs of the perks/runes assigned. |
| `perkStyle`    | `long`   | ✓    | Primary runes path               |
| `perkSubStyle` | `long`   | ✓    | Secondary runes path             |

### spectator-v5.GameCustomizationObject

<a id="spectator-v5gamecustomizationobject"></a>

2 fields.

| Field      | Type     | Req. | Description                                |
| ---------- | -------- | ---- | ------------------------------------------ |
| `category` | `string` | ✓    | Category identifier for Game Customization |
| `content`  | `string` | ✓    | Game Customization content                 |

## Static data and game constants

The API returns ids, not names or images. Map them with **Data Dragon**, Riot's static data CDN. Data Dragon is versioned by patch: get the list of versions from <https://ddragon.leagueoflegends.com/api/versions.json> (the first entry is the latest, `16.20.1` when this was written).

| Data                                                           | URL                                                                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Champions (`championId` matches the `key` field, not the `id`) | `https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/champion.json`                 |
| Items                                                          | `https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/item.json`                     |
| Runes (`perks`)                                                | `https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/runesReforged.json`            |
| Summoner spells (`summoner1Id`/`summoner2Id` match `key`)      | `https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/summoner.json`                 |
| Champion square icon                                           | `https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{championName}.png`          |
| Item icon                                                      | `https://ddragon.leagueoflegends.com/cdn/{version}/img/item/{itemId}.png`                    |
| Profile icon                                                   | `https://ddragon.leagueoflegends.com/cdn/{version}/img/profileicon/{profileIconId}.png`      |
| Rune icons                                                     | `https://ddragon.leagueoflegends.com/cdn/img/{icon}` (`icon` path from `runesReforged.json`) |

Other constants: [queues.json](https://static.developer.riotgames.com/docs/lol/queues.json), [maps.json](https://static.developer.riotgames.com/docs/lol/maps.json), [gameModes.json](https://static.developer.riotgames.com/docs/lol/gameModes.json), [gameTypes.json](https://static.developer.riotgames.com/docs/lol/gameTypes.json), [seasons.json](https://static.developer.riotgames.com/docs/lol/seasons.json).

Ranked values in `LeagueEntryDTO`:

- `queueType`: `RANKED_SOLO_5x5`, `RANKED_FLEX_SR`
- `tier`: `IRON`, `BRONZE`, `SILVER`, `GOLD`, `PLATINUM`, `EMERALD`, `DIAMOND`, `MASTER`, `GRANDMASTER`, `CHALLENGER`
- `rank`: `I` to `IV` (always `I` for Master and above)

### Queue IDs

From Riot's [queues.json](https://static.developer.riotgames.com/docs/lol/queues.json) (`info.queueId`, and the `queue` filter on the match id list). Queues marked deprecated by Riot are left out.

| queueId | Map               | Description                              |
| ------- | ----------------- | ---------------------------------------- |
| 0       | Custom games      | —                                        |
| 72      | Howling Abyss     | 1v1 Snowdown Showdown games              |
| 73      | Howling Abyss     | 2v2 Snowdown Showdown games              |
| 75      | Summoner's Rift   | 6v6 Hexakill games                       |
| 76      | Summoner's Rift   | Ultra Rapid Fire games                   |
| 78      | Howling Abyss     | One For All: Mirror Mode games           |
| 83      | Summoner's Rift   | Co-op vs AI Ultra Rapid Fire games       |
| 98      | Twisted Treeline  | 6v6 Hexakill games                       |
| 100     | Butcher's Bridge  | 5v5 ARAM games                           |
| 310     | Summoner's Rift   | Nemesis games                            |
| 313     | Summoner's Rift   | Black Market Brawlers games              |
| 317     | Crystal Scar      | Definitely Not Dominion games            |
| 325     | Summoner's Rift   | All Random games                         |
| 400     | Summoner's Rift   | 5v5 Draft Pick games                     |
| 420     | Summoner's Rift   | 5v5 Ranked Solo games                    |
| 430     | Summoner's Rift   | 5v5 Blind Pick games                     |
| 440     | Summoner's Rift   | 5v5 Ranked Flex games                    |
| 450     | Howling Abyss     | 5v5 ARAM games                           |
| 480     | Summoner's Rift   | Swiftplay Games                          |
| 490     | Summoner's Rift   | Normal (Quickplay)                       |
| 600     | Summoner's Rift   | Blood Hunt Assassin games                |
| 610     | Cosmic Ruins      | Dark Star: Singularity games             |
| 700     | Summoner's Rift   | Summoner's Rift Clash games              |
| 720     | Howling Abyss     | ARAM Clash games                         |
| 820     | Twisted Treeline  | Co-op vs. AI Beginner Bot games          |
| 870     | Summoner's Rift   | Co-op vs. AI Intro Bot games             |
| 880     | Summoner's Rift   | Co-op vs. AI Beginner Bot games          |
| 890     | Summoner's Rift   | Co-op vs. AI Intermediate Bot games      |
| 900     | Summoner's Rift   | ARURF games                              |
| 910     | Crystal Scar      | Ascension games                          |
| 920     | Howling Abyss     | Legend of the Poro King games            |
| 940     | Summoner's Rift   | Nexus Siege games                        |
| 950     | Summoner's Rift   | Doom Bots Voting games                   |
| 960     | Summoner's Rift   | Doom Bots Standard games                 |
| 980     | Valoran City Park | Star Guardian Invasion: Normal games     |
| 990     | Valoran City Park | Star Guardian Invasion: Onslaught games  |
| 1000    | Overcharge        | PROJECT: Hunters games                   |
| 1010    | Summoner's Rift   | Snow ARURF games                         |
| 1020    | Summoner's Rift   | One for All games                        |
| 1030    | Crash Site        | Odyssey Extraction: Intro games          |
| 1040    | Crash Site        | Odyssey Extraction: Cadet games          |
| 1050    | Crash Site        | Odyssey Extraction: Crewmember games     |
| 1060    | Crash Site        | Odyssey Extraction: Captain games        |
| 1070    | Crash Site        | Odyssey Extraction: Onslaught games      |
| 1090    | Convergence       | Teamfight Tactics games                  |
| 1100    | Convergence       | Ranked Teamfight Tactics games           |
| 1110    | Convergence       | Teamfight Tactics Tutorial games         |
| 1111    | Convergence       | Teamfight Tactics test games             |
| 1210    | Convergence       | Teamfight Tactics Choncc's Treasure Mode |
| 1300    | Nexus Blitz       | Nexus Blitz games                        |
| 1400    | Summoner's Rift   | Ultimate Spellbook games                 |
| 1700    | Rings of Wrath    | Arena                                    |
| 1710    | Rings of Wrath    | Arena                                    |
| 1810    | Swarm             | Swarm Mode Games                         |
| 1820    | Swarm Mode Games  | Swarm                                    |
| 1830    | Swarm Mode Games  | Swarm                                    |
| 1840    | Swarm Mode Games  | Swarm                                    |
| 1900    | Summoner's Rift   | Pick URF games                           |
| 2000    | Summoner's Rift   | Tutorial 1                               |
| 2010    | Summoner's Rift   | Tutorial 2                               |
| 2020    | Summoner's Rift   | Tutorial 3                               |
| 2300    | The Bandlewood    | Brawl                                    |
| 2400    | Howling Abyss     | ARAM: Mayhem                             |
