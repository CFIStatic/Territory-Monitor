import { jsonOk } from "@/lib/api";
import { listSecurityEvents, securityStats } from "@/lib/security/audit";
import { isApiKeyConfigured } from "@/lib/security/auth";

export async function GET() {
  return jsonOk({
    ok: true,
    stats: securityStats(),
    apiKeyConfigured: isApiKeyConfigured(),
    events: listSecurityEvents(40),
  });
}
