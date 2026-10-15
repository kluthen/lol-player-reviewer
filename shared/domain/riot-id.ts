import { InvalidInput } from './invalid-input.ts'

export class InvalidRiotId extends InvalidInput {
  constructor() {
    super(
      'INVALID_RIOT_ID',
      'Saisissez un Riot ID au format Pseudo#TAG (pseudo de 3 à 16 caractères, tag de 3 à 5 lettres ou chiffres).',
    )
    this.name = 'InvalidRiotId'
  }
}

export function parseRiotId(value: unknown): { gameName: string; tagLine: string } {
  if (typeof value !== 'string' || value.length > 100) throw new InvalidRiotId()
  const parts = value.normalize('NFC').trim().split('#')
  const gameName = parts[0]?.trim() ?? ''
  const tagLine = parts[1]?.trim() ?? ''
  if (
    parts.length !== 2 ||
    [...gameName].length < 3 ||
    [...gameName].length > 16 ||
    /[\p{C}#/\\]/u.test(gameName) ||
    !/^[\p{L}\p{N}]{3,5}$/u.test(tagLine)
  ) {
    throw new InvalidRiotId()
  }
  return { gameName, tagLine }
}

// URL segment `{gameName}-{tagLine}`. A tag never contains "-", so the last one separates them.
export const playerSlug = (gameName: string, tagLine: string) => `${gameName}-${tagLine}`

export function parsePlayerSlug(value: unknown): { gameName: string; tagLine: string } {
  if (typeof value !== 'string') throw new InvalidRiotId()
  const separator = value.lastIndexOf('-')
  if (separator <= 0) throw new InvalidRiotId()
  return parseRiotId(`${value.slice(0, separator)}#${value.slice(separator + 1)}`)
}
