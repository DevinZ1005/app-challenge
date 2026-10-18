import { it, expect } from "vitest";
import { updateSchema } from "../src/lib/updates";
import {
  realListingSchema,
  listingSchema,
  verificationSchema,
} from "../src/lib/listings";
const proposal = {
  programId: "test",
  hours: [{ day: 1, start: 1320, end: 1440 }],
  exceptions: [],
  offerings: null,
  appointment: "no",
  eligibility: null,
  phone: null,
  note: "Test proposal",
};
it("supports midnight and rejects reversed or duplicate windows and impossible dates", () => {
  expect(updateSchema.safeParse(proposal).success).toBe(true);
  for (const patch of [
    { hours: [proposal.hours[0], proposal.hours[0]] },
    { hours: [{ day: 1, start: 1320, end: 0 }] },
    { exceptions: [{ date: "2026-02-30", closed: true }] },
    {
      exceptions: [
        { date: "2026-10-19", closed: true },
        { date: "2026-10-19", closed: false },
      ],
    },
  ])
    expect(updateSchema.safeParse({ ...proposal, ...patch }).success).toBe(
      false,
    );
});
it("requires HTTPS sources at the real API boundary even when fixtures remain", () => {
  const listing = {
    name: { en: "Test", es: "Prueba" },
    description: { en: "Test", es: "Prueba" },
    address: { en: "Test", es: "Prueba" },
    zip: "10468",
    lat: 40,
    lng: -73,
    type: "pantry",
    sourceName: { en: "Test", es: "Prueba" },
    collectedAt: new Date().toISOString(),
    sourceUrl: "",
  };
  expect(listingSchema.safeParse(listing).success).toBe(true);
  expect(realListingSchema.safeParse(listing).success).toBe(false);
  expect(
    realListingSchema.safeParse({
      ...listing,
      sourceUrl: "http://example.test",
    }).success,
  ).toBe(false);
  expect(
    realListingSchema.safeParse({
      ...listing,
      sourceUrl: "https://example.test",
    }).success,
  ).toBe(true);
});
it("does not infer eligibility classification from selecting the field", () => {
  const v = {
    programId: "test",
    method: "official_source",
    fields: ["eligibility"],
    notes: "Personally reviewed evidence",
  };
  expect(verificationSchema.safeParse(v).success).toBe(false);
  expect(
    verificationSchema.safeParse({ ...v, eligibilityStatus: "unrestricted" })
      .success,
  ).toBe(true);
});
