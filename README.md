# PantryFit

**Food assistance that fits your life.** A functional development prototype for the Congressional App Challenge, starting with the Bronx’s 10468 ZIP code.

PantryFit compares household schedules, travel limits, cooking equipment, refrigeration, and dietary needs with documented services. It explains both compatibility and missing information. No household account is required.

> All built-in services are fictional. Do not visit their illustrative locations. No real organizations, partnerships, interviews, or impact statistics are claimed.

## Run locally

Use Node.js 22 or 24 and npm. From this directory:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No environment variables are needed for the fictional demo. To use Supabase, copy `.env.example` to `.env.local`, set **both** public Supabase variables, apply the migrations, and restart. Partial configuration returns an error rather than silently using demo authentication.

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm start
```

An existing Chromium installation can be used with `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium npm run test:e2e`. The browser tests use a local development server. Unit tests include the matching engine, a questionnaire component, dictionary completeness, and PostgreSQL authorization through PGlite when installed. The production Supabase service must still be tested with real project credentials.

## Demonstrate the provider workflow

In demo mode only:

| Role                         | Email                        | Password            |
| ---------------------------- | ---------------------------- | ------------------- |
| Provider (Garden Table only) | provider@demo.pantryfit.test | PantryFit-demo-2026 |
| Administrator                | admin@demo.pantryfit.test    | PantryFit-demo-2026 |

1. Open `/provider/login`, sign in as provider, edit hours or offerings, and enter an update note.
2. Submit for review. Published data stays unchanged while the request is pending.
3. Sign out, sign in as administrator, and approve or reject with a review note.
4. Reopen `/results` or the provider details to see approved changes. Review audit history in the dashboard.
5. Administrators can add listings, record evidence, flag stale records, and review feedback.

These public credentials are a **fictional sandbox**, not production authentication. Demo sessions use signed HTTP-only, SameSite cookies. Only provider/admin demo records are stored in `/tmp/pantryfit-demo-v1.json`; preferences are never stored. Run `node scripts/reset-demo.mjs` while the server is stopped to reset demo records and sessions. The demo store is suitable for one local server process, not a multi-instance production database.

## Architecture and files

| Path                   | Purpose                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| `src/app/`             | Next.js App Router pages, layout, and server API routes               |
| `src/components/`      | Responsive public UI, bilingual questionnaire, results, dashboards    |
| `src/lib/model.ts`     | Typed matching contracts and Zod household validation                 |
| `src/lib/matching.ts`  | Deterministic reference matching algorithm                            |
| `src/lib/i18n.ts`      | English/Spanish dictionary used by shared components                  |
| `src/lib/server.ts`    | Server authorization, demo storage, Supabase access                   |
| `src/lib/updates.ts`   | Shared provider submission validation                                 |
| `supabase/migrations/` | Normalized PostgreSQL schema, policies, review transactions           |
| `supabase/seed.sql`    | Clearly fictional Supabase seed                                       |
| `scripts/import.ts`    | JSON import validation; no automatic publication                      |
| `tests/`, `e2e/`       | Unit, component, database-policy, and browser tests                   |
| `docs/`                | Architecture, data research, deployment, demo script |

Next.js + React + strict TypeScript, Tailwind CSS with a custom visual system, Lucide, React Hook Form, Zod, Supabase PostgreSQL/Auth/RLS, Vitest, React Testing Library, Playwright. A small typed dictionary replaces next-intl to keep language switching and in-memory forms simple. Recommendations use deterministic rules.

## Trust and privacy

- Household inputs stay in React memory; navigating within the app preserves them, reloading clears them. Locale changes preserve answers. No precise address or account is requested.
- Geolocation is requested only when the user presses the location button and is rounded to roughly a neighborhood block. Coordinates are never sent to the backend.
- Unknown information never earns compatibility credit. Hard conflicts cannot be overridden by a score. Scores and information confidence are shown separately.
- Stored times use UTC timestamps; recurring schedules use structured local weekday/minute intervals with `America/New_York` calculations. Overnight hours must be split across days.
- Directions and calling are disabled for fictional services. Straight-line distance is available only with household coordinates and verified service coordinates and is labeled explicitly.
- Provider statements are not independent verification. Approval strips verification flags, clears freshness and phone verification, and creates audit records.
- No advertising trackers or household analytics are implemented. Standard hosting access logs may exist.

## Data and import

The public demo uses `src/lib/data.ts`. An exported example is in `docs/demo-data.json`. Official source research and a field-by-field verification checklist are in [docs/DATA.md](docs/DATA.md). Reliable sources were identified, but no local listing was independently verified or imported.

```sh
npm run import:data -- docs/demo-data.json /tmp/pantryfit-validated.json
```

The importer validates the complete typed JSON shape, requires source URLs for real records, rejects mixed real/demo datasets, and preserves uncertainty. It does not publish data or assert verification. Use the admin form to publish reviewed listings; use the proposed update/review process to populate schedules and offerings. Public source text must be translated and reviewed by a bilingual human before being represented as verified provider content.

## Deployment

A standard Next.js Node build is prepared for Vercel. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). No live URL or real Supabase integration is claimed until deployment and credential-backed tests are performed.

## Known limitations

- Real local data verification, live Supabase credentials, Vercel deployment, a privacy review, and a completed demonstration video remain prerequisites to public/competition use.
- Live routing, transit estimates, geocoding, and MapLibre rendering are not connected. The map control explains the fallback; the full list remains usable. ZIP/landmark inputs are not geocoded. Initial records are a single Bronx fixture set, not a national directory.
- Eligibility restrictions are not inferred from sensitive household traits. Documented restrictions are presented as requiring confirmation. The questionnaire does not collect names, income, or immigration status.
- Demo authentication/storage and in-memory rate limits are deliberately local prototypes. Supabase mode uses Auth tokens and RLS; sessions expire after one hour and require sign-in again. Refresh-token rotation, account recovery, invitation emails, admin membership onboarding UI, and distributed rate limits remain production work.
- Independent verification is recorded by field; the summary freshness timestamp requires hours, offerings, and eligibility confirmation together. Availability of food on a particular day is never guaranteed.
- The schema supports multiple programs per organization; the public app renders each program as a separate service card. The initial UI supports English/Spanish text; third languages need an additional dictionary and reviewed provider translations.
- Automated accessibility scans and browser testing support, but do not replace, keyboard, screen-reader, bilingual, and low-end-device testing with local users. See `docs/STATUS.md` for executed checks and remaining review items.

