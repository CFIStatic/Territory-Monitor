import { jsonError } from "@/lib/api";

/**
 * Optional API key gate. When TM_API_KEY is set, mutating / sensitive
 * API routes require x-api-key or Authorization: Bearer <key>.
 */
export function getConfiguredApiKey(): string | null {
  const key = process.env.TM_API_KEY?.trim();
  return key ? key : null;
}

export function isApiKeyConfigured(): boolean {
  return Boolean(getConfiguredApiKey());
}

export function extractApiKey(request: Request): string | null {
  const header = request.headers.get("x-api-key");
  if (header?.trim()) return header.trim();
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return null;
}

export function requireApiKeyIfConfigured(request: Request): Response | null {
  const expected = getConfiguredApiKey();
  if (!expected) return null;
  const provided = extractApiKey(request);
  if (!provided || provided !== expected) {
    return jsonError("Unauthorized — valid API key required", 401);
  }
  return null;
}
