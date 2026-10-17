# Security design and review limits

The public app sends no household preferences to the backend. Anonymous GET requests return published provider/service data. Geolocation is optional, rounded, held in memory, and never written to the server.

## Authorization boundaries

- Every privileged API request verifies its server-side session. UI role checks only improve navigation.
- Demo credentials authorize fictional records only. HMAC-signed sessions expire in one hour and use HTTP-only, SameSite=Strict cookies (Secure in production). The local signing key is stored with mode 0600 in `/tmp`; it is never returned to a browser or committed.
- When both Supabase variables are configured, demo accounts are disabled. Supabase Auth verifies the user's token. The server queries approved organization membership and administrator status, then makes database calls with that user's JWT, never a service-role credential.
- PostgreSQL policies independently restrict membership, submissions, reads, and direct mutations. Users cannot grant membership, promote themselves, or directly update published tables.
- Providers submit proposed JSON. Zod validates it at the API boundary; a database trigger validates direct database proposals and strips verification flags. Provider submissions cannot confer independent verification.
- Only an administrator can run review RPCs. Approval applies normalized rows transactionally and appends an audit record; duplicate decisions are rejected. Verification records separately capture method, confirmed fields, and notes.
- Public feedback has no read permission. Administrators can review it. No outbound email or messaging is implemented.

## Request handling

Mutations require an Origin whose host matches the request Host, supporting reverse-proxy deployments without trusting a client-chosen organization. Browser cookies are SameSite=Strict. Login, submissions, and feedback have best-effort per-process rate limits. Error responses do not reveal credentials; passwords are never logged. React escapes displayed text; public links are validated at admin entry and opened with `noopener noreferrer`. Security response headers disable framing and unnecessary device permissions.

## Tested here

- Browser/API rejection of anonymous writes, unrelated-organization writes, and nonadministrator approvals.
- UI submission, approval publication, duplicate-review rejection.
- Embedded PostgreSQL execution of migrations, public RLS reads, direct-write denial, membership/promotion denial, malicious verification removal, audit records, and direct malformed payload rejection.

## Before production

Real Supabase Auth/network/session behavior and deployment-specific proxy/cookie configuration require credential-backed tests. Replace local/file storage with configured Supabase for persistent use. Add distributed rate limiting at the gateway, session refresh/revocation and account recovery/invitation flows, organization association review, provider field translations with provenance, log-retention review, backup/restore testing, and an appropriate CSP. Anonymous feedback RPC access still needs abuse controls at the database/API gateway; the Next.js limiter does not govern direct RPC requests. Do not collect sensitive household data through free-text fields.

No claim is made that automated tests establish a complete security audit or production readiness.

## Dependency review

The production dependency audit identified an inherited vulnerable PostCSS version in Next.js. The repository overrides PostCSS to patched version 8.5.30; the subsequent production audit reported zero vulnerabilities. Keep the lockfile and re-run audits when updating dependencies. This is a point-in-time package check, not a complete security guarantee.
