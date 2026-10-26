import { identity, checkOrigin } from "@/lib/server";
import { requireAdmin } from "@/lib/authorization";
import { apiError, readJson } from "@/lib/http";
import { reviewProviderApplication } from "@/lib/provider-application-review-server";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(request);
    const who = await identity();
    requireAdmin(who);
    await reviewProviderApplication(
      who,
      (await params).id,
      await readJson(request, 8192),
    );
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
