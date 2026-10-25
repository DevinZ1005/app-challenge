import { checkHouseholdOrigin } from "@/lib/household-auth";
import { apiError, readJson } from "@/lib/server";
import { codeSchema, verifyHouseholdCode } from "@/lib/household-auth";
import { limitHouseholdAuth } from "@/lib/auth-limits";
export async function POST(request: Request) {
  try {
    checkHouseholdOrigin(request);
    const { email, code } = codeSchema.parse(await readJson(request, 1024));
    limitHouseholdAuth("verify", email);
    return await verifyHouseholdCode(email, code);
  } catch (error) {
    return apiError(error);
  }
}
