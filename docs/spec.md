# Spec: player review for coaches (v1)

Status: draft, 2026-10-15. Open questions are listed at the end.

## Goal

A coach enters a player's Riot ID and gets a review of that player's **last 20 matches**:

1. **Overall:** how the player is performing across those 20 games, and on which champions and roles.
2. **Per match:** a detailed breakdown of any single game so the coach can discuss it with the player.

The product is called **Rift Review** in the mockups. The mockups' UI text is in French.

## Users

- **Coach (primary):** reviews one player at a time, often before or during a coaching session. Needs to spot trends quickly, then open the specific games worth talking about.
- **Player (secondary):** can look up their own Riot ID and see the same pages.

v1 has no accounts: anyone with the URL can look up any player (see open question Q1).

## Mockups

At the repo root. They show fictional data and are design directions, not pixel-perfect targets.

| File                        | Screen                                                |
| --------------------------- | ----------------------------------------------------- |
| `01-profil-joueur.png`      | Player page, "Vue d'ensemble" (overview) tab, desktop |
| `02-historique-parties.png` | Match history ("Historique des parties"), desktop     |
| `03-version-mobile.png`     | Player page on mobile                                 |

There is no mockup for the match detail page yet.

## User flow

1. The coach types `GameName#TAG` in the search bar (always visible in the header) and picks the server (default EUW).
2. The app opens the **player page** for that player, on the overview tab.
3. From the overview, the coach opens the **match list** ("Parties" tab or "Voir plus"), filters it, and opens a **match detail** page.
4. Every page has a shareable URL, so a coach can send a link to a specific player or match.

Suggested routes:

| Route                                                        | Page                         |
| ------------------------------------------------------------ | ---------------------------- |
| `/`                                                          | Home with search             |
| `/players/{platform}/{gameName}-{tagLine}`                   | Player page, overview tab    |
| `/players/{platform}/{gameName}-{tagLine}/matches`           | Player page, match list tab  |
| `/players/{platform}/{gameName}-{tagLine}/matches/{matchId}` | Match detail for that player |

## Requirements

Priority: **Must** is required for v1, **Should** is wanted for v1 but can slip, **Could** is later.

### Search

| ID  | Requirement                                                                          | Priority |
| --- | ------------------------------------------------------------------------------------ | -------- |
| S1  | Search by Riot ID (`GameName#TAG`) and server. Accept names with spaces and accents. | Must     |
| S2  | Clear error when the Riot ID doesn't exist on that server.                           | Must     |
| S3  | Remember the last searched players on this device.                                   | Could    |

### Player header

| ID  | Requirement                                                                                 | Priority |
| --- | ------------------------------------------------------------------------------------------- | -------- |
| H1  | Riot ID, profile icon and summoner level.                                                   | Must     |
| H2  | Main role over the 20 matches (the most played `teamPosition`). The mockups show "Support". | Must     |
| H3  | Ranked standing: tier, division, LP and season wins/losses for Solo/Duo and Flex.           | Should   |
| H4  | Banner art of the most played champion, as in the mockups.                                  | Could    |

### Overall review (overview tab)

Computed over the last 20 matches that match the active filter (see O7). Remakes are excluded from every figure.

| ID  | Requirement                                                                                                                                                                            | Priority |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| O1  | Headline stats: win rate, average KDA (`(kills + assists) / max(deaths, 1)`), and the number of games counted.                                                                         | Must     |
| O2  | Average performance: kills/deaths/assists per game, CS per minute, gold per minute, damage to champions per minute, kill participation, vision score per minute, share of team damage. | Must     |
| O3  | Favorite champions ("Champions favoris"): the top 3 by games played, each with games, win rate and KDA.                                                                                | Must     |
| O4  | A breakdown by champion and by role: games, win rate, KDA, CS/min.                                                                                                                     | Should   |
| O5  | Trend across the 20 games, oldest to newest, for a chosen stat (for example KDA or CS/min), with wins and losses marked.                                                               | Should   |
| O6  | Recent matches ("Dernières parties"): the last 3 to 5 games, with a link to the full list.                                                                                             | Must     |
| O7  | Period/queue filter (the "Récent" dropdown): all queues, Ranked Solo/Duo, Ranked Flex, Normal, ARAM. It changes which 20 matches are counted.                                          | Must     |
| O8  | "To review" list ("À revoir" on mobile): highlights the games most worth reviewing. The rule is open (Q3).                                                                             | Should   |

### Match list ("Parties" tab)

| ID  | Requirement                                                                                                                      | Priority |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| L1  | One row per match, newest first: result (Victoire/Défaite), champion, queue, role, K/D/A, date. Each row opens the match detail. | Must     |
| L2  | Filters: mode (queue), role, result.                                                                                             | Must     |
| L3  | Sort: most recent first (the "Récent" dropdown). Other sorts are Could.                                                          | Must     |
| L4  | Show the 20 matches, with "Afficher plus" if the list is paginated on screen.                                                    | Must     |
| L5  | Remakes are shown but marked as such.                                                                                            | Should   |
| L6  | Extra columns: game duration, CS, KP.                                                                                            | Could    |

### Match detail

| ID  | Requirement                                                                                                                                                                                  | Priority |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| D1  | Summary: result, champion, role, queue, date, duration, patch.                                                                                                                               | Must     |
| D2  | The player's stats for the game: K/D/A, KDA, CS and CS/min, gold, damage to champions and share of team damage, kill participation, vision score, wards placed/killed, control wards bought. | Must     |
| D3  | Build: final items, runes, summoner spells (icons from Data Dragon).                                                                                                                         | Must     |
| D4  | Comparison with the lane opponent (same `teamPosition` on the enemy team) for the D2 stats.                                                                                                  | Must     |
| D5  | Each stat from D2 compared with the player's own 20-game average, so the coach sees at a glance where this game was better or worse.                                                         | Should   |
| D6  | Scoreboard of all 10 players: champion, Riot ID, K/D/A, CS, gold, damage, items.                                                                                                             | Should   |
| D7  | Team objectives: dragons, barons, heralds, towers, first blood.                                                                                                                              | Should   |
| D8  | Timeline (needs the timeline API): gold and CS difference with the lane opponent over time, and the values at 10 and 15 minutes.                                                             | Should   |
| D9  | Key events on the timeline: the player's kills and deaths, objectives, item purchases.                                                                                                       | Could    |
| D10 | Previous / next match navigation.                                                                                                                                                            | Could    |

### Layout and accessibility

| ID  | Requirement                                                                                                 | Priority |
| --- | ----------------------------------------------------------------------------------------------------------- | -------- |
| U1  | Desktop and mobile layouts, following the mockups.                                                          | Must     |
| U2  | Win/loss isn't conveyed by color alone (the word "Victoire" or "Défaite" is always shown).                  | Must     |
| U3  | Loading state while matches are fetched, and a clear message if Riot's API is unavailable or rate-limiting. | Must     |

## Data

See [riot-api-player-history.md](riot-api-player-history.md) for the endpoints and every field.

Calls to load one player:

| Step                                              | Endpoint                                   | Calls              |
| ------------------------------------------------- | ------------------------------------------ | ------------------ |
| Riot ID → PUUID                                   | account-v1 `by-riot-id`                    | 1                  |
| Profile                                           | summoner-v4 `by-puuid`                     | 1                  |
| Ranked                                            | league-v4 `entries/by-puuid`               | 1                  |
| Last 20 match ids                                 | match-v5 `ids?count=20` (+ `queue` for O7) | 1                  |
| Match details                                     | match-v5 `matches/{matchId}`               | up to 20           |
| Timeline (D8, only when a match detail is opened) | match-v5 `matches/{matchId}/timeline`      | 1 per match viewed |

The player's entry in a match is the participant whose `puuid` matches. Field sources for the common stats are listed in the API doc, "Fetching a player's recent stats".

Definitions:

- **Remake:** `gameEndedInEarlySurrender` is true.
- **CS:** `totalMinionsKilled + neutralMinionsKilled`.
- **Per minute:** divided by `timePlayed / 60`.
- **Kill participation:** `challenges.killParticipation`, or `(kills + assists) / team kills`.

## Technical constraints

- **The API key stays on the server.** The browser only calls our own Nuxt server routes (`server/api/...`), which call Riot.
- **Rate limits:** a development key allows 100 requests per 2 minutes, and loading one player costs about 24 calls. So:
  - cache match details and timelines permanently (a finished match never changes);
  - cache account, profile and ranked data briefly (a few minutes);
  - fetch the 20 match details with limited concurrency and retry on `429` after `Retry-After`.
- A production key is needed before real coaches use the app (development keys expire every 24 hours).
- Static data (champion, item, rune and spell names and icons) comes from Data Dragon, at the version matching the match patch or the latest one.
- The Riot legal disclaimer stays in the footer (already in the README).

## Out of scope for v1

- Accounts, login, and saved lists of players (the mockups show a user icon; see Q1).
- Coach notes or annotations on matches.
- Comparing several players side by side.
- More than 20 matches, or a custom date range.
- Live game view.
- Teamfight Tactics and other Riot games.

## Open questions

| #   | Question                                                                                                                                                         | Default if nobody decides                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Q1  | Do coaches need accounts (to save their players, write notes)? The mockups show a user icon.                                                                     | No accounts in v1.                                                             |
| Q2  | Which queues count by default: all games, or ranked only? ARAM and Arena stats aren't comparable with Summoner's Rift.                                           | All queues, with the filter from O7.                                           |
| Q3  | How are the "To review" (À revoir) games chosen?                                                                                                                 | Losses, plus games where the player's KDA is well below their 20-game average. |
| Q4  | UI language: French only, or French and English?                                                                                                                 | French only, text kept in one place to make translation easy later.            |
| Q5  | Should the match detail compare against benchmarks for the player's rank and role (for example average CS/min in Gold support)? Riot's API doesn't provide them. | No, compare only with the lane opponent and the player's own average.          |
| Q6  | Which servers to support at launch?                                                                                                                              | All of them, EUW selected by default.                                          |
