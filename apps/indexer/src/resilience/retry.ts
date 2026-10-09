import { setTimeout as sleep } from "node:timers/promises";

export interface BackoffOptions {
  initialDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_BACKOFF: BackoffOptions = { initialDelayMs: 1_000, maxDelayMs: 30_000 };
/** About 3 minutes with the default backoff (1+2+4+8+16+30×5 s, before jitter). */
export const DEFAULT_MAX_RETRIES = 10;

/** A transient failure persisted through every retry. Fatal; `cause` is the last error. */
export class RetriesExhaustedError extends Error {
  override name = "RetriesExhaustedError";
  constructor(
    readonly attempts: number,
    options: { cause: unknown },
  ) {
    super(`gave up after ${attempts} attempts`, options);
  }
}

export interface RetryOptions {
  isTransient: (error: unknown) => boolean;
  signal?: AbortSignal;
  backoff?: BackoffOptions;
  /** Retries after the first attempt before giving up; defaults to DEFAULT_MAX_RETRIES. */
  maxRetries?: number;
  /**
   * Called after each failure: true when the operation made progress since the
   * previous failure (e.g. wrote a block), which restarts the retry budget and backoff.
   */
  madeProgress?: () => boolean;
  /** Injectable for tests; defaults to Math.random. */
  random?: () => number;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

/**
 * Runs `operation`, retrying transient failures with exponential backoff and
 * 50–100% jitter. A fatal error is rethrown at once; if `signal` aborts
 * (including mid-wait) the last error is rethrown; after `maxRetries` failed
 * retries it throws RetriesExhaustedError.
 */
export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { initialDelayMs, maxDelayMs } = options.backoff ?? DEFAULT_BACKOFF;
  const random = options.random ?? Math.random;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  for (let attempt = 1; ; attempt += 1) {
    // `attempt` counts failures since the last progress; the budget applies to that streak.
    try {
      return await operation();
    } catch (error) {
      if (!options.isTransient(error) || options.signal?.aborted) {
        throw error;
      }
      if (options.madeProgress?.()) {
        attempt = 1;
      }
      if (attempt > maxRetries) {
        throw new RetriesExhaustedError(attempt, { cause: error });
      }
      const backoff = Math.min(maxDelayMs, initialDelayMs * 2 ** (attempt - 1));
      const delayMs = Math.round(backoff * (0.5 + random() * 0.5));
      options.onRetry?.(error, attempt, delayMs);
      try {
        await sleep(delayMs, undefined, { signal: options.signal });
      } catch {
        throw error;
      }
    }
  }
}
