# Provider application review (Phase 3)

The existing `/admin` dashboard includes an administrator-only application queue, status filters, private details and final approval/rejection records. Both English and Spanish are supported. This phase records affiliation decisions only: approval creates no Auth user, invitation, provider membership, or dashboard access. Account activation belongs to a later phase.

Approval requires an HTTPS source for independently obtained official organization contact information, the official phone/email actually contacted, the contact time, a review explanation and an explicit affiliation confirmation. Do not treat an applicant's email confirmation, website entry or assertion as independent verification. Contact the organization through its independently established official channel first. Record only a concise verification summary; avoid unnecessary personal information or private correspondence. An administrator cannot review an application submitted with their own Auth email.

## Local changes and security

Migration `008_provider_application_review.sql` extends the existing application table with final status, reviewer, timestamp, private decision note and verification evidence. Existing pending rows are preserved. The partial organization/email unique index continues to suppress duplicate pending applications; a new application can be submitted after a previous one is reviewed. Existing Phase 2 email throttling remains in place.

The migration preserves the existing administrator-only SELECT RLS policy and removes direct application mutation privileges from browser roles. The review RPC rechecks administrator membership, locks the application row, accepts only pending-to-final transitions, and requires evidence for approvals. Its trigger assigns reviewer/time from the trusted session and atomically creates a minimal audit record. Existing reviewed records and applicant-supplied fields cannot be edited through this workflow. SQL functions use a restricted search path and explicit schema names; the trigger helper is not callable by clients. No service-role key is used. The API uses the administrator's existing Supabase session, bounds input and pagination, verifies request origin and sanitizes storage errors.

The API routes are `GET /api/admin/provider-applications?status=all&page=1`, `GET /api/admin/provider-applications/[id]` and `POST /api/admin/provider-applications/[id]/review`. Responses are not cached. Anonymous requests receive 401 and signed-in non-administrators receive 403 before application queries. Database RLS and function checks also enforce these restrictions for direct Supabase requests.

## Files changed

| File                                                                 | Purpose                                                                                            |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `supabase/migrations/008_provider_application_review.sql` (new)      | Review fields, final-state constraints, guarded RPC, immutable decisions and atomic audit logging. |
| `src/app/api/admin/provider-applications/route.ts` (new)             | Administrator queue with status filters and pagination.                                            |
| `src/app/api/admin/provider-applications/[id]/route.ts` (new)        | Private application details.                                                                       |
| `src/app/api/admin/provider-applications/[id]/review/route.ts` (new) | Same-origin administrator decision endpoint.                                                       |
| `src/lib/provider-application-review.ts` (new)                       | Shared strict decision validation and types.                                                       |
| `src/lib/provider-application-review-server.ts` (new)                | Authorized Supabase queries, RPC invocation and safe error mapping.                                |
| `src/components/provider-application-review.tsx` (new)               | Queue, details, evidence form, confirmation dialogs and read-only review history.                  |
| `src/components/dashboard.tsx`                                       | Mount review section inside the administrator dashboard and label its audit events.                |
| `src/lib/i18n.ts`                                                    | English and Spanish review labels and messages.                                                    |
| `src/app/globals.css`                                                | One-line mobile dashboard grid overflow correction.                                                |
| `tests/provider-application-review.test.ts` (new)                    | API authorization, validation, session forwarding and error handling tests.                        |
| `tests/provider-application-review-database.test.ts` (new)           | Actual isolated SQL migrations, RLS, grants, decisions, rollback and audit tests.                  |
| `tests/provider-application-review-ui.test.tsx` (new)                | Confirmation, evidence, self-review, history, errors and Spanish UI tests.                         |
| `e2e/provider-application-review.spec.ts` (new)                      | Desktop/mobile review and accessibility browser tests.                                             |
| `e2e/login-pip.spec.ts`, `e2e/time-map.spec.ts`                      | Repair stale tests to match the existing rendered screens; see verification notes below.           |
| `next.config.ts`, `playwright.config.ts`, `tsconfig.json`            | Isolate browser-test generated files and register their generated type path.                       |
| `docs/PROVIDER_APPLICATION_REVIEW.md` (new)                          | Setup, security rationale, file inventory, test scope and manual staging checklist.                |

## Staging setup: run manually after reviewing migration 008

No staging or production migration is applied by development tests. Local database tests use isolated PGlite, an embedded PostgreSQL runtime. They execute migrations 001–008 with a minimal mock Auth schema. These tests check SQL constraints, grants, RLS, review functions and transaction rollback; they do not replace testing actual Supabase Auth or simultaneous requests from independent PostgreSQL connections. Browser tests mock the review API and do not contact staging.

1. Open PowerShell in the correct checkout:

   ```powershell
   Set-Location 'C:\Users\chenghanli\Downloads\pantryfit-git'
   git branch --show-current
   git diff -- supabase/migrations/008_provider_application_review.sql
   Get-Content supabase/migrations/008_provider_application_review.sql
   ```

   The branch should be `pantryfit-provider-onboarding`. New untracked migration files do not appear in `git diff`, so read the file as shown. Confirm the linked project reference in the local Supabase CLI matches your **staging** project in the Supabase dashboard. Do not print `.env.local` or credentials. Do not relink to production.

2. Review the remote migration history and dry run:

   ```powershell
   npx.cmd supabase migration list --linked
   npx.cmd supabase db push --linked --dry-run
   ```

   Stop if migrations 001–007 are not already applied, if the project reference differs from staging, or if any unexpected migration is proposed. The dry run should propose **only 008**. A CLI dry run previews pending migrations; it does not execute and validate every SQL statement. If the CLI needs authentication, use its normal local interactive setup; never share credentials in chat.

3. Once you have reviewed and approved that exact migration yourself, apply it manually:

   ```powershell
   npx.cmd supabase db push --linked
   npx.cmd supabase migration list --linked
   ```

   Do not use database reset or seed commands. Migration 008 runs in a transaction and preserves pending applications.

4. Restart the development server from this checkout:

   ```powershell
   npm.cmd run dev
   ```

   Open the localhost address printed by this server. Verify `/api/auth/me` identifies your real staging administrator as `role: "admin"`, `demo: false`. A fictional demo login cannot review real applications. If 008 has not been applied, the queue displays an unavailable error instead of an empty queue.

5. Submit a clearly labeled fictional application at `/provider/apply`, then open `/admin`. Check its pending status, private details, filters and confirmation cancellation. Use rejection with a test explanation for an end-to-end staging test that requires no claim of real affiliation. Confirm the decision, reviewer, time and audit entry appear, and that review buttons disappear. Do not approve a real organization until independent verification is complete. Test approval paths with synthetic data in the isolated automated database tests.

6. Sign out and confirm private API routes return 401. With an ordinary staging account, confirm 403 and no review UI. Using two administrator sessions, try to review the same synthetic pending application: one decision should succeed and the other should return 409. Refresh to see the single recorded decision. Confirm provider memberships and existing reviewed listing-edit workflows are unchanged.

7. Switch to Spanish and check the queue and confirmation dialogs. Repeat on a narrow mobile viewport and confirm keyboard navigation, focus containment, and Escape/Cancel behavior. Keep test notes concise and free of unnecessary sensitive information.

## Local verification commands

The browser regression run also identified stale assumptions in `e2e/login-pip.spec.ts` and `e2e/time-map.spec.ts`: the welcome screen lives at `/login`, food search is public, `/find` currently uses the standard questionnaire with a maximum travel time and native time inputs, and the results Map control displays an unavailable-map notice. Those tests now cover these existing behaviors, household-cookie forgery/revocation, mobile layout and accessibility. They no longer claim coverage of a Pip chat or interactive route map that the current screens do not render. Household, questionnaire and map application code was not changed. The current welcome-to-questionnaire full-page navigation also resets the language control; the Spanish browser test switches language on each screen rather than claiming automatic preservation.

The new review browser test checks both mobile and desktop widths, full details, approval evidence controls, Escape cancellation, a final rejection, read-only history, and accessibility. It includes a regression assertion for an existing mobile dashboard grid overflow; the CSS correction lets the column shrink within the screen.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test -- tests/provider-application-review.test.ts tests/provider-application-review-database.test.ts tests/provider-application-review-ui.test.tsx
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e -- e2e/provider-application-review.spec.ts
```

Browser tests require Playwright Chromium, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chrome executable. They start a separate localhost server on port 3102 with Supabase disabled and isolated demo data.

The Playwright server sets `PANTRYFIT_BROWSER_TEST=1` to use `.cache/next-e2e` for its build cache. This keeps the test server's generated files separate from a development server's `.next-dev` directory. Ordinary development and production build directories are unchanged. Stop a previous Playwright run before starting another run on the same test port.
