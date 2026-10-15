export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>()
  private readonly inFlight = new Map<string, Promise<T>>()

  constructor(
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  async remember(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const entry = this.entries.get(key)
    if (entry && entry.expiresAt > this.now()) return entry.value
    this.entries.delete(key)
    const pending = this.inFlight.get(key)
    if (pending) return pending
    const promise = loader()
      .then((value) => {
        if (this.entries.size >= this.maxEntries)
          this.entries.delete(this.entries.keys().next().value!)
        this.entries.set(key, { value, expiresAt: this.now() + ttlMs })
        return value
      })
      .finally(() => this.inFlight.delete(key))
    this.inFlight.set(key, promise)
    return promise
  }
}
