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

Unit tests exercise 30 matching cases, including schedule conflict versus proximity, refrigeration, microwave-only use, unknown food/hours/diets, stale records, ranking, no suitable providers, joint hard constraints, interval endpoints, exceptional closures, deterministic ties, unavailable/unreliable travel, malformed inputs/timestamps, DST/local-day conversion, and configurable scoring. An RTL component test checks questionnaire input retention and labeling; dictionary tests check bilingual key completeness.

Seven embedded PostgreSQL/PGlite tests load the actual SQL migrations with a small Auth-role stub, then exercise RLS and review functions. PGlite's built-in UUID implementation replaces the `pgcrypto` extension setup. This validates database logic locally but is not a live Supabase integration test.

Three Playwright browser journeys cover bilingual questionnaire/results/detail/editing behavior, mobile validation/navigation, and authenticated provider form submission plus admin form approval. They also directly challenge API authorization boundaries. Browser tests freeze the household evaluation date for reproducibility and reset only the local fictional demo store. Use an isolated local demo, not a real configured directory.

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
