# Spec: player review for coaches (v1)

Status: draft, updated 2026-10-15. Open questions are listed at the end.

## Goal

A coach enters a player's Riot ID and reviews that player's games:

1. **Profile:** how the player performs in **ranked** games over their last 20 or 30 games (within 30, 60 or 90 days).
2. **History:** every recent game, ranked or not, with filters.
3. **Game detail:** both teams of a single game, so the coach can see who played what and how it went, then jump to any other player's profile.

The product is called **Rift Review** in the mockups. The mockups' UI text is in French.

## Users

- **Coach (primary):** reviews one player at a time, often before or during a coaching session. Needs to spot trends quickly, then open the specific games worth talking about.
- **Player (secondary):** can look up their own Riot ID and see the same pages.

v1 has no accounts: anyone with the URL can look up any player (see open question Q1).

## Mockups

At the repo root. They show fictional data and are design directions, not pixel-perfect targets.

| File                        | Screen                                      |
| --------------------------- | ------------------------------------------- |
| `01-profil-joueur.png`      | Profile, desktop                            |
| `02-historique-parties.png` | History ("Historique des parties"), desktop |
| `03-version-mobile.png`     | Profile on mobile                           |

There is no mockup for the game detail page yet.

## Screens and flow

1. The coach types `GameName#TAG` in the search bar (always visible in the header) and picks the server (default EUW).
2. The app opens the **profile** of that player: ranked games only, "20 parties · 30 jours" period by default.
3. From the profile, the coach opens the **history** ("Historique" in the header, or "Voir plus"), which shows every type of game.
4. Clicking a game in the history opens the **game detail**: both teams.
5. Clicking a player or a champion in the game detail opens **that player's profile**, and the coach can carry on from there.
6. Every page has a shareable URL, so a coach can send a link to a specific player or game.

Suggested routes:

| Route                                                        | Page                                           |
| ------------------------------------------------------------ | ---------------------------------------------- |
| `/`                                                          | Home with search                               |
| `/players/{platform}/{gameName}-{tagLine}`                   | Profile                                        |
| `/players/{platform}/{gameName}-{tagLine}/history`           | History                                        |
| `/players/{platform}/{gameName}-{tagLine}/history/{matchId}` | Game detail, opened from that player's history |

## Requirements

Priority: **Must** is required for v1, **Should** is wanted for v1 but can slip, **Could** is later.

### Search

| ID  | Requirement                                                                          | Priority |
| --- | ------------------------------------------------------------------------------------ | -------- |
| S1  | Search by Riot ID (`GameName#TAG`) and server. Accept names with spaces and accents. | Must     |
| S2  | Clear error when the Riot ID doesn't exist on that server.                           | Must     |
| S3  | Remember the last searched players on this device.                                   | Could    |

### Profile

**The profile only counts ranked games:** Ranked Solo/Duo (queue `420`) and Ranked Flex (queue `440`). Normal games, ARAM and other modes are never part of the profile's figures or lists. Remakes are excluded too.

#### Period

A dropdown on the profile ("Récent" in the mockups) picks which ranked games every figure on the profile is computed from. It offers three fixed presets:

| Option                              | Games counted                                        |
| ----------------------------------- | ---------------------------------------------------- |
| **20 parties · 30 jours** (default) | The last 20 ranked games played in the last 30 days. |
| **30 parties · 60 jours**           | The last 30 ranked games played in the last 60 days. |
| **30 parties · 90 jours**           | The last 30 ranked games played in the last 90 days. |

When the player played fewer games than the preset asks for in that window, all of them count, however few.

| ID  | Requirement                                                                                                              | Priority |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| P1  | Period dropdown with the three presets. Changing it recomputes every figure on the profile.                              | Must     |
| P2  | The number of games counted is always shown ("Parties" in the mockups), so a period with only 3 games is obvious.        | Must     |
| P3  | Empty state when the player has no ranked game in the period: say so, and link to the history (which shows other modes). | Must     |

#### Header

| ID  | Requirement                                                                                                                                                                                                                                                                                              | Priority |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| H1  | Riot ID, profile icon and summoner level.                                                                                                                                                                                                                                                                | Must     |
| H2  | Main role over the period (the most played `teamPosition`). The mockups show "Support".                                                                                                                                                                                                                  | Must     |
| H3  | Ranked standing: tier, division, LP and season wins/losses for Solo/Duo and Flex.                                                                                                                                                                                                                        | Should   |
| H4  | Banner art of the most played champion, as in the mockups.                                                                                                                                                                                                                                               | Could    |
| H5  | **Mobile:** the round picture next to the name shows the **most played champion** of the period (instead of the profile icon). On a tie, the champion whose name comes first alphabetically wins (display name from Data Dragon, ignoring case and accents). Example: Nami 4 games, Lulu 4 games → Lulu. | Must     |
| H6  | **Mobile:** the role under the name is the **most played role** of the period. On a tie, all the tied roles are shown. Example: Support 4 games, Jungle 4 games → "Support · Jungle".                                                                                                                    | Must     |

With no ranked game in the period (P3), the mobile header falls back to the profile icon and shows no role.

#### Stats

| ID  | Requirement                                                                                                                                                                            | Priority |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| O1  | Headline stats: win rate ("Victoires"), average KDA (`(kills + assists) / max(deaths, 1)`), and the number of games (P2).                                                              | Must     |
| O2  | Average performance: kills/deaths/assists per game, CS per minute, gold per minute, damage to champions per minute, kill participation, vision score per minute, share of team damage. | Should   |
| O3  | Favorite champions ("Champions favoris"): the top 3 by games played over the period, each with games, win rate and KDA.                                                                | Must     |
| O4  | A breakdown by champion and by role: games, win rate, KDA, CS/min.                                                                                                                     | Could    |
| O5  | Trend over the period, oldest to newest, for a chosen stat (for example KDA or CS/min), with wins and losses marked.                                                                   | Could    |

#### Game lists on the profile

| ID  | Requirement                                                                                                                                                                               | Priority |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| O6  | **Desktop:** recent games ("Dernières parties"): the last 3 to 5 ranked games of the period, wins and losses, with a link to the history ("Voir plus").                                   | Must     |
| O7  | **Mobile:** the game list ("À revoir") shows **only defeats**: the last 3 to 5 ranked losses of the period, with "Détails" on each and a link to the full history ("Toutes les parties"). | Must     |
| O8  | Each game in these lists opens its game detail.                                                                                                                                           | Must     |

### History

**The history shows every type of game**, ranked or not: ranked, normal, ARAM, Arena and so on.

| ID  | Requirement                                                                                    | Priority |
| --- | ---------------------------------------------------------------------------------------------- | -------- |
| L1  | One row per game, newest first: result (Victoire/Défaite), champion, queue, role, K/D/A, date. | Must     |
| L2  | Clicking a row opens the game detail.                                                          | Must     |
| L3  | Filters: mode (queue), role, result.                                                           | Must     |
| L4  | The last 20 games, and "Afficher plus" loads 20 more (Q7).                                     | Must     |
| L5  | Remakes are shown but marked as such.                                                          | Should   |
| L6  | Extra columns: game duration, CS, KP.                                                          | Could    |

### Game detail

Opened from the history (or from a game list on the profile). It shows the whole game, not only the player being reviewed.

| ID  | Requirement                                                                                                                                       | Priority |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| D1  | **Both rosters:** the two teams side by side (stacked on mobile), 5 players each.                                                                 | Must     |
| D2  | For each player: their name (Riot ID), their champion (portrait and name), their role, and their score (K/D/A).                                   | Must     |
| D3  | **Overall score per team:** total kills / deaths / assists of the team.                                                                           | Must     |
| D4  | **The winning team is highlighted**, and each team is labelled "Victoire" or "Défaite" (color isn't the only signal, see U2).                     | Must     |
| D5  | **Clicking a player's name or champion opens that player's profile.**                                                                             | Must     |
| D6  | The player whose history the game was opened from is highlighted in their roster.                                                                 | Should   |
| D7  | Game summary above the rosters: queue, date, duration.                                                                                            | Should   |
| D8  | Arena games (teams of 2) show their teams in the same way, with as many rosters as there are teams. ARAM has no roles, so the role shows "Aucun". | Should   |
| D9  | Per player: CS, gold, damage to champions, items, runes and summoner spells.                                                                      | Could    |
| D10 | Team objectives: dragons, barons, heralds, towers, first blood.                                                                                   | Could    |
| D11 | The reviewed player compared with their lane opponent, and with their own average on the profile period.                                          | Could    |
| D12 | Timeline: gold and CS gap with the lane opponent over time, and key events (kills, deaths, objectives, item purchases).                           | Could    |
| D13 | Previous / next game navigation within the history.                                                                                               | Could    |

### Layout and accessibility

| ID  | Requirement                                                                                                               | Priority |
| --- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| U1  | Desktop and mobile layouts, following the mockups. The profile game list differs between them (O6 and O7).                | Must     |
| U2  | Win/loss isn't conveyed by color alone (the word "Victoire" or "Défaite" is always shown).                                | Must     |
| U3  | Loading state while games are fetched, and a clear message if Riot's API is unavailable or rate-limiting.                 | Must     |
| U4  | Player names and champions in the game detail are real links (keyboard-focusable, open in a new tab with a middle click). | Must     |

## Data

See [riot-api-player-history.md](riot-api-player-history.md) for the endpoints and every field, and [data-matrix.md](data-matrix.md) for where each displayed value comes from.

| Need                         | Endpoint                                                                                                       | Calls              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------ |
| Riot ID → PUUID              | account-v1 `by-riot-id`                                                                                        | 1                  |
| Profile header               | summoner-v4 `by-puuid`, league-v4 `entries/by-puuid`                                                           | 2                  |
| Profile                      | match-v5 `ids?type=ranked&startTime={now − 30, 60 or 90 days}&count={20 or 30}`, then each game                | 1 + up to 30       |
| History                      | match-v5 `ids?start={n}&count=20` (no queue filter), then each game                                            | 1 + 20 per page    |
| Game detail                  | match-v5 `matches/{matchId}`, usually already cached from the history                                          | 0 or 1             |
| Profile from the game detail | the Riot ID is in the game (`riotIdGameName`, `riotIdTagline`), and the server is the game's `info.platformId` | as for any profile |

`type=ranked` returns Solo/Duo and Flex games. `startTime` is in epoch seconds.

Definitions:

- **Player's entry in a game:** the participant whose `puuid` matches.
- **Remake:** `gameEndedInEarlySurrender` is true.
- **Team score:** the sum of `kills`, `deaths` and `assists` of the team's participants (`teamId`).
- **Winning team:** `info.teams[].win`.
- **CS:** `totalMinionsKilled + neutralMinionsKilled`.
- **Per minute:** divided by `timePlayed / 60`.
- **Kill participation:** `challenges.killParticipation`, or `(kills + assists) / team kills`.

## Technical constraints

- **The API key stays on the server.** The browser only calls our own Nuxt server routes (`server/api/...`), which call Riot.
- **Rate limits:** a development key allows 100 requests per 2 minutes. Each game is one call (Riot has no endpoint returning several games at once), so a profile costs about 24 calls with 20 games and 34 with 30, and a history page about 21. So:
  - cache games permanently (a finished game never changes);
  - cache account, profile and ranked data briefly (a few minutes);
  - fetch game details with limited concurrency and retry on `429` after `Retry-After`.
- Switching presets reuses the cached games: going from 20 to 30 games only fetches the games not cached yet.
- A production key is needed before real coaches use the app (development keys expire every 24 hours).
- Static data (champion, item, rune and spell names and icons) comes from Data Dragon.
- The Riot legal disclaimer stays in the footer.

## Out of scope for v1

- Accounts, login, and saved lists of players (the mockups show a user icon; see Q1).
- Coach notes or annotations on games.
- Comparing several players side by side.
- Custom date ranges or game counts (only the three presets).
- Live game view.
- Teamfight Tactics and other Riot games.

## Decisions

| Date       | Decision                                                                                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-15 | The profile counts ranked games only (Solo/Duo and Flex). The history shows every type of game.                                                                                                                              |
| 2026-10-15 | Profile periods are three presets: 20 games / 30 days (default), 30 games / 60 days, 30 games / 90 days. They replace an earlier "Récent / Global" choice: "Global" (all ranked games, all time) cost one API call per game. |
| 2026-10-15 | On mobile, the profile's game list shows only defeats.                                                                                                                                                                       |
| 2026-10-15 | The game detail shows both rosters with name, champion, role and K/D/A per player, team totals, and the winner highlighted. Players link to their profile.                                                                   |
| 2026-10-15 | Mobile profile header: the picture is the most played champion (tie: alphabetical), the role is the most played role (tie: all tied roles shown).                                                                            |

## Open questions

| #   | Question                                                                                                                                                        | Default if nobody decides                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Q1  | Do coaches need accounts (to save their players, write notes)? The mockups show a user icon.                                                                    | No accounts in v1.                                                               |
| Q4  | UI language: French only, or French and English?                                                                                                                | French only, text kept in one place to make translation easy later.              |
| Q5  | Should the game detail compare against benchmarks for the player's rank and role (for example average CS/min in Gold support)? Riot's API doesn't provide them. | No.                                                                              |
| Q6  | Which servers to support at launch?                                                                                                                             | All of them, EUW selected by default.                                            |
| Q7  | How many games does the history load at first, and is there a limit to "Afficher plus"?                                                                         | 20 at first, 20 more per click, no limit.                                        |
| Q9  | Should the period count Solo/Duo and Flex together, or let the coach pick one?                                                                                  | Together.                                                                        |
| Q10 | Should the desktop header follow the same rules as mobile (H5, H6): most played champion as the picture, and tied roles shown together?                         | Desktop keeps the profile icon; the role tie rule from H6 applies to H2 as well. |
