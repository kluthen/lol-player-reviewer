export class ReviewError extends Error {
  readonly code: string
  readonly status: number
  readonly retryAfter?: number

  constructor(code: string, message: string, status = 502, retryAfter?: number) {
    super(message)
    this.name = 'ReviewError'
    this.code = code
    this.status = status
    this.retryAfter = retryAfter
  }
}
