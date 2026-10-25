import { it, expect } from "vitest";
import { parseTimeInput } from "../src/lib/time-input";
import { householdSchema, defaultPreferences } from "../src/lib/model";
import {
  approximateRoute,
  mapViewport,
  exampleOrigin,
} from "../src/lib/route-preview";
import { demoProviders } from "../src/lib/data";
import { evaluateTravelCompatibility } from "../src/lib/matching";
it("accepts typed clock times, examples, and end-of-day without normalizing invalid times", () => {
  for (const [value, minute] of [
    ["9am", 540],
    ["1:45 PM", 825],
    ["13:30", 810],
    ["12am", 0],
  ] as const)
    expect(parseTimeInput(value)).toBe(minute);
  for (const value of ["25:00", "13pm", "9:99", "not a time", ""])
    expect(parseTimeInput(value)).toBeNull();
  expect(parseTimeInput("24:00")).toBeNull();
  expect(parseTimeInput("24:00", true)).toBe(1440);
});
it("validates both range bounds and preserves custom minutes", () => {
  expect(
    householdSchema.parse({
      ...defaultPreferences,
      minMinutes: 12,
      maxMinutes: 37,
    }),
  ).toMatchObject({ minMinutes: 12, maxMinutes: 37 });
  for (const patch of [
    { minMinutes: 40, maxMinutes: 20 },
    { minMinutes: -1 },
    { maxMinutes: 181 },
    { maxMinutes: 0 },
  ])
    expect(
      householdSchema.safeParse({ ...defaultPreferences, ...patch }).success,
    ).toBe(false);
});
it("checks both endpoints for reliable journey estimates", () => {
  const p = structuredClone(demoProviders[0]);
  const location = { lat: 40.87, lng: -73.89 };
  const now = new Date();
  p.coordinatesVerified = true;
  p.travel = {
    mode: "walking",
    minutes: 10,
    reliable: true,
    estimatedAt: now.toISOString(),
    origin: location,
    destination: p.coordinates,
  };
  expect(
    evaluateTravelCompatibility(
      { ...defaultPreferences, minMinutes: 15, maxMinutes: 30, location },
      p,
      now,
    ).state,
  ).toBe("incompatible");
  p.travel.minutes = 15;
  expect(
    evaluateTravelCompatibility(
      { ...defaultPreferences, minMinutes: 15, maxMinutes: 30, location },
      p,
      now,
    ).state,
  ).toBe("compatible");
  p.travel.minutes = 30;
  expect(
    evaluateTravelCompatibility(
      { ...defaultPreferences, minMinutes: 15, maxMinutes: 30, location },
      p,
      now,
    ).state,
  ).toBe("compatible");
});
it("keeps fictional routes separate from user location and does not turn approximations into verified travel", () => {
  const p = structuredClone(demoProviders[0]);
  const before = structuredClone(p);
  const route = approximateRoute(p, { lat: 10, lng: 10 })!;
  expect(route.origin).toEqual(exampleOrigin);
  expect(route.maxMinutes).toBeGreaterThanOrEqual(route.minMinutes);
  expect(p).toEqual(before);
  p.demo = false;
  expect(approximateRoute(p, exampleOrigin)).toBeNull();
  p.coordinatesVerified = true;
  expect(approximateRoute(p)).toBeNull();
  expect(approximateRoute(p, exampleOrigin)?.example).toBe(false);
  expect(mapViewport([exampleOrigin, p.coordinates]).zoom).toBeGreaterThan(10);
});
