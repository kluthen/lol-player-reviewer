# lol-player-reviewer

This project lets you review the recent stats of a League of Legends player.

> Status: early stage. The Nuxt app is scaffolded; the features below are planned, not built yet.

## Goals

- Look up a player by Riot ID (`GameName#TAG`) and region.
- Show recent match history: champions played, KDA, CS, vision, win/loss.
- Summarize trends over the last games: win rate, most played champions, average performance.

Data will come from the [Riot Games API](https://developer.riotgames.com/), which requires an API key.

## Tech stack

- [Nuxt 4](https://nuxt.com/) (Vue 3, TypeScript)
- Node.js 22, npm 11
- Development happens inside a [dev container](https://containers.dev/)

## Getting started

All development happens inside the dev container defined in [`.devcontainer/`](.devcontainer/). You don't need Node.js on your machine.

### VS Code

1. Install Docker and the **Dev Containers** extension.
2. Open the repository and run **Dev Containers: Reopen in Container**.
3. Dependencies are installed automatically when the container is created.

### Dev Container CLI

```bash
npx @devcontainers/cli up --workspace-folder .
npx @devcontainers/cli exec --workspace-folder . npm run dev
```

The dev server runs on <http://localhost:3000>.

## Scripts

| Command            | Description                      |
| ------------------ | -------------------------------- |
| `npm run dev`      | Start the dev server             |
| `npm run build`    | Build for production             |
| `npm run preview`  | Preview the production build     |
| `npm run generate` | Generate a static site           |
| `npm run check:riot-key -- [platform] [GameName#TAG]` | Check that `RIOT_API_KEY` in `.env` works (default platform `euw1`) |

## Disclaimer

lol-player-reviewer isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
