import "server-only";
import { HttpError } from "./http";

export type AccountRole = "admin" | "provider" | "unaffiliated";
/** Constructed only by the server after authentication and trusted-record reads. */
export type Identity = {
  id: string;
  email: string;
  role: AccountRole;
  organizationIds: string[];
  programIds: string[];
  token?: string;
};

export function requireAuthenticated(
  who: Identity | null | undefined,
): asserts who is Identity {
  if (!who) throw new HttpError(401, "Authentication required");
}

export function requireAdmin(who: Identity | null | undefined) {
  requireAuthenticated(who);
  if (who.role !== "admin")
    throw new HttpError(403, "Administrator access required");
}

export function requireOrganizationAccess(
  who: Identity | null | undefined,
  organizationId: string,
) {
  requireAuthenticated(who);
  if (
    who.role !== "admin" &&
    (who.role !== "provider" || !who.organizationIds.includes(organizationId))
  )
    throw new HttpError(403, "Organization access required");
}

export function requireProgramAccess(
  who: Identity | null | undefined,
  programId: string,
) {
  requireAuthenticated(who);
  if (
    who.role !== "admin" &&
    (who.role !== "provider" || !who.programIds.includes(programId))
  )
    throw new HttpError(403, "Organization access required");
}

/** Return a sanitized service failure for returned errors and rejected queries. */
export async function readAuthorizationQuery<T>(
  query: PromiseLike<{ data: T; error: unknown }>,
): Promise<T> {
  try {
    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch {
    throw new HttpError(
      503,
      "Account permissions unavailable; try again later",
    );
  }
}
