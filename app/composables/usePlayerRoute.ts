import { isPlatform, type Platform } from '#shared/domain/platform'
import { parsePlayerSlug } from '#shared/domain/riot-id'

export interface PlayerRoute {
  platform: Platform
  gameName: string
  tagLine: string
  riotId: string
}

// The player named by the current URL, or null when the URL doesn't name a valid one.
export function usePlayerRoute() {
  const route = useRoute()
  return computed<PlayerRoute | null>(() => {
    const { platform, player } = route.params
    if (!isPlatform(platform) || typeof player !== 'string') return null
    try {
      const { gameName, tagLine } = parsePlayerSlug(player)
      return { platform, gameName, tagLine, riotId: `${gameName}#${tagLine}` }
    } catch {
      return null
    }
  })
}
