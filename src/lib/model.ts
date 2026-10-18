import { z } from "zod";
export const intervalSchema = z
  .object({
    day: z.number().int().min(0).max(6),
    start: z.number().int().min(0).max(1439),
    end: z.number().int().min(1).max(1440),
  })
  .refine((v) => v.end > v.start, "End must follow start");
export type TimeInterval = z.infer<typeof intervalSchema>;
export const householdSchema = z
  .object({
    zip: z.string().regex(/^\d{5}$/),
    landmark: z.string().max(120).default(""),
    location: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .optional(),
    mode: z.enum(["walking", "transit", "either"]),
    maxMinutes: z.number().int().min(1).max(180),
    availability: z.array(intervalSchema).max(100),
    equipment: z
      .array(z.enum(["none", "microwave", "stovetop", "oven"]))
      .max(4),
    refrigeration: z.enum(["yes", "no", "limited", "unknown"]),
    shelfStable: z.boolean(),
    diet: z.enum(["none", "vegetarian", "vegan", "halal", "kosher", "other"]),
    dietNote: z.string().max(120).default(""),
    strictDiet: z.boolean(),
  })
  .refine(
    (v) => !(v.equipment.includes("none") && v.equipment.length > 1),
    "Select no equipment on its own",
  );
export type HouseholdPreferences = z.infer<typeof householdSchema>;
export const defaultPreferences: HouseholdPreferences = {
  zip: "10468",
  landmark: "",
  mode: "walking",
  maxMinutes: 30,
  availability: [],
  equipment: [],
  refrigeration: "unknown",
  shelfStable: false,
  diet: "none",
  dietNote: "",
  strictDiet: false,
};
export type Locale = "en" | "es";
export type Bilingual = Record<Locale, string>;
export type State = "compatible" | "incompatible" | "unknown";
export type Factor =
  | "schedule"
  | "travel"
  | "storage"
  | "cooking"
  | "diet"
  | "eligibility"
  | "combination";
export interface FoodOffering {
  name: Bilingual;
  equipment: ("none" | "microwave" | "stovetop" | "oven")[];
  storage: "shelf" | "cold" | "unknown";
  diets: string[];
  verified: boolean;
}
export interface ServiceProgram {
  type: "pantry" | "meals" | "community";
  hours: TimeInterval[] | null;
  exceptions: { date: string; closed: boolean }[];
  offerings: FoodOffering[] | null;
  appointment: "yes" | "no" | "unknown";
  eligibility: Bilingual | null;
  eligibilityStatus: "unrestricted" | "restricted" | "unknown";
}
export interface Provider {
  id: string;
  organizationId?: string;
  revision?: number;
  organizationRevision?: number;
  name: Bilingual;
  description: Bilingual;
  address: Bilingual;
  coordinates: { lat: number; lng: number };
  coordinatesVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  demo: boolean;
  program: ServiceProgram;
  source: { url: string | null; name: Bilingual; collectedAt: string };
  verifiedAt: string | null;
  updatedAt: string;
  accessibility: Bilingual | null;
  travel?: {
    mode: "walking" | "transit";
    minutes: number;
    reliable: boolean;
    estimatedAt: string;
    origin?: { lat: number; lng: number };
    destination?: { lat: number; lng: number };
  };
}
export interface ConstraintEvaluation {
  factor: Factor;
  state: State;
  hard: boolean;
  active: boolean;
  code: string;
}
export interface MatchExplanation {
  factor: Factor;
  code: string;
  state: State;
}
export interface MatchResult {
  provider: Provider;
  score: number;
  confidence: number;
  category: "strong" | "possible" | "unsuitable";
  evaluations: ConstraintEvaluation[];
  explanations: MatchExplanation[];
  stale: boolean;
  distanceKm: number | null;
}
