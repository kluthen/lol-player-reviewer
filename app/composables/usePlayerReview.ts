import type { PlayerReview } from '#shared/types/review'
import { parseRiotId } from '#shared/domain/riot-id'

interface SearchError {
  message: string
  code: string
}
let requestNumber = 0

export function usePlayerReview() {
  const review = useState<PlayerReview | null>('player-review', () => null)
  const pending = useState('review-pending', () => false)
  const error = useState<SearchError | null>('review-error', () => null)
  const retryAt = useState('review-retry-at', () => 0)
  const route = useRoute()
  const router = useRouter()
  const riotId = computed(() => (typeof route.query.joueur === 'string' ? route.query.joueur : ''))

  async function load(value: string) {
    if (Date.now() < retryAt.value) return
    const current = ++requestNumber
    pending.value = true
    error.value = null
    review.value = null
    try {
      parseRiotId(value)
      const response = await $fetch<PlayerReview>('/api/review', {
        query: { riotId: value },
        timeout: 120_000,
        retry: 0,
      })
      if (current === requestNumber) review.value = response
    } catch (cause: unknown) {
      if (current !== requestNumber) return
      const failure = cause as {
        data?: { data?: { message?: string; code?: string; retryAfter?: number } }
        message?: string
      }
      const details = failure.data?.data
      error.value = {
        message:
          details?.message ??
          (cause instanceof Error && cause.name === 'InvalidRiotId'
            ? cause.message
            : 'La recherche n’a pas pu aboutir. Vérifiez votre connexion et réessayez.'),
        code: details?.code ?? 'SEARCH_FAILED',
      }
      if (details?.retryAfter) retryAt.value = Date.now() + details.retryAfter * 1000
    } finally {
      if (current === requestNumber) pending.value = false
    }
  }

  async function search(value: string) {
    try {
      parseRiotId(value)
    } catch (cause) {
      error.value = { message: (cause as Error).message, code: 'INVALID_RIOT_ID' }
      return
    }
    const normalized = value.normalize('NFC').trim()
    if (normalized === riotId.value) await load(normalized)
    else await router.push({ path: route.path, query: { joueur: normalized } })
  }

  function reset() {
    requestNumber++
    review.value = null
    error.value = null
    pending.value = false
  }

  return { review, pending, error, retryAt, riotId, search, load, reset }
}
