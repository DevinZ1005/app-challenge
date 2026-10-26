import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
let db: PGlite;
const admin = "00000000-0000-4000-8000-000000000001";
const ordinary = "00000000-0000-4000-8000-000000000002";
const sample = {
  organizationName: "Synthetic Pantry",
  organizationAddress: "Test address, Bronx, NY",
  contactName: "Test Representative",
  contactEmail: "PERSON@example.test",
  description: "Synthetic food assistance service for isolated tests.",
};
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`,
  );
  for (const name of [
    "001_pantryfit.sql",
    "002_admin_tools.sql",
    "003_validate_proposals.sql",
    "004_verification_boundaries.sql",
    "005_review_remediation.sql",
    "006_field_verification.sql",
    "007_provider_applications.sql",
  ])
    await db.exec(
      (await readFile(`supabase/migrations/${name}`, "utf8")).replace(
        "create extension if not exists pgcrypto;",
        "",
      ),
    );
  await db.exec(
    `insert into auth.users values ('${admin}'),('${ordinary}'); insert into public.administrators values ('${admin}');`,
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    "truncate public.provider_applications,public.provider_application_limits",
  );
});
async function asUser(user: string | null, action: () => Promise<void>) {
  await db.exec(
    user
      ? `set role authenticated; set request.jwt.claim.sub='${user}'`
      : "set role anon; reset request.jwt.claim.sub",
  );
  try {
    await action();
  } finally {
    await db.exec("reset role; reset request.jwt.claim.sub");
  }
}
const submit = (patch = {}) =>
  db.query("select public.submit_provider_application($1)", [
    { ...sample, ...patch },
  ]);

it("lets an anonymous representative submit pending only and creates no account or access", async () => {
  await asUser(null, async () => {
    await submit();
  });
  const result = await db.query(
    "select status,contact_email,contact_phone from public.provider_applications",
  );
  expect(result.rows).toEqual([
    {
      status: "pending",
      contact_email: "person@example.test",
      contact_phone: null,
    },
  ]);
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from auth.users",
      )
    ).rows[0].count,
  ).toBe(2);
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.provider_users",
      )
    ).rows[0].count,
  ).toBe(0);
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.providers",
      )
    ).rows[0].count,
  ).toBe(0);
});

it("denies anonymous table access, direct writes, private counters, and internal limit calls", async () => {
  await asUser(null, async () => {
    await expect(
      db.query("select * from public.provider_applications"),
    ).rejects.toThrow();
    await expect(
      db.query("select * from public.provider_application_limits"),
    ).rejects.toThrow();
    await expect(
      db.query("insert into public.provider_applications default values"),
    ).rejects.toThrow();
    await expect(
      db.query("update public.provider_applications set status='approved'"),
    ).rejects.toThrow();
    await expect(
      db.query("delete from public.provider_applications"),
    ).rejects.toThrow();
    await expect(
      db.query(
        "select public.consume_provider_application_limit('global',9999,1)",
      ),
    ).rejects.toThrow();
  });
});

it("keeps applications private to administrators and offers no client approval functionality", async () => {
  await submit();
  await asUser(ordinary, async () => {
    expect(
      (await db.query("select * from public.provider_applications")).rows,
    ).toEqual([]);
    await expect(
      db.query("update public.provider_applications set status='approved'"),
    ).rejects.toThrow();
  });
  await asUser(admin, async () => {
    expect(
      (await db.query("select * from public.provider_applications")).rows,
    ).toHaveLength(1);
    await expect(
      db.query("update public.provider_applications set status='approved'"),
    ).rejects.toThrow();
  });
});

it("validates direct RPC requests instead of relying on the website", async () => {
  await asUser(null, async () => {
    for (const patch of [
      { status: "approved" },
      { contactEmail: "invalid" },
      { description: "x" },
      { contactPhone: null },
      { organizationWebsite: "javascript:alert(1)" },
      { organizationName: "x".repeat(161) },
    ])
      await expect(submit(patch)).rejects.toThrow();
  });
  expect(
    (await db.query("select * from public.provider_applications")).rows,
  ).toEqual([]);
});

it("deduplicates normalized identity without overwriting earlier application content", async () => {
  await asUser(null, async () => {
    await submit();
    await submit({
      organizationName: " SYNTHETIC   pantry ",
      contactEmail: "person@example.test",
      description: "This duplicate must not overwrite the earlier content.",
    });
  });
  const rows = (
    await db.query("select description from public.provider_applications")
  ).rows;
  expect(rows).toEqual([{ description: sample.description }]);
});

it("enforces shared email limits for simultaneous direct RPC attempts and allows expiry", async () => {
  await asUser(null, async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, index) =>
        submit({ organizationName: `Pantry ${index}` }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(3);
  });
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.provider_applications",
      )
    ).rows[0].count,
  ).toBe(3);
  await db.exec(
    "update public.provider_application_limits set expires_at=now()-interval '1 second'",
  );
  await asUser(null, async () => {
    await submit({ organizationName: "After expiry" });
  });
});

it("does not let one shared application quota block unrelated email addresses", async () => {
  await asUser(null, async () => {
    for (let index = 0; index < 101; index++)
      await submit({ contactEmail: `independent-${index}@example.test` });
  });
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.provider_applications",
      )
    ).rows[0].count,
  ).toBe(101);
}, 15000);

it("keeps committed quota and expiry intact when over-limit statements roll back", async () => {
  await asUser(null, async () => {
    for (let index = 0; index < 3; index++)
      await submit({ organizationName: `Committed ${index}` });
  });
  const readCounters = () =>
    db.query(
      "select bucket,attempts,expires_at from public.provider_application_limits order by bucket",
    );
  const before = (await readCounters()).rows;
  await asUser(null, async () => {
    for (let index = 0; index < 4; index++)
      await expect(
        submit({ organizationName: `Rejected ${index}` }),
      ).rejects.toThrow("application_rate_limited");
  });
  expect((await readCounters()).rows).toEqual(before);
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.provider_applications",
      )
    ).rows[0].count,
  ).toBe(3);
  // An explicit rollback discards both insertion and counter changes, as it should.
  await db.exec("begin");
  await submit({ contactEmail: "rolled-back@example.test" });
  await db.exec("rollback");
  expect((await readCounters()).rows).toEqual(before);
});

it("does not resolve attacker-controlled public-schema function overloads", async () => {
  await db.exec(
    "create function public.make_interval(secs integer) returns interval language plpgsql as $$ begin raise exception 'unsafe_shadow_function'; end $$",
  );
  try {
    await asUser(null, async () => {
      await submit();
    });
  } finally {
    await db.exec("drop function public.make_interval(integer)");
  }
});

it("keeps private-function execution and authenticated mutation privileges revoked", async () => {
  for (const role of ["anon", "authenticated"])
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select has_function_privilege($1,'public.consume_provider_application_limit(text,integer,integer)','EXECUTE') as allowed",
          [role],
        )
      ).rows[0].allowed,
    ).toBe(false);
  await submit();
  await asUser(ordinary, async () => {
    await expect(
      db.query("insert into public.provider_applications default values"),
    ).rejects.toThrow();
    await expect(
      db.query("delete from public.provider_applications"),
    ).rejects.toThrow();
    await expect(
      db.query("select * from public.provider_application_limits"),
    ).rejects.toThrow();
  });
});
