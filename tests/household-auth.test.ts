import { beforeEach, afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  token: "",
  getUser: vi.fn(),
  send: vi.fn(),
  verify: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Error("redirect:" + path);
  },
}));
vi.mock("../src/lib/server", async () => {
  const { HttpError } = await import("../src/lib/http");
  return {
    isDemo: false,
    HttpError,
    checkOrigin: (request: Request) => {
      if (
        new URL(request.headers.get("origin") || "https://invalid").host !==
        request.headers.get("host")
      )
        throw new HttpError(403, "Same-origin request required");
    },
    supabase: () => ({
      auth: {
        getUser: state.getUser,
        signInWithOtp: state.send,
        verifyOtp: state.verify,
        admin: { signOut: state.signOut },
      },
    }),
  };
});
import {
  checkHouseholdOrigin,
  createHouseholdDemo,
  householdCookie,
  householdSignedIn,
  requestHouseholdCode,
  requireHousehold,
  verifyHouseholdCode,
  logoutHousehold,
} from "../src/lib/household-auth";
beforeEach(() => {
  vi.clearAllMocks();
  state.token = "";
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-test-key");
  vi.stubEnv("PANTRYFIT_EMAIL_LOGIN_ENABLED", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it("requires a verified server identity and never treats cookie presence as login", async () => {
  expect(await householdSignedIn()).toBe(false);
  await expect(requireHousehold()).rejects.toThrow("redirect:/login");
  state.token = "forged";
  state.getUser.mockResolvedValue({
    data: { user: null },
    error: Error("expired"),
  });
  expect(await householdSignedIn()).toBe(false);
  expect(state.getUser).toHaveBeenCalledWith("forged");
  for (const user of [
    { email_confirmed_at: null },
    { email_confirmed_at: "today", is_anonymous: true },
  ]) {
    state.getUser.mockResolvedValue({ data: { user }, error: null });
    expect(await householdSignedIn()).toBe(false);
  }
  state.getUser.mockResolvedValue({
    data: { user: { email_confirmed_at: "today", is_anonymous: false } },
    error: null,
  });
  expect(await householdSignedIn()).toBe(true);
});
it("disables both email routes until configured and never enables demo for real projects", async () => {
  vi.stubEnv("PANTRYFIT_EMAIL_LOGIN_ENABLED", "false");
  await expect(requestHouseholdCode("a@example.com")).rejects.toMatchObject({
    status: 503,
  });
  await expect(
    verifyHouseholdCode("a@example.com", "123456"),
  ).rejects.toMatchObject({ status: 503 });
  await expect(createHouseholdDemo()).rejects.toMatchObject({ status: 404 });
  expect(state.send).not.toHaveBeenCalled();
});
it("normalizes address-specific failures without disclosing account existence", async () => {
  for (const error of [
    null,
    { status: 400 },
    { status: 422 },
    { status: 429 },
  ]) {
    state.send.mockResolvedValue({ error });
    await expect(
      requestHouseholdCode("a@example.com"),
    ).resolves.toBeUndefined();
  }
  state.send.mockResolvedValue({ error: { status: 503 } });
  await expect(requestHouseholdCode("a@example.com")).rejects.toMatchObject({
    status: 503,
  });
});
it("issues no session for a bad code and keeps valid tokens out of JSON", async () => {
  state.verify.mockResolvedValue({ data: {}, error: Error() });
  await expect(
    verifyHouseholdCode("a@example.com", "123456"),
  ).rejects.toMatchObject({ status: 401 });
  state.verify.mockResolvedValue({
    data: {
      session: { access_token: "secret-test-token", expires_in: 600 },
      user: { email_confirmed_at: "today" },
    },
    error: null,
  });
  const response = await verifyHouseholdCode("a@example.com", "123456");
  expect(await response.json()).toEqual({ ok: true });
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(response.headers.get("set-cookie")).toContain("SameSite=strict");
  expect(response.cookies.get(householdCookie)?.maxAge).toBe(600);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("revokes only the current upstream session and clears its cookie", async () => {
  state.token = "real-token";
  state.signOut.mockResolvedValue({ error: null });
  const response = await logoutHousehold();
  expect(state.signOut).toHaveBeenCalledWith("real-token", "local");
  expect(response.cookies.get(householdCookie)?.maxAge).toBe(0);
});
it("rejects missing origins, other schemes, and an unconfigured production origin", () => {
  const request = (origin?: string) =>
    new Request("http://localhost:3000/api/household/demo", {
      headers: { host: "localhost:3000", ...(origin ? { origin } : {}) },
    });
  expect(() => checkHouseholdOrigin(request())).toThrow();
  expect(() =>
    checkHouseholdOrigin(request("https://localhost:3000")),
  ).toThrow();
  expect(() =>
    checkHouseholdOrigin(request("http://localhost:3000")),
  ).not.toThrow();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("PANTRYFIT_APP_ORIGIN", "");
  expect(() => checkHouseholdOrigin(request("http://localhost:3000"))).toThrow(
    "configuration",
  );
});
it("limits guesses and code sends without trusting client IP headers", async () => {
  const { limitHouseholdAuth } = await import("../src/lib/auth-limits");
  const email = `${crypto.randomUUID()}@example.com`;
  limitHouseholdAuth("send", email);
  expect(() => limitHouseholdAuth("send", email)).toThrow("Try again later");
  for (let i = 0; i < 5; i++) limitHouseholdAuth("verify", email);
  expect(() => limitHouseholdAuth("verify", email)).toThrow("Try again later");
});
