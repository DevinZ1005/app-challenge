import { z } from "zod";

export const providerApplicationSchema = z
  .object({
    organizationName: z.string().trim().min(2).max(160),
    organizationAddress: z.string().trim().min(5).max(400),
    contactName: z.string().trim().min(2).max(120),
    contactEmail: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    contactPhone: z
      .string()
      .trim()
      .regex(/^$|^[+0-9 ()-]{7,30}$/)
      .default(""),
    organizationWebsite: z
      .string()
      .trim()
      .max(500)
      .refine((value) => {
        if (!value) return true;
        try {
          const url = new URL(value);
          return (
            url.protocol === "https:" &&
            !url.username &&
            !url.password &&
            !/\s/.test(value)
          );
        } catch {
          return false;
        }
      })
      .transform((value) => (value ? new URL(value).href : ""))
      .default(""),
    description: z.string().trim().min(20).max(1000),
  })
  .strict();

export const providerApplicationRequestSchema =
  providerApplicationSchema.extend({
    faxNumber: z.string().max(200).default(""),
  });
export type ProviderApplication = z.infer<typeof providerApplicationSchema>;
