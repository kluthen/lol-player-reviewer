export interface ApiError {
  message: string
  code: string
}

export interface ApiRequest {
  url: string
  query: Record<string, string>
}

const RATE_LIMITED: ApiError = {
  code: 'RIOT_RATE_LIMITED',
  message: 'La limite de requêtes Riot est atteinte. Patientez avant de réessayer.',
}
const requests = new Map<string, number>()

// Shared by every resource: a 429 blocks all calls until Retry-After has elapsed.
export const useRetryAt = () => useState('riot-retry-at', () => 0)

export function apiError(cause: unknown): ApiError & { retryAfter?: number } {
  const details = (
    cause as { data?: { data?: { message?: string; code?: string; retryAfter?: number } } }
  )?.data?.data
  return {
    message:
      details?.message ?? 'La recherche n’a pas pu aboutir. Vérifiez votre connexion et réessayez.',
    code: details?.code ?? 'SEARCH_FAILED',
    retryAfter: details?.retryAfter,
  }
}

export async function fetchApi<T>(request: ApiRequest): Promise<T> {
  const retryAt = useRetryAt()
  if (Date.now() < retryAt.value) throw { data: { data: RATE_LIMITED } }
  try {
    // The response is the DTO the matching server route declares in shared/types/review.ts.
    const response: unknown = await $fetch(request.url, {
      query: request.query,
      timeout: 120_000,
      retry: 0,
    })
    return response as T
  } catch (cause) {
    const { retryAfter } = apiError(cause)
    if (retryAfter) retryAt.value = Date.now() + retryAfter * 1000
    throw cause
  }
}

const keyOf = (request: ApiRequest | null) =>
  request ? `${request.url}?${new URLSearchParams(request.query)}` : ''

// Loads one API resource after hydration and again whenever its request changes. The result
// is kept in Nuxt state, so returning to a page doesn't call Riot again. With `keepFor`, data
// stays visible while a request with the same group key loads (a period change, say).
export function useRiotResource<T>(
  name: string,
  request: () => ApiRequest | null,
  keepFor?: () => string,
) {
  const data = useState<T | null>(`${name}-data`, () => null)
  const pending = useState(`${name}-pending`, () => false)
  const error = useState<ApiError | null>(`${name}-error`, () => null)
  const loadedKey = useState(`${name}-key`, () => '')
  const loadedGroup = useState(`${name}-group`, () => '')
  const key = computed(() => keyOf(request()))

  async function load(force = false) {
    const current = request()
    if (!current) return reset()
    if (!force && key.value === loadedKey.value && (data.value || pending.value || error.value))
      return
    const number = (requests.get(name) ?? 0) + 1
    requests.set(name, number)
    const group = keepFor?.() ?? ''
    if (!keepFor || group !== loadedGroup.value) data.value = null
    loadedKey.value = key.value
    loadedGroup.value = group
    pending.value = true
    error.value = null
    try {
      const response = await fetchApi<T>(current)
      if (requests.get(name) === number) data.value = response
    } catch (cause) {
      if (requests.get(name) !== number) return
      const { message, code } = apiError(cause)
      data.value = null
      error.value = { message, code }
    } finally {
      if (requests.get(name) === number) pending.value = false
    }
  }

  function reset() {
    requests.set(name, (requests.get(name) ?? 0) + 1)
    data.value = null
    error.value = null
    pending.value = false
    loadedKey.value = ''
    loadedGroup.value = ''
  }

  onMounted(() => {
    void load()
  })
  watch(key, () => {
    if (import.meta.client) void load()
  })
  return { data, pending, error, key, load }
}
