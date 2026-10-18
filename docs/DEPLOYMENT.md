# Deployment and Supabase setup

## Vercel

1. Push this source to a repository you control.
2. Import the project into Vercel using the Next.js preset and Node.js 22 or 24. Root directory is this `pantryfit` directory. Build: `npm run build`; install: `npm ci`.
3. For a temporary fictional demonstration, leave both Supabase variables unset and explicitly set `PANTRYFIT_ALLOW_DEMO=true`. Production otherwise fails closed with 503 responses. This exposes public demo credentials for fictional data only. Vercel `/tmp` storage is ephemeral and per-instance; demonstrate the complete persistent provider workflow locally or configure Supabase.
4. For persistent use, configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the intended environment. These are public project identifiers/anonymous keys, not privileged keys. Rebuild after changing public variables.
5. Deploy, then run public questionnaire, language, provider authentication, authorization, approval, and mobile smoke tests against the resulting URL. No live deployment was performed in this workspace.
6. Add a verified project feedback contact, review hosting logs/retention, and replace fictional data only after field verification. Reconsider no-index metadata only when public data is ready.

## Supabase

1. Create a Supabase project under the team’s account. Apply all files in `supabase/migrations/` in numeric order through `005_review_remediation.sql`. Existing projects apply only unapplied migrations. Migration 004 clears fictional verification claims; 005 adds revision-checked approvals, duplicate schedule validation, and evidence-backed eligibility classification. Existing pending proposals without base revisions must be compared and explicitly resubmitted before approval. Deploy the matching application update with 005: eligibility verification now requires an explicit classification. Inspect migration results before seeding or testing. See [remediation validation](REMEDIATION.md) for execution limits.
2. Optionally apply `supabase/seed.sql`; it is fictional and must remain labeled demo data.
3. Create a provider Auth user and administrator Auth user through the trusted Supabase dashboard. Do not make organization associations from public sign-up data.
4. As a trusted database operator, bootstrap the administrator:

```sql
insert into public.administrators(user_id) values ('ADMIN_AUTH_USER_UUID');
```

5. After checking organization association, add approved membership:

```sql
insert into public.provider_users(user_id,provider_id,approved,approved_by,approved_at)
values ('PROVIDER_AUTH_USER_UUID','ORGANIZATION_UUID',true,'ADMIN_AUTH_USER_UUID',now());
```

6. Configure the two public environment variables and restart/redeploy. Demo credentials no longer work. The server authenticates against Supabase Auth and uses only the signed-in user's access token for protected reads and writes.
7. Test with an unrelated provider user, a nonmember, an administrator, and the anonymous role. The app never needs a service-role secret. Keep the service-role key away from browser bundles and repository history.
8. Review Auth password/rate-limit/session settings. This prototype uses one-hour access-token cookies and reauthentication, not a refresh-token flow. Password recovery, account invitation, and organization-verification admin UI need implementation before a broad rollout.

## Production gate

HTML uses a fresh script nonce per request. Pages render dynamically and must not be cached as shared HTML; retain Next.js's private/no-store response behavior. Static assets can still be cached. Validate CSP, hydration, client navigation and proxy behavior after deployment. This changes server rendering cost; measure performance and capacity on staging before choosing the pilot limit.

Follow [HANDOFF.md](HANDOFF.md), [OPERATIONS.md](OPERATIONS.md), and `launch-checklist.json`. Run `npm run check`, the dependency audit, browser checks and `npm run readiness:release`. The last command intentionally fails until all seven public-launch blockers have evidence. Workflow configuration does not imply a successful GitHub run; verify hosted CI and branch-protection evidence separately.

Do not advertise this prototype as a live food-assistance directory until verified data, current provider contacts, translated content review, Supabase integration tests, accessibility/user tests, persistent rate limiting, and privacy review are complete. Deployment credentials and account-specific setup are human-owned. No credential values are committed.
