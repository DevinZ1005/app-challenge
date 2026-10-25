import { checkHouseholdOrigin } from "@/lib/household-auth";
import { apiError, readJson } from "@/lib/server";
import { emailSchema, requestHouseholdCode } from "@/lib/household-auth";
import { limitHouseholdAuth } from "@/lib/auth-limits";
export async function POST(request: Request) {
  try {
    checkHouseholdOrigin(request);
    const { email } = emailSchema.parse(await readJson(request, 1024));
    limitHouseholdAuth("send", email);
    await requestHouseholdCode(email);
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
