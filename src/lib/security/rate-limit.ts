/**
 * Simple in-memory sliding-window rate limiter for API defense.
 * Suitable for single-node demo / small deployments.
 */

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  limit: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    buckets.set(key, bucket);
    return { allowed: false, remaining: 0, retryAfterSec, limit };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.timestamps.length),
    retryAfterSec: 0,
    limit,
  };
}

export function clientKey(request: Request, suffix = ""): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  return `${ip}:${suffix}`;
}

/** Periodic cleanup to avoid unbounded growth in long-running processes. */
export function pruneRateLimitBuckets(maxAgeMs = 60 * 60 * 1000) {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < maxAgeMs);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}
