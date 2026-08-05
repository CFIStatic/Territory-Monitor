import { jsonError, jsonOk } from "@/lib/api";
import { runOutreachEngine } from "@/lib/engine";
import { guardRequest } from "@/lib/security/guard";

export async function POST(request: Request) {
  const blocked = guardRequest(request, {
    bucket: "engine-run",
    limit: 20,
    windowMs: 60_000,
    requireAuth: true,
  });
  if (blocked) return blocked;

  const result = await runOutreachEngine(new Date());
  return jsonOk({
    ok: true,
    ranAt: new Date().toISOString(),
    ...result,
  });
}

/** GET disabled — engine mutations must use POST to reduce CSRF / accidental trigger risk. */
export async function GET() {
  return jsonError("Method not allowed. Use POST /api/engine/run", 405);
}
