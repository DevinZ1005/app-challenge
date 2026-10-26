import { expect, it } from "vitest";
import { googleMapsDirectionsUrl } from "../src/lib/directions";

it("uses KHCC's published address in the official destination-only directions URL", () => {
  const address = "3101 Kingsbridge Terrace, Bronx, NY 10463";
  expect(googleMapsDirectionsUrl(address)).toBe(
    "https://www.google.com/maps/dir/?api=1&destination=3101%20Kingsbridge%20Terrace%2C%20Bronx%2C%20NY%2010463",
  );
});
it.each([
  "123 Main St, Bronx, NY",
  "10 Calle José & Ana #2, Nueva York",
  "5 Main St?origin=private&travelmode=walking",
  "50% Community Pantry, Bronx",
])("encodes the full address as one destination: %s", (address) => {
  const href = googleMapsDirectionsUrl(`  ${address}  `)!;
  const url = new URL(href);
  expect(url.origin).toBe("https://www.google.com");
  expect(url.pathname).toBe("/maps/dir/");
  expect([...url.searchParams.entries()]).toEqual([
    ["api", "1"],
    ["destination", address],
  ]);
});
it.each([
  undefined,
  null,
  "",
  " \n\t ",
  123,
  {},
  "—",
  "10463",
  "Unknown",
  "Address not available",
  "N/A",
  "Dirección no disponible",
  "desconocida",
  "\ud800",
])("hides unusable addresses: %j", (address) => {
  expect(googleMapsDirectionsUrl(address)).toBeNull();
});
it("does not generate links beyond the Maps URL length limit", () => {
  expect(googleMapsDirectionsUrl("Street ".repeat(500))).toBeNull();
});
