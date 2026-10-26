import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { Identity } from "../src/lib/authorization";
import { applicationReviewSchema } from "../src/lib/provider-application-review";
const state = vi.hoisted(() => ({
  who: null as Identity | null,
  demo: false,
  from: vi.fn(),
  rpc: vi.fn(),
  client: vi.fn(),
  query: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  select: vi.fn(),
  range: vi.fn(),
  single: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../src/lib/server", async () => {
  const { HttpError } = await import("../src/lib/http");
  return {
    identity: async () => state.who,
    get isDemo() {
      return state.demo;
    },
    supabase: state.client,
    checkOrigin(request: Request) {
      if (request.headers.get("origin") !== new URL(request.url).origin)
        throw new HttpError(403, "Same-origin request required");
    },
  };
});
import { GET as list } from "../src/app/api/admin/provider-applications/route";
import { GET as detail } from "../src/app/api/admin/provider-applications/[id]/route";
import { POST as review } from "../src/app/api/admin/provider-applications/[id]/review/route";
const id = "00000000-0000-4000-8000-000000000010";
const admin: Identity = {
  id: "admin",
  email: "admin@example.test",
  role: "admin",
  organizationIds: [],
  programIds: [],
  token: "test-user-jwt",
};
const params = { params: Promise.resolve({ id }) };
const rejection = {
  decision: "rejected",
  note: "Independent affiliation could not be confirmed.",
};
const approval = {
  decision: "approved",
  note: "Affiliation confirmed through the official organization.",
  sourceUrl: "https://example.test/contact",
  contactMethod: "email",
  officialContact: "office@example.test",
  contactedAt: "2025-01-01T12:00:00Z",
  affiliationConfirmed: true,
};
const row = {
  id,
  organization_name: "Synthetic Pantry",
  organization_address: "Test address",
  contact_name: "Test Representative",
  contact_email: "person@example.test",
  contact_phone: null,
  organization_website: null,
  description: "Synthetic program",
  created_at: "2025-01-01T00:00:00Z",
  status: "pending",
  reviewed_at: null,
  reviewed_by: null,
  review_note: null,
};
function req(body: unknown, origin = "http://localhost:3000") {
  return new Request(
    `http://localhost:3000/api/admin/provider-applications/${id}/review`,
    {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  state.who = admin;
  state.demo = false;
  const builder = {
    select: state.select,
    eq: state.eq,
    order: state.order,
    range: state.range,
    maybeSingle: state.single,
  };
  state.from.mockReturnValue(builder);
  state.select.mockReturnValue(builder);
  state.eq.mockReturnValue(builder);
  state.order.mockReturnValue(builder);
  state.range.mockResolvedValue({ data: [row], count: 1, error: null });
  state.single.mockResolvedValue({ data: row, error: null });
  state.rpc.mockResolvedValue({ data: null, error: null });
  state.client.mockReturnValue({ from: state.from, rpc: state.rpc });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
it.each([null, "unaffiliated", "provider"])(
  "denies %s before any private database access",
  async (role) => {
    state.who = role ? { ...admin, role: role as Identity["role"] } : null;
    const expected = role ? 403 : 401;
    expect(
      (
        await list(
          new Request("http://localhost:3000/api/admin/provider-applications"),
        )
      ).status,
    ).toBe(expected);
    expect(
      (await detail(new Request("http://localhost:3000"), params)).status,
    ).toBe(expected);
    expect((await review(req(rejection), params)).status).toBe(expected);
    expect(state.client).not.toHaveBeenCalled();
  },
);
it("lists pending first with bounded pagination and excludes private contact data", async () => {
  const response = await list(
    new Request(
      "http://localhost:3000/api/admin/provider-applications?status=pending&page=2",
    ),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({
    applications: [
      {
        id,
        organizationName: "Synthetic Pantry",
        createdAt: row.created_at,
        status: "pending",
        reviewedAt: null,
      },
    ],
    total: 1,
    page: 2,
    pageSize: 25,
  });
  expect(state.eq).toHaveBeenCalledWith("status", "pending");
  expect(state.range).toHaveBeenCalledWith(25, 49);
  expect(state.order).toHaveBeenCalledWith("reviewed_at", {
    ascending: false,
    nullsFirst: true,
  });
  expect(state.client).toHaveBeenCalledWith(admin.token);
});
it("loads administrator-only details and distinguishes a missing application", async () => {
  expect(
    await (await detail(new Request("http://localhost:3000"), params)).json(),
  ).toMatchObject({ contactEmail: row.contact_email, reviewedBy: null });
  state.single.mockResolvedValueOnce({ data: null, error: null });
  expect(
    (await detail(new Request("http://localhost:3000"), params)).status,
  ).toBe(404);
});
it.each([rejection, approval])(
  "submits one fixed review RPC through the user's JWT: $decision",
  async (body) => {
    const response = await review(req(body), params);
    expect(response.status).toBe(200);
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
      "review_provider_application",
      {
        application_id: id,
        decision: body.decision,
        decision_note: body.note,
        evidence_source_url:
          body.decision === "approved" ? approval.sourceUrl : null,
        evidence_method:
          body.decision === "approved" ? approval.contactMethod : null,
        evidence_contact:
          body.decision === "approved" ? approval.officialContact : null,
        evidence_contacted_at:
          body.decision === "approved" ? approval.contactedAt : null,
        affiliation_confirmed: body.decision === "approved",
      },
    );
    expect(state.from).not.toHaveBeenCalled();
  },
);
it.each([
  { reviewedBy: "forged" },
  { status: "approved" },
  { decision: "pending" },
  { note: "short" },
])("rejects forged or invalid decision fields %j", async (patch) => {
  expect((await review(req({ ...rejection, ...patch }), params)).status).toBe(
    400,
  );
  expect(state.rpc).not.toHaveBeenCalled();
});
it("requires independent approval evidence and rejects future or unsafe evidence", () => {
  expect(
    applicationReviewSchema.safeParse({
      decision: "approved",
      note: approval.note,
    }).success,
  ).toBe(false);
  for (const patch of [
    { affiliationConfirmed: false },
    { sourceUrl: "javascript:alert(1)" },
    { sourceUrl: "https://user:password@example.test" },
    { sourceUrl: "https://?claimed-proof" },
    { sourceUrl: "https://#claimed-proof" },
    { sourceUrl: "https://\\claimed-proof" },
    { sourceUrl: "https://example.test\\contact" },
    { contactedAt: "0000-01-01T00:00:00Z" },
    { contactMethod: "phone", officialContact: "-------" },
    { contactMethod: "phone", officialContact: "() () ()" },
    { contactMethod: "phone", officialContact: "123456" },
    { contactMethod: "phone", officialContact: "1234567890123456" },
    { officialContact: "invalid" },
    { contactedAt: "2999-01-01T00:00:00Z" },
  ])
    expect(
      applicationReviewSchema.safeParse({ ...approval, ...patch }).success,
    ).toBe(false);
});
it("rejects cross-origin, oversized and invalid pagination requests", async () => {
  expect(
    (await review(req(rejection, "https://unrelated.example"), params)).status,
  ).toBe(403);
  expect(
    (await review(req({ ...rejection, note: "x".repeat(9000) }), params))
      .status,
  ).toBe(413);
  expect(
    (
      await list(
        new Request(
          "http://localhost:3000/api/admin/provider-applications?page=401",
        ),
      )
    ).status,
  ).toBe(400);
  expect(state.rpc).not.toHaveBeenCalled();
});
it.each([
  ["P0001", "application_already_reviewed", 409],
  ["42501", "PRIVATE applicant", 403],
  ["P0002", "PRIVATE applicant", 404],
  ["23514", "PRIVATE applicant", 400],
  ["40001", "PRIVATE applicant", 409],
  ["42P01", "PRIVATE applicant", 503],
])("sanitizes RPC failure %s to %s", async (code, message, expected) => {
  state.rpc.mockResolvedValueOnce({ error: { code, message } });
  const response = await review(req(rejection), params);
  expect(response.status).toBe(expected);
  expect(JSON.stringify(await response.json())).not.toContain("PRIVATE");
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
    "PRIVATE",
  );
});
it("fails closed for returned and rejected queries and keeps fictional demo separate", async () => {
  state.range.mockResolvedValueOnce({
    data: null,
    count: null,
    error: { message: "PRIVATE" },
  });
  expect((await list(new Request("http://localhost:3000"))).status).toBe(503);
  state.single.mockRejectedValueOnce(new Error("PRIVATE"));
  expect(
    (await detail(new Request("http://localhost:3000"), params)).status,
  ).toBe(503);
  state.rpc.mockRejectedValueOnce(new Error("PRIVATE"));
  expect((await review(req(rejection), params)).status).toBe(503);
  state.demo = true;
  state.client.mockClear();
  expect((await review(req(rejection), params)).status).toBe(503);
  expect(state.client).not.toHaveBeenCalled();
});
