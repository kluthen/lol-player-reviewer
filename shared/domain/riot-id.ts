export class InvalidRiotId extends Error {
  constructor() {
    super(
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
