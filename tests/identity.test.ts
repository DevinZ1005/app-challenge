import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";

const state = vi.hoisted(() => ({
  cookie: "synthetic-test-token" as string | undefined,
  getUser: vi.fn(),
  queries: [] as string[],
  filters: [] as unknown[][],
  results: {} as Record<string, { data: unknown; error: unknown }>,
  rejectedTable: "",
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.cookie ? { value: state.cookie } : undefined),
  }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: state.getUser },
    from(table: string) {
      state.queries.push(table);
      const q = {
        select: () => q,
        eq: (...args: unknown[]) => {
          state.filters.push([table, ...args]);
          return q;
        },
        in: (...args: unknown[]) => {
          state.filters.push([table, ...args]);
          return q;
        },
        maybeSingle: () => q,
        order: () => q,
        limit: () => q,
        then(
          resolve: (value: unknown) => unknown,
          reject: (error: unknown) => unknown,
        ) {
          const result =
            table === state.rejectedTable
              ? Promise.reject(new Error("private database details"))
              : Promise.resolve(
                  state.results[table] ?? { data: [], error: null },
                );
          return result.then(resolve, reject);
        },
      };
      return q;
    },
  }),
}));

let server: typeof import("../src/lib/server");
let me: typeof import("../src/app/api/auth/me/route");
beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.co");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "sb_publishable_synthetic_test_only",
  );
  server = await import("../src/lib/server");
  me = await import("../src/app/api/auth/me/route");
});
afterAll(() => vi.unstubAllEnvs());
beforeEach(() => {
  state.cookie = "synthetic-test-token";
  state.queries = [];
  state.filters = [];
  state.rejectedTable = "";
  state.results = {
    administrators: { data: null, error: null },
    provider_users: { data: [], error: null },
    service_programs: { data: [], error: null },
  };
  state.getUser.mockReset().mockResolvedValue({
    data: { user: { id: "user-id", email: "person@example.test" } },
    error: null,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

it("rejects anonymous requests before any Auth or database calls", async () => {
  state.cookie = undefined;
  const response = await me.GET();
  expect(response.status).toBe(401);
  expect(state.getUser).not.toHaveBeenCalled();
  expect(state.queries).toEqual([]);
});

it("does not accept an invalid session", async () => {
  state.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: "private auth details" },
  });
  await expect(server.identity()).rejects.toMatchObject({ status: 401 });
  expect(state.queries).toEqual([]);
});

it("reports an unaffiliated account without fetching private dashboard history or exposing its token", async () => {
  const response = await me.GET();
  const account = await response.json();
  expect(response.status).toBe(200);
  expect(account).toMatchObject({
    role: "unaffiliated",
    organizationIds: [],
    programIds: [],
    demo: false,
    changes: [],
    audit: [],
    feedback: [],
  });
  expect(account).not.toHaveProperty("token");
  expect(state.queries).toEqual(["administrators", "provider_users"]);
});

it("ignores forged metadata and an admin-looking email", async () => {
  state.getUser.mockResolvedValue({
    data: {
      user: {
        id: "user-id",
        email: "admin@example.test",
        user_metadata: {
          role: "admin",
          approved: true,
          organizationIds: ["other-org"],
        },
        app_metadata: { role: "admin" },
      },
    },
    error: null,
  });
  expect(await server.identity()).toMatchObject({
    role: "unaffiliated",
    organizationIds: [],
    programIds: [],
  });
});

it("recognizes an administrator only from their database row", async () => {
  state.results.administrators = { data: { user_id: "user-id" }, error: null };
  const response = await me.GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ role: "admin", demo: false });
});

it("scopes provider programs to approved database memberships", async () => {
  state.results.provider_users = {
    data: [{ provider_id: "own-org" }],
    error: null,
  };
  state.results.service_programs = {
    data: [{ id: "own-program" }],
    error: null,
  };
  expect(await server.identity()).toMatchObject({
    role: "provider",
    organizationIds: ["own-org"],
    programIds: ["own-program"],
  });
  expect(state.filters).toContainEqual([
    "provider_users",
    "user_id",
    "user-id",
  ]);
  expect(state.filters).toContainEqual(["provider_users", "approved", true]);
  expect(state.filters).toContainEqual([
    "service_programs",
    "provider_id",
    ["own-org"],
  ]);
});

it("recognizes approved membership even when the organization has no programs", async () => {
  state.results.provider_users = {
    data: [{ provider_id: "own-org" }],
    error: null,
  };
  expect(await server.identity()).toMatchObject({
    role: "provider",
    organizationIds: ["own-org"],
    programIds: [],
  });
});

it.each(["administrators", "provider_users", "service_programs"])(
  "fails closed and sanitizes %s query errors",
  async (table) => {
    state.results.administrators = {
      data: { user_id: "user-id" },
      error: null,
    };
    state.results.provider_users = {
      data: [{ provider_id: "own-org" }],
      error: null,
    };
    state.results[table] = {
      data: null,
      error: { message: "private database details" },
    };
    const response = await me.GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).not.toHaveProperty("role");
    expect(JSON.stringify(body)).not.toContain("private database details");
  },
);

it("fails closed when a permission query rejects instead of returning an error", async () => {
  state.rejectedTable = "provider_users";
  await expect(server.identity()).rejects.toMatchObject({ status: 503 });
});
