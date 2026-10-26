import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { providerApplicationSchema } from "../src/lib/provider-application";

const state = vi.hoisted(() => ({ rpc: vi.fn(), demo: false }));
vi.mock("server-only", () => ({}));
vi.mock("../src/lib/server", async () => {
  const { HttpError } = await import("../src/lib/http");
  return {
    get isDemo() {
      return state.demo;
    },
    supabase: () => ({ rpc: state.rpc }),
    checkOrigin(request: Request) {
      if (request.headers.get("origin") !== new URL(request.url).origin)
        throw new HttpError(403, "Same-origin request required");
    },
  };
});
import { POST } from "../src/app/api/provider-applications/route";
const sample = {
  organizationName: " Test Pantry ",
  organizationAddress: "3101 Example Street, Bronx, NY",
  contactName: "Test Representative",
  contactEmail: "PERSON@example.test",
  description: "Synthetic food assistance program for testing only.",
};
function request(body: unknown, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/provider-applications", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  state.demo = false;
  state.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("public application validation", () => {
  it("normalizes contact details and permits omitted optional fields", () => {
    expect(
      providerApplicationSchema.parse({
        ...sample,
        contactEmail: " PERSON@example.test ",
      }),
    ).toMatchObject({
      organizationName: "Test Pantry",
      contactEmail: "person@example.test",
      contactPhone: "",
      organizationWebsite: "",
    });
  });
  it.each([
    { organizationName: " " },
    { organizationAddress: "x" },
    { contactName: "x" },
    { contactEmail: "invalid" },
    { contactPhone: "not a phone" },
    { organizationWebsite: "javascript:alert(1)" },
    { organizationWebsite: "https://user:password@example.test" },
    { description: "short" },
    { description: "x".repeat(1001) },
    { status: "approved" },
    { userId: "forged" },
  ])("rejects invalid input and privilege fields: %j", (patch) => {
    expect(
      providerApplicationSchema.safeParse({ ...sample, ...patch }).success,
    ).toBe(false);
  });
});

it("accepts a public submission without login, accounts, or membership calls", async () => {
  const response = await POST(request(sample));
  expect(response.status).toBe(202);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ ok: true });
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
    "submit_provider_application",
    { application: providerApplicationSchema.parse(sample) },
  );
});
it("rejects cross-origin requests and invalid or oversized input before storage", async () => {
  expect(
    (await POST(request(sample, "https://unrelated.example"))).status,
  ).toBe(403);
  expect((await POST(request({ ...sample, status: "approved" }))).status).toBe(
    400,
  );
  expect(
    (await POST(request({ ...sample, description: "x".repeat(9000) }))).status,
  ).toBe(413);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("acknowledges a honeypot without storing its content", async () => {
  const response = await POST(request({ ...sample, faxNumber: "bot" }));
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ ok: true });
  expect(state.rpc).not.toHaveBeenCalled();
});
it("preserves database throttling and hides private storage errors", async () => {
  state.rpc.mockResolvedValueOnce({
    error: { code: "P0001", message: "application_rate_limited" },
  });
  const limited = await POST(request(sample));
  expect(limited.status).toBe(429);
  expect(limited.headers.get("Retry-After")).toBeTruthy();
  state.rpc.mockResolvedValueOnce({
    error: { code: "42P01", message: "PRIVATE contact details or SQL" },
  });
  const failed = await POST(request(sample));
  expect(failed.status).toBe(503);
  expect(JSON.stringify(await failed.json())).not.toContain("PRIVATE");
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
    "PRIVATE",
  );
});
it("does not store real applications in fictional demo mode", async () => {
  state.demo = true;
  expect((await POST(request(sample))).status).toBe(503);
  expect(state.rpc).not.toHaveBeenCalled();
});
