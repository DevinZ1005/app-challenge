import { z } from "zod";
import { intervalSchema } from "./model";
import { offeringSchema } from "./updates";
export const bilingualSchema = z.object({
  en: z.string().min(1).max(400),
  es: z.string().min(1).max(400),
});
export const listingSchema = z.object({
  name: bilingualSchema,
  description: bilingualSchema,
  address: bilingualSchema,
  zip: z.string().regex(/^\d{5}$/),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  type: z.enum(["pantry", "meals", "community"]),
  sourceName: bilingualSchema,
  sourceUrl: z
    .url()
    .refine((v) => v.startsWith("https://"))
    .or(z.literal("")),
  collectedAt: z.iso.datetime(),
});
export type ListingInput = z.infer<typeof listingSchema>;
export const realListingSchema = listingSchema.extend({
  sourceUrl: z
    .url({ error: "Source URL must be an HTTPS URL" })
    .refine((v) => v.startsWith("https://"), "Source URL must use HTTPS"),
});
export const verificationSchema = z
  .object({
    programId: z.string().min(1).max(80),
    method: z.enum(["phone", "official_source", "in_person", "flag_outdated"]),
    fields: z
      .array(
        z.enum(["hours", "offerings", "eligibility", "coordinates", "phone"]),
      )
      .max(5),
    notes: z.string().min(10).max(1000),
    eligibilityStatus: z
      .enum(["unrestricted", "restricted", "unknown"])
      .optional(),
  })
  .refine((v) => v.method === "flag_outdated" || v.fields.length > 0)
  .refine(
    (v) =>
      v.method === "flag_outdated" ||
      !v.fields.includes("eligibility") ||
      v.eligibilityStatus !== undefined,
    {
      path: ["eligibilityStatus"],
      message: "Choose the evidence-confirmed eligibility classification",
    },
  );
export const providerImportSchema = z
  .object({
    id: z.string().min(1),
    name: bilingualSchema,
    description: bilingualSchema,
    address: bilingualSchema,
    coordinates: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
    coordinatesVerified: z.boolean(),
    phone: z.string().nullable(),
    phoneVerified: z.boolean(),
    demo: z.boolean(),
    program: z.object({
      type: z.enum(["pantry", "meals", "community"]),
      hours: z.array(intervalSchema).nullable(),
      exceptions: z.array(
        z.object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          closed: z.boolean(),
        }),
      ),
      offerings: z.array(offeringSchema).nullable(),
      appointment: z.enum(["yes", "no", "unknown"]),
      eligibility: bilingualSchema.nullable(),
      eligibilityStatus: z.enum(["unrestricted", "restricted", "unknown"]),
    }),
    source: z.object({
      url: z.url().nullable(),
      name: bilingualSchema,
      collectedAt: z.iso.datetime(),
    }),
    verifiedAt: z.iso.datetime().nullable(),
    updatedAt: z.iso.datetime(),
    accessibility: bilingualSchema.nullable(),
  })
  .superRefine((p, ctx) => {
    if (!p.demo && !p.source.url)
      ctx.addIssue({
        code: "custom",
        message: "Real listings require a source URL",
      });
    if (p.demo && (p.coordinatesVerified || p.phoneVerified || p.verifiedAt))
      ctx.addIssue({
        code: "custom",
        message: "Demo fixtures must not claim real-world verification",
      });
  });
