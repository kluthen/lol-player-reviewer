import { useRuntimeConfig } from 'nuxt/server'
import { GetPlayerProfile } from '../application/get-player-profile.ts'
import { GetPlayerHistory } from '../application/get-player-history.ts'
import { GetMatchDetail } from '../application/get-match-detail.ts'
import { RiotAdapter } from '../infrastructure/riot-adapter.ts'
import { RiotTransport } from '../infrastructure/riot-transport.ts'
import { DataDragon } from '../infrastructure/data-dragon.ts'

const dragon = new DataDragon()
const catalog = () => dragon.catalog()
// One adapter, so the profile, the history and the game detail share the same caches.
const riot = new RiotAdapter(new RiotTransport(() => useRuntimeConfig().riotApiKey))
export const profileService = new GetPlayerProfile(riot, catalog)
export const historyService = new GetPlayerHistory(riot, catalog)
export const matchService = new GetMatchDetail(riot, catalog)
