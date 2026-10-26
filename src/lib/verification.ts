import type { Provider, VerificationField } from "./model";
export const verificationFields: VerificationField[] = [
  "hours",
  "offerings",
  "eligibility",
  "phone",
  "coordinates",
];
export const coreVerificationFields = [
  "hours",
  "offerings",
  "eligibility",
] as const;

/** Shared freshness policy for matching and public verification information. */
export const VERIFICATION_MAX_AGE_DAYS = 30;
const MAX_AGE_MS = VERIFICATION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

export type VerificationFreshness = "recent" | "outdated" | "unconfirmed";

export function providerVerificationDate(provider: Provider): string | null {
  if (provider.demo) return null;
  if (!provider.verification) return provider.verifiedAt;
  const dates = coreVerificationFields.map(
    (field) => provider.verification?.[field]?.checkedAt,
  );
  if (dates.some((date) => !date || !Number.isFinite(Date.parse(date))))
    return null;
  return dates.reduce<string | null>(
    (oldest, date) =>
      !oldest || Date.parse(date!) < Date.parse(oldest) ? date! : oldest,
    null,
  );
}

export function providerVerificationStatus(
  provider: Provider,
  now = new Date(),
) {
  if (!provider.verification)
    return verificationFreshness(provider.verifiedAt, now);
  const statuses = coreVerificationFields.map((field) =>
    verificationFreshness(
      provider.verification?.[field]?.checkedAt ?? null,
      now,
    ),
  );
  if (provider.demo) return "unconfirmed";
  if (statuses.every((status) => status === "recent")) return "recent";
  if (statuses.includes("outdated")) return "outdated";
  return statuses.includes("recent") ? "partial" : "unconfirmed";
}

export function verificationFreshness(
  checkedAt: string | null,
  now = new Date(),
): VerificationFreshness {
  if (!checkedAt) return "unconfirmed";
  const timestamp = Date.parse(checkedAt);
  if (
    !Number.isFinite(timestamp) ||
    !Number.isFinite(now.getTime()) ||
    timestamp > now.getTime()
  )
    return "unconfirmed";
  return now.getTime() - timestamp > MAX_AGE_MS ? "outdated" : "recent";
}
