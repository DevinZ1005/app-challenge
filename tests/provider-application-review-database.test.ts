import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { beforeAll, afterAll, beforeEach, expect, it } from "vitest";

let db: PGlite;
const admin = "00000000-0000-4000-8000-000000000001";
const secondAdmin = "00000000-0000-4000-8000-000000000002";
const ordinary = "00000000-0000-4000-8000-000000000003";
const provider = "00000000-0000-4000-8000-000000000004";
const organization = "00000000-0000-4000-8000-000000000005";
const sample = {
  organizationName: "Synthetic Pantry",
  organizationAddress: "Example address, Bronx, NY",
  contactName: "Test Representative",
  contactEmail: "person@example.test",
  description: "Synthetic food assistance organization for testing only.",
};
let preservedId: string;
let preservedBefore: Record<string, unknown>;
async function submit(email = sample.contactEmail) {
  await db.query("select public.submit_provider_application($1::jsonb)", [
    JSON.stringify({ ...sample, contactEmail: email }),
  ]);
  return (
    await db.query<{ id: string }>(
      "select id from public.provider_applications where status='pending' and contact_email=$1",
      [email.toLowerCase()],
    )
  ).rows[0].id;
}
async function asUser<T>(
  id: string | null,
  action: () => Promise<T>,
): Promise<T> {
  await db.exec(
    id
      ? `set role authenticated; set request.jwt.claim.sub='${id}'`
      : "set role anon; reset request.jwt.claim.sub",
  );
  try {
    return await action();
  } finally {
    await db.exec("reset role; reset request.jwt.claim.sub");
  }
}
async function reject(
  id: string,
  note = "Organization could not be independently verified.",
) {
  return db.query(
    "select public.review_provider_application($1,'rejected',$2)",
    [id, note],
  );
}
async function approve(id: string, patch: Record<string, unknown> = {}) {
  const evidence = {
    source: "https://example.test/official",
    method: "phone",
    contact: "+1 (718) 555-0100",
    time: "2025-01-01T12:00:00Z",
    confirmed: true,
    ...patch,
  };
  return db.query(
    "select public.review_provider_application($1,'approved','Confirmed affiliation by contacting the official organization.',$2,$3,$4,$5::timestamptz,$6)",
    [
      id,
      evidence.source,
      evidence.method,
      evidence.contact,
      evidence.time,
      evidence.confirmed,
    ],
  );
}
async function state(id: string) {
  return (
    await db.query<Record<string, unknown>>(
      "select * from public.provider_applications where id=$1",
      [id],
    )
  ).rows[0];
}
async function auditCount(id: string) {
  return Number(
    (
      await db.query<{ count: number }>(
        "select count(*) from public.audit_logs where entity_id=$1",
        [id],
      )
    ).rows[0].count,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`,
  );
  const migrations = (await readdir("supabase/migrations"))
    .filter((name) => /^00[1-7]_/.test(name))
    .sort();
  expect(migrations).toHaveLength(7);
  for (const name of migrations)
    await db.exec(
      (await readFile(`supabase/migrations/${name}`, "utf8")).replace(
        "create extension if not exists pgcrypto;",
        "",
      ),
    );
  await db.exec(
    `insert into auth.users values ('${admin}','admin@example.test'),('${secondAdmin}','second@example.test'),('${ordinary}','ordinary@example.test'),('${provider}','provider@example.test'); insert into public.administrators values ('${admin}'),('${secondAdmin}');
     insert into public.providers(id,name,description) values ('${organization}','{"en":"Synthetic Organization","es":"Organización ficticia"}','{}');
     insert into public.provider_users(user_id,provider_id,approved,approved_by,approved_at) values ('${provider}','${organization}',true,'${admin}',now());`,
  );
  preservedId = await submit();
  preservedBefore = await state(preservedId);
  await db.exec(
    await readFile(
      "supabase/migrations/008_provider_application_review.sql",
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    "delete from public.audit_logs; delete from public.provider_applications where id <> '" +
      preservedId +
      "'; truncate public.provider_application_limits;",
  );
});
it("applies after 001–007 and preserves existing pending applications", async () => {
  const preservedAfter = await state(preservedId);
  for (const [key, value] of Object.entries(preservedBefore))
    expect(preservedAfter[key]).toEqual(value);
  expect(await state(preservedId)).toMatchObject({
    status: "pending",
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
  });
  expect(
    (
      await db.query(
        "select relrowsecurity from pg_class where oid='public.provider_applications'::regclass",
      )
    ).rows,
  ).toEqual([{ relrowsecurity: true }]);
});
it("blocks anonymous and ordinary users from private reads, decisions and all direct mutations", async () => {
  for (const user of [null, ordinary, provider])
    await asUser(user, async () => {
      if (user)
        expect(
          (await db.query("select * from public.provider_applications")).rows,
        ).toEqual([]);
      else
        await expect(
          db.query("select * from public.provider_applications"),
        ).rejects.toThrow(/permission denied/);
      await expect(reject(preservedId)).rejects.toThrow(
        /permission denied|Administrator required/,
      );
      for (const sql of [
        "update public.provider_applications set status='approved'",
        "delete from public.provider_applications",
        "insert into public.provider_applications default values",
      ])
        await expect(db.exec(sql)).rejects.toThrow(/permission denied/);
    });
  await asUser(admin, async () => {
    expect(
      (await db.query("select id from public.provider_applications")).rows
        .length,
    ).toBe(1);
    await expect(
      db.exec("update public.provider_applications set status='rejected'"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.exec("update public.audit_logs set action='forged'"),
    ).rejects.toThrow(/permission denied/);
  });
});
it("approves with trusted reviewer/time and minimal atomic audit, without creating access", async () => {
  const id = await submit("approval@example.test");
  const before = await db.query(
    "select (select count(*) from auth.users) as users,(select count(*) from public.provider_users) as memberships",
  );
  await asUser(admin, () => approve(id));
  expect(await state(id)).toMatchObject({
    status: "approved",
    reviewed_by: admin,
    verification_method: "phone",
    verification_contact: "+1 (718) 555-0100",
  });
  expect((await state(id)).reviewed_at).toBeTruthy();
  const audit = (
    await db.query(
      "select actor,action,after_data from public.audit_logs where entity_id=$1",
      [id],
    )
  ).rows;
  expect(audit).toEqual([
    {
      actor: admin,
      action: "provider_application_approved",
      after_data: { status: "approved" },
    },
  ]);
  expect(
    await db.query(
      "select (select count(*) from auth.users) as users,(select count(*) from public.provider_users) as memberships",
    ),
  ).toEqual(before);
});
it.each([
  { confirmed: false },
  { confirmed: null },
  { source: null },
  { source: "http://example.test" },
  { source: "https://user:password@example.test" },
  { method: "self" },
  { contact: null },
  { contact: "invalid" },
  { time: null },
  { time: "2999-01-01T00:00:00Z" },
  { time: "-infinity" },
  { time: "infinity" },
  { time: "0001-01-01 00:00:00+00 BC" },
  { source: "https://?claimed-proof" },
  { source: "https://#claimed-proof" },
  { source: "https://\\claimed-proof" },
  { source: "https://example.test\\contact" },
  { contact: "-------" },
  { contact: "() () ()" },
  { contact: "123456" },
  { contact: "1234567890123456" },
])("rolls back invalid evidence and its audit: %j", async (patch) => {
  const id = await submit("invalid@example.test");
  await expect(asUser(admin, () => approve(id, patch))).rejects.toThrow();
  expect(await state(id)).toMatchObject({
    status: "pending",
    reviewed_by: null,
  });
  expect(await auditCount(id)).toBe(0);
});
it("prevents normalized self-approval and self-rejection", async () => {
  const id = await submit("ADMIN@example.test");
  await expect(asUser(admin, () => approve(id))).rejects.toThrow(
    /self_review_not_allowed/,
  );
  await expect(asUser(admin, () => reject(id))).rejects.toThrow(
    /self_review_not_allowed/,
  );
  expect(await auditCount(id)).toBe(0);
});
it("allows exactly one competing decision and makes final history immutable", async () => {
  const id = await submit("race@example.test");
  // PGlite queues statements; the real SQL row lock is exercised, not two connections.
  const results = await asUser(admin, () =>
    Promise.allSettled([approve(id), reject(id)]),
  );
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(
    1,
  );
  expect(await auditCount(id)).toBe(1);
  await expect(asUser(secondAdmin, () => reject(id))).rejects.toThrow(
    /application_already_reviewed/,
  );
  // Even direct updates through a trusted SQL role still encounter the history guard.
  await db.exec(`set request.jwt.claim.sub='${admin}'`);
  try {
    await expect(
      db.query(
        "update public.provider_applications set review_note='A replacement decision note.' where id=$1",
        [id],
      ),
    ).rejects.toThrow(/application_already_reviewed/);
  } finally {
    await db.exec("reset request.jwt.claim.sub");
  }
  expect(await auditCount(id)).toBe(1);
});
it("records rejection, suppresses pending duplicates and permits a fresh application after review", async () => {
  const id = await submit("reapply@example.test");
  expect(await submit("reapply@example.test")).toBe(id);
  await asUser(admin, () => reject(id));
  const fresh = await submit("reapply@example.test");
  expect(fresh).not.toBe(id);
  expect(await state(fresh)).toMatchObject({
    status: "pending",
    reviewed_by: null,
  });
  expect(await state(id)).toMatchObject({
    status: "rejected",
    reviewed_by: admin,
    verification_source_url: null,
  });
});
it("rejects missing notes and leaves pending application data immutable", async () => {
  const id = await submit("immutable@example.test");
  await expect(asUser(admin, () => reject(id, "short"))).rejects.toThrow(
    /Invalid review/,
  );
  await db.exec(`set request.jwt.claim.sub='${admin}'`);
  try {
    await expect(
      db.query(
        "update public.provider_applications set status='rejected',review_note='A valid review explanation.',organization_name='Tampered' where id=$1",
        [id],
      ),
    ).rejects.toThrow(/Application contents are immutable/);
  } finally {
    await db.exec("reset request.jwt.claim.sub");
  }
  expect(await auditCount(id)).toBe(0);
});
it.each([
  "\n".repeat(10),
  "\t".repeat(10),
  "\n\t x \t\n".repeat(2),
  "\u00a0".repeat(10),
  "\u2003".repeat(10),
  "\ufeff".repeat(10),
])("rejects a review note padded with whitespace: %j", async (note) => {
  const id = await submit("whitespace@example.test");
  await expect(asUser(admin, () => reject(id, note))).rejects.toThrow(
    /Invalid review/,
  );
  expect(await state(id)).toMatchObject({
    status: "pending",
    reviewed_by: null,
  });
  expect(await auditCount(id)).toBe(0);
});
it("requires an authenticated administrator independently of forged role claims", async () => {
  await db.exec("set role authenticated; reset request.jwt.claim.sub");
  try {
    await expect(reject(preservedId)).rejects.toThrow(/Administrator required/);
  } finally {
    await db.exec("reset role");
  }
  await asUser(ordinary, async () => {
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({
        sub: ordinary,
        role: "authenticated",
        user_metadata: { role: "admin" },
        app_metadata: { role: "admin" },
      }),
    ]);
    try {
      expect(
        (await db.query("select public.is_admin() as allowed")).rows,
      ).toEqual([{ allowed: false }]);
      await expect(reject(preservedId)).rejects.toThrow(
        /Administrator required/,
      );
      expect(
        (await db.query("select * from public.provider_applications")).rows,
      ).toEqual([]);
    } finally {
      await db.exec("reset request.jwt.claims");
    }
  });
  await asUser(null, async () => {
    await db.exec(`set request.jwt.claim.sub='${admin}'`);
    await expect(reject(preservedId)).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select * from public.provider_applications"),
    ).rejects.toThrow(/permission denied/);
  });
});
it("denies review and private reads after administrator membership is revoked", async () => {
  await db.query("delete from public.administrators where user_id=$1", [
    secondAdmin,
  ]);
  try {
    await asUser(secondAdmin, async () => {
      await expect(reject(preservedId)).rejects.toThrow(
        /Administrator required/,
      );
      expect(
        (await db.query("select * from public.provider_applications")).rows,
      ).toEqual([]);
    });
  } finally {
    await db.query("insert into public.administrators values ($1)", [
      secondAdmin,
    ]);
  }
});
it("denies direct application, audit and authority writes for every application role", async () => {
  for (const role of ["anon", "authenticated"])
    for (const table of [
      "provider_applications",
      "audit_logs",
      "administrators",
      "provider_users",
    ])
      for (const privilege of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"])
        expect(
          (
            await db.query<{ allowed: boolean }>(
              "select has_table_privilege($1,$2,$3) as allowed",
              [role, `public.${table}`, privilege],
            )
          ).rows[0].allowed,
        ).toBe(false);
  await db.query(
    "insert into public.audit_logs(actor,action,entity_id,after_data) values ($1,'synthetic_existing_audit',$2,'{}')",
    [ordinary, preservedId],
  );
  for (const user of [null, ordinary, provider, admin])
    await asUser(user, async () => {
      for (const sql of [
        "update public.audit_logs set action='forged'",
        "delete from public.audit_logs",
        "truncate public.audit_logs",
        "insert into public.audit_logs(action) values ('forged')",
        "truncate public.provider_applications",
      ])
        await expect(db.exec(sql)).rejects.toThrow(/permission denied/);
    });
  expect(await auditCount(preservedId)).toBe(1);
});
it("overwrites forged reviewer identifiers and timestamps inside the database trigger", async () => {
  const id = await submit("trusted-stamp@example.test");
  // A fixture-only owner update exercises the trigger separately from the
  // application's denied direct-UPDATE privilege. No such owner is exposed by the API.
  await db.exec(`set request.jwt.claim.sub='${admin}'`);
  try {
    const result = await db.query(
      "update public.provider_applications set status='rejected',review_note='A valid independent review explanation.',reviewed_by=$2,reviewed_at='2000-01-01T00:00:00Z' where id=$1 returning reviewed_by,reviewed_at=statement_timestamp() as trusted_time",
      [id, secondAdmin],
    );
    expect(result.rows).toEqual([{ reviewed_by: admin, trusted_time: true }]);
  } finally {
    await db.exec("reset request.jwt.claim.sub");
  }
  expect(await auditCount(id)).toBe(1);
});
it("rolls back the entire decision if audit logging fails", async () => {
  const id = await submit("audit-required@example.test");
  await db.exec(
    "alter table public.audit_logs add constraint synthetic_audit_failure check(action !~ '^provider_application_')",
  );
  try {
    await expect(asUser(admin, () => approve(id))).rejects.toThrow(
      /synthetic_audit_failure/,
    );
  } finally {
    await db.exec(
      "alter table public.audit_logs drop constraint synthetic_audit_failure",
    );
  }
  expect(await state(id)).toMatchObject({
    status: "pending",
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
  });
  expect(await auditCount(id)).toBe(0);
});
it("rejects repeated and opposing decisions after a rejection", async () => {
  const id = await submit("final-rejection@example.test");
  await asUser(admin, () => reject(id));
  const before = await state(id);
  await expect(asUser(secondAdmin, () => reject(id))).rejects.toThrow(
    /application_already_reviewed/,
  );
  await expect(asUser(secondAdmin, () => approve(id))).rejects.toThrow(
    /application_already_reviewed/,
  );
  expect(await state(id)).toEqual(before);
  expect(await auditCount(id)).toBe(1);
});
it("approval leaves all Auth and authorization records unchanged", async () => {
  const id = await submit("ordinary@example.test");
  const snapshot = () =>
    db.query(
      "select (select jsonb_agg(to_jsonb(u) order by id) from auth.users u) as auth_users,(select jsonb_agg(to_jsonb(a) order by user_id) from public.administrators a) as admins,(select jsonb_agg(to_jsonb(m) order by user_id,provider_id) from public.provider_users m) as memberships,(select jsonb_agg(to_jsonb(p) order by id) from public.providers p) as providers,(select count(*) from public.service_programs) as programs",
    );
  const before = await snapshot();
  await asUser(admin, () => approve(id));
  expect(await snapshot()).toEqual(before);
  await asUser(ordinary, async () => {
    expect(
      (
        await db.query(
          "select public.is_admin() as admin,public.can_manage($1::uuid) as provider_access",
          [organization],
        )
      ).rows,
    ).toEqual([{ admin: false, provider_access: false }]);
    expect(
      (await db.query("select * from public.provider_applications")).rows,
    ).toEqual([]);
  });
});
it.each([
  null,
  "pending",
  "APPROVED",
  "approved'; delete from public.administrators; --",
])(
  "rejects invalid decision %j without changing an application",
  async (decision) => {
    const id = await submit("bad-decision@example.test");
    await expect(
      asUser(admin, () =>
        db.query(
          "select public.review_provider_application($1,$2,'A valid review explanation.')",
          [id, decision],
        ),
      ),
    ).rejects.toThrow(/Invalid review/);
    expect(await state(id)).toMatchObject({
      status: "pending",
      reviewed_by: null,
    });
    expect(await auditCount(id)).toBe(0);
  },
);
it("normalizes valid notes and stores SQL-looking text as data", async () => {
  const id = await submit("literal-note@example.test");
  const note = "A synthetic note: '; delete from public.administrators; --";
  await asUser(admin, () =>
    reject(id, `\n\t \ufeff\u00a0 ${note} \u00a0\ufeff\r\n`),
  );
  expect(await state(id)).toMatchObject({
    status: "rejected",
    review_note: note,
  });
  expect(
    (await db.query("select count(*)::int as count from public.administrators"))
      .rows,
  ).toEqual([{ count: 2 }]);
});
it.each(["1234567", "+123456789012345"])(
  "accepts valid phone digit boundaries: %s",
  async (contact) => {
    const id = await submit("phone-bounds@example.test");
    await asUser(admin, () =>
      approve(id, {
        contact,
        source: "https://example.test/contact?channel=phone#office",
      }),
    );
    expect(await state(id)).toMatchObject({
      status: "approved",
      verification_contact: contact,
    });
  },
);
it("accepts official email evidence with query and fragment URLs", async () => {
  const id = await submit("email-evidence@example.test");
  await asUser(admin, () =>
    approve(id, {
      method: "email",
      contact: "office@example.test",
      source: "https://example.test/contact?channel=email#office",
    }),
  );
  expect(await state(id)).toMatchObject({
    status: "approved",
    verification_method: "email",
  });
});
it("does not resolve hostile public or temporary function/table names", async () => {
  const id = await submit("search-path@example.test");
  await db.exec(
    "create function public.jsonb_build_object(text,text) returns jsonb language plpgsql as $$ begin raise exception 'unsafe_shadow_function'; end $$; create function public.isfinite(timestamptz) returns boolean language sql as $$ select false $$; create temporary table provider_applications(id uuid,status text); create temporary table administrators(user_id uuid)",
  );
  try {
    await asUser(admin, () => approve(id));
  } finally {
    await db.exec(
      "drop function public.jsonb_build_object(text,text); drop function public.isfinite(timestamptz); drop table pg_temp.provider_applications,pg_temp.administrators",
    );
  }
  expect(await state(id)).toMatchObject({
    status: "approved",
    reviewed_by: admin,
  });
  expect(await auditCount(id)).toBe(1);
});
it("locks down SECURITY DEFINER search paths and helper execution", async () => {
  const rows = (
    await db.query<{
      proname: string;
      prosecdef: boolean;
      proconfig: string[];
    }>(
      "select proname,prosecdef,proconfig from pg_proc where proname in ('guard_provider_application_review','review_provider_application')",
    )
  ).rows;
  expect(rows).toHaveLength(2);
  for (const row of rows) {
    expect(row.prosecdef).toBe(true);
    expect(row.proconfig).toEqual(["search_path=pg_catalog, pg_temp"]);
  }
  const privileges = (
    await db.query(
      "select has_function_privilege('anon','public.review_provider_application(uuid,text,text,text,text,text,timestamptz,boolean)','execute') as anon_review,has_function_privilege('authenticated','public.guard_provider_application_review()','execute') as helper",
    )
  ).rows[0];
  expect(privileges).toEqual({ anon_review: false, helper: false });
});
