# Verification — October 18, 2026

Fresh follow-up evidence on Windows with Node.js 24.19.0, Next.js 15.5.28, Vitest 4.1.11 / Vite 8.3.4 and Playwright-managed Chromium. This supersedes the earlier October 18 table and the October 17 baseline in STATUS.md. The item-by-item source audit and external dependencies are in [AUDIT.md](AUDIT.md).

| Check                       | Observed result                                                                                                                                                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean locked installation   | Passed after the toolchain update: `npm ci`, 439 packages installed. Lockfile and root Node >=22.12 <25 engine agree. npm reported blocked install scripts for esbuild and unrs-resolver; subsequent actual checks passed.                                                                                                |
| Complete quality command    | `npm run check` exited 0: strict TypeScript, ESLint, Vitest, readiness integrity and production build. Checklist labels were subsequently corrected for hosted-CI evidence and readiness was rerun.                                                                                                                       |
| Vitest                      | 55 tests across 6 files passed: 30 matching, 13 database, 9 HTTP/runtime, 1 context load/retry, 1 questionnaire and 1 dictionary.                                                                                                                                                                                         |
| Database regressions        | Four tests failed before migration 004 and passed afterward: fictional verification flags, null programId, null equipment and null diet values. Additional RPC/flag-invalidation and feedback-privacy tests pass. All data is synthetic in embedded PGlite.                                                               |
| Playwright                  | Final clean-install run: all 7 tests passed. Covers household/bilingual/details/editing, mobile validation/overflow, household network/storage privacy/reload clearing, feedback failure/retry/admin visibility, provider/admin authorization and publication, API safeguards and public/Spanish automated accessibility. |
| Extended axe scan           | Zero automated A/AA violations across 16 routes/states on an isolated **production** fictional demo, including remaining questionnaire steps, expanded/Spanish results and authenticated staff forms. See [accessibility.json](../artifacts/accessibility.json).                                                          |
| Production dependency audit | `npm audit --omit=dev --audit-level=high` exited 0; zero vulnerabilities after the clean install. This excludes development dependencies.                                                                                                                                                                                 |
| Full dependency audit       | `npm audit --json` exited 1: five high development-only findings in braces/micromatch/fast-glob/Next ESLint; zero critical or moderate. Initial audit had eight findings; upgrading Vitest removed the two critical and one moderate findings. SEC-06 remains open.                                                       |
| Production build            | Passed. Public HTML routes are dynamic for fresh script nonces; robots remains static. No performance or hosting-cost conclusion follows from the build result.                                                                                                                                                           |
| Production smoke            | Final clean-install run passed unconfigured fail-closed and explicit fictional-demo cases. Unconfigured health/data/login return 503 and login creates no cookie; explicit demo health/data return 200 and all records remain fictional.                                                                                  |
| Production CSP browser      | Passed fresh nonces per response, replacement of caller-supplied CSP, correct framework-script nonces, blocked untrusted parser-inserted inline markup, no script unsafe-inline/unsafe-eval, language hydration, questionnaire/results/details/edit navigation and input retention. HTML is no-store.                     |
| Import CLI                  | `node --import tsx scripts/import.ts docs/demo-data.json artifacts/validated-demo.json` validated four fictional records; nothing was published or independently verified. Malformed database payloads are separately covered by regressions.                                                                             |
| Handoff integrity           | Final matrix: 29 requirements, 15 implemented, 11 pending, 3 not applicable. Original 28 audited; SEC-06 added. OPS-01 corrected to pending because hosted CI acceptance is unproved; SEC-05 implemented with production-browser evidence. Source-evidence paths exist.                                                   |
| Public-release gate         | Final `node scripts/readiness.mjs --release` exited 1 as expected: LAUNCH-01 through LAUNCH-07 remain pending. `implementationEvidenceValid=true`, `releaseApproved=false` in [readiness.json](../artifacts/readiness.json).                                                                                              |

The standard commands used through the bundled npm package runner where npm was unavailable on PATH were:

```sh
npm ci
npm run check
npm audit --omit=dev --audit-level=high
npm audit --json                         # exit 1; five dev-only high findings
npx playwright install chromium
npm run test:e2e
npm run test:production
# Isolated local production demo running on 127.0.0.1:3103:
BASE_URL=http://127.0.0.1:3103 npm run test:a11y
npm run readiness:release               # expected exit 1; seven manual gates
```

Actual equivalent direct entry points were also used: `node node_modules/playwright/cli.js install chromium`, `node node_modules/playwright/cli.js test`, `node scripts/smoke-production.mjs`, `node scripts/accessibility.mjs` with BASE_URL set, and `node scripts/readiness.mjs --release`. npm commands ran via bundled `pnpm --package=npm dlx npm`. The initial install was repeated after updating Vitest and its lockfile. The Node engine floor reflects the locked Vite dependency.

Environment limits encountered and resolved: sandbox DNS blocked the initial package runner and Chromium download, and filesystem/process restrictions blocked generated build directories or Vite's temporary-module cache. Approved normal-access runs completed the checks. An initial sandboxed browser server occupied the owned test port; only that test process/child was stopped before rerun. No automatic approval rejection remains unresolved.

The first production injection check used a script created by trusted JavaScript, which strict-dynamic intentionally permits. It was corrected to inject untrusted markup into the HTML response; that script was blocked and hydration/navigation still passed. One feedback test initially used an exact-text locator that included an appended timestamp; the corrected contains-text assertion passed. These were test corrections, not ignored product failures.

Browser QA uses isolated fictional stores. E2E now creates a unique temporary file on its own server at port 3102, blanks inherited Supabase settings and refuses server reuse; it no longer deletes the shared developer demo file. Production smoke uses its own temporary directory and cleans up its servers. The separate accessibility production demo used port 3103 and was stopped after the scan. Household tests use synthetic preferences and browser-provided synthetic location; no personal research data was collected.

Not established: hosted GitHub Actions/branch protection, live Supabase Auth/network/session and migration execution, HTTPS deployment/proxy behavior, real provider verification or translations, external alert delivery, restore/rollback rehearsal, production capacity/mobile field performance, representative manual screen-reader/Spanish/community testing, or operator contact/retention/privacy approval. PGlite stubs Auth roles; axe cannot prove WCAG conformance. Runtime/root error fallback screens were inspected in source but not triggered through real Next error injection or visually reviewed in this follow-up.

This directory is not a Git checkout, so no commit or PR was created. No real service or manual LAUNCH gate was marked verified. Script CSP is stronger locally; styles remain inline, local throttling remains nondistributed and session lifecycle is still limited. Read [SECURITY.md](SECURITY.md), [OPERATIONS.md](OPERATIONS.md) and the exact dependencies in [AUDIT.md](AUDIT.md) before any release decision.
