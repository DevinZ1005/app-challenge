// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { VerificationSummary } from "../src/components/verification-summary";
import { demoProviders } from "../src/lib/data";

const language = vi.hoisted(() => ({ locale: "en" }));
vi.mock("../src/components/context", () => ({ useApp: () => language }));
afterEach(() => {
  cleanup();
  language.locale = "en";
});

it("never presents a fictional service as recently checked even with a date", () => {
  const provider = {
    ...demoProviders[0],
    verifiedAt: new Date().toISOString(),
  };
  render(<VerificationSummary provider={provider} />);
  expect(screen.getByText("Fictional demo service")).toBeTruthy();
  expect(screen.queryByText(/Last checked/)).toBeNull();
  expect(screen.getByText(/do not verify a real service/)).toBeTruthy();
});

it("warns that old real-service evidence needs another check", () => {
  const provider = {
    ...demoProviders[0],
    demo: false,
    verifiedAt: "2000-01-01T12:00:00Z",
  };
  render(<VerificationSummary provider={provider} />);
  expect(screen.getByText("Recheck needed")).toBeTruthy();
  expect(screen.getByText(/Last checked/)).toBeTruthy();
});

it("renders invalid evidence safely and explains missing confirmation in Spanish", () => {
  language.locale = "es";
  const provider = { ...demoProviders[0], demo: false, verifiedAt: "invalid" };
  render(<VerificationSummary provider={provider} />);
  expect(screen.getAllByText("Necesita confirmación").length).toBeGreaterThan(
    0,
  );
  expect(
    screen.getByText(/Confirma los detalles antes de visitar/),
  ).toBeTruthy();
  expect(screen.queryByText(/Última revisión/)).toBeNull();
});

it("shows partial confirmation and links only the recorded public evidence", () => {
  const provider = {
    ...demoProviders[0],
    demo: false,
    verification: {
      hours: {
        checkedAt: new Date().toISOString(),
        method: "official_source" as const,
        sourceUrl: "https://example.test/hours",
      },
    },
  };
  render(<VerificationSummary provider={provider} />);
  expect(screen.getByText("Information partially checked")).toBeTruthy();
  expect(screen.getByText("Confirmed recently")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Evidence source" }).getAttribute("href"),
  ).toBe("https://example.test/hours");
  expect(screen.queryByText(/Last checked/)).toBeNull();
});
