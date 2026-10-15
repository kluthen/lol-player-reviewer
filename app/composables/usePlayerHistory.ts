import type { PlayerHistory, ReviewMatch } from '#shared/types/review'
import type { ApiError } from './useRiotResource'

// The history's first page, plus the pages "Afficher plus" loaded for the same player. Kept in
// Nuxt state so coming back from a game detail shows every page already loaded.
export function usePlayerHistory() {
  const player = usePlayerRoute()
  const first = useRiotResource<PlayerHistory>('history', () =>
    player.value
      ? {
          url: '/api/history',
          query: { platform: player.value.platform, riotId: player.value.riotId },
        }
      : null,
  )
  const more = useState<{ key: string; pages: PlayerHistory[] }>('history-more', () => ({
    key: '',
    pages: [],
  }))
  const loadingMore = useState('history-loading-more', () => false)
  const moreError = useState<ApiError | null>('history-more-error', () => null)

  const pages = computed(() =>
    first.data.value
      ? [first.data.value, ...(more.value.key === first.key.value ? more.value.pages : [])]
      : [],
  )
  const matches = computed(() => {
    const seen = new Set<string>()
    return pages.value
      .flatMap((page) => page.matches)
      .filter((match: ReviewMatch) => !seen.has(match.id) && seen.add(match.id))
  })
  const next = computed(() => pages.value.at(-1)?.page.next ?? null)
  const unavailable = computed(() =>
    pages.value.reduce((total, page) => total + page.page.unavailable, 0),
  )
  const excluded = computed(() =>
    pages.value.reduce((total, page) => total + page.page.excluded, 0),
  )

  async function loadMore() {
    const key = first.key.value
    if (!player.value || next.value === null || loadingMore.value) return
    loadingMore.value = true
    moreError.value = null
    try {
      const page = await fetchApi<PlayerHistory>({
        url: '/api/history',
        query: {
          platform: player.value.platform,
          riotId: player.value.riotId,
          start: String(next.value),
        },
      })
      if (key !== first.key.value) return
      more.value = { key, pages: [...(more.value.key === key ? more.value.pages : []), page] }
    } catch (cause) {
      const { message, code } = apiError(cause)
      moreError.value = { message, code }
    } finally {
      loadingMore.value = false
    }
  }

  watch(first.key, () => {
    moreError.value = null
  })

  return { ...first, matches, next, unavailable, excluded, loadMore, loadingMore, moreError }
}
