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
import { AppContext, useApp } from "../src/components/context";
import { demoProviders } from "../src/lib/data";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function Probe() {
  const {
    providers,
    loading,
    loadError,
    refresh,
    preferences,
    setPreferences,
  } = useApp();
  return (
    <>
      <output data-testid="state">
        {loading ? "loading" : loadError ? "failed" : providers.length}
      </output>
      <output data-testid="zip">{preferences.zip}</output>
      <button onClick={refresh}>Retry</button>
      <button onClick={() => setPreferences({ ...preferences, zip: "10467" })}>
        Edit
      </button>
    </>
  );
}
it("never substitutes fictional listings for a failed provider request and supports retry", async () => {
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(Error("offline"))
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        providers: demoProviders,
        demo: true,
        demoAuth: true,
      }),
    });
  vi.stubGlobal("fetch", fetchMock);
  render(
    <AppContext>
      <Probe />
    </AppContext>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("state").textContent).toBe("failed"),
  );
  fireEvent.click(screen.getByText("Edit"));
  fireEvent.click(screen.getByText("Retry"));
  await waitFor(() =>
    expect(screen.getByTestId("state").textContent).toBe(
      String(demoProviders.length),
    ),
  );
  expect(screen.getByTestId("zip").textContent).toBe("10467");
});
