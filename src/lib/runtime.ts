import { HttpError } from "./http";

export function assertRuntimeConfiguration(
  env: NodeJS.ProcessEnv = process.env,
) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (Boolean(url) !== Boolean(key))
    throw new HttpError(503, "Service configuration incomplete");
  if (
    env.NODE_ENV === "production" &&
    !url &&
    env.PANTRYFIT_ALLOW_DEMO !== "true"
  )
    throw new HttpError(503, "Service configuration incomplete");
  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new HttpError(503, "Service configuration incomplete");
    }
    if (
      !["https:", "http:"].includes(parsed.protocol) ||
      (env.NODE_ENV === "production" && parsed.protocol !== "https:")
    )
      throw new HttpError(503, "Service configuration incomplete");
  }
}
