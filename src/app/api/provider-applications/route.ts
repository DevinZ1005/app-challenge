import { checkOrigin } from "@/lib/server";
import { apiError, readJson } from "@/lib/http";
import { providerApplicationRequestSchema } from "@/lib/provider-application";
import { submitProviderApplication } from "@/lib/provider-application-server";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { faxNumber, ...application } =
      providerApplicationRequestSchema.parse(await readJson(request, 8192));
    // The noninteractive honeypot is never persisted or echoed.
    if (!faxNumber) await submitProviderApplication(application);
    // Identical acknowledgement for new, duplicate, and honeypot submissions.
    return Response.json(
      { ok: true },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
