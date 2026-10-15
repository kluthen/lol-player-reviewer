import { parseRiotId } from '#shared/domain/riot-id'
import { DEFAULT_PLATFORM } from '#shared/domain/platform'
import { historyPath, profilePath } from '~/utils/routes'

// Links shared before the per-player routes (/?joueur=… and /historique?joueur=…) were EUW only.
export default defineNuxtRouteMiddleware((to) => {
  const history = to.path === '/historique'
  if (!history && !(to.path === '/' && to.query.joueur !== undefined)) return
  try {
    const { gameName, tagLine } = parseRiotId(to.query.joueur)
    const player = { platform: DEFAULT_PLATFORM, gameName, tagLine }
    return navigateTo(history ? historyPath(player) : profilePath(player), { redirectCode: 301 })
  } catch {
    return navigateTo('/', { redirectCode: 301 })
  }
})
