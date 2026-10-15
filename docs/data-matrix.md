# Data matrix: spec vs. Riot API

What each screen in the [spec](spec.md) needs, and where it comes from in the [Riot API](riot-api-player-history.md).

**Availability:**

- **Direct:** a field returns it as is.
- **Computed:** we calculate it from API fields.
- **Static:** a lookup in Data Dragon or Riot's static files, not the API itself.
- **Missing:** the API doesn't provide it.

`p` is the searched player's entry in a game (`info.participants[]` where `puuid` matches). `q` is any participant of a game.

## Which games each screen uses

| Screen                           | Games                           | API call                                                       |
| -------------------------------- | ------------------------------- | -------------------------------------------------------------- |
| Profile, "20 parties · 30 jours" | last 20 ranked games in 30 days | match-v5 `ids?type=ranked&startTime={now − 30 days}&count=20`  |
| Profile, "30 parties · 60 jours" | last 30 ranked games in 60 days | match-v5 `ids?type=ranked&startTime={now − 60 days}&count=30`  |
| Profile, "30 parties · 90 jours" | last 30 ranked games in 90 days | match-v5 `ids?type=ranked&startTime={now − 90 days}&count=30`  |
| History                          | every game type, 20 per page    | match-v5 `ids?start={n}&count=20`                              |
| Game detail                      | one game                        | match-v5 `matches/{matchId}` (usually cached from the history) |

`type=ranked` returns Solo/Duo (`420`) and Flex (`440`). Then one `matches/{matchId}` call per game not cached yet. The profile also drops remakes: `p.gameEndedInEarlySurrender`.

## Profile: header

| Info                                                        | Spec   | Source                    | Field(s)                                                                                                 | Availability      |
| ----------------------------------------------------------- | ------ | ------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------- |
| Riot ID                                                     | H1     | account-v1                | `gameName`, `tagLine`                                                                                    | Direct            |
| Profile icon (desktop, and mobile fallback)                 | H1     | summoner-v4 + Data Dragon | `profileIconId` → `img/profileicon/{id}.png`                                                             | Direct + Static   |
| Level                                                       | H1     | summoner-v4               | `summonerLevel`                                                                                          | Direct            |
| Main role, all tied roles on a tie                          | H2, H6 | match-v5                  | most frequent `p.teamPosition` over the period                                                           | Computed          |
| Rank, LP, season W/L                                        | H3     | league-v4                 | `queueType`, `tier`, `rank`, `leaguePoints`, `wins`, `losses`                                            | Direct            |
| Banner art                                                  | H4     | Data Dragon               | `img/champion/splash/{id}_0.jpg` of the most played champion                                             | Static            |
| Mobile picture: most played champion, alphabetical on a tie | H5     | match-v5 + Data Dragon    | most frequent `p.championId`; tie broken on the `name` in `champion.json`; image `img/champion/{id}.png` | Computed + Static |

## Profile: stats and game lists

| Info                                        | Spec   | Source                 | Field(s)                                                                  | Availability      |
| ------------------------------------------- | ------ | ---------------------- | ------------------------------------------------------------------------- | ----------------- |
| Games counted                               | P2, O1 | match-v5               | games returned for the preset, minus remakes                              | Computed          |
| Win rate                                    | O1     | match-v5               | `p.win`                                                                   | Computed          |
| Average KDA                                 | O1     | match-v5               | `p.kills`, `p.deaths`, `p.assists`                                        | Computed          |
| CS/min                                      | O2     | match-v5               | `(p.totalMinionsKilled + p.neutralMinionsKilled) / (p.timePlayed / 60)`   | Computed          |
| Gold/min, damage/min, vision/min            | O2     | match-v5               | `p.challenges.goldPerMinute`, `.damagePerMinute`, `.visionScorePerMinute` | Direct            |
| Kill participation, team damage share       | O2     | match-v5               | `p.challenges.killParticipation`, `.teamDamagePercentage`                 | Direct            |
| Favorite champions (games, win rate, KDA)   | O3     | match-v5 + Data Dragon | group by `p.championId`; names and icons from `champion.json`             | Computed + Static |
| Desktop: last ranked games, wins and losses | O6     | match-v5               | the period's games, newest first by `info.gameCreation`                   | Direct            |
| Mobile: last ranked defeats only            | O7     | match-v5               | the period's games where `p.win` is false                                 | Computed          |

## History

| Info            | Spec   | Source                   | Field(s)                                            | Availability    |
| --------------- | ------ | ------------------------ | --------------------------------------------------- | --------------- |
| Result          | L1     | match-v5                 | `p.win`                                             | Direct          |
| Champion        | L1     | match-v5 + Data Dragon   | `p.championId` → `champion.json`                    | Direct + Static |
| Queue (mode)    | L1, L3 | match-v5 + `queues.json` | `info.queueId`                                      | Direct + Static |
| Role            | L1, L3 | match-v5                 | `p.teamPosition` (empty in ARAM and Arena: "Aucun") | Direct          |
| K/D/A           | L1     | match-v5                 | `p.kills`, `p.deaths`, `p.assists`                  | Direct          |
| Date            | L1     | match-v5                 | `info.gameCreation` (epoch ms)                      | Direct          |
| "Afficher plus" | L4     | match-v5                 | next page: `ids?start={n}&count=20`                 | Direct          |
| Remake flag     | L5     | match-v5                 | `p.gameEndedInEarlySurrender`                       | Direct          |

## Game detail

| Info                                   | Spec     | Source                   | Field(s)                                                                                                                                        | Availability    |
| -------------------------------------- | -------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Both rosters                           | D1       | match-v5                 | `info.participants[]` grouped by `q.teamId` (`100` and `200`)                                                                                   | Direct          |
| Player name                            | D2       | match-v5                 | `q.riotIdGameName`, `q.riotIdTagline`                                                                                                           | Direct          |
| Champion portrait and name             | D2       | match-v5 + Data Dragon   | `q.championId` → `champion.json`                                                                                                                | Direct + Static |
| Role                                   | D2       | match-v5                 | `q.teamPosition` (empty: "Aucun")                                                                                                               | Direct          |
| Score                                  | D2       | match-v5                 | `q.kills`, `q.deaths`, `q.assists`                                                                                                              | Direct          |
| Team score                             | D3       | match-v5                 | sums of `kills`, `deaths`, `assists` per `teamId`                                                                                               | Computed        |
| Winning team                           | D4       | match-v5                 | `info.teams[].win` (or `q.win`)                                                                                                                 | Direct          |
| Link to a player's profile             | D5       | match-v5                 | `q.riotIdGameName` + `q.riotIdTagline`, server from `info.platformId` (`EUW1` → `euw1`)                                                         | Direct          |
| Highlight the reviewed player          | D6       | match-v5                 | `q.puuid` equals the searched PUUID                                                                                                             | Computed        |
| Summary: queue, date, duration         | D7       | match-v5 + `queues.json` | `info.queueId`, `info.gameCreation`, `info.gameDuration` (seconds)                                                                              | Direct + Static |
| Arena teams                            | D8       | match-v5                 | `q.playerSubteamId`, ranked by `q.subteamPlacement`                                                                                             | Direct          |
| CS, gold, damage, items, runes, spells | D9       | match-v5 + Data Dragon   | `totalMinionsKilled + neutralMinionsKilled`, `goldEarned`, `totalDamageDealtToChampions`, `item0`–`item6`, `perks`, `summoner1Id`/`summoner2Id` | Direct + Static |
| Team objectives                        | D10      | match-v5                 | `info.teams[].objectives` (`dragon`, `baron`, `riftHerald`, `tower`, `inhibitor`, `horde`, `atakhan`, `champion`)                               | Direct          |
| Lane opponent, timeline                | D11, D12 | match-v5 + timeline      | same `teamPosition` on the other `teamId`; `frames[].participantFrames`, `frames[].events`                                                      | Computed        |

## Gaps and caveats

- **No batch endpoint.** Every game is one `matches/{matchId}` call. A profile costs about 24 calls with 20 games, 34 with 30; a history page about 21. Cache finished games permanently.
- **`riotIdGameName` and `riotIdTagline` are optional in the schema.** For older games they can be missing. To still link that player to their profile, look up their Riot ID from `q.puuid` with account-v1 `by-puuid` (1 call per missing name), or show the name without a link.
- **Linking to another server:** the profile link uses the game's server (`info.platformId`). A player who has since transferred servers may not be found there.
- **No lane opponent in ARAM and Arena:** `teamPosition` is empty there. Arena players are paired into subteams (`playerSubteamId`), so the game detail shows more than two rosters.
- **`challenges` is optional:** fall back to computing from the base fields (KDA, CS/min, KP from team kills) when it's missing.
- **Missing: rank and role benchmarks** (Q5) and **LP gained or lost per game.** Neither is in the API.
- **Timeline event names** (such as `CHAMPION_KILL`) aren't listed in the API reference. Confirm them on a real timeline before building D12.
