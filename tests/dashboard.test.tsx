// @vitest-environment jsdom
import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { AppContext } from "../src/components/context";
import { Dashboard } from "../src/components/dashboard";
import { demoProviders } from "../src/lib/data";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function setup(
  providers = [] as typeof demoProviders,
  role = "admin",
  failed = false,
) {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/providers" && !init)
      return {
        ok: !failed,
        json: async () => ({ providers, demo: true, demoAuth: false }),
      };
    if (url === "/api/auth/me")
      return {
        ok: true,
        json: async () => ({
          id: "admin",
          email: "admin@test",
          role,
          programIds: providers.map((p) => p.id),
          changes: [],
          audit: [],
          feedback: [],
          demo: false,
        }),
      };
    return { ok: true, json: async () => ({ id: "new" }) };
  });
  vi.stubGlobal("fetch", fetcher);
  render(
    <AppContext>
      <Dashboard admin={role === "admin"} />
    </AppContext>,
  );
  return fetcher;
}
it("offers first listing creation with real source requirements in an empty directory", async () => {
  setup();
  await screen.findByText("Add a listing");
  expect(
    await screen.findByText("The directory is empty. Add the first listing."),
  ).toBeTruthy();
  expect(screen.queryByText("Data quality review")).toBeNull();
  fireEvent.click(screen.getByText("Add a listing"));
  const source = screen.getByRole("textbox", {
    name: "Data source · URL",
  }) as HTMLInputElement;
  expect(source.required).toBe(true);
  expect(source.pattern).toBe("https://.*");
});

it("shows an unaffiliated access state without any provider or administrator tools", async () => {
  setup([structuredClone(demoProviders[0])], "unaffiliated");
  await screen.findByText("Organization access not approved");
  expect(screen.queryByText("Add a listing")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Submit for review" }),
  ).toBeNull();
  expect(screen.queryByText("Data quality review")).toBeNull();
  expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
});
it("distinguishes a failed directory load and hides administrator creation for providers", async () => {
  setup([], "provider", true);
  await waitFor(() => expect(screen.queryByText("Loading…")).toBeNull());
  expect(screen.queryByText("Add a listing")).toBeNull();
  expect(
    screen.queryByText("The directory is empty. Add the first listing."),
  ).toBeNull();
});
it("loads midnight hours and submits the original 1440 minute boundary", async () => {
  const p = structuredClone(demoProviders[0]);
  p.program.hours = [{ day: 1, start: 1320, end: 1440 }];
  const fetcher = setup([p]);
  await screen.findByText("Add a listing");
  const midnight = screen.getByLabelText(
    "End of day (midnight)",
  ) as HTMLInputElement;
  expect(midnight.checked).toBe(true);
  fireEvent.change(screen.getByLabelText("Update note"), {
    target: { value: "Midnight regression" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
  await waitFor(() =>
    expect(fetcher.mock.calls.some(([url]) => url === "/api/changes")).toBe(
      true,
    ),
  );
  const sent = fetcher.mock.calls.find(([url]) => url === "/api/changes")![1]!;
  expect(JSON.parse(sent.body as string).hours).toEqual([
    { day: 1, start: 1320, end: 1440 },
  ]);
  fireEvent.click(midnight);
  fireEvent.click(screen.getByLabelText("End of day (midnight)"));
  expect(
    (screen.getByLabelText("End of day (midnight)") as HTMLInputElement)
      .checked,
  ).toBe(true);
});

it("sends selected fields and public evidence separately from private review notes", async () => {
  const fetcher = setup([structuredClone(demoProviders[0])]);
  await screen.findByText("Data quality review");
  const checkbox = screen.getByRole("checkbox", { name: "Pickup hours" });
  fireEvent.click(checkbox);
  fireEvent.change(
    screen.getByRole("textbox", { name: "Public evidence URL (optional)" }),
    { target: { value: "https://example.test/hours" } },
  );
  fireEvent.change(
    screen.getByRole("textbox", { name: "Verification or review note" }),
    {
      target: { value: "Private evidence review notes" },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "Record review" }));
  await waitFor(() =>
    expect(
      fetcher.mock.calls.some(([url]) => url === "/api/verification"),
    ).toBe(true),
  );
  const sent = fetcher.mock.calls.find(
    ([url]) => url === "/api/verification",
  )![1]!;
  expect(JSON.parse(sent.body as string)).toMatchObject({
    fields: ["hours"],
    sourceUrl: "https://example.test/hours",
    notes: "Private evidence review notes",
  });
});
