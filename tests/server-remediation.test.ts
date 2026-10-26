import { it, expect, vi, beforeAll, afterAll } from "vitest";
const state = vi.hoisted(() => ({
  results: {} as Record<
    string,
    { data: unknown[] | null; error: object | null }
  >,
  rpc: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: state.rpc,
    from: (table: string) => {
      const q = {
        select: () => q,
        order: () => q,
        limit: () => q,
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve(
            state.results[table] || { data: [], error: null },
          ).then(resolve),
      };
      return q;
    },
  }),
}));
let server: typeof import("../src/lib/server");
const admin = {
  id: "admin-id",
  email: "admin@test",
  role: "admin" as const,
  organizationIds: [],
  programIds: [],
  token: "test",
};
beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test");
  server = await import("../src/lib/server");
});
afterAll(() => vi.unstubAllEnvs());
it("maps persisted SQL evidence into the dashboard DTO after reload", async () => {
  state.results.audit_logs = {
    data: [
      {
        id: "audit-id",
        actor: "verifier-id",
        action: "verification_recorded",
        created_at: "2026-10-18T12:00:00Z",
        change_id: null,
        entity_id: "target-program",
        after_data: {
          method: "phone",
          fields: ["eligibility"],
          notes: "Distinctive persisted phone evidence",
        },
      },
    ],
    error: null,
  };
  expect((await server.dashboard(admin)).audit[0]).toMatchObject({
    actor: "verifier-id",
    entityId: "target-program",
    method: "phone",
    fields: ["eligibility"],
    notes: "Distinctive persisted phone evidence",
  });
});
it("reports failed audit queries instead of showing empty history", async () => {
  state.results.audit_logs = { data: null, error: { message: "Unavailable" } };
  await expect(server.dashboard(admin)).rejects.toThrow(
    "Audit history unavailable",
  );
});
it("rejects missing and HTTP real source URLs before calling SQL regardless of fixture contents", async () => {
  const listing = {
    name: { en: "Test", es: "Prueba" },
    description: { en: "Test", es: "Prueba" },
    address: { en: "Test", es: "Prueba" },
    zip: "10468",
    lat: 40,
    lng: -73,
    type: "pantry",
    sourceName: { en: "Test", es: "Prueba" },
    collectedAt: new Date().toISOString(),
    sourceUrl: "",
  };
  for (const sourceUrl of ["", "http://example.test"])
    await expect(
      server.createListing(admin, { ...listing, sourceUrl }),
    ).rejects.toThrow();
  expect(state.rpc).not.toHaveBeenCalled();
  await expect(
    server.createListing({ ...admin, role: "provider" }, listing),
  ).rejects.toThrow("Administrator access required");
  state.rpc.mockResolvedValueOnce({ data: "new-program", error: null });
  expect(
    await server.createListing(admin, {
      ...listing,
      sourceUrl: "https://example.test",
    }),
  ).toEqual({ id: "new-program" });
});
