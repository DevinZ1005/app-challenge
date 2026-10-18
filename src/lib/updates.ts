import { z } from "zod";
import { intervalSchema } from "./model";
const b = z.object({
  en: z.string().min(1).max(240),
  es: z.string().min(1).max(240),
});
export const offeringSchema = z.object({
  name: b,
  equipment: z
    .array(z.enum(["none", "microwave", "stovetop", "oven"]))
    .min(1)
    .max(4),
  storage: z.enum(["shelf", "cold", "unknown"]),
  diets: z.array(z.enum(["vegetarian", "vegan", "halal", "kosher"])).max(4),
  verified: z.boolean(),
});
export const updateSchema = z
  .object({
    programId: z.string().min(1).max(80),
    baseRevision: z.number().int().nonnegative().default(0),
    baseOrganizationRevision: z.number().int().nonnegative().default(0),
    hours: z.array(intervalSchema).max(50).nullable(),
    exceptions: z
      .array(
        z.object({
          date: z.iso.date(),
          closed: z.boolean(),
        }),
      )
      .max(50),
    offerings: z.array(offeringSchema).max(30).nullable(),
    appointment: z.enum(["yes", "no", "unknown"]),
    eligibility: b.nullable(),
    phone: z
      .string()
      .regex(/^[+\d ()-]{7,30}$/)
      .or(z.literal(""))
      .nullable(),
    note: z.string().min(5).max(1000),
  })
  .superRefine((v, ctx) => {
    const windows = new Set<string>();
    v.hours?.forEach((h, i) => {
      const key = `${h.day}/${h.start}/${h.end}`;
      if (windows.has(key))
        ctx.addIssue({
          code: "custom",
          path: ["hours", i],
          message: `Hours row ${i + 1} duplicates an earlier window`,
        });
      windows.add(key);
    });
    const dates = new Set<string>();
    v.exceptions.forEach((e, i) => {
      if (dates.has(e.date))
        ctx.addIssue({
          code: "custom",
          path: ["exceptions", i, "date"],
          message: `Closure row ${i + 1} repeats date ${e.date}`,
        });
      dates.add(e.date);
    });
  });
export type ProviderUpdate = z.infer<typeof updateSchema>;
export interface ChangeRequest {
  id: string;
  programId: string;
  submittedBy: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
  payload: ProviderUpdate;
  reviewNote: string | null;
}
export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  at: string;
  changeId: string | null;
  entityId?: string;
  method?: string;
  fields?: string[];
  notes?: string;
}
