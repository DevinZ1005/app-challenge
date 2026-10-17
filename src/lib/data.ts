import type { Provider, Bilingual } from "./model";
const b = (en: string, es: string): Bilingual => ({ en, es });
const base = {
  coordinatesVerified: false,
  phone: null,
  phoneVerified: false,
  demo: true,
  source: {
    url: null,
    name: b(
      "Fictional development fixture — not a real service",
      "Datos ficticios de desarrollo; no es un servicio real",
    ),
    collectedAt: "2026-10-01T12:00:00Z",
  },
  verifiedAt: null,
  updatedAt: "2026-10-01T12:00:00Z",
  accessibility: null,
};
export const demoProviders: Provider[] = [
  {
    ...base,
    id: "demo-garden",
    name: b("Garden Table Pantry", "Despensa Mesa del Jardín"),
    description: b(
      "A fictional neighborhood pantry demonstrating flexible afternoon pickups and shelf-stable groceries.",
      "Una despensa ficticia para demostrar recogidas por la tarde y alimentos que no requieren refrigeración.",
    ),
    address: b(
      "Illustrative location · Bedford Park, Bronx 10468",
      "Ubicación ilustrativa · Bedford Park, Bronx 10468",
    ),
    coordinates: { lat: 40.873, lng: -73.891 },
    program: {
      type: "pantry",
      hours: [
        { day: 1, start: 780, end: 1020 },
        { day: 3, start: 600, end: 840 },
        { day: 5, start: 540, end: 720 },
      ],
      exceptions: [],
      offerings: [
        {
          name: b("Shelf-stable groceries", "Alimentos sin refrigeración"),
          equipment: ["none"],
          storage: "shelf",
          diets: ["vegetarian", "vegan"],
          verified: true,
        },
      ],
      appointment: "no",
      eligibility: null,
      eligibilityStatus: "unrestricted",
    },
  },
  {
    ...base,
    id: "demo-community",
    name: b("Community Kitchen", "Cocina Comunitaria"),
    description: b(
      "A fictional meal program demonstrating ready-to-eat options and evening service.",
      "Un programa ficticio de comidas para demostrar opciones listas para comer y servicio por la tarde.",
    ),
    address: b(
      "Illustrative location · Jerome Park, Bronx 10468",
      "Ubicación ilustrativa · Jerome Park, Bronx 10468",
    ),
    coordinates: { lat: 40.881, lng: -73.897 },
    program: {
      type: "meals",
      hours: [
        { day: 0, start: 1020, end: 1140 },
        { day: 2, start: 1020, end: 1140 },
        { day: 4, start: 1020, end: 1140 },
      ],
      exceptions: [],
      offerings: [
        {
          name: b("Ready-to-eat meals", "Comidas listas para comer"),
          equipment: ["none"],
          storage: "shelf",
          diets: ["vegetarian"],
          verified: true,
        },
      ],
      appointment: "no",
      eligibility: null,
      eligibilityStatus: "unrestricted",
    },
  },
  {
    ...base,
    id: "demo-neighbors",
    name: b("Neighbors Food Collective", "Colectivo de Alimentos Vecinos"),
    description: b(
      "A fictional grocery program with refrigerated ingredients that require a stove.",
      "Un programa ficticio con ingredientes refrigerados que requieren una estufa.",
    ),
    address: b(
      "Illustrative location · Kingsbridge, Bronx 10468",
      "Ubicación ilustrativa · Kingsbridge, Bronx 10468",
    ),
    coordinates: { lat: 40.867, lng: -73.904 },
    program: {
      type: "community",
      hours: [
        { day: 1, start: 540, end: 720 },
        { day: 4, start: 600, end: 840 },
      ],
      exceptions: [],
      offerings: [
        {
          name: b("Fresh ingredients", "Ingredientes frescos"),
          equipment: ["stovetop"],
          storage: "cold",
          diets: [],
          verified: true,
        },
      ],
      appointment: "yes",
      eligibility: b(
        "Service area requirements must be confirmed.",
        "Confirme los requisitos del área de servicio.",
      ),
      eligibilityStatus: "unknown",
    },
  },
  {
    ...base,
    id: "demo-harvest",
    name: b("Harvest Share", "Cosecha Compartida"),
    description: b(
      "A fictional listing demonstrating how PantryFit handles missing hours and unknown food offerings.",
      "Un registro ficticio que demuestra cómo PantryFit trata horarios y alimentos desconocidos.",
    ),
    address: b(
      "Illustrative location · University Heights, Bronx 10468",
      "Ubicación ilustrativa · University Heights, Bronx 10468",
    ),
    coordinates: { lat: 40.861, lng: -73.908 },
    program: {
      type: "pantry",
      hours: null,
      exceptions: [],
      offerings: null,
      appointment: "unknown",
      eligibility: null,
      eligibilityStatus: "unknown",
    },
  },
];
