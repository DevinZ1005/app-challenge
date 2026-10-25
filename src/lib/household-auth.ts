import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemo, supabase, HttpError, checkOrigin } from "./server";
import { assertRuntimeConfiguration } from "./runtime";

// Household sessions cannot authenticate to the staff API, which uses a different cookie.
export const householdCookie =
  process.env.NODE_ENV === "production"
    ? "__Host-pantryfit-household"
    : "pantryfit-household";
const lifetime = 3600;
const demoDirectory = join(tmpdir(), "pantryfit-household-sessions");
export const emailSchema = z
  .object({
    email: z
      .email()
      .max(200)
      .transform((v) => v.toLowerCase()),
  })
  .strict();
export const codeSchema = emailSchema
  .extend({ code: z.string().regex(/^\d{6}$/) })
  .strict();
export function emailLoginEnabled() {
  return !isDemo && process.env.PANTRYFIT_EMAIL_LOGIN_ENABLED === "true";
}
export function checkHouseholdOrigin(request: Request) {
  checkOrigin(request);
  const expected =
    process.env.NODE_ENV === "production"
      ? process.env.PANTRYFIT_APP_ORIGIN
      : new URL(request.url).origin;
  if (!expected) throw new HttpError(503, "Sign-in configuration incomplete");
  if (request.headers.get("origin") !== expected)
    throw new HttpError(403, "Same-origin request required");
  if (process.env.NODE_ENV === "production" && !expected.startsWith("https://"))
    throw new HttpError(503, "Sign-in requires HTTPS");
}
function demoPath(token: string) {
  return join(
    demoDirectory,
    createHash("sha256").update(token).digest("hex") + ".json",
  );
}
export async function createHouseholdDemo() {
  assertRuntimeConfiguration();
  if (!isDemo) throw new HttpError(404, "Not available");
  const token = "demo." + randomBytes(32).toString("base64url");
  await mkdir(demoDirectory, { recursive: true });
  await writeFile(
    demoPath(token),
    JSON.stringify({ expiresAt: Date.now() + lifetime * 1000 }),
    { mode: 0o600, flag: "wx" },
  );
  return token;
}
export function householdResponse(token: string, expiresIn = lifetime) {
  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(householdCookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.max(0, Math.min(lifetime, expiresIn)),
  });
  return response;
}
export async function householdSignedIn(): Promise<boolean> {
  assertRuntimeConfiguration();
  const token = (await cookies()).get(householdCookie)?.value;
  if (!token) return false;
  if (isDemo) {
    if (!/^demo\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
    try {
      const session = JSON.parse(await readFile(demoPath(token), "utf8"));
      if (
        typeof session.expiresAt !== "number" ||
        session.expiresAt <= Date.now()
      ) {
        await unlink(demoPath(token)).catch(() => {});
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
  if (!emailLoginEnabled() || token.startsWith("demo.")) return false;
  const { data, error } = await supabase().auth.getUser(token);
  return !error && !!data.user?.email_confirmed_at && !data.user.is_anonymous;
}
export async function requireHousehold() {
  if (!(await householdSignedIn())) redirect("/login");
}
export async function requestHouseholdCode(email: string) {
  assertRuntimeConfiguration();
  if (!emailLoginEnabled())
    throw new HttpError(503, "Email sign-in is not configured yet");
  const { error } = await supabase().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  // Do not expose whether an address exists, is blocked, or has reached a provider limit.
  if (error && (error.status ?? 500) >= 500)
    throw new HttpError(503, "Sign-in is temporarily unavailable");
}
export async function verifyHouseholdCode(email: string, code: string) {
  assertRuntimeConfiguration();
  if (!emailLoginEnabled())
    throw new HttpError(503, "Email sign-in is not configured yet");
  const { data, error } = await supabase().auth.verifyOtp({
    email,
    token: code,
    type: "email",
  });
  if (
    error ||
    !data.session ||
    !data.user?.email_confirmed_at ||
    data.user.is_anonymous
  )
    throw new HttpError(401, "Code is invalid or expired");
  return householdResponse(data.session.access_token, data.session.expires_in);
}
export async function logoutHousehold() {
  const token = (await cookies()).get(householdCookie)?.value;
  if (token && isDemo && /^demo\.[A-Za-z0-9_-]{43}$/.test(token)) {
    await unlink(demoPath(token)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  } else if (token && !isDemo) {
    // Revoke this upstream refresh session. Access JWTs still expire on their configured TTL.
    const { error } = await supabase().auth.admin.signOut(token, "local");
    if (error && ![401, 403, 404].includes(error.status ?? 500))
      throw new HttpError(
        503,
        "Sign-out is temporarily unavailable. Please try again.",
      );
  }
  return householdResponse("", 0);
}
