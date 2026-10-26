# Public provider applications (Phase 2)

`/provider/apply` accepts applications without an account. Links appear on provider login and unaffiliated-access pages. An application creates only a private `pending` record, never an Auth user, membership, organization, or public listing. No approval or invitation UI/API is implemented.

## Manual setup

Review and explicitly approve `supabase/migrations/007_provider_applications.sql` before applying it to staging, after migrations 001–006. No migration is applied by the app. Keep your existing project URL and publishable key in `.env.local`; no secret/service-role key is needed. Restart development with `npm.cmd run dev` and open `/provider/apply`. Without real Supabase configuration or the new migration, submissions fail safely; the fictional demo store is never used for application contact details. Do not post real contact data to fictional hosted demos.

The endpoint is `POST /api/provider-applications`. It validates a JSON body no larger than 8 KiB, checks same-origin browser requests, rejects extra privilege/status fields, and includes a noninteractive honeypot. Errors do not echo input or underlying Supabase error text. Responses are no-store. A 202 acknowledgement is identical for new and duplicate submissions and does not return an application ID or account-existence information.

## Database permissions and abuse controls

Applications and rate counters have RLS enabled. `anon` and ordinary authenticated users cannot read applications or directly insert, update, delete, or approve them. Administrators have read-only access through the existing `is_admin()` policy. Status is constrained to `pending`; Phase 3 must add separately reviewed transitions.

The public `submit_provider_application(jsonb)` security-definer function is intentionally executable by `anon` and `authenticated`. It accepts only validated contact/organization fields and always inserts pending. Direct Supabase RPC callers face the same validation and database rate limits, so bypassing the Next.js endpoint does not bypass these controls. The internal counter function and tables are inaccessible to client roles. Ordinary user-scoped listing authorization is unchanged.

The shared limit is 3 admitted submissions per email per 24 hours, including duplicates. There is no global rejection quota: an attacker claiming 100 different email addresses must not block every legitimate applicant. Counters are atomic and expire using database time. Expired counter cleanup runs during submissions. Email hashes are private counter identifiers, not credentials or an anonymity guarantee. Duplicate pending applications are deduplicated by normalized organization name and case-insensitive email; they do not overwrite earlier submissions.

On the fourth submission, the limiter's exception rolls back the attempted increment and the rest of that RPC transaction. Earlier committed counts remain at three, so repeated rejections cannot reset the quota or extend its expiry. The counter measures admitted transactions, not durable counts of all rejected attempts. Explicitly rolling back a transaction also rolls back its application and counter together.

Both security-definer functions use `search_path=pg_catalog,pg_temp`; application tables and helper calls are explicitly schema-qualified. Client roles cannot execute the internal counter function. This prevents attacker-controlled public-schema function overloads from being resolved with the function owner's privileges, even if public-schema creation rights are accidentally granted elsewhere.

These are basic defenses, not comprehensive bot prevention. Claimed emails are unverified: an attacker can rotate addresses or exhaust a particular address's quota. Before broad public release, add trusted gateway/source controls or an accessible bot challenge that also covers direct Supabase RPC calls. Raising a shared global quota does not solve its denial-of-service risk. Do not trust applicant-supplied IP addresses or merely add an app-only limit that direct RPC callers can bypass. Origin checking is a browser protection, not authentication. Supabase's public RPC remains intentionally callable without browser origin headers. There is no account access from knowing an application ID or email.

Treat applicant-provided contacts and website links as unverified claims. Reviewers must independently obtain official organization contacts in Phase 3. Website URLs are not fetched by the backend. Keep application contact details out of logs, analytics, and public views. Establish a retention/deletion owner and policy before public recruitment; automatic application deletion is not implemented in this phase.

## Local verification

Run `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd test`. New tests validate the form and API with mocked storage and run the actual migration against isolated PGlite with stub Auth roles. They do not contact staging or create real accounts. Hosted Supabase validation still requires the manually approved migration and a synthetic test submission.

Executed locally on October 25, 2026: all 147 Vitest tests passed, along with TypeScript, ESLint, and the production build. The new mobile browser test passed using installed Chrome, with no horizontal overflow or automated axe A/AA violations on the application form. Browser submission is mocked; the separate database tests exercise real pending-only insertion and permissions in PGlite. No hosted Supabase migration or submission was performed.

Security follow-up: regression tests reproduced the global-quota outage and public-schema overload interception before corrections. Additional tests verify counter rollback/expiry behavior, explicit transaction rollback, internal function permissions, and authenticated write denial. The migration is suitable for controlled staging validation after review; the source/bot controls above remain required before broad public exposure. Migration 007 is still a local, unapplied migration; migrations 001–006 are unchanged.
