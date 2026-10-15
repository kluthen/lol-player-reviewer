export interface ChampionCatalog {
  version: string
  champions: Record<string, { key: string; name: string }>
}
