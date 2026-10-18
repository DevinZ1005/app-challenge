import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import { readJson, apiError, HttpError } from "../src/lib/http";
import { assertRuntimeConfiguration } from "../src/lib/runtime";

afterEach(() => vi.restoreAllMocks());
function request(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}
describe("API request boundaries", () => {
  it("accepts JSON with a charset and rejects malformed JSON as a client error", async () => {
    await expect(
      readJson(
        request('{"message":"hello"}', {
          "Content-Type": "application/json; charset=utf-8",
        }),
      ),
    ).resolves.toEqual({ message: "hello" });
    await expect(readJson(request("{"))).rejects.toMatchObject({ status: 400 });
  });
  it("rejects non-JSON, empty bodies, and oversized declared bodies", async () => {
    await expect(
      readJson(request("hello", { "Content-Type": "text/plain" })),
    ).rejects.toMatchObject({ status: 415 });
    await expect(readJson(request(""))).rejects.toMatchObject({ status: 400 });
    await expect(
      readJson(request("{}", { "Content-Length": "65537" })),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("enforces the actual byte limit even without Content-Length", async () => {
    await expect(
      readJson(request(JSON.stringify({ value: "é".repeat(20) })), 32),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("cancels an oversized chunked request", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(20));
      },
      cancel,
    });
    const req = new Request("http://localhost/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(readJson(req, 10)).rejects.toMatchObject({ status: 413 });
    expect(cancel).toHaveBeenCalled();
  });
  it("does not disclose secrets in unexpected errors or logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = apiError(new Error("password=private"));
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.error).toBe("Request failed");
    expect(body.requestId).toBe(response.headers.get("X-Request-Id"));
    expect(JSON.stringify(log.mock.calls)).not.toContain("private");
  });
  it("returns validation errors and retry guidance with correct HTTP status", () => {
    const parsed = z.string().safeParse(12);
    if (!parsed.success) expect(apiError(parsed.error).status).toBe(400);
    const response = apiError(new HttpError(429, "Try again later"));
    expect(response.headers.get("Retry-After")).toBe("60");
  });
});
describe("production configuration", () => {
  it("allows a local demo but fails closed for an unconfigured production", () => {
    expect(() =>
      assertRuntimeConfiguration({ NODE_ENV: "development" }),
    ).not.toThrow();
    expect(() =>
      assertRuntimeConfiguration({ NODE_ENV: "production" }),
    ).toThrow(HttpError);
    expect(() =>
      assertRuntimeConfiguration({
        NODE_ENV: "production",
        PANTRYFIT_ALLOW_DEMO: "true",
      }),
    ).not.toThrow();
  });
  it("never allows partial Supabase configuration, even with demo opt-in", () => {
    expect(() =>
      assertRuntimeConfiguration({
        NODE_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        PANTRYFIT_ALLOW_DEMO: "true",
      }),
    ).toThrow(HttpError);
    expect(() =>
      assertRuntimeConfiguration({
        NODE_ENV: "development",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "test",
      }),
    ).toThrow(HttpError);
  });
  it("requires a valid HTTPS database endpoint in production", () => {
    for (const url of ["invalid", "http://example.com", "file:///tmp/db"]) {
      expect(() =>
        assertRuntimeConfiguration({
          NODE_ENV: "production",
          NEXT_PUBLIC_SUPABASE_URL: url,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "test",
        }),
      ).toThrow(HttpError);
    }
    expect(() =>
      assertRuntimeConfiguration({
        NODE_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "test",
      }),
    ).not.toThrow();
  });
});
