# Engineering review and remediation handoff

Review date: October 18, 2026. Scope: current checkout, including matching, React forms, API authentication and authorization, demo persistence, SQL migrations, and existing tests. Application code was not changed. This supplements the existing product handoff in `HANDOFF.md`.

## Recommendation

Fix items 1–2 before onboarding real providers. Address items 3–7 before public launch. No P0 issue was confirmed in this review; passing the existing suite does not cover the failures below. P1 means high-priority workflow or data-integrity failure; P2 means a material correctness or operational defect. Order within each priority reflects recommended implementation order.

## 1. P1 — Older proposals can overwrite newer approved information

**Owner:** Backend/database engineer.

**Evidence:** `supabase/migrations/001_pantryfit.sql:152` locks the request, then lines 157–165 replace all program details and the organization phone. Neither the payload nor review logic checks the version from which the proposal was created. The equivalent demo behavior is in `src/lib/server.ts:294`.

**Reproduction:** Submit A with phone `1111111111`, then B with phone `2222222222`. Approve B, then A. Both succeed; the published phone becomes `1111111111`. Reproduced against all four migrations in PGlite. This also affects hours, offerings, closures, and eligibility. A provider changing one field can inadvertently restore stale values in the other fields. Phone is organization-wide, so different programs can overwrite it too.

**Fix:** Capture a base revision with each proposal. Lock and check the affected program and organization revisions during approval; reject stale proposals with an actionable conflict response. Provide a current-versus-proposed comparison and a resubmission/rebase path. Apply equivalent checks in demo mode. Locking only the request prevents double approval of that request, not conflicting requests.

**Acceptance:** Approving B then A must reject A without changing published data. Add concurrent-approval coverage and a cross-program shared-phone case. Preserve intentionally authorized changes through explicit re-review.

## 2. P1 — Administrators cannot create the first listing through the UI

**Owner:** Frontend engineer.

**Evidence:** `src/components/dashboard.tsx:612` renders `AdminTools` only when `admin && provider`. The creation form lives inside that component (`src/components/admin-tools.tsx:94`). With an empty provider list, there is no selected provider and no creation form.

**Reproduction:** Use a new database with migrations and an administrator account but no seed listings. Open `/admin`. The account loads, but “Add a listing” is unavailable. This is a source-confirmed rendering condition; it was not browser-tested against a live Supabase project.

**Fix:** Render listing creation independently of the selected program. Gate only verification controls on an existing selection. Distinguish an empty directory from a failed directory load.

**Acceptance:** An administrator can create the first listing from an empty directory, select it, and submit its service details. A provider account cannot access the creation controls or API.

## 3. P2 — Duplicate schedules and closures enter the queue but cannot be approved

**Owner:** Backend engineer, with frontend validation support.

**Evidence:** `src/lib/updates.ts:19` accepts duplicate intervals and dates. The SQL proposal validator in migration 003 also accepts them. Database uniqueness constraints at `supabase/migrations/001_pantryfit.sql:33` and `:37` reject the normalized rows during approval.

**Reproduction:** Submit two identical `{day:1,start:800,end:1000}` intervals, or two closures for `2026-10-19`. Submission succeeds; approval raises a unique-constraint error and leaves the request pending. Both cases were reproduced in PGlite. The UI can create these values using repeated “Add window” or “Add closure” clicks. Demo approval accepts them, concealing the production failure.

**Fix:** Reject duplicate intervals and duplicate exception dates in both Zod and SQL before queue insertion, and identify the conflicting row in the form. Decide explicitly whether identical entries should instead be deduplicated; do not silently resolve conflicting closure values. Also validate calendar dates, since the Zod regex accepts dates such as February 30 while PostgreSQL rejects them.

**Acceptance:** Invalid requests fail at submission with useful validation messages. Valid requests approve in both demo and SQL modes. Include direct database submissions so bypassing the Next.js route cannot bypass validation.

## 4. P2 — Eligibility confirmation never updates the eligibility classification

**Owner:** Backend engineer and product/data owner.

**Evidence:** Approval resets eligibility to `unknown` at `supabase/migrations/001_pantryfit.sql:164`. The current verification RPC (`supabase/migrations/004_verification_boundaries.sql:54`) can set freshness but never changes `eligibility_requirements.status`. The verification form/schema has no input for the confirmed classification. `src/lib/matching.ts` treats only `unrestricted` as compatible.

**Reproduction:** Approve a proposal, then verify hours, offerings, and eligibility on a real record. PGlite returns a non-null `verified_at` while eligibility remains `unknown`. Newly created listings start in that same state. The supported admin workflow cannot restore an independently confirmed unrestricted classification; household results continue to say eligibility requires confirmation. This is a separate limitation from the intentionally absent routing integration.

**Fix:** Add an admin-only, evidence-backed eligibility classification to verification. Keep provider submissions unable to assert independent verification. Do not infer unrestricted eligibility from free text or merely checking the eligibility box.

**Acceptance:** Evidence-confirmed unrestricted eligibility produces a compatible evaluation; restricted or unconfirmed eligibility still requires confirmation. A subsequent provider change invalidates the prior classification.

## 5. P2 — Verification evidence disappears from the Supabase dashboard response

**Owner:** Backend/frontend engineer.

**Evidence:** The verification RPC stores notes, method, and fields in `audit_logs.after_data` and `verification_events` (`supabase/migrations/004_verification_boundaries.sql:70`). `src/lib/server.ts:235` maps audit rows without those values or `entity_id`; it uses `change_id`, which is null for verification actions. The dashboard at `src/components/dashboard.tsx:687` can display notes only if `a.notes` is provided. Demo mode supplies notes, so its behavior differs.

**Impact:** After a real verification, an administrator sees a generic action and time without the evidence note or affected program. Evidence is stored, but the application gives reviewers no usable evidence history for that action.

**Fix:** Return a typed audit DTO including the entity, actor, method, fields, and notes, or expose an authorized verification-history endpoint. Display the associated listing and evidence in the dashboard. Handle failed audit queries explicitly rather than presenting an empty history.

**Acceptance:** Record a distinctive evidence note in SQL mode, reload the dashboard, and confirm the note, fields, method, actor, and target listing remain visible to administrators. Verify unauthorized users cannot read that evidence.

## 6. P2 — Midnight-ending operating hours cannot be edited correctly

**Owner:** Frontend engineer.

**Evidence:** The interval contract supports `end:1440` in `src/lib/model.ts`. `src/components/dashboard.tsx:129` formats that value as `24:00`, then binds it to a required HTML time input at line 216. HTML time controls use hours 00–23; `24:00` is not a valid value. Selecting `00:00` instead produces zero, which fails the end-after-start rule.

**Impact:** A valid imported interval ending at midnight cannot be represented by the edit form, and a provider cannot enter one. This undermines the documented instruction to split overnight hours across days. This finding is based on the input contract and code path; browser reproduction was not run.

**Fix:** Add an explicit end-of-day option or separate midnight handling that preserves 1440 in the model and distinguishes it from the start of the same day.

**Acceptance:** Load and submit a 22:00–24:00 interval without changing its meaning; create one from the UI; retain rejection of invalid reversed intervals.

## 7. P2 — Real listing creation accepts a missing source URL until database rejection

**Owner:** Frontend/backend engineer.

**Evidence:** `src/components/admin-tools.tsx` makes `sourceUrl` optional, and `src/lib/listings.ts:26` accepts an empty string. `supabase/migrations/002_admin_tools.sql:6` requires an HTTPS source URL. The form therefore appears valid but returns a generic save error in SQL mode.

**Fix:** Require a source URL in real/Supabase creation mode at both the form and API validation boundaries, with a field-specific error. Preserve an explicit fictional-demo exception if needed; do not infer authentication mode solely from whether currently displayed records are fictional.

**Acceptance:** Missing or non-HTTPS sources are rejected before the SQL RPC with a clear explanation; valid real listings save successfully. Cover a Supabase database that still contains fictional seed records.

## Validation and implementation sequence

- Existing Vitest suite: **55 tests passed across 6 files**.
- TypeScript `--noEmit`: **passed**. ESLint: **passed**.
- Additional isolated PGlite checks reproduced duplicate-approval failures, stale-proposal overwrite, and unchanged eligibility classification after verification. The reproduction script is local at `.cache/review-repro.mjs` (ignored by Git).
- No production build, browser suite, live Supabase integration, deployment check, or fresh dependency vulnerability audit was performed for this review. Existing documentation's audit results were not independently revalidated.

Implement new migrations for deployed SQL changes rather than rewriting applied migrations. Start with versioned approvals and the empty-directory flow, then align proposal validation, eligibility verification, and evidence retrieval. Finish the form boundary fixes and run focused regression tests plus the existing suite and browser workflow against both demo mode and a credential-backed test Supabase project.

Existing documented launch prerequisites remain separate work: verified real listings, routing/geocoding limitations, distributed abuse controls (including direct anonymous feedback RPC access), session lifecycle improvements, live integration testing, accessibility/user review, and deployment. This review does not certify those prerequisites as complete.
