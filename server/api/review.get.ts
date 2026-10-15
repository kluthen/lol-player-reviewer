import { createError, defineEventHandler, getQuery, getRequestIP } from 'nuxt/server'
import { InvalidRiotId } from '../../shared/domain/riot-id.ts'
import { ReviewError } from '../domain/review-error.ts'
import { reviewService } from '../utils/review-service.ts'

const requests = new Map<string, { start: number; count: number }>()

export default defineEventHandler(async (event) => {
  event.res.headers.set('Cache-Control', 'no-store')
  try {
    // Forwarded headers are deliberately not trusted on an unconfigured deployment.
    const ip = getRequestIP(event) ?? 'local'
    const now = Date.now()
    const quota = requests.get(ip)
    if (quota && now - quota.start < 60_000) {
      if (quota.count >= 20)
        throw new ReviewError(
          'SEARCH_RATE_LIMITED',
          'Trop de recherches. Patientez une minute avant de réessayer.',
          429,
          Math.ceil((quota.start + 60_000 - now) / 1000),
        )
      quota.count++
    } else {
      if (requests.size >= 1000) requests.delete(requests.keys().next().value!)
      requests.set(ip, { start: now, count: 1 })
    }
    return await reviewService.execute(getQuery(event).riotId)
  } catch (error) {
    if (error instanceof InvalidRiotId)
      throw createError({
        status: 400,
        message: error.message,
        data: { code: 'INVALID_RIOT_ID', message: error.message },
      })
    if (error instanceof ReviewError) {
      if (error.retryAfter) event.res.headers.set('Retry-After', String(error.retryAfter))
      throw createError({
        status: error.status,
        message: error.message,
        data: { code: error.code, message: error.message, retryAfter: error.retryAfter },
      })
    }
    console.error('[review] Unexpected server error')
    throw createError({
      status: 500,
      message: 'La recherche n’a pas pu aboutir. Réessayez plus tard.',
      data: {
        code: 'INTERNAL_ERROR',
        message: 'La recherche n’a pas pu aboutir. Réessayez plus tard.',
      },
    })
  }
})
