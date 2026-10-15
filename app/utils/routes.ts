import { playerSlug } from '#shared/domain/riot-id'
import type { Platform } from '#shared/domain/platform'

export interface PlayerLocation {
  platform: Platform
  gameName: string
  tagLine: string
}

// Shareable page URLs: /players/{platform}/{gameName}-{tagLine}[/history[/{matchId}]].
export const profilePath = (player: PlayerLocation) =>
  `/players/${player.platform}/${encodeURIComponent(playerSlug(player.gameName, player.tagLine))}`
export const historyPath = (player: PlayerLocation) => `${profilePath(player)}/history`
export const matchPath = (player: PlayerLocation, matchId: string) =>
  `${historyPath(player)}/${encodeURIComponent(matchId)}`
