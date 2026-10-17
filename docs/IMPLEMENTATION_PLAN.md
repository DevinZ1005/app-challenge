# Implementation plan and structure

1. Initialize a strict TypeScript Next.js App Router application with React, Tailwind, Lucide, React Hook Form, and Zod.
2. Define reusable household, service, constraint, provenance, verification, and match contracts in `src/lib/`.
3. Implement shared English/Spanish screens, an anonymous in-memory questionnaire, explainable results, and details in `src/components/`; route wrappers live in `src/app/`.
4. Build a working deterministic reference matcher with independent schedule, travel, food, eligibility, scoring, explanation, and ranking functions. This is development scaffolding for substantial student reimplementation.
5. Add server-validated provider submissions, authenticated role checks, admin review transactions, audit history, new listings, evidence recording, and feedback.
6. Add normalized Supabase migrations and least-privilege RLS, plus an explicitly fictional local demo when credentials are absent.
7. Validate with unit/component/PostgreSQL/browser tests, mobile/desktop screenshots, accessibility scans, TypeScript, ESLint, and production build.
8. Prepare Vercel deployment instructions, source-attributed import tools, student ownership assignments, AI disclosure, and competition demonstration drafts.

Student-owned technical modules: core matching reimplementation, independently authored interval and uncertainty tests, a substantial full-stack extension, credential-backed authorization tests, and reviewed local data integration. See `STUDENT_CONTRIBUTIONS.md` for the actual contribution record, which is currently unfilled.
