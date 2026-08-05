import { jsonOk } from "@/lib/api";
import { runOutreachEngine } from "@/lib/engine";

export async function POST() {
  const result = await runOutreachEngine(new Date());
  return jsonOk({
    ok: true,
    ranAt: new Date().toISOString(),
    ...result,
  });
}

export async function GET() {
  const result = await runOutreachEngine(new Date());
  return jsonOk({
    ok: true,
    ranAt: new Date().toISOString(),
    ...result,
  });
}
