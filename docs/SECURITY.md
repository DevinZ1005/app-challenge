# Security design and review limits

Update (October 25, 2026): household entry now uses email-code login and Pip’s guided conversation. The local demo is explicitly labeled. [LOGIN_SECURITY_HANDOFF.md](LOGIN_SECURITY_HANDOFF.md) supersedes earlier descriptions of anonymous household entry and lists outstanding production authentication requirements.

The public app sends no household preferences to the backend. Anonymous GET requests return published provider/service data. Geolocation is optional, rounded, held in memory, and never written to the server.

## Authorization boundaries

- Every privileged API request verifies its server-side session. UI role checks only improve navigation.
- Demo credentials authorize fictional records only. HMAC-signed sessions expire in one hour and use HTTP-only, SameSite=Strict cookies (Secure in production). The local signing key is stored with mode 0600 in the OS temporary directory (Windows access also depends on user-directory ACLs); it is never returned to a browser or committed. Production demo mode requires explicit `PANTRYFIT_ALLOW_DEMO=true`; otherwise missing/partial database configuration fails closed.
- When both Supabase variables are configured, demo accounts are disabled. Supabase Auth verifies the user's token. The server queries approved organization membership and administrator status, then makes database calls with that user's JWT, never a service-role credential.
- PostgreSQL policies independently restrict membership, submissions, reads, and direct mutations. Users cannot grant membership, promote themselves, or directly update published tables.
- Providers submit proposed JSON. Zod validates it at the API boundary; a database trigger validates direct database proposals and strips verification flags. Provider submissions cannot confer independent verification.
- Only an administrator can run review RPCs. Approval applies normalized rows transactionally and appends an audit record; duplicate decisions are rejected. Verification records separately capture method, confirmed fields, and notes.
- Public feedback has no read permission. Administrators can review it. No outbound email or messaging is implemented.

## Request handling

Mutations require an Origin whose host matches the request Host, supporting reverse-proxy deployments without trusting a client-chosen organization. Browser cookies are SameSite=Strict. Login, submissions, and feedback have best-effort per-process rate limits. Error responses do not reveal credentials; passwords are never logged. React escapes displayed text; public links are validated at admin entry and opened with `noopener noreferrer`. Security response headers disable framing and unnecessary device permissions.

All JSON mutation routes enforce application/json and a 64 KiB limit on actual streamed bytes. Invalid JSON returns 400, non-JSON 415, oversized data 413. API error responses are no-store and carry a request ID; server failures log only a structured event ID, status and timestamp, never exception messages or request contents. CSP limits origins, embedding, base URLs and form actions. Middleware generates a fresh nonce, overwrites caller-supplied CSP, and gives Next.js the request policy for framework scripts. Script policy uses nonce/strict-dynamic without unsafe-inline; development additionally permits eval/websocket connections. Inline styles remain permitted for current layout styles. HTML renders dynamically with private/no-store behavior. All API paths use no-store cache controls.

The nonce approach follows [Next.js CSP guidance](https://nextjs.org/docs/app/guides/content-security-policy), adapted to this repository's Next.js 15 middleware API. Production-browser tests check unique nonces, rejection of caller-supplied policy, blocked parser-inserted untrusted inline script, hydration and client navigation. strict-dynamic delegates script loading to trusted scripts; it does not protect against compromised trusted application code. Deployment behavior still requires staging checks.

Migration 004 rejects JSON null program IDs and null food-requirement array members on direct proposals. It prevents fictional Supabase seed records from gaining real-world freshness, phone or coordinate verification and clears earlier impossible flags. Offering verification can still illustrate matching in fictional fixtures. Real-record evidence and stale flags remain separate administrator actions with audit records.

## Tested here

- Browser/API rejection of anonymous writes, unrelated-organization writes, and nonadministrator approvals.
- UI submission, approval publication, duplicate-review rejection.
- Embedded PostgreSQL execution of migrations, public RLS reads, direct-write denial, membership/promotion denial, malicious verification removal, audit records, and direct malformed payload rejection.

## Before production

Real Supabase Auth/network/session behavior and deployment-specific proxy/cookie/CSP configuration require credential-backed tests. Replace local/file storage with configured Supabase for persistent use. Add distributed rate limiting at the gateway, session refresh/revocation and account recovery/invitation flows, organization association review, provider field translations with provenance, log-retention review and backup/restore testing. Anonymous feedback RPC access still needs abuse controls at the database/API gateway; the Next.js limiter does not govern direct RPC requests. Logout currently deletes the browser cookie; it does not revoke a previously copied token. Do not collect sensitive household data through free-text fields.

No claim is made that automated tests establish a complete security audit or production readiness.

## Dependency review

The production dependency audit identified an inherited vulnerable PostCSS version in Next.js. The repository overrides PostCSS to patched version 8.5.30; the subsequent production audit reported zero vulnerabilities. Keep the lockfile and re-run audits when updating dependencies. This is a point-in-time package check, not a complete security guarantee.

The October 18 follow-up full audit initially reported eight development-tool findings. Upgrading Vitest from 3.2.7 to 4.1.11 removed its two critical and one moderate dependency findings; the tests pass with the Vite 8 JSX configuration. The locked toolchain requires Node >=22.12 (and <25, per project policy).

Five high development-only findings remain in the braces/micromatch/fast-glob/Next ESLint chain. The [underlying braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched version. The registry proposes a Next ESLint downgrade; no automatic force fix was applied. Engineering and a security reviewer own SEC-06: assess actual development/CI exposure and adopt a patched compatible chain or reviewed replacement, then rerun the full audit and checks. The clean production audit does not cover these findings. Local commands used `vitest run`, not a public Vitest development server.
