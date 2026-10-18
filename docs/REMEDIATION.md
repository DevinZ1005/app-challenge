# Engineering remediation — October 18, 2026

All seven findings in [the engineering review](CODE_REVIEW_HANDOFF.md) have implementation fixes and regression coverage. The review remains the historical record; this file records the resulting changes.

1. Proposals carry program and organization base revisions. Approval locks the shared organization, then the program and request, checks both revisions, and rejects stale approval transactionally with HTTP 409. Verification also invalidates affected snapshots. The dashboard shows current and proposed values and offers explicit resubmission for a new review. Existing unversioned pending requests cannot be approved. Direct SQL submissions capture current revisions when no snapshot base is supplied; supplied stale bases fail. Demo mode applies equivalent conflict checks, including shared organization phones.
2. Administrators can create a listing without a selected program. Verification requires a selected program. Empty directories and failed directory loads have separate messages; provider accounts retain no listing-creation access.
3. Zod and direct SQL inserts reject duplicate windows, repeated closure dates (including conflicting closure values), and impossible calendar dates. The form reports offending rows. Valid windows ending at 1440 remain supported.
4. Administrator verification requires an explicit evidence-confirmed eligibility classification when confirming eligibility. Notes and method remain mandatory. Unrestricted classification produces a compatible eligibility evaluation; restricted and unknown require confirmation. Provider publication resets classification to unknown, and outdated flags clear it.
5. SQL audit responses include target entity, actor, method, fields, and notes. The dashboard displays them and reports failed history loads. Existing RLS keeps administrator verification evidence unavailable to providers and anonymous readers.
6. Operating hours have a separate end-of-day checkbox. The time input never receives invalid 24:00; loading, creating, publishing, and reloading midnight-ending hours preserve 1440.
7. Real listing creation requires an HTTPS source at the form and API boundaries. Authentication mode comes from the authenticated account response, including when the directory contains fictional seed records. Only explicit demo mode permits an empty source.

## Validation performed

- 72 Vitest tests across 10 files passed, including all five SQL migrations in PGlite, direct database writes, competing approvals, cross-program phones, explicit resubmission, eligibility matching/invalidation, evidence authorization, demo persistence, Supabase response mapping, and form regressions.
- TypeScript and ESLint passed.
- Production build and production smoke checks passed: unconfigured fail-closed behavior, explicit fictional demo, CSP nonces, injection blocking, hydration, and client navigation.
- All 9 Playwright browser scenarios passed across the existing suite and focused reruns. New tests exercise first-listing creation in an empty directory, midnight publication/reload, stale rejection, and explicit resubmission. Existing browser scenarios include automated accessibility checks. Initial new-test failures were corrected synchronization and label selectors.
- Readiness evidence validation passed; the seven documented public-launch blockers remain pending.

No credential-backed Supabase project was configured. PGlite uses stubbed Auth identities and serializes queries; competing-call tests do not establish behavior under independent live PostgreSQL connections. Live migration execution, Supabase Auth/RLS integration, independent-connection concurrency, deployment, and the existing launch prerequisites remain unverified. Apply migration 005 and exercise these workflows in a credential-backed staging project before onboarding real providers. Demo persistence still requires a single server process.

No production database was changed and no public deployment was performed.
