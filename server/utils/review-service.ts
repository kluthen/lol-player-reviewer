import { useRuntimeConfig } from 'nuxt/server'
import { GetPlayerReview } from '../application/get-player-review.ts'
import { RiotAdapter } from '../infrastructure/riot-adapter.ts'
import { RiotTransport } from '../infrastructure/riot-transport.ts'
import { DataDragon } from '../infrastructure/data-dragon.ts'

const dragon = new DataDragon()
const riot = new RiotAdapter(new RiotTransport(() => useRuntimeConfig().riotApiKey))
export const reviewService = new GetPlayerReview(riot, () => dragon.catalog())
