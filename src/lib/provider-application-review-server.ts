import "server-only";
import { z } from "zod";
import { requireAdmin, type Identity } from "./authorization";
import { HttpError } from "./http";
import { isDemo, supabase } from "./server";
import {
  applicationReviewSchema,
  type ApplicationSummary,
  type ApplicationDetails,
  type ApplicationStatus,
} from "./provider-application-review";

function reviewClient(who: Identity) {
  requireAdmin(who);
  if (isDemo)
    throw new HttpError(
      503,
      "Application review requires Supabase configuration",
    );
  return supabase(who.token);
}
async function queryResult<T>(query: PromiseLike<T>): Promise<T> {
  try {
    return await query;
  } catch {
    throw new HttpError(503, "Application review unavailable; try again later");
  }
}
type Row = {
  id: string;
  organization_name: string;
  created_at: string;
  status: ApplicationStatus;
  reviewed_at: string | null;
};
const summary = (row: Row): ApplicationSummary => ({
  id: row.id,
  organizationName: row.organization_name,
  createdAt: row.created_at,
  status: row.status,
  reviewedAt: row.reviewed_at,
});
export async function listProviderApplications(
  who: Identity,
  status: ApplicationStatus | "all",
  page: number,
) {
  const client = reviewClient(who);
  let query = client
    .from("provider_applications")
    .select("id,organization_name,created_at,status,reviewed_at", {
      count: "exact",
    });
  if (status !== "all") query = query.eq("status", status);
  const { data, error, count } = await queryResult(
    query
      .order("reviewed_at", { ascending: false, nullsFirst: true })
      .order("created_at", { ascending: true })
      .order("id")
      .range((page - 1) * 25, page * 25 - 1),
  );
  if (error || !data || count === null)
    throw new HttpError(503, "Application review unavailable; try again later");
  return {
    applications: data.map((row) => summary(row as Row)),
    total: count,
    page,
    pageSize: 25,
  };
}
export async function getProviderApplication(
  who: Identity,
  id: string,
): Promise<ApplicationDetails> {
  const client = reviewClient(who);
  z.uuid().parse(id);
  const { data, error } = await queryResult(
    client.from("provider_applications").select("*").eq("id", id).maybeSingle(),
  );
  if (error)
    throw new HttpError(503, "Application review unavailable; try again later");
  if (!data) throw new HttpError(404, "Application unavailable");
  return {
    ...summary(data as Row),
    organizationAddress: data.organization_address,
    contactName: data.contact_name,
    contactEmail: data.contact_email,
    contactPhone: data.contact_phone,
    organizationWebsite: data.organization_website,
    description: data.description,
    reviewedBy: data.reviewed_by,
    reviewNote: data.review_note,
    verification:
      data.status === "approved"
        ? {
            sourceUrl: data.verification_source_url,
            method: data.verification_method,
            contact: data.verification_contact,
            contactedAt: data.verification_contacted_at,
          }
        : null,
  };
}
export async function reviewProviderApplication(
  who: Identity,
  id: string,
  raw: unknown,
) {
  const client = reviewClient(who);
  z.uuid().parse(id);
  const review = applicationReviewSchema.parse(raw);
  const approved = review.decision === "approved" ? review : null;
  const { error } = await queryResult(
    client.rpc("review_provider_application", {
      application_id: id,
      decision: review.decision,
      decision_note: review.note,
      evidence_source_url: approved?.sourceUrl ?? null,
      evidence_method: approved?.contactMethod ?? null,
      evidence_contact: approved?.officialContact ?? null,
      evidence_contacted_at: approved?.contactedAt ?? null,
      affiliation_confirmed: !!approved,
    }),
  );
  if (!error) return;
  if (
    error.code === "P0001" &&
    error.message === "application_already_reviewed"
  )
    throw new HttpError(
      409,
      "Application already reviewed; reload to see the decision",
    );
  if (error.code === "42501")
    throw new HttpError(
      403,
      "Administrator permission or independent reviewer required",
    );
  if (error.code === "P0002")
    throw new HttpError(404, "Application unavailable");
  if (["22023", "23514", "22007", "22008"].includes(error.code))
    throw new HttpError(
      400,
      "Check the review note and independent verification evidence",
    );
  if (["40001", "40P01"].includes(error.code))
    throw new HttpError(409, "Review conflict; reload and try again");
  throw new HttpError(503, "Application review unavailable; try again later");
}
