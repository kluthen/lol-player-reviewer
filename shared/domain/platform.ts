import { InvalidInput } from './invalid-input.ts'

export type RiotRegion = 'americas' | 'asia' | 'europe' | 'sea'

// League of Legends servers and the match-v5 region that serves each of them.
export const PLATFORMS = {
  euw1: { label: 'EUW', name: 'Europe de l’Ouest', region: 'europe' },
  eun1: { label: 'EUNE', name: 'Europe du Nord et de l’Est', region: 'europe' },
  tr1: { label: 'TR', name: 'Turquie', region: 'europe' },
  ru: { label: 'RU', name: 'Russie', region: 'europe' },
  me1: { label: 'ME', name: 'Moyen-Orient', region: 'europe' },
  na1: { label: 'NA', name: 'Amérique du Nord', region: 'americas' },
  br1: { label: 'BR', name: 'Brésil', region: 'americas' },
  la1: { label: 'LAN', name: 'Amérique latine Nord', region: 'americas' },
  la2: { label: 'LAS', name: 'Amérique latine Sud', region: 'americas' },
  kr: { label: 'KR', name: 'Corée', region: 'asia' },
  jp1: { label: 'JP', name: 'Japon', region: 'asia' },
  oc1: { label: 'OCE', name: 'Océanie', region: 'sea' },
  sg2: { label: 'SG', name: 'Asie du Sud-Est', region: 'sea' },
  tw2: { label: 'TW', name: 'Taïwan', region: 'sea' },
  vn2: { label: 'VN', name: 'Viêt Nam', region: 'sea' },
} as const satisfies Record<string, { label: string; name: string; region: RiotRegion }>

export type Platform = keyof typeof PLATFORMS

export const DEFAULT_PLATFORM: Platform = 'euw1'

export function isPlatform(value: unknown): value is Platform {
  return typeof value === 'string' && Object.hasOwn(PLATFORMS, value)
}

export function parsePlatform(value: unknown): Platform {
  if (!isPlatform(value))
    throw new InvalidInput('INVALID_PLATFORM', 'Choisissez un serveur League of Legends valide.')
  return value
}

// Match ids carry their platform as a prefix, for example EUW1_7212345678.
export const matchIdPrefix = (platform: Platform) => `${platform.toUpperCase()}_`

export function platformOfMatchId(id: string): Platform | null {
  const prefix = id.split('_')[0]?.toLowerCase()
  return isPlatform(prefix) ? prefix : null
}

export function parseMatchId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[A-Z0-9]{2,5}_\d{1,20}$/.test(value) ||
    !platformOfMatchId(value)
  )
    throw new InvalidInput('INVALID_MATCH_ID', 'Cette référence de partie n’est pas valide.')
  return value
}
