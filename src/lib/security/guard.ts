import { jsonError } from "@/lib/api";
import { requireApiKeyIfConfigured, extractApiKey, getConfiguredApiKey } from "./auth";
import { clientKey, rateLimit } from "./rate-limit";
import { logSecurityEvent } from "./audit";

type GuardOptions = {
  /** Rate limit bucket name */
  bucket: string;
  limit: number;
  windowMs: number;
  /** Require API key when TM_API_KEY is configured */
  requireAuth?: boolean;
};

export function guardRequest(request: Request, options: GuardOptions): Response | null {
  if (options.requireAuth !== false) {
    const authFail = requireApiKeyIfConfigured(request);
    if (authFail) {
      logSecurityEvent("auth_fail", "Rejected request — missing or invalid API key", {
        path: new URL(request.url).pathname,
        hasKeyHeader: Boolean(extractApiKey(request)),
        configured: Boolean(getConfiguredApiKey()),
      });
      return authFail;
    }
  }

  const key = clientKey(request, options.bucket);
  const result = rateLimit(key, options.limit, options.windowMs);
  if (!result.allowed) {
    logSecurityEvent("rate_limit", `Rate limit exceeded for ${options.bucket}`, {
      path: new URL(request.url).pathname,
      limit: result.limit,
      retryAfterSec: result.retryAfterSec,
    });
    return jsonError(
      `Too many requests. Retry in ${result.retryAfterSec}s.`,
      429
    );
  }

  return null;
}
