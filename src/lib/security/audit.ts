/**
 * In-memory security audit log for blocked malware / abuse events.
 * Surfaces on the Cyber Defense page for operators.
 */

export type SecurityEvent = {
  id: string;
  at: string;
  kind: "malware_block" | "rate_limit" | "auth_fail" | "info";
  message: string;
  meta?: Record<string, unknown>;
};

const MAX_EVENTS = 200;
const events: SecurityEvent[] = [];

function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function logSecurityEvent(
  kind: SecurityEvent["kind"],
  message: string,
  meta?: Record<string, unknown>
) {
  events.unshift({
    id: id(),
    at: new Date().toISOString(),
    kind,
    message,
    meta,
  });
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  console.warn(`[security:${kind}]`, message, meta ?? "");
}

export function listSecurityEvents(limit = 50): SecurityEvent[] {
  return events.slice(0, limit);
}

export function securityStats() {
  const malwareBlocks = events.filter((e) => e.kind === "malware_block").length;
  const rateLimits = events.filter((e) => e.kind === "rate_limit").length;
  const authFails = events.filter((e) => e.kind === "auth_fail").length;
  return {
    totalEvents: events.length,
    malwareBlocks,
    rateLimits,
    authFails,
    apiKeyRequired: Boolean(process.env.TM_API_KEY?.trim()),
    defenses: [
      "Upload malware signature scan",
      "Macro / executable extension block",
      "PDF JavaScript & Launch action block",
      "CSV formula / script polyglot block",
      "Contact field sanitization",
      "API rate limiting",
      "Security response headers (CSP, frame deny, nosniff)",
      "Optional API key on sensitive routes",
    ],
  };
}
