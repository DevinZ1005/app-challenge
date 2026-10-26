import {
  householdSchema,
  type HouseholdPreferences,
  type Provider,
  type ConstraintEvaluation,
  type MatchResult,
  type Factor,
} from "./model";
import { providerVerificationStatus } from "./verification";
export const weights: Record<Factor, number> = {
  schedule: 30,
  travel: 25,
  storage: 20,
  cooking: 15,
  diet: 10,
  eligibility: 0,
  combination: 0,
};
const evaluation = (
  factor: Factor,
  state: ConstraintEvaluation["state"],
  hard: boolean,
  active = true,
  code: string = state,
): ConstraintEvaluation => ({ factor, state, hard, active, code });
export function overlaps(
  a: { start: number; end: number },
  b: { start: number; end: number },
) {
  return Math.max(a.start, b.start) < Math.min(a.end, b.end);
}
export function localDates(now: Date) {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(key + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), day: (d.getUTCDay() + 6) % 7 };
  });
}
export function evaluateScheduleCompatibility(
  h: HouseholdPreferences,
  p: Provider,
  now: Date,
) {
  if (!h.availability.length)
    return evaluation("schedule", "unknown", false, false, "notSelected");
  if (!p.program.hours)
    return evaluation("schedule", "unknown", true, true, "missing");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const minute =
    Number(parts.find((p) => p.type === "hour")?.value) * 60 +
    Number(parts.find((p) => p.type === "minute")?.value);
  const today = localDates(now)[0].date;
  const available = localDates(now).some(
    (d) =>
      !p.program.exceptions.some((e) => e.date === d.date && e.closed) &&
      h.availability.some(
        (a) =>
          a.day === d.day &&
          p.program.hours!.some(
            (w) =>
              w.day === d.day &&
              overlaps(
                {
                  ...a,
                  start: Math.max(a.start, d.date === today ? minute : 0),
                },
                w,
              ) &&
              a.end > Math.max(a.start, d.date === today ? minute : 0),
          ),
      ),
  );
  return evaluation(
    "schedule",
    available ? "compatible" : "incompatible",
    true,
  );
}
export function evaluateTravelCompatibility(
  h: HouseholdPreferences,
  p: Provider,
  now: Date,
) {
  const t = p.travel;
  if (
    !t ||
    !t.reliable ||
    !h.location ||
    !t.origin ||
    !t.destination ||
    !p.coordinatesVerified ||
    t.origin.lat !== h.location.lat ||
    t.origin.lng !== h.location.lng ||
    t.destination.lat !== p.coordinates.lat ||
    t.destination.lng !== p.coordinates.lng ||
    !Number.isFinite(t.minutes) ||
    t.minutes < 0 ||
    !Number.isFinite(Date.parse(t.estimatedAt)) ||
    now.getTime() - Date.parse(t.estimatedAt) > 86400000 ||
    Date.parse(t.estimatedAt) > now.getTime() ||
    (h.mode !== "either" && h.mode !== t.mode)
  )
    return evaluation("travel", "unknown", true, true, "missing");
  return evaluation(
    "travel",
    t.minutes <= h.maxMinutes ? "compatible" : "incompatible",
    true,
  );
}
export function evaluateFoodCompatibility(
  h: HouseholdPreferences,
  p: Provider,
): ConstraintEvaluation[] {
  const offers = p.program.offerings;
  const storageActive =
    h.refrigeration === "no" || h.refrigeration === "limited" || h.shelfStable;
  const cookingActive = h.equipment.length > 0;
  const dietActive = h.diet !== "none";
  const test = (
    factor: Factor,
    active: boolean,
    hard: boolean,
    predicate: (o: NonNullable<typeof offers>[number]) => boolean,
  ) => {
    if (!active)
      return evaluation(factor, "unknown", false, false, "notSelected");
    if (!offers?.length || offers.some((o) => !o.verified))
      return evaluation(factor, "unknown", hard, true, "missing");
    return evaluation(
      factor,
      offers.some(predicate) ? "compatible" : "incompatible",
      hard,
    );
  };
  const result = [
    test("storage", storageActive, true, (o) => o.storage === "shelf"),
    test(
      "cooking",
      cookingActive,
      true,
      (o) =>
        o.equipment.includes("none") ||
        o.equipment.some((e) => h.equipment.includes(e)),
    ),
    test(
      "diet",
      dietActive,
      h.strictDiet,
      (o) => h.diet !== "other" && o.diets.includes(h.diet),
    ),
  ];
  // A single usable food option must satisfy all selected hard food requirements together.
  if (
    offers?.length &&
    offers.every((o) => o.verified) &&
    result
      .filter((e) => e.hard)
      .every((e) => !e.active || e.state === "compatible") &&
    !offers.some(
      (o) =>
        (!storageActive || o.storage === "shelf") &&
        (!cookingActive ||
          o.equipment.includes("none") ||
          o.equipment.some((e) => h.equipment.includes(e))) &&
        (!dietActive || !h.strictDiet || o.diets.includes(h.diet)),
    )
  )
    result.push(
      evaluation("combination", "incompatible", true, true, "conflict"),
    );
  if (
    offers?.some((o) => o.storage === "unknown") &&
    storageActive &&
    !offers.some((o) => o.storage === "shelf" && o.verified)
  )
    result[0] = evaluation("storage", "unknown", true, true, "missing");
  if (h.diet === "other")
    result[2] = evaluation("diet", "unknown", h.strictDiet, true, "missing");
  return result;
}
export function evaluateEligibility(p: Provider) {
  return evaluation(
    "eligibility",
    p.program.eligibilityStatus === "unrestricted" ? "compatible" : "unknown",
    true,
    true,
    p.program.eligibilityStatus === "unrestricted" ? "compatible" : "missing",
  );
}
export function calculateMatchScore(e: ConstraintEvaluation[], w = weights) {
  if (
    Object.values(w).some((v) => !Number.isFinite(v) || v < 0) ||
    Object.values(w).every((v) => v === 0)
  )
    throw new Error(
      "Weights must be nonnegative, finite and include a positive factor",
    );
  const active = e.filter((x) => x.active && w[x.factor] > 0);
  const total = active.reduce((s, x) => s + w[x.factor], 0);
  const known = active
    .filter((x) => x.state !== "unknown")
    .reduce((s, x) => s + w[x.factor], 0);
  const fit = active
    .filter((x) => x.state === "compatible")
    .reduce((s, x) => s + w[x.factor], 0);
  return {
    score: known ? Math.round((fit / known) * 100) : 0,
    confidence: total ? Math.round((known / total) * 100) : 0,
  };
}
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const r = (v: number) => (v * Math.PI) / 180;
  const x =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) *
      Math.cos(r(b.lat)) *
      Math.sin(r(b.lng - a.lng) / 2) ** 2;
  const clamped = Math.min(1, Math.max(0, x));
  return 6371 * 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
}
export function generateMatchExplanations(e: ConstraintEvaluation[]) {
  return e
    .filter((x) => x.active)
    .map(({ factor, code, state }) => ({ factor, code, state }));
}
export function rankProviders(
  input: HouseholdPreferences,
  providers: Provider[],
  now = new Date(),
  w = weights,
): MatchResult[] {
  const h = householdSchema.parse(input);
  return providers
    .map((provider) => {
      const evaluations = [
        evaluateScheduleCompatibility(h, provider, now),
        evaluateTravelCompatibility(h, provider, now),
        ...evaluateFoodCompatibility(h, provider),
        evaluateEligibility(provider),
      ];
      const stale = providerVerificationStatus(provider, now) !== "recent";
      const hardFailure = evaluations.some(
        (e) => e.active && e.hard && e.state === "incompatible",
      );
      const unknown = evaluations.some(
        (e) => e.active && e.state === "unknown",
      );
      const score = calculateMatchScore(evaluations, w);
      return {
        provider,
        ...score,
        stale,
        category: hardFailure
          ? "unsuitable"
          : unknown || stale || score.score < 80
            ? "possible"
            : "strong",
        evaluations,
        explanations: generateMatchExplanations(evaluations),
        distanceKm:
          h.location && provider.coordinatesVerified
            ? distanceKm(h.location, provider.coordinates)
            : null,
      } satisfies MatchResult;
    })
    .sort((a, b) => {
      const c = { strong: 0, possible: 1, unsuitable: 2 };
      return (
        c[a.category] - c[b.category] ||
        b.score - a.score ||
        b.confidence - a.confidence ||
        a.provider.id.localeCompare(b.provider.id)
      );
    });
}
