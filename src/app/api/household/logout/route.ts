import { checkHouseholdOrigin } from "@/lib/household-auth";
import { apiError } from "@/lib/server";
import { logoutHousehold } from "@/lib/household-auth";
export async function POST(request: Request) {
  try {
    checkHouseholdOrigin(request);
    return await logoutHousehold();
  } catch (error) {
    return apiError(error);
  }
}
