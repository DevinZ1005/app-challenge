import { listProviders } from "@/lib/server";
import { apiError } from "@/lib/http";
export const dynamic = "force-dynamic";

// Readiness checks the public data dependency without exposing listings or configuration.
export async function GET() {
  try {
    await listProviders();
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    apiError(e);
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
