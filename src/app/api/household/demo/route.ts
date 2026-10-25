import { checkHouseholdOrigin } from "@/lib/household-auth";
import { apiError } from "@/lib/server";
import { createHouseholdDemo, householdResponse } from "@/lib/household-auth";
import { limitHouseholdAuth } from "@/lib/auth-limits";
export async function POST(request: Request) {
  try {
    checkHouseholdOrigin(request);
    limitHouseholdAuth("demo");
    return householdResponse(await createHouseholdDemo());
  } catch (error) {
    return apiError(error);
  }
}
