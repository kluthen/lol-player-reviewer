import { TtlCache } from './ttl-cache.ts'
import type { ChampionCatalog } from '../domain/catalog-port.ts'

export class DataDragon {
  private readonly cache = new TtlCache<ChampionCatalog>(1)

  async catalog(): Promise<ChampionCatalog> {
    try {
      return await this.cache.remember('fr_FR', 86_400_000, async () => {
        const versions: unknown = await this.json(
          'https://ddragon.leagueoflegends.com/api/versions.json',
        )
        if (!Array.isArray(versions) || !/^\d+\.\d+\.\d+$/.test(versions[0]))
          throw new Error('Invalid versions')
        const version = versions[0] as string
        const response = (await this.json(
          `https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/champion.json`,
        )) as { data?: Record<string, { id: string; key: string; name: string }> }
        if (!response?.data || typeof response.data !== 'object')
          throw new Error('Invalid champions')
        const champions: ChampionCatalog['champions'] = {}
        for (const champion of Object.values(response.data)) {
          if (
            /^[A-Za-z0-9]+$/.test(champion.id) &&
            /^\d+$/.test(champion.key) &&
            typeof champion.name === 'string'
          ) {
            champions[champion.key] = { key: champion.id, name: champion.name }
          }
        }
        return { version, champions }
      })
    } catch {
      // Static assets can fail independently of the player's actual match data.
      return { version: '16.20.1', champions: {} }
    }
  }

  private async json(url: string): Promise<unknown> {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' })
    if (!response.ok) throw new Error('Data Dragon unavailable')
    return response.json()
  }
}
