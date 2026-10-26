# Field verification

Each program can record separate checks for hours (including schedule exceptions), food offerings, eligibility, phone, and location. The public summary shows when each field was checked, the method, and an optional HTTPS evidence link. Private review notes and reviewer identities are not included in the public document.

## Try the workflow locally

1. Sign in as the demo administrator and select the existing listing. Existing local records are preserved; no reset is needed.
2. In **Data quality review**, choose a method and only the fields supported by evidence you reviewed. Add a public source URL when available and private review notes. Record the review.
3. Open the service detail page to see the field breakdown. Demo checks are explicitly simulated; they never turn a fictional listing into a verified real service.
4. Check another field separately. The earlier field check remains recorded.
5. Approving an operational update clears hours, offerings, and eligibility checks because the current proposal replaces all those values. Phone checks are cleared across the organization. Location evidence is retained unless location information is invalidated. Rejected proposals leave checks intact.
6. Flagging a listing outdated clears its field checks. Shared phone/location invalidations also clear affected checks for related programs in Supabase.

Do not confirm an unknown field merely because a source mentions the organization. Check the actual published values. Coordinates should identify the pickup location; community-center operating hours may differ from pantry distribution hours. Empty exceptions mean no closures recorded, not independently confirmed absence of closures.

## Supabase migration

Apply `006_field_verification.sql` after migrations 001–005 before running this app against Supabase. This adds public field metadata, extends the admin-only RPC, and retains existing private verification events and audit history. No live Supabase migration has been run by this change.

Old aggregate dates are not converted into invented field evidence. Programs without field evidence need new checks before receiving a recent summary. Standalone legacy/imported documents without a `verification` property retain aggregate-date compatibility.

Hours, offerings, and eligibility must all have checks within the existing 30-day window to earn the recent summary. The oldest of those dates governs overall freshness. Phone/location checks alone cannot make a service recently verified. Expired, missing, invalid, and future dates never earn recent status. This policy is shared with the matcher. No check guarantees food availability.

Evidence URLs are optional because phone or in-person evidence may have no public URL. Review notes remain required. A later source change does not rewrite historical checks; recheck the affected field and record its current source.

Listing creation still adds a listing immediately. Draft/publication controls are a separate next step. Demo mode remains a fictional sandbox; use credential-backed Supabase for real data.

## Local validation — October 25, 2026

TypeScript, ESLint, the production build, and all 84 Vitest tests passed on Node 22.23.4. Tests exercise partial checks, oldest-date freshness, source validation, public-note privacy, approval/outdated invalidation, internal RPC permissions, existing demo record compatibility, and admin form submission. All nine browser test cases passed using installed Chrome through `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; the default Playwright-managed browser was unavailable. The browser suite uses an isolated temporary demo store. Supabase migration behavior was exercised in PGlite, not a live Supabase project.

The build now explicitly traces this project directory because automatic workspace-root detection selected a parent lockfile and encountered a Windows readlink error.

The browser runner stalled during server shutdown after reporting all nine cases successful and was interrupted. This is case-level browser evidence, not a clean full-run exit.
