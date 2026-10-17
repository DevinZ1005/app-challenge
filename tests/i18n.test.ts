import { it, expect } from "vitest";
import { en, es } from "../src/lib/i18n";
it("provides all English keys in Spanish without missing strings", () => {
  expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  for (const value of Object.values(es)) {
    expect(value).toBeTruthy();
  }
  expect(es.days).toHaveLength(7);
});
