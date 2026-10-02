export class Backoff {
  private attempt = 0

  constructor(private readonly opts: { initialMs: number; maxMs: number }) {}

  next(): number {
    const delay = Math.min(this.opts.maxMs, this.opts.initialMs * 2 ** this.attempt)
    this.attempt++
    return delay
  }

  reset(): void {
    this.attempt = 0
  }
}
