import { it, expect, vi, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { demoProviders } from "../src/lib/data";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
const file = resolve(".cache/demo-regression-" + crypto.randomUUID() + ".json");
let server: typeof import("../src/lib/server");
const admin = {
  id: "admin@test",
  email: "admin@test",
  role: "admin" as const,
  programIds: [],
};
beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  vi.stubEnv("PANTRYFIT_DEMO_FILE", file);
  const a = structuredClone(demoProviders[0]);
  a.organizationId = "shared";
  const b = { ...structuredClone(a), id: "sibling" };
  await mkdir(resolve(".cache"), { recursive: true });
  await writeFile(
    file,
    JSON.stringify({ providers: [a, b], changes: [], audit: [] }),
  );
  server = await import("../src/lib/server");
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(file, { force: true });
});
async function propose(id: string, phone: string) {
  const p = (await server.listProviders()).find((p) => p.id === id)!;
  return server.submitChange(admin, {
    programId: p.id,
    baseRevision: p.revision || 0,
    baseOrganizationRevision: p.organizationRevision || 0,
    hours: [{ day: 1, start: 1320, end: 1440 }],
    exceptions: [],
    offerings: null,
    appointment: "no",
    eligibility: null,
    phone,
    note: "Explicit demo regression",
  });
}
it("matches SQL stale checks including shared phones and concurrent approvals", async () => {
  const id = demoProviders[0].id;
  const a = await propose(id, "1111111111");
  const b = await propose("sibling", "2222222222");
  await server.reviewChange(admin, b.id, "approved", "Reviewed newer proposal");
  await expect(
    server.reviewChange(admin, a.id, "approved", "Reviewed older proposal"),
  ).rejects.toThrow("Stale proposal");
  expect((await server.listProviders()).find((p) => p.id === id)!.phone).toBe(
    "2222222222",
  );
  const c = await propose(id, "3333333333");
  const d = await propose(id, "4444444444");
  const outcomes = await Promise.allSettled([
    server.reviewChange(admin, c.id, "approved", "First parallel review"),
    server.reviewChange(admin, d.id, "approved", "Second parallel review"),
  ]);
  expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
});
it("retains verification evidence and invalidates eligibility on subsequent provider changes", async () => {
  const id = demoProviders[0].id;
  await server.verifyListing(admin, {
    programId: id,
    method: "official_source",
    fields: ["eligibility"],
    eligibilityStatus: "unrestricted",
    notes: "Distinctive fictional evidence",
  });
  expect(
    (await server.listProviders()).find((p) => p.id === id)!.program
      .eligibilityStatus,
  ).toBe("unrestricted");
  expect(
    (await server.dashboard(admin)).audit.find(
      (a) => a.notes === "Distinctive fictional evidence",
    ),
  ).toMatchObject({
    entityId: id,
    method: "official_source",
    fields: ["eligibility"],
    actor: admin.id,
  });
  const c = await propose(id, "5555555555");
  await server.reviewChange(
    admin,
    c.id,
    "approved",
    "Reviewed changed provider statement",
  );
  expect(
    (await server.listProviders()).find((p) => p.id === id)!.program
      .eligibilityStatus,
  ).toBe("unknown");
});
