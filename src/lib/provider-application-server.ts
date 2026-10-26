import "server-only";
import { isDemo, supabase } from "./server";
import { HttpError } from "./http";
import { providerApplicationSchema } from "./provider-application";

export async function submitProviderApplication(raw: unknown) {
  const payload = providerApplicationSchema.parse(raw);
  if (isDemo)
    throw new HttpError(
      503,
      "Applications are unavailable in the fictional demo",
    );
  try {
    // Public execute permission is deliberately limited to this pending-only RPC.
    // Database validation and shared limits also govern direct Supabase callers.
    const { error } = await supabase().rpc("submit_provider_application", {
      application: payload,
    });
    if (error?.code === "P0001" && error.message === "application_rate_limited")
      throw new HttpError(
        429,
        "Please wait before submitting another application",
      );
    if (error?.code === "22023")
      throw new HttpError(400, "Check the application fields");
    if (error) throw new Error("Application storage unavailable");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      503,
      "Applications are temporarily unavailable; try again later",
    );
  }
}
