# Testing instructions and scope

```sh
npm ci
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Current executed results and environment details are in [VERIFICATION.md](VERIFICATION.md). `npm run check` combines types, lint, Vitest, checklist evidence validation and build. `npm run readiness:release` deliberately fails while manual public-launch gates remain pending; it cannot certify a release.

After building and installing Chromium, `npm run test:production` starts isolated production servers on port 3101 (override `SMOKE_PORT` if necessary), verifies unconfigured fail-closed and explicit fictional-demo behavior, and stops them. Production Chromium also checks fresh script nonces, policy override resistance, blocked untrusted HTML scripts, hydration, language switching, matching, details and editing through client navigation. The script overrides Supabase variables to blank and uses a dedicated temporary data directory. It does not exercise real Supabase credentials.

Unit tests exercise 30 matching cases, including schedule conflict versus proximity, refrigeration, microwave-only use, unknown food/hours/diets, stale records, ranking, no suitable providers, joint hard constraints, interval endpoints, exceptional closures, deterministic ties, unavailable/unreliable travel, malformed inputs/timestamps, DST/local-day conversion, and configurable scoring. An RTL component test checks questionnaire input retention and labeling; dictionary tests check bilingual key completeness.

Thirteen embedded PostgreSQL/PGlite tests load all four SQL migrations with a small Auth-role stub. They exercise RLS, review transactions, null input rejection, fictional verification boundaries, synthetic real-record verification/invalidation and feedback privacy. PGlite's built-in UUID implementation replaces the `pgcrypto` extension setup. These synthetic tests validate database logic locally and do not verify a real service or live Supabase integration.

Seven Playwright tests cover bilingual questionnaire/results/detail/editing behavior, mobile validation/navigation, household network/storage privacy and reload clearing, feedback failure/retry/admin visibility, authenticated provider form submission plus admin approval, API launch safeguards, and automated accessibility across nine public routes plus a Spanish questionnaire state. They challenge authorization, cross-origin writes, malformed/oversized bodies, health, crawler exclusion, headers and private cache controls. Browser journey tests freeze the household evaluation date. The suite creates its own fictional server on port 3102, blanks inherited database settings, uses a unique temporary data file and cleans up that file. It refuses to reuse an existing server and never resets the shared developer demo file.

Additional regression tests cover bounded/chunked request streams, configuration fail-closed behavior, sanitized error logging and provider-load failure/retry with preferences preserved. These supplement the original matcher/database/component/dictionary tests.

```sh
# Optional use of a system browser:
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e

# Run with the development server already available on localhost:3000:
node scripts/accessibility.mjs
node scripts/screenshot.mjs

# Or point QA scripts at another local server:
BASE_URL=http://localhost:3001 node scripts/accessibility.mjs
```

QA script browser paths can be overridden with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. The accessibility script uses axe-core WCAG A/AA checks and writes `artifacts/accessibility.json`, exiting nonzero for violations. It inspects seven routes, five additional questionnaire steps, expanded/Spanish results, and authenticated provider/admin dashboards. Screenshots are QA artifacts, not a substitute for the functioning app.

Manual review still required: keyboard and screen-reader use, browser zoom/reflow, actual Spanish-language review, older mobile devices, slow/offline connections, geographic edge cases, real Supabase sessions and RLS, and deployment smoke tests. Do not call the app WCAG certified on the basis of automated scans.
