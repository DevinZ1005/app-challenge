import { identity } from "@/lib/server";
import { apiError } from "@/lib/http";
import { getProviderApplication } from "@/lib/provider-application-review-server";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return Response.json(
      await getProviderApplication(await identity(), (await params).id),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
