# Data matrix: spec vs. Riot API

What each screen in the [spec](spec.md) needs, and where it comes from in the [Riot API](riot-api-player-history.md).

**Availability:**

- **Direct:** a field returns it as is.
- **Computed:** we calculate it from API fields.
- **Static:** a lookup in Data Dragon or Riot's static files, not the API itself.
- **Missing:** the API doesn't provide it.

`p` is the player's entry in a match (`info.participants[]` where `puuid` matches). `opp` is the lane opponent: the participant on the other `teamId` with the same `teamPosition`.

## Player header

| Info | Spec | Source | Field(s) | Availability |
|---|---|---|---|---|
| Riot ID | H1 | account-v1 | `gameName`, `tagLine` | Direct |
| Profile icon | H1 | summoner-v4 + Data Dragon | `profileIconId` → `img/profileicon/{id}.png` | Direct + Static |
| Level | H1 | summoner-v4 | `summonerLevel` | Direct |
| Main role | H2 | match-v5 | most frequent `p.teamPosition` over 20 games | Computed |
| Rank, LP, season W/L | H3 | league-v4 | `queueType`, `tier`, `rank`, `leaguePoints`, `wins`, `losses` | Direct |
| Banner art | H4 | Data Dragon | `img/champion/splash/{championName}_0.jpg` of the most played champion | Static |

## Overall review (20 matches)

| Info | Spec | Source | Field(s) | Availability |
|---|---|---|---|---|
| Win rate | O1 | match-v5 | `p.win` | Computed |
| Average KDA | O1 | match-v5 | `p.kills`, `p.deaths`, `p.assists` (or `p.challenges.kda` per game) | Computed |
| Games counted | O1 | match-v5 | exclude `p.gameEndedInEarlySurrender` | Computed |
| CS/min | O2 | match-v5 | `(p.totalMinionsKilled + p.neutralMinionsKilled) / (p.timePlayed / 60)` | Computed |
| Gold/min | O2 | match-v5 | `p.challenges.goldPerMinute` | Direct |
| Damage/min | O2 | match-v5 | `p.challenges.damagePerMinute` | Direct |
| Kill participation | O2 | match-v5 | `p.challenges.killParticipation` | Direct |
| Vision/min | O2 | match-v5 | `p.challenges.visionScorePerMinute` | Direct |
| Team damage share | O2 | match-v5 | `p.challenges.teamDamagePercentage` | Direct |
| Favorite champions | O3 | match-v5 + Data Dragon | group by `p.championId`; names and icons from `champion.json` | Computed + Static |
| By champion / by role | O4 | match-v5 | group by `p.championId` / `p.teamPosition` | Computed |
| Trend over 20 games | O5 | match-v5 | per-game values, ordered by `info.gameCreation` | Computed |
| Queue filter | O7 | match-v5 | `queue` parameter on the match id list; labels from `queues.json` | Direct + Static |
| "To review" games | O8 | match-v5 | our own rule (Q3), applied to per-game stats | Computed |

## Match list

| Info | Spec | Source | Field(s) | Availability |
|---|---|---|---|---|
| Result | L1 | match-v5 | `p.win` | Direct |
| Champion | L1 | match-v5 + Data Dragon | `p.championName`, `p.championId` | Direct + Static |
| Queue | L1, L2 | match-v5 + `queues.json` | `info.queueId` | Direct + Static |
| Role | L1, L2 | match-v5 | `p.teamPosition` (empty in ARAM, shown as "Aucun" in the mockup) | Direct |
| K/D/A | L1 | match-v5 | `p.kills`, `p.deaths`, `p.assists` | Direct |
| Date | L1 | match-v5 | `info.gameCreation` (epoch ms) | Direct |
| Remake flag | L5 | match-v5 | `p.gameEndedInEarlySurrender` | Direct |
| Duration, CS, KP | L6 | match-v5 | `info.gameDuration` (seconds), CS as above, `p.challenges.killParticipation` | Direct / Computed |

## Match detail

| Info | Spec | Source | Field(s) | Availability |
|---|---|---|---|---|
| Result, champion, role, queue, date | D1 | match-v5 | as in the match list | Direct |
| Duration | D1 | match-v5 | `info.gameDuration` (seconds since patch 11.20) | Direct |
| Patch | D1 | match-v5 | first two parts of `info.gameVersion` | Computed |
| K/D/A, KDA | D2 | match-v5 | `p.kills`, `p.deaths`, `p.assists`, `p.challenges.kda` | Direct |
| CS, CS/min | D2 | match-v5 | as above | Computed |
| Gold | D2 | match-v5 | `p.goldEarned` | Direct |
| Damage, damage share | D2 | match-v5 | `p.totalDamageDealtToChampions`, `p.challenges.teamDamagePercentage` | Direct |
| Kill participation | D2 | match-v5 | `p.challenges.killParticipation` | Direct |
| Vision, wards | D2 | match-v5 | `p.visionScore`, `p.wardsPlaced`, `p.wardsKilled`, `p.visionWardsBoughtInGame` | Direct |
| Items | D3 | match-v5 + Data Dragon | `p.item0`…`p.item6` (`0` = empty) → `item.json` | Direct + Static |
| Runes | D3 | match-v5 + Data Dragon | `p.perks.styles[].style`, `.selections[].perk`, `p.perks.statPerks` → `runesReforged.json` | Direct + Static |
| Summoner spells | D3 | match-v5 + Data Dragon | `p.summoner1Id`, `p.summoner2Id` → `summoner.json` | Direct + Static |
| Lane opponent comparison | D4 | match-v5 | the D2 fields on `opp` | Computed |
| Vs. the player's 20-game average | D5 | match-v5 | D2 values vs. the O2 averages | Computed |
| Scoreboard | D6 | match-v5 | all 10 `info.participants[]`; names from `riotIdGameName`, `riotIdTagline` | Direct |
| Team objectives | D7 | match-v5 | `info.teams[].objectives`: `dragon`, `baron`, `riftHerald`, `tower`, `inhibitor`, `horde`, `atakhan`, `champion` (each with `kills` and `first`) | Direct |
| First blood | D7 | match-v5 | `objectives.champion.first`, or `p.firstBloodKill` | Direct |
| Gold / CS gap over time | D8 | match-v5 timeline | `frames[].participantFrames[id].totalGold`, `minionsKilled + jungleMinionsKilled`, one frame per minute (`frameInterval`) | Computed |
| Gap at 10 and 15 min | D8 | match-v5 timeline | frames 10 and 15 | Computed |
| Key events | D9 | match-v5 timeline | `frames[].events[]`: `type`, `killerId`, `victimId`, `itemId`, `timestamp` | Direct |

## Gaps and caveats

- **Missing: rank and role benchmarks** (Q5), such as the average CS/min for Gold supports. The API doesn't provide them. We would have to build them by collecting many matches ourselves, so v1 compares only with the lane opponent and the player's own average.
- **Missing: LP gained or lost per match.** league-v4 only gives the current LP and season totals, not a history.
- **No lane opponent in ARAM and Arena.** `teamPosition` is empty there, so D4 and D8 only work on Summoner's Rift. In Arena, players are paired into subteams (`playerSubteamId`), so the 5v5 scoreboard doesn't fit.
- **Old matches:** `info.gameDuration` was in milliseconds before patch 11.20. That only matters if we ever go further back than 20 games.
- **`challenges` is optional:** the schema doesn't guarantee it in every match or queue. Fall back to computing from the base fields (KDA, CS/min, KP from team kills) when it's missing.
- **Timeline event names** (such as `CHAMPION_KILL`, `ITEM_PURCHASED`, `ELITE_MONSTER_KILL`) aren't listed in the API reference. Confirm them on a real timeline before building D9.
- **Cost:** O1 to O8 and the match list need the 20 match details (about 24 calls per player). D8 and D9 add 1 timeline call per match opened.
