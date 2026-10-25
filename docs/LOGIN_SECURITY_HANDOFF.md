# Login security handoff

Reviewed: October 25, 2026. Applies to PantryFit and can be reused as a starting checklist for other apps.

**Status: local demonstration implemented; real-account launch requires the setup and evidence below.** No login screen can guarantee that nobody will break in. Security depends on the authentication service, server authorization, deployment settings, recovery process, and ongoing maintenance together.

## What this app now does

- `/` and `/login` open the welcome/sign-in screen. A valid household session goes directly to Pip at `/find`.
- `/find`, `/results`, and individual service pages check the session on the server before returning their page. Editing a browser flag or inventing a cookie does not satisfy the check.
- Live household sign-in uses a six-digit email code through Supabase. Requesting a code can create an account; only verification produces a session. Production access is disabled until `PANTRYFIT_EMAIL_LOGIN_ENABLED=true` is configured.
- The code and email are sent to the same-origin server, then to Supabase. They are not stored in browser storage or written to application logs. JSON responses never return bearer tokens.
- The household cookie is HTTP-only, SameSite=Strict, and Secure in production. Production uses a `__Host-` cookie with Path=/ and no Domain. Its lifetime is at most one hour, or the shorter upstream token lifetime. There is no silent refresh; expired sessions must sign in again.
- All household POST endpoints check the origin. Production requires an exact configured HTTPS origin. Code payloads are JSON, strictly validated, and limited to 1 KiB. Code request responses do not reveal account existence; verification failures are generic.
- There are process-local limits: one email request per address per minute, five verification attempts per address per ten minutes, plus global ceilings. Keys hash the email rather than retaining its plain text. This is a secondary defense, **not a distributed production abuse-control system**.
- Household and staff sessions use different cookies. Household login never grants access to the provider/admin API. Published service listings remain intentionally public through `/api/providers`; household preferences are not exposed there.
- Demo entry only exists when no Supabase project is configured and runtime demo policy allows it. It creates an opaque random session backed by a server file, expires after an hour, and grants access to fictional public-service examples only. Demo logout deletes the session record; replaying that cookie fails. Deployment must periodically remove abandoned expired demo files from the OS temporary directory.
- Real logout revokes the current upstream refresh session and expires the browser cookie. Supabase access JWTs can remain valid until their expiry: there is no claim of immediate stolen-token revocation. Set a short JWT lifetime and add shared server-side revocation if the threat model requires immediate invalidation. See [Supabase sign-out behavior](https://supabase.com/docs/reference/javascript/auth-signout).
- Protected pages request private/no-store caching; existing CSP, frame restrictions, and content-type protections remain active. Production adds HSTS. TLS must still be configured at the host.
- Pip uses local, prepared conversation prompts and food tips. It does not send household answers to an AI service, keep chat histories on a server, or claim to be a clinician. Answers clear on reload or full sign-out navigation in that tab. Other open tabs must reload to clear their existing in-memory answers.

## Production setup and release gates

Assign a named owner and record evidence for each gate; code alone is not completion.

| Gate                        | Owner                | Required evidence before real accounts                                                                                                                                                                                                                                                                        |
| --------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth project and email      | App maintainer       | Dedicated production Supabase project, verified SMTP sender, actual email received and code verified on staging. Configure the Magic Link email template to show `{{ .Token }}`; use six digits and a short expiry such as ten minutes. Confirm new-user registration is intended.                            |
| Abuse controls              | Infrastructure owner | Shared/edge limits for sends and guesses across replicas and restarts, keyed by account and trusted source signals; email-sending quotas and alarms; test attacker-triggered account lockouts and service-wide denial of service. Configure provider limits too. Do not trust arbitrary forwarded-IP headers. |
| Strong staff authentication | Security owner       | Enforced MFA or passkeys for provider/admin actions, enrollment and recovery reviewed, step-up verification for sensitive changes. Existing staff password flow does **not** enforce MFA in this code. Household email codes are a single factor dependent on mailbox security.                               |
| Sessions and recovery       | Auth owner           | Expiry, logout, replay, lost-email recovery, account disablement, stolen-token response, and session revocation tested against real Supabase. Document the accepted JWT replay window or implement immediate revocation. No bypass through support or fallback routes.                                        |
| Authorization               | Backend owner        | All SQL migrations applied; RLS tested with anonymous, household, provider A, provider B, and admin accounts. User-edited metadata cannot confer staff privileges. Verify restrictions through direct API/database requests.                                                                                  |
| Hosting                     | Infrastructure owner | HTTPS-only deployment, exact `PANTRYFIT_APP_ORIGIN`, correct reverse-proxy Host/Origin behavior, Secure cookie observed in browser, no shared caching of account pages, no demo entry in the real project.                                                                                                    |
| Operations                  | Maintainer           | Secret scanning, dependency/security updates, redacted auth telemetry, alert owner, incident steps, backups/restore exercise, rollback plan, privacy/retention and account-deletion process.                                                                                                                  |

Set the Supabase URL and public anon key on the server as described in `.env.example`. Set `PANTRYFIT_APP_ORIGIN` to the exact production origin, for example `https://pantryfit.example`, with no trailing slash. Keep `PANTRYFIT_ALLOW_DEMO=false` for real accounts. Enable `PANTRYFIT_EMAIL_LOGIN_ENABLED=true` only after these gates pass. A service-role key is not needed for this household flow and must never be shipped to a browser.

The implementation follows the provider's [email OTP flow](https://supabase.com/docs/guides/auth/auth-email-passwordless). SMTP delivery, configured expiry, provider rate limits, and a deployed production session have not been proven by local demo tests.

## Reusable checklist for every app

### Identity and authentication

- [ ] Define who can register, what verification establishes, and which actions need stronger authentication.
- [ ] Use a maintained identity provider or established authentication library. Prefer phishing-resistant passkeys where appropriate; enforce MFA for privileged access.
- [ ] Make failed login and account lookup responses generic, including status and timing behavior.
- [ ] Limit automated attempts and message sends; use layered controls and monitor abuse without allowing attackers to permanently lock out victims.
- [ ] Reauthenticate before changing credentials, recovery contacts, permissions, or other sensitive settings.

Reference: [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).

### If passwords are supported

- [ ] Never store plaintext or reversible passwords. Use the provider's credential storage or a vetted slow password hash with unique salts and maintained work factors.
- [ ] Allow password managers, paste, and long passphrases; screen against breached passwords. Do not invent a custom hash or send passwords into analytics.
- [ ] Keep keys and peppers, if used, separate from the credential database and document rotation.

Reference: [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

### Sessions, cookies, and transport

- [ ] Require HTTPS throughout. Set Secure, HTTP-only, appropriate SameSite, narrow cookie scope, and explicit expiry.
- [ ] Establish a fresh session after authentication; rotate after privilege changes. Validate sessions on the server on every protected request.
- [ ] Keep session IDs out of URLs, logs, analytics, and readable browser storage.
- [ ] Define idle and absolute expiry, logout behavior, multiple-device handling, and a revocation strategy. Test stolen-session replay rather than assuming cookie deletion revokes it.
- [ ] Prevent shared caches from serving one user's authenticated response to another.

Reference: [OWASP session management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

### Authorization and browser attack defenses

- [ ] Deny access by default. Enforce roles, ownership, and tenant boundaries in server APIs and the database.
- [ ] Never trust a hidden button, client-side redirect, claimed role, supplied user ID, or unverified token as authorization.
- [ ] Check each object's access rights even when its ID is hard to guess. Test direct API calls and cross-account access.
- [ ] Protect state changes against CSRF with framework-supported tokens or properly validated origins plus suitable cookie policy. Reject unexpected content types and restrict CORS.
- [ ] Validate input lengths and types, use parameterized database access, escape output, and deploy a restrictive CSP.

References: [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) and [CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

### Recovery and ongoing operation

- [ ] Recovery must not be weaker than sign-in. Use short-lived, unpredictable, single-use recovery tokens, generic responses, and abuse limits.
- [ ] Verify sensitive account changes, notify the account owner, and provide a way to report compromise. Avoid security-question shortcuts.
- [ ] Test expired/reused codes, disabled accounts, interrupted networks, missing provider configuration, and provider downtime.
- [ ] Assign ownership for updates, alerts, credential leaks, access reviews, data deletion, and incident response. Never log codes, passwords, session cookies, or tokens.

Reference: [OWASP account recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Acceptance evidence to attach

Keep unit/API tests, browser journey results, mobile/keyboard checks, and a production-settings review with the release. At minimum prove: forged/expired/revoked sessions fail; cross-origin writes fail; OTPs cannot be reused; brute-force limits survive restarts/replicas; household users cannot enter staff APIs; one provider cannot act on another provider's records; logout and expiry behave as documented. Local tests cover the app boundary; real OTP delivery and provider-side behavior need staging credentials and configuration.

Relevant files: `src/lib/household-auth.ts`, `src/lib/auth-limits.ts`, `src/app/api/household/`, `src/components/welcome-login.tsx`, `src/components/questionnaire.tsx`, `src/components/pip.tsx`, `tests/household-auth.test.ts`, and `e2e/login-pip.spec.ts`.
