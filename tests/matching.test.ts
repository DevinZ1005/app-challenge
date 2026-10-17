import { describe, it, expect } from "vitest";
import {
  defaultPreferences,
  type Provider,
  type HouseholdPreferences,
} from "../src/lib/model";
import { demoProviders } from "../src/lib/data";
import {
  rankProviders,
  overlaps,
  evaluateScheduleCompatibility,
  calculateMatchScore,
  localDates,
  distanceKm,
} from "../src/lib/matching";
const now = new Date("2026-10-19T12:00:00Z");
function provider(i = 0): Provider {
  return structuredClone(demoProviders[i]);
}
function household(
  p: Partial<HouseholdPreferences> = {},
): HouseholdPreferences {
  return { ...defaultPreferences, ...p };
}
const state = (h: HouseholdPreferences, p: Provider, f: string) =>
  rankProviders(h, [p], now)[0].evaluations.find((e) => e.factor === f)?.state;
describe("constraint-aware ranking", () => {
  it("rejects a nearby pantry closed during selected windows", () => {
    const h = household({ availability: [{ day: 0, start: 480, end: 720 }] });
    expect(rankProviders(h, [provider()], now)[0].category).toBe("unsuitable");
  });
  it("ranks a farther service with compatible hours ahead of a schedule conflict", () => {
    const close = provider();
    close.coordinates = { lat: 40.873, lng: -73.891 };
    const far = provider(1);
    far.coordinates = { lat: 40.9, lng: -73.9 };
    const h = household({ availability: [{ day: 0, start: 1020, end: 1140 }] });
    expect(
      rankProviders(h, [close, far], now).map((r) => r.provider.id),
    ).toEqual([far.id, close.id]);
  });
  it("requires a shelf-stable option when there is no refrigeration", () => {
    expect(
      state(household({ refrigeration: "no" }), provider(2), "storage"),
    ).toBe("incompatible");
    expect(
      state(household({ refrigeration: "no" }), provider(), "storage"),
    ).toBe("compatible");
  });
  it("handles microwave-only households", () => {
    expect(
      state(household({ equipment: ["microwave"] }), provider(2), "cooking"),
    ).toBe("incompatible");
    const p = provider();
    p.program.offerings![0].equipment = ["microwave"];
    expect(state(household({ equipment: ["microwave"] }), p, "cooking")).toBe(
      "compatible",
    );
  });
  it("does not invent compatibility when offerings are missing", () => {
    const r = rankProviders(
      household({ equipment: ["microwave"], refrigeration: "no" }),
      [provider(3)],
      now,
    )[0];
    expect(r.evaluations.find((e) => e.factor === "cooking")?.state).toBe(
      "unknown",
    );
    expect(r.category).toBe("possible");
  });
  it("handles missing hours as unknown", () => {
    expect(
      evaluateScheduleCompatibility(
        household({ availability: [{ day: 0, start: 500, end: 600 }] }),
        provider(3),
        now,
      ).state,
    ).toBe("unknown");
  });
  it("does not verify an unverified dietary requirement", () => {
    const p = provider();
    p.program.offerings![0].verified = false;
    expect(
      state(household({ diet: "vegan", strictDiet: true }), p, "diet"),
    ).toBe("unknown");
  });
  it("downgrades stale records even with all active criteria known", () => {
    const p = provider();
    p.verifiedAt = "2025-01-01T00:00:00Z";
    p.travel = {
      mode: "walking",
      minutes: 10,
      reliable: true,
      estimatedAt: now.toISOString(),
    };
    const r = rankProviders(household(), [p], now)[0];
    expect(r.stale).toBe(true);
    expect(r.category).toBe("possible");
  });
  it("produces distinct weighted scores for known flexible dietary conflicts", () => {
    const a = provider();
    const b = provider(1);
    const h = household({ diet: "vegan", equipment: ["none"] });
    const r = rankProviders(h, [a, b], now);
    expect(r[0].score).toBeGreaterThan(r[1].score);
  });
  it("handles no suitable providers", () => {
    const r = rankProviders(
      household({ equipment: ["none"], refrigeration: "no" }),
      [provider(2)],
      now,
    );
    expect(r.every((x) => x.category === "unsuitable")).toBe(true);
    expect(rankProviders(household(), [], now)).toEqual([]);
  });
  it("detects hard constraints that are only individually satisfiable", () => {
    const p = provider();
    p.program.offerings = [
      {
        name: { en: "A", es: "A" },
        storage: "shelf",
        equipment: ["stovetop"],
        diets: [],
        verified: true,
      },
      {
        name: { en: "B", es: "B" },
        storage: "cold",
        equipment: ["none"],
        diets: [],
        verified: true,
      },
    ];
    const r = rankProviders(
      household({ equipment: ["none"], refrigeration: "no" }),
      [p],
      now,
    )[0];
    expect(r.category).toBe("unsuitable");
    expect(r.explanations.some((e) => e.code === "conflict")).toBe(true);
  });
  it("uses half-open intervals and accepts a partial overlap", () => {
    expect(overlaps({ start: 10, end: 20 }, { start: 20, end: 30 })).toBe(
      false,
    );
    expect(overlaps({ start: 10, end: 21 }, { start: 20, end: 30 })).toBe(true);
  });
  it("applies date-specific exceptional closures", () => {
    const p = provider();
    p.program.hours = [{ day: 0, start: 600, end: 720 }];
    p.program.exceptions = [{ date: "2026-10-19", closed: true }];
    expect(
      evaluateScheduleCompatibility(
        household({ availability: [{ day: 0, start: 600, end: 720 }] }),
        p,
        now,
      ).state,
    ).toBe("incompatible");
  });
  it("breaks equal scores deterministically regardless of input order", () => {
    const a = provider();
    const b = provider();
    a.id = "a";
    b.id = "b";
    expect(
      rankProviders(household(), [b, a], now).map((r) => r.provider.id),
    ).toEqual(["a", "b"]);
  });
  it.each([
    undefined,
    {
      mode: "walking" as const,
      minutes: 5,
      reliable: false,
      estimatedAt: now.toISOString(),
    },
    {
      mode: "walking" as const,
      minutes: 5,
      reliable: true,
      estimatedAt: "2020-01-01T00:00:00Z",
    },
  ])("does not trust unavailable or unreliable travel estimates", (travel) => {
    const p = provider();
    p.travel = travel;
    expect(state(household(), p, "travel")).toBe("unknown");
  });
  it("enforces travel limits without straight-line substitution", () => {
    const p = provider();
    p.coordinatesVerified = true;
    p.travel = {
      mode: "walking",
      minutes: 40,
      origin: { lat: 40.87, lng: -73.89 },
      destination: p.coordinates,
      reliable: true,
      estimatedAt: now.toISOString(),
    };
    expect(
      state(
        household({ maxMinutes: 20, location: { lat: 40.87, lng: -73.89 } }),
        p,
        "travel",
      ),
    ).toBe("incompatible");
  });
  it("weights unknown information only in confidence", () => {
    const r = calculateMatchScore([
      {
        factor: "schedule",
        state: "compatible",
        active: true,
        hard: true,
        code: "compatible",
      },
      {
        factor: "travel",
        state: "unknown",
        active: true,
        hard: true,
        code: "missing",
      },
    ]);
    expect(r).toEqual({ score: 100, confidence: 55 });
  });
  it("never lets a high score override a hard conflict", () => {
    const p = provider();
    const r = rankProviders(
      household({
        refrigeration: "no",
        equipment: ["none"],
        availability: [{ day: 0, start: 600, end: 720 }],
      }),
      [p],
      now,
    )[0];
    expect(r.category).toBe("unsuitable");
  });
  it("keeps household data immutable", () => {
    const h = household();
    const snapshot = structuredClone(h);
    rankProviders(h, [provider()], now);
    expect(h).toEqual(snapshot);
  });
  it("validates malformed input", () => {
    expect(() =>
      rankProviders({ ...household(), maxMinutes: -1 }, [provider()], now),
    ).toThrow();
  });
  it("uses the New York local day around UTC midnight and daylight-saving changes", () => {
    expect(localDates(new Date("2026-11-02T02:00:00Z"))[0]).toEqual({
      date: "2026-11-01",
      day: 6,
    });
  });
  it("calculates only labeled straight-line geography", () => {
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(
      111.195,
      2,
    );
    expect(
      rankProviders(
        household({ location: { lat: 40.87, lng: -73.89 } }),
        [provider()],
        now,
      )[0].distanceKm,
    ).toBeNull();
  });
  it("rejects invalid scoring configurations", () => {
    expect(() =>
      calculateMatchScore([], {
        schedule: -1,
        travel: 25,
        storage: 20,
        cooking: 15,
        diet: 10,
        eligibility: 0,
        combination: 0,
      }),
    ).toThrow();
  });
  it("does not count a joint constraint conflict twice", () => {
    const p = provider();
    p.program.offerings = [
      {
        name: { en: "A", es: "A" },
        storage: "shelf",
        equipment: ["stovetop"],
        diets: [],
        verified: true,
      },
      {
        name: { en: "B", es: "B" },
        storage: "cold",
        equipment: ["none"],
        diets: [],
        verified: true,
      },
    ];
    const r = rankProviders(
      household({
        equipment: ["none"],
        refrigeration: "no",
        diet: "vegan",
        strictDiet: false,
      }),
      [p],
      now,
    )[0];
    expect(r.category).toBe("unsuitable");
    expect(r.evaluations.filter((e) => e.factor === "cooking")).toHaveLength(1);
  });
  it("does not recommend pickup windows already past today", () => {
    const p = provider();
    p.program.hours = [{ day: 0, start: 540, end: 600 }];
    expect(
      evaluateScheduleCompatibility(
        household({ availability: [{ day: 0, start: 540, end: 600 }] }),
        p,
        new Date("2026-10-19T20:00:00Z"),
      ).state,
    ).toBe("incompatible");
  });
  it("treats malformed journey timestamps as unknown", () => {
    const p = provider();
    p.travel = {
      mode: "walking",
      minutes: 10,
      reliable: true,
      estimatedAt: "not-a-date",
    };
    expect(state(household(), p, "travel")).toBe("unknown");
  });
  it("binds journey estimates to the household origin and verified destination", () => {
    const p = provider();
    p.coordinatesVerified = true;
    p.travel = {
      mode: "walking",
      minutes: 10,
      reliable: true,
      estimatedAt: now.toISOString(),
      origin: { lat: 40.87, lng: -73.89 },
      destination: p.coordinates,
    };
    expect(
      state(household({ location: { lat: 40.88, lng: -73.89 } }), p, "travel"),
    ).toBe("unknown");
    expect(
      state(household({ location: { lat: 40.87, lng: -73.89 } }), p, "travel"),
    ).toBe("compatible");
  });
  it("classifies fully known current compatibility as a strong match", () => {
    const p = provider();
    p.verifiedAt = now.toISOString();
    p.coordinatesVerified = true;
    p.travel = {
      mode: "walking",
      minutes: 10,
      reliable: true,
      estimatedAt: now.toISOString(),
      origin: { lat: 40.87, lng: -73.89 },
      destination: p.coordinates,
    };
    expect(
      rankProviders(
        household({ location: { lat: 40.87, lng: -73.89 } }),
        [p],
        now,
      )[0].category,
    ).toBe("strong");
  });
});
