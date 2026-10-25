# Development status — 2026-10-18

Update (October 25, 2026): household entry now uses email-code login and Pip’s guided conversation. The local demo is explicitly labeled. [LOGIN_SECURITY_HANDOFF.md](LOGIN_SECURITY_HANDOFF.md) supersedes earlier descriptions of anonymous household entry and lists outstanding production authentication requirements.

This is a working development prototype. All bundled provider records are fictional; real data verification and production setup remain incomplete.

The October 18 startup-readiness audit, completed code additions, prioritized backlog and source research are in [HANDOFF.md](HANDOFF.md). The engineering follow-up is in [AUDIT.md](AUDIT.md), and current executed results are in [VERIFICATION.md](VERIFICATION.md); the verification table below preserves the October 17 baseline. Use `launch-checklist.json` and `npm run readiness` for the current 29-item handoff. Seven manual public-launch gates remain open. SEC-05 is implemented locally; hosted CI (OPS-01) and development lint advisories (SEC-06) remain pending.

## Completed

- Responsive public pages and shared navigation for every requested route.
- English/Spanish dictionaries, language switching without losing questionnaire answers.
- Six-step anonymous preference form, optional custom pickup intervals, explicit geolocation permission, editable preferences.
- Deterministic, independently testable reference matcher with three-valued rules, weighted known fit, separate confidence, hard constraints, joint food compatibility, closures, timezone handling, freshness, stable ranking, and grounded explanations.
- List-based results, service filters/sorting, uncertainty indicators, provider details, and explicit map/routing fallback.
- Fictional data clearly labeled, no fictional directions or unverified phone calls, official NYC food finder link.
- Authenticated local provider/admin demonstration, validated forms, pending requests, review decisions, publication, audit history, new listings, verification notes, outdated flags, and privacy-conscious feedback.
- Supabase Auth adapter, normalized schema, indexed relations, RLS, restricted review/verification functions, direct-database proposal validation, fictional SQL seed.
- JSON validation/import tooling, environment template, setup/deployment documentation, architecture/database diagrams, pseudocode/formula, data research/checklist, three-minute demo/submission drafts.

## Verification

Executed in this workspace using Node.js 24 and Chromium:

| Check                        | Observed result                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| TypeScript strict check      | Passed                                                                                      |
| ESLint                       | Passed without warnings                                                                     |
| Vitest                       | 39 tests passed: 30 matching, 7 PostgreSQL-policy, 1 component, 1 dictionary                |
| Playwright                   | 3 journeys passed, including UI submission and UI approval plus API authorization rejection |
| axe-core                     | No automated A/AA violations across 16 inspected routes/states                              |
| Production dependency audit  | Zero reported vulnerabilities after overriding inherited PostCSS to 8.5.30                  |
| Next.js production build     | Passed                                                                                      |
| JSON fixture import          | 4 fictional records validated successfully                                                  |
| Desktop/mobile visual review | Screenshots inspected; responsive layouts reviewed                                          |

Automated accessibility results do not establish full WCAG conformance. PGlite tests validate actual migration logic with stub Auth roles, not the live Supabase network/auth service. See `TESTING.md` for commands and exact scope.

## Remaining work and constraints

- **Live deployment:** no Vercel account credentials/project or Supabase credentials were configured. A reproducible Next.js build and Vercel instructions are provided; no deployed URL is claimed.
- **Real data:** official sources were researched, but no individual 10468 provider was independently verified or imported. All bundled records remain fictional. Verify a small local dataset before public use.
- **Production onboarding:** organization association and administrator bootstrapping are trusted-operator procedures. Public account registration, invitations, account recovery, and an online access-request/association-review UI remain unimplemented; the provider information page explains manual access. Do not grant ownership based on a claimed name.
- **Routing/map:** live routing, transit predictions, geocoding and MapLibre are not connected. ZIP/landmark inputs do not calculate travel. Routing inputs must match the exact household origin and verified service destination; otherwise the rule remains unknown. The map control explains the list fallback.
- **Provider identity edits:** the app supports listing creation and reviewed operational/contact updates. Editing organization identity/address/source after creation is currently a trusted database maintenance task; no general identity-edit form is implemented.
- **Production security:** add persistent database-backed storage, distributed abuse controls, session refresh/revocation, staging review of the nonce-based CSP, hosting/log-retention review, backups and credential-backed cross-organization testing. Production now fails closed without full configuration or explicit fictional-demo opt-in. Local demo file updates are serialized only within one server process. Apply migration 004 after the existing migrations; fictional records cannot gain real-world verification flags.
- **Eligibility:** restrictions are displayed for confirmation. Sensitive household eligibility facts are not collected or inferred.
- **Verification:** demo evidence actions remain fictional and do not create real verification dates. Supabase field verification is recorded separately from approval; provider-submitted changes clear affected verification confidence.
- **User validation:** bilingual human review, keyboard/screen-reader/zoom tests, older phones/slow connections, consent-based community research, a recorded demo video and factual competition submissions remain to be completed.

No stretch analytics, PWA, external messaging, paid routing were added. Household data is not persisted or exposed to providers.
