import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, rename } from "node:fs/promises";
import { demoProviders } from "./data";
import type { Provider } from "./model";
import { listingSchema, verificationSchema } from "./listings";
import { updateSchema, type ChangeRequest, type AuditEntry } from "./updates";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const isDemo = !url && !anon;
const keyFile = "/tmp/pantryfit-demo-session.key";
async function sessionSecret() {
  try {
    return await readFile(keyFile);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    try {
      await writeFile(keyFile, randomBytes(32), { flag: "wx", mode: 0o600 });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    return readFile(keyFile);
  }
}
const file = process.env.PANTRYFIT_DEMO_FILE || "/tmp/pantryfit-demo-v1.json";
export type Identity = {
  id: string;
  email: string;
  role: "provider" | "admin";
  programIds: string[];
  token?: string;
};
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function supabase(token?: string) {
  if (!url || !anon)
    throw new HttpError(503, "Supabase configuration incomplete");
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
  });
}
async function sign(value: string) {
  return createHmac("sha256", await sessionSecret())
    .update(value)
    .digest("hex");
}
export async function login(email: string, password: string) {
  if (isDemo) {
    if (
      password !== "PantryFit-demo-2026" ||
      !["provider@demo.pantryfit.test", "admin@demo.pantryfit.test"].includes(
        email,
      )
    )
      throw new HttpError(401, "Invalid credentials");
    const value = Buffer.from(
      JSON.stringify({ id: email, exp: Date.now() + 3600000 }),
    ).toString("base64url");
    return `${value}.${await sign(value)}`;
  }
  const { data, error } = await supabase().auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) throw new HttpError(401, "Invalid credentials");
  return data.session.access_token;
}
export async function identity(): Promise<Identity> {
  const token = (await cookies()).get("pantryfit-session")?.value;
  if (!token) throw new HttpError(401, "Authentication required");
  if (isDemo) {
    const [value, signature] = token.split(".");
    if (!value || !signature || signature.length !== 64)
      throw new HttpError(401, "Invalid session");
    const expected = await sign(value);
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
      throw new HttpError(401, "Invalid session");
    let parsed;
    try {
      parsed = JSON.parse(Buffer.from(value, "base64url").toString());
    } catch {
      throw new HttpError(401, "Invalid session");
    }
    if (
      parsed.exp < Date.now() ||
      !["provider@demo.pantryfit.test", "admin@demo.pantryfit.test"].includes(
        parsed.id,
      )
    )
      throw new HttpError(401, "Expired session");
    const admin = parsed.id.startsWith("admin@");
    return {
      id: parsed.id,
      email: parsed.id,
      role: admin ? "admin" : "provider",
      programIds: admin ? demoProviders.map((p) => p.id) : ["demo-garden"],
    };
  }
  const client = supabase(token);
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  if (error || !user) throw new HttpError(401, "Invalid session");
  const { data: admin } = await client
    .from("administrators")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: members } = await client
    .from("provider_users")
    .select("provider_id")
    .eq("user_id", user.id)
    .eq("approved", true);
  const ids = (members || []).map((v) => v.provider_id);
  const { data: programs } = await client
    .from("service_programs")
    .select("id")
    .in("provider_id", ids);
  return {
    id: user.id,
    email: user.email || "",
    role: admin ? "admin" : "provider",
    programIds: (programs || []).map((v) => v.id),
    token,
  };
}
interface Feedback {
  id: string;
  message: string;
  createdAt: string;
}
interface DemoStore {
  providers: Provider[];
  changes: ChangeRequest[];
  audit: AuditEntry[];
  feedback?: Feedback[];
}
async function readStore(): Promise<DemoStore> {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    return {
      providers: structuredClone(demoProviders),
      changes: [],
      audit: [],
    };
  }
}
let queue: Promise<unknown> = Promise.resolve();
function mutate<T>(fn: (s: DemoStore) => T): Promise<T> {
  const task = queue.then(async () => {
    const s = await readStore();
    const result = fn(s);
    const tmp = file + "." + randomBytes(5).toString("hex");
    await writeFile(tmp, JSON.stringify(s), { mode: 0o600 });
    await rename(tmp, file);
    return result;
  });
  queue = task.catch(() => {});
  return task;
}
export async function listProviders() {
  if (isDemo) {
    await queue;
    return (await readStore()).providers;
  }
  const { data, error } = await supabase()
    .from("public_provider_documents")
    .select("document");
  if (error) throw new HttpError(503, "Provider data unavailable");
  const records = (data || []).map((v) => v.document as Provider);
  const real = records.filter((p) => !p.demo);
  return real.length ? real : records;
}
export async function dashboard(who: Identity) {
  if (isDemo) {
    await queue;
    const s = await readStore();
    return {
      changes: s.changes.filter(
        (c) => who.role === "admin" || c.submittedBy === who.id,
      ),
      audit: s.audit.filter((a) => who.role === "admin" || a.actor === who.id),
      feedback: who.role === "admin" ? s.feedback || [] : [],
    };
  }
  const client = supabase(who.token);
  const { data: rows, error } = await client
    .from("change_requests")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error) throw new HttpError(403, "Access denied");
  const { data: feedback } =
    who.role === "admin"
      ? await client
          .from("feedback")
          .select("id,message,created_at")
          .order("created_at", { ascending: false })
          .limit(100)
      : { data: [] };
  const { data: audit } = await client
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return {
    feedback: (feedback || []).map((f) => ({
      id: f.id,
      message: f.message,
      createdAt: f.created_at,
    })),
    changes: (rows || []).map((r) => ({
      id: r.id,
      programId: r.program_id,
      submittedBy: r.submitted_by,
      submittedAt: r.submitted_at,
      status: r.status,
      payload: r.payload,
      reviewNote: r.review_note,
    })),
    audit: (audit || []).map((a) => ({
      id: a.id,
      actor: a.actor,
      action: a.action,
      at: a.created_at,
      changeId: a.change_id,
    })),
  };
}
export async function submitChange(who: Identity, raw: unknown) {
  const p = updateSchema.parse(raw);
  if (who.role !== "admin" && !who.programIds.includes(p.programId))
    throw new HttpError(403, "Organization access required");
  // Provider statements are never independent verification.
  if (p.offerings)
    p.offerings = p.offerings.map((o) => ({ ...o, verified: false }));
  if (isDemo)
    return mutate((s) => {
      if (!s.providers.some((v) => v.id === p.programId))
        throw new HttpError(404, "Program not found");
      const id = crypto.randomUUID();
      s.changes.unshift({
        id,
        programId: p.programId,
        submittedBy: who.id,
        submittedAt: new Date().toISOString(),
        status: "pending",
        payload: p,
        reviewNote: null,
      });
      s.audit.push({
        id: crypto.randomUUID(),
        actor: who.id,
        action: "submitted",
        at: new Date().toISOString(),
        changeId: id,
      });
      return { id };
    });
  const { data, error } = await supabase(who.token)
    .from("change_requests")
    .insert({ program_id: p.programId, submitted_by: who.id, payload: p })
    .select("id")
    .single();
  if (error) throw new HttpError(403, "Update rejected");
  return data;
}
export async function reviewChange(
  who: Identity,
  id: string,
  status: "approved" | "rejected",
  note: string,
) {
  if (who.role !== "admin")
    throw new HttpError(403, "Administrator access required");
  if (isDemo)
    return mutate((s) => {
      const c = s.changes.find((v) => v.id === id);
      if (!c) throw new HttpError(404, "Change not found");
      if (c.status !== "pending") throw new HttpError(409, "Already reviewed");
      if (status === "approved") {
        const p = s.providers.find((p) => p.id === c.programId)!;
        p.program = {
          ...p.program,
          hours: c.payload.hours,
          exceptions: c.payload.exceptions,
          offerings: c.payload.offerings,
          appointment: c.payload.appointment,
          eligibility: c.payload.eligibility,
          eligibilityStatus: "unknown",
        };
        p.phone = c.payload.phone || null;
        p.phoneVerified = false;
        p.updatedAt = new Date().toISOString();
        p.verifiedAt = null;
      }
      c.status = status;
      c.reviewNote = note;
      s.audit.push({
        id: crypto.randomUUID(),
        actor: who.id,
        action: status,
        at: new Date().toISOString(),
        changeId: id,
      });
      return { ok: true };
    });
  const { error } = await supabase(who.token).rpc("review_change", {
    request_id: id,
    decision: status,
    review_reason: note,
  });
  if (error) throw new HttpError(409, "Review rejected");
  return { ok: true };
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  let valid = false;
  try {
    const parsed = new URL(origin || "");
    valid =
      !!host &&
      parsed.host === host &&
      ["http:", "https:"].includes(parsed.protocol);
  } catch {}
  if (!valid) throw new HttpError(403, "Same-origin request required");
}
const attempts = new Map<string, { count: number; start: number }>();
export function rateLimit(key: string) {
  const now = Date.now();
  if (attempts.size > 10000) attempts.clear();
  const a = attempts.get(key);
  if (!a || now - a.start > 60000) {
    attempts.set(key, { count: 1, start: now });
    return;
  }
  if (++a.count > 10) throw new HttpError(429, "Try again later");
}
export function apiError(e: unknown) {
  if (e instanceof HttpError)
    return Response.json({ error: e.message }, { status: e.status });
  if (e && typeof e === "object" && "issues" in e)
    return Response.json({ error: "Invalid input" }, { status: 400 });
  console.error(
    "PantryFit request failed",
    e instanceof Error ? e.message : "Unknown error",
  );
  return Response.json({ error: "Request failed" }, { status: 500 });
}

export async function createListing(who: Identity, raw: unknown) {
  if (who.role !== "admin")
    throw new HttpError(403, "Administrator access required");
  const v = listingSchema.parse(raw);
  if (isDemo)
    return mutate((s) => {
      const id = "demo-" + crypto.randomUUID();
      s.providers.push({
        id,
        name: v.name,
        description: v.description,
        address: v.address,
        coordinates: { lat: v.lat, lng: v.lng },
        coordinatesVerified: false,
        phone: null,
        phoneVerified: false,
        demo: true,
        source: {
          url: v.sourceUrl || null,
          name: v.sourceName,
          collectedAt: v.collectedAt,
        },
        verifiedAt: null,
        updatedAt: new Date().toISOString(),
        accessibility: null,
        program: {
          type: v.type,
          hours: null,
          exceptions: [],
          offerings: null,
          appointment: "unknown",
          eligibility: null,
          eligibilityStatus: "unknown",
        },
      });
      s.audit.push({
        id: crypto.randomUUID(),
        actor: who.id,
        action: "listing_created",
        at: new Date().toISOString(),
        changeId: id,
      });
      return { id };
    });
  const { data, error } = await supabase(who.token).rpc("create_listing", {
    listing: v,
  });
  if (error) throw new HttpError(400, "Listing rejected");
  return { id: data };
}
export async function verifyListing(who: Identity, raw: unknown) {
  if (who.role !== "admin")
    throw new HttpError(403, "Administrator access required");
  const v = verificationSchema.parse(raw);
  if (isDemo)
    return mutate((s) => {
      const p = s.providers.find((p) => p.id === v.programId);
      if (!p) throw new HttpError(404, "Program not found");
      if (v.method === "flag_outdated") {
        p.verifiedAt = null;
        p.phoneVerified = false;
        p.coordinatesVerified = false;
        if (p.program.offerings)
          p.program.offerings = p.program.offerings.map((o) => ({
            ...o,
            verified: false,
          }));
      } else {
        // Demo records remain fictional; no real-world verification dates or contacts.
        if (v.fields.includes("offerings") && p.program.offerings)
          p.program.offerings = p.program.offerings.map((o) => ({
            ...o,
            verified: true,
          }));
      }
      s.audit.push({
        id: crypto.randomUUID(),
        actor: who.id,
        action:
          v.method === "flag_outdated"
            ? "flag_outdated"
            : "verification_recorded",
        notes: v.notes,
        at: new Date().toISOString(),
        changeId: v.programId,
      });
      return { ok: true };
    });
  const { error } = await supabase(who.token).rpc("record_verification", {
    program: v.programId,
    verification_method: v.method,
    fields: v.fields,
    verification_notes: v.notes,
  });
  if (error) throw new HttpError(400, "Verification rejected");
  return { ok: true };
}
export async function submitFeedback(message: string) {
  if (isDemo)
    return mutate((s) => {
      s.feedback = s.feedback || [];
      s.feedback.push({
        id: crypto.randomUUID(),
        message,
        createdAt: new Date().toISOString(),
      });
      return { ok: true };
    });
  const { error } = await supabase().rpc("submit_feedback", {
    feedback_message: message,
  });
  if (error) throw new HttpError(400, "Feedback rejected");
  return { ok: true };
}
