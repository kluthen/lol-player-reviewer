# lol-player-reviewer

A Nuxt app for reviewing the recent stats of a League of Legends player, using the Riot Games API. Public repo: https://github.com/kluthen/lol-player-reviewer (no license).

## Secrets: never read `.env`

- **Never read, print, grep, source or edit `.env`** (or `.env.local`, `.env.*.local`, `.env.development`, `.env.production`, `.env.test`). It holds the Riot API key.
- To learn which variables exist, read `.env.example`.
- When adding a variable, add it to `.env.example` with an empty value and ask the user to fill in `.env`.
- To check that the key works, run `npm run check:riot-key` (see below). It loads `.env` itself and never prints the key.
- `.claude/settings.json` enforces this: deny rules block Read/Edit on those files, and a Bash hook (`.claude/hooks/block-env-access.sh`) blocks shell commands that name them. Don't work around these.

## Always work in the dev container

Run every npm/Nuxt command inside the dev container (`.devcontainer/`), never on the host:

```bash
npx @devcontainers/cli up --workspace-folder .                 # start or reuse the container
npx @devcontainers/cli exec --workspace-folder . npm run dev    # run anything inside it
```

- Image: Node 22 with **npm 11**, installed by `.devcontainer/Dockerfile`. npm 10 crashes when installing Nuxt 4 (`Cannot read properties of null (reading 'edgesOut')`).
- npm 11 holds back dependency install scripts until they're approved. Approvals live in `allowScripts` in `package.json`. If a new dependency needs its install script, run `npm install-scripts approve <pkg> --no-allow-scripts-pin` inside the container.
- After changing `.devcontainer/`, rebuild with `npx @devcontainers/cli up --workspace-folder . --remove-existing-container`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` | Production build. Use it to check that the app compiles. |
| `npm run check:riot-key -- [platform] [GameName#TAG]` | Check that `RIOT_API_KEY` works. Default platform is `euw1`. With a Riot ID, it also checks the account and match APIs. |

There are no tests or linter yet.

## Layout

- `app/`: Nuxt 4 app source (`app.vue`, and later `pages/`, `components/`, `composables/`)
- `server/`: server routes (not created yet). All Riot API calls go here.
- `scripts/`: standalone Node scripts (`check-riot-key.mjs`)
- `docs/riot-api-player-history.md`: reference for the Riot API endpoints and every field of the player and match data
- `01-profil-joueur.png`, `02-historique-parties.png`, `03-version-mobile.png`: UI mockups for the player profile, match history and mobile view

## Riot API rules

- **The key never reaches the browser.** Call Riot only from Nuxt server routes (`server/api/...`), reading the key from runtime config (`runtimeConfig.riotApiKey`, set by the `NUXT_RIOT_API_KEY` env var) or `process.env.RIOT_API_KEY`. Pages call our own `/api/...` routes.
- Identify players by **PUUID**. Look it up from a Riot ID with account-v1. The encrypted summoner ID (`id` / `summonerId`) is deprecated.
- **Routing:** account-v1 and match-v5 use the regional host (`europe`, `americas`, `asia`, `sea`). summoner-v4, league-v4, champion-mastery-v4 and spectator-v5 use the platform host (`euw1`, `na1`, …). The mapping is in `scripts/check-riot-key.mjs` and in the doc.
- **Rate limits:** a development key allows 20 requests/second and 100 per 2 minutes, and it expires every 24 hours. Each match is one call, so cache finished matches (they never change) and handle `429` with `Retry-After`.
- Get champion, item, rune and spell names and icons from Data Dragon. Don't hard-code them.
- Check `docs/riot-api-player-history.md` before guessing a field name or endpoint.

## Conventions

- TypeScript, Vue 3 `<script setup lang="ts">`, Nuxt auto-imports.
- Match the style of the code around you. Keep changes small and focused.
- Commit only when asked.
