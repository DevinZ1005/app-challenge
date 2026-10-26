import { z } from "zod";
import { identity } from "@/lib/server";
import { requireAdmin } from "@/lib/authorization";
import { apiError } from "@/lib/http";
import { applicationStatusSchema } from "@/lib/provider-application-review";
import { listProviderApplications } from "@/lib/provider-application-review-server";
export async function GET(request: Request) {
  try {
    const who = await identity();
    requireAdmin(who);
    const search = new URL(request.url).searchParams;
    const status = applicationStatusSchema
      .or(z.literal("all"))
      .parse(search.get("status") ?? "all");
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(400)
      .parse(search.get("page") ?? 1);
    return Response.json(await listProviderApplications(who, status, page), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
