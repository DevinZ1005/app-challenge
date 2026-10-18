import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
let program: string;
let org: string;
const admin = "00000000-0000-4000-8000-000000000001";
const provider = "00000000-0000-4000-8000-000000000002";
const outsider = "00000000-0000-4000-8000-000000000003";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
  );
  for (const f of [
    "001_pantryfit.sql",
    "002_admin_tools.sql",
    "003_validate_proposals.sql",
    "004_verification_boundaries.sql",
  ]) {
    const sql = await readFile("supabase/migrations/" + f, "utf8");
    await db.exec(sql.replace("create extension if not exists pgcrypto;", ""));
  }
  await db.exec(await readFile("supabase/seed.sql", "utf8"));
  await db.exec(
    `insert into auth.users(id) values ('${admin}'),('${provider}'),('${outsider}');insert into public.administrators values ('${admin}');`,
  );
  const p = await db.query<{ id: string; provider_id: string }>(
    "select id,provider_id from public.service_programs limit 1",
  );
  program = p.rows[0].id;
  org = p.rows[0].provider_id;
  await db.query(
    "insert into public.provider_users values ($1,$2,true,$3,now())",
    [provider, org, admin],
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
async function asUser(user: string | null, fn: () => Promise<void>) {
  await db.exec(
    user
      ? `set role authenticated;set request.jwt.claim.sub='${user}';`
      : "set role anon;reset request.jwt.claim.sub;",
  );
  try {
    await fn();
  } finally {
    await db.exec("reset role;reset request.jwt.claim.sub;");
  }
}
const payload = () => ({
  programId: program,
  hours: [{ day: 1, start: 800, end: 1000 }],
  exceptions: [],
  offerings: [
    {
      name: { en: "Test", es: "Prueba" },
      equipment: ["none"],
      storage: "shelf",
      diets: [],
      verified: true,
    },
  ],
  appointment: "no",
  eligibility: null,
  phone: null,
  note: "Policy test change request",
});
it("exposes published service data but no account rows to anonymous readers", async () => {
  await asUser(null, async () => {
    const r = await db.query(
      "select document from public.public_provider_documents",
    );
    expect(r.rows.length).toBe(1);
    await expect(
      db.query("select * from public.provider_users"),
    ).rejects.toThrow();
  });
});
it("rejects direct provider writes even for an approved member", async () => {
  await asUser(provider, async () => {
    await expect(
      db.query("update public.providers set phone='1234567' where id=$1", [
        org,
      ]),
    ).rejects.toThrow();
  });
});
it("rejects cross-organization proposals and self-approved requests", async () => {
  await asUser(outsider, async () => {
    await expect(
      db.query(
        "insert into public.change_requests(program_id,submitted_by,payload) values ($1,$2,$3)",
        [program, outsider, payload()],
      ),
    ).rejects.toThrow();
  });
  await asUser(provider, async () => {
    await expect(
      db.query(
        "insert into public.change_requests(program_id,submitted_by,payload,status) values ($1,$2,$3,'approved')",
        [program, provider, payload()],
      ),
    ).rejects.toThrow();
  });
});
it("queues authorized updates, removes forged verification, and logs submission", async () => {
  await asUser(provider, async () => {
    const r = await db.query<{
      id: string;
      payload: { offerings: { verified: boolean }[] };
    }>(
      "insert into public.change_requests(program_id,submitted_by,payload) values ($1,$2,$3) returning id,payload",
      [program, provider, payload()],
    );
    expect(r.rows[0].payload.offerings[0].verified).toBe(false);
    const a = await db.query("select * from public.audit_logs");
    expect(a.rows.length).toBe(1);
  });
});
it("allows only administrator approval and publishes transactionally with an audit record", async () => {
  const changes = await db.query<{ id: string }>(
    "select id from public.change_requests",
  );
  const id = changes.rows[0].id;
  await asUser(provider, async () => {
    await expect(
      db.query(
        "select public.review_change($1,'approved','This should be rejected')",
        [id],
      ),
    ).rejects.toThrow();
  });
  await asUser(admin, async () => {
    await db.query(
      "select public.review_change($1,'approved','Reviewed fictional proposal')",
      [id],
    );
  });
  const h = await db.query<{ start_minute: number }>(
    "select start_minute from public.operating_hours where program_id=$1",
    [program],
  );
  expect(h.rows[0].start_minute).toBe(800);
  const a = await db.query("select * from public.audit_logs");
  expect(a.rows.length).toBe(2);
  await asUser(admin, async () => {
    await expect(
      db.query(
        "select public.review_change($1,'approved','Duplicate review attempt')",
        [id],
      ),
    ).rejects.toThrow();
  });
});
it("prevents self-granted admin or organization membership", async () => {
  await asUser(outsider, async () => {
    await expect(
      db.query("insert into public.administrators values ($1)", [outsider]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into public.provider_users(user_id,provider_id) values ($1,$2)",
        [outsider, org],
      ),
    ).rejects.toThrow();
  });
});

it("rejects malformed proposals sent directly to the database", async () => {
  await asUser(provider, async () => {
    await expect(
      db.query(
        "insert into public.change_requests(program_id,submitted_by,payload) values ($1,$2,$3)",
        [
          program,
          provider,
          { note: "Malformed direct payload", appointment: "no" },
        ],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into public.change_requests(program_id,submitted_by,payload) values ($1,$2,$3)",
        [
          program,
          provider,
          { ...payload(), hours: [{ day: 1, start: 900, end: 800 }] },
        ],
      ),
    ).rejects.toThrow();
  });
});

it("keeps fictional seed records unverified after an administrator review", async () => {
  await asUser(admin, async () => {
    await db.query("select public.record_verification($1,$2,$3,$4)", [
      program,
      "official_source",
      ["hours", "offerings", "eligibility", "coordinates", "phone"],
      "Reviewed fictional fixture for regression testing only",
    ]);
  });
  const result = await db.query<{
    document: {
      demo: boolean;
      verifiedAt: string | null;
      coordinatesVerified: boolean;
      phoneVerified: boolean;
    };
  }>("select document from public.public_provider_documents");
  expect(result.rows[0].document).toMatchObject({
    demo: true,
    verifiedAt: null,
    coordinatesVerified: false,
    phoneVerified: false,
  });
});

it.each([
  { programId: null },
  { offerings: [{ ...payload().offerings[0], equipment: [null] }] },
  { offerings: [{ ...payload().offerings[0], diets: [null] }] },
])("rejects JSON nulls in required proposal values: %j", async (patch) => {
  await asUser(provider, async () => {
    await expect(
      db.query(
        "insert into public.change_requests(program_id,submitted_by,payload) values ($1,$2,$3)",
        [program, provider, { ...payload(), ...patch }],
      ),
    ).rejects.toThrow();
  });
});

it("protects verification RPCs, supports synthetic real-record verification, and clears outdated flags", async () => {
  const listing = {
    name: { en: "Synthetic SQL test", es: "Prueba SQL sintética" },
    description: { en: "Isolated test only", es: "Solo prueba aislada" },
    address: { en: "Test location", es: "Ubicación de prueba" },
    zip: "10468",
    lat: 40.87,
    lng: -73.89,
    type: "pantry",
    sourceName: { en: "Test source", es: "Fuente de prueba" },
    sourceUrl: "https://example.test/source",
    collectedAt: new Date().toISOString(),
  };
  for (const user of [null, outsider, provider]) {
    await asUser(user, async () => {
      await expect(
        db.query("select public.create_listing($1)", [listing]),
      ).rejects.toThrow();
      await expect(
        db.query("select public.record_verification($1,$2,$3,$4)", [
          program,
          "official_source",
          ["coordinates"],
          "Unauthorized verification attempt",
        ]),
      ).rejects.toThrow();
    });
  }
  await asUser(admin, async () => {
    const created = await db.query<{ id: string }>(
      "select public.create_listing($1) as id",
      [listing],
    );
    const id = created.rows[0].id;
    await db.query("select public.record_verification($1,$2,$3,$4)", [
      id,
      "official_source",
      ["coordinates"],
      "Synthetic regression evidence only",
    ]);
    const read = async () =>
      (
        await db.query<{
          document: { verifiedAt: string | null; coordinatesVerified: boolean };
        }>(
          "select document from public.public_provider_documents where document->>'id'=$1",
          [id],
        )
      ).rows[0].document;
    expect(await read()).toMatchObject({
      verifiedAt: null,
      coordinatesVerified: true,
    });
    await db.query("select public.record_verification($1,$2,$3,$4)", [
      id,
      "flag_outdated",
      [],
      "Synthetic regression invalidation only",
    ]);
    expect(await read()).toMatchObject({
      verifiedAt: null,
      coordinatesVerified: false,
    });
    await expect(
      db.query("select public.record_verification($1,$2,$3,$4)", [
        id,
        "official_source",
        [null],
        "Invalid null verification field",
      ]),
    ).rejects.toThrow();
  });
});

it("keeps anonymous feedback private and rejects short reports", async () => {
  await asUser(null, async () => {
    await db.query("select public.submit_feedback($1)", [
      "Synthetic private feedback regression",
    ]);
    await expect(db.query("select * from public.feedback")).rejects.toThrow();
    await expect(
      db.query("select public.submit_feedback('bad')"),
    ).rejects.toThrow();
  });
  await asUser(provider, async () => {
    expect((await db.query("select * from public.feedback")).rows).toHaveLength(
      0,
    );
  });
  await asUser(admin, async () => {
    expect((await db.query("select * from public.feedback")).rows).toHaveLength(
      1,
    );
  });
});
