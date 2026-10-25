import "server-only";
import { createHash } from "node:crypto";
import { HttpError } from "./http";

const buckets = new Map<string, { count: number; expires: number }>();
function limit(key: string, maximum: number, windowMs: number) {
  const now = Date.now();
  for (const [id, value] of buckets)
    if (value.expires <= now) buckets.delete(id);
  const bucket = buckets.get(key);
  if (!bucket) {
    // Fail closed when full; clearing the map would reset attackers' budgets.
    if (buckets.size >= 10000) throw new HttpError(429, "Try again later");
    buckets.set(key, { count: 1, expires: now + windowMs });
  } else if (++bucket.count > maximum)
    throw new HttpError(429, "Try again later");
}
export function limitHouseholdAuth(
  action: "send" | "verify" | "demo",
  email?: string,
) {
  limit("global:" + action, action === "verify" ? 100 : 30, 60000);
  if (email) {
    const account = createHash("sha256").update(email).digest("hex");
    limit(
      action + ":" + account,
      action === "send" ? 1 : 5,
      action === "send" ? 60000 : 600000,
    );
  }
}
