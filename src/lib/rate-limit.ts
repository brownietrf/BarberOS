/**
 * In-memory sliding window rate limiter.
 *
 * Works within a single process/Edge instance.
 * For multi-region production (Vercel), migrate to Upstash:
 *   https://github.com/upstash/ratelimit
 */

type Entry = { count: number; resetAt: number }

const store = new Map<string, Entry>()

/** Remove expired entries to prevent unbounded memory growth */
function cleanup() {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}

export interface RateLimitResult {
  success:   boolean
  remaining: number
  resetAt:   number  // ms epoch
}

/**
 * @param key       Unique identifier, typically the client IP
 * @param limit     Max requests allowed in the window
 * @param windowMs  Window duration in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  cleanup()

  const now   = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}
