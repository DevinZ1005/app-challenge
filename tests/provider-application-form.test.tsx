// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProviderApplicationForm } from "../src/components/provider-application";
import { en, es } from "../src/lib/i18n";
const state = vi.hoisted(() => ({ spanish: false }));
vi.mock("../src/components/context", () => ({
  useApp: () => ({ t: state.spanish ? es : en }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  state.spanish = false;
});
function fillForm() {
  for (const [label, value] of [
    [en.applicationOrganization, "Synthetic Pantry"],
    [en.applicationAddress, "Example address in the Bronx"],
    [en.applicationContact, "Test Representative"],
    [en.applicationEmail, "person@example.test"],
    [
      en.applicationDescription,
      "Synthetic food assistance organization for testing only.",
    ],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
it("provides labeled required and optional fields and acknowledges review without signing in", async () => {
  const fetcher = vi.fn().mockResolvedValue({ status: 202 });
  vi.stubGlobal("fetch", fetcher);
  render(<ProviderApplicationForm />);
  expect(
    (screen.getByLabelText(en.applicationPhone) as HTMLInputElement).required,
  ).toBe(false);
  expect(
    (screen.getByLabelText(en.applicationOrganization) as HTMLInputElement)
      .required,
  ).toBe(true);
  fillForm();
  fireEvent.click(screen.getByRole("button", { name: en.applicationSubmit }));
  expect(await screen.findByRole("status")).toHaveProperty(
    "textContent",
    expect.stringContaining(en.applicationSuccess),
  );
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(
    "/api/provider-applications",
    expect.objectContaining({ method: "POST" }),
  );
  expect(
    screen.queryByRole("button", { name: en.applicationSubmit }),
  ).toBeNull();
});
it("preserves entries when storage fails and gives a safe retry message", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 503 }));
  render(<ProviderApplicationForm />);
  fillForm();
  fireEvent.click(screen.getByRole("button", { name: en.applicationSubmit }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    en.applicationUnavailable,
  );
  expect(
    (screen.getByLabelText(en.applicationOrganization) as HTMLInputElement)
      .value,
  ).toBe("Synthetic Pantry");
});
it("renders the application in Spanish", () => {
  state.spanish = true;
  render(<ProviderApplicationForm />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    es.applicationTitle,
  );
  expect(screen.getByLabelText(es.applicationEmail)).toBeTruthy();
});
