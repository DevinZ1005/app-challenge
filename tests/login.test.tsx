// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Login } from "../src/components/dashboard";
import { en } from "../src/lib/i18n";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../src/components/context", () => ({
  useApp: () => ({ t: en, demoAuth: false }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  router.push.mockReset();
});

async function submit(accountResponse: {
  ok: boolean;
  json: () => Promise<unknown>;
}) {
  const fetcher = vi.fn(async (url: string) => {
    if (url === "/api/auth/login") return { ok: true };
    if (url === "/api/auth/me") return accountResponse;
    throw Error("Unexpected test request");
  });
  vi.stubGlobal("fetch", fetcher);
  render(<Login />);
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "person@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "synthetic-test-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith("/api/auth/me"));
}

it.each([
  ["admin", "/admin"],
  ["provider", "/provider/dashboard"],
  ["unaffiliated", "/provider/access"],
])(
  "routes a successfully loaded %s account explicitly",
  async (role, destination) => {
    await submit({ ok: true, json: async () => ({ role }) });
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(destination));
  },
);

it.each([401, 403, 503])(
  "does not redirect on an unsuccessful account response (%s)",
  async (status) => {
    await submit({
      ok: false,
      json: async () => ({
        error: "Synthetic account error",
        status,
        role: "provider",
      }),
    });
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      en.accountUnavailable,
    );
    expect(router.push).not.toHaveBeenCalled();
  },
);

it("does not redirect on an unknown or missing account role", async () => {
  await submit({
    ok: true,
    json: async () => ({ error: "Unexpected response" }),
  });
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    en.accountUnavailable,
  );
  expect(router.push).not.toHaveBeenCalled();
});

it("does not redirect when account JSON is invalid", async () => {
  await submit({
    ok: true,
    json: async () => {
      throw SyntaxError("invalid JSON");
    },
  });
  await screen.findByRole("alert");
  expect(router.push).not.toHaveBeenCalled();
});
