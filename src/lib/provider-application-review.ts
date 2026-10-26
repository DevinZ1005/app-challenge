import { z } from "zod";
export const applicationStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
const note = z.string().trim().min(10).max(2000);
const sourceUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        /^https:\/\/[^/?#\s@\\]+(?:[/?#][^\s\\]*)?$/.test(value)
      );
    } catch {
      return false;
    }
  });
export const applicationReviewSchema = z
  .discriminatedUnion("decision", [
    z.object({ decision: z.literal("rejected"), note }).strict(),
    z
      .object({
        decision: z.literal("approved"),
        note,
        sourceUrl,
        contactMethod: z.enum(["phone", "email"]),
        officialContact: z.string().trim().min(3).max(254),
        contactedAt: z.iso.datetime(),
        affiliationConfirmed: z.literal(true),
      })
      .strict(),
  ])
  .superRefine((value, context) => {
    if (value.decision !== "approved") return;
    if (Date.parse(value.contactedAt) < Date.parse("0001-01-01T00:00:00Z"))
      context.addIssue({
        code: "custom",
        path: ["contactedAt"],
        message: "Enter a supported contact date",
      });
    const phoneDigits = value.officialContact.replace(/[^0-9]/g, "").length;
    const valid =
      value.contactMethod === "phone"
        ? /^[+0-9 ()-]{7,30}$/.test(value.officialContact) &&
          phoneDigits >= 7 &&
          phoneDigits <= 15
        : z.email().safeParse(value.officialContact).success;
    if (!valid)
      context.addIssue({
        code: "custom",
        path: ["officialContact"],
        message: "Enter the official phone or email used",
      });
    if (Date.parse(value.contactedAt) > Date.now())
      context.addIssue({
        code: "custom",
        path: ["contactedAt"],
        message: "Contact time cannot be in the future",
      });
  });
export type ApplicationReview = z.infer<typeof applicationReviewSchema>;
export interface ApplicationSummary {
  id: string;
  organizationName: string;
  createdAt: string;
  status: ApplicationStatus;
  reviewedAt: string | null;
}
export interface ApplicationDetails extends ApplicationSummary {
  organizationAddress: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  organizationWebsite: string | null;
  description: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  verification: {
    sourceUrl: string;
    method: "phone" | "email";
    contact: string;
    contactedAt: string;
  } | null;
}
