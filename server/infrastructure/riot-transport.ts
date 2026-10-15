import { ReviewError } from '../domain/review-error.ts'
import { PLATFORMS } from '../../shared/domain/platform.ts'

type Fetch = typeof globalThis.fetch

// Regional hosts (account-v1, match-v5) and platform hosts (summoner-v4, league-v4).
const HOSTS: ReadonlySet<string> = new Set([
  'americas',
  'asia',
  'europe',
  'sea',
  ...Object.keys(PLATFORMS),
])

export class RiotTransport {
  private starts: number[] = []
  private nextStart = 0
  private blockedUntil = 0

  constructor(
    private readonly apiKey: () => string,
    private readonly fetcher: Fetch = globalThis.fetch,
  ) {}

  async get(host: string, path: string): Promise<unknown> {
    if (!HOSTS.has(host)) throw new Error('Unknown Riot host')
    const key = this.apiKey()
    if (!key || key === '.....') {
      throw new ReviewError(
        'RIOT_NOT_CONFIGURED',
        'Le service Riot n’est pas encore configuré. Ajoutez la clé Riot dans le fichier .env du serveur.',
        503,
      )
    }
    const now = Date.now()
    if (now < this.blockedUntil) this.rateLimited(this.blockedUntil - now)
    this.starts = this.starts.filter((time) => time > now - 120_000)
    // Reserve before awaiting so concurrent searches share the same quota.
    if (this.starts.length >= 95) this.rateLimited(this.starts[0]! + 120_000 - now)
    const scheduledAt = Math.max(now, this.nextStart)
    if (scheduledAt - now > 12_000) this.rateLimited(scheduledAt - now)
    this.nextStart = scheduledAt + 110
    this.starts.push(scheduledAt)
    if (scheduledAt > now) await new Promise((resolve) => setTimeout(resolve, scheduledAt - now))
    if (Date.now() < this.blockedUntil) this.rateLimited(this.blockedUntil - Date.now())
    let response: Response
    try {
      response = await this.fetcher(`https://${host}.api.riotgames.com${path}`, {
        headers: { 'X-Riot-Token': key, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
      })
    } catch {
      throw new ReviewError(
        'RIOT_UNAVAILABLE',
        'Riot est momentanément inaccessible. Réessayez dans quelques instants.',
      )
    }
    if (response.status === 429) {
      const header = response.headers.get('Retry-After')
      const seconds = Number(header)
      const delay =
        header && Number.isFinite(seconds)
          ? Math.max(1, seconds) * 1000
          : Math.max(1000, Date.parse(header ?? '') - Date.now() || 120_000)
      this.blockedUntil = Date.now() + delay
      this.rateLimited(delay)
    }
    if (response.status === 401 || response.status === 403)
      throw new ReviewError(
        'RIOT_KEY_REJECTED',
        'La clé Riot est refusée ou a expiré. Le responsable du serveur doit la renouveler.',
        503,
      )
    if (response.status === 404)
      throw new ReviewError(
        'RIOT_NOT_FOUND',
        'Joueur introuvable. Vérifiez le pseudo et le tag.',
        404,
      )
    if (!response.ok)
      throw new ReviewError(
        'RIOT_UNAVAILABLE',
        'Le service Riot rencontre un problème. Réessayez dans quelques instants.',
      )
    try {
      return await response.json()
    } catch {
      throw new ReviewError(
        'RIOT_INVALID_RESPONSE',
        'Riot a renvoyé une réponse illisible. Réessayez plus tard.',
      )
    }
  }

  private rateLimited(delayMs: number): never {
    throw new ReviewError(
      'RIOT_RATE_LIMITED',
      'La limite de requêtes Riot est atteinte. Patientez avant de réessayer.',
      429,
      Math.max(1, Math.ceil(delayMs / 1000)),
    )
  }
}
