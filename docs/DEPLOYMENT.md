# Deployment and Supabase setup

## Vercel

1. Push this source to a repository you control. Preserve `AI_USAGE.md` and the student contribution record.
2. Import the project into Vercel using the Next.js preset and Node.js 22 or 24. Root directory is this `pantryfit` directory. Build: `npm run build`; install: `npm ci`.
3. For a temporary demonstration, leave both Supabase variables unset. This exposes public demo credentials for fictional data only. Vercel `/tmp` storage is ephemeral and per-instance; demonstrate the complete persistent provider workflow locally or configure Supabase.
4. For persistent use, configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the intended environment. These are public project identifiers/anonymous keys, not privileged keys. Rebuild after changing public variables.
5. Deploy, then run public questionnaire, language, provider authentication, authorization, approval, and mobile smoke tests against the resulting URL. No live deployment was performed in this workspace.
6. Add a verified project feedback contact, review hosting logs/retention, and replace fictional data only after field verification. Reconsider no-index metadata only when public data is ready.

## Supabase

1. Create a Supabase project under the team’s account. Apply `001_pantryfit.sql`, then `002_admin_tools.sql` and `003_validate_proposals.sql` from `supabase/migrations/` using Supabase migrations or its SQL editor. Use a fresh project and inspect migration results.
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

Do not advertise this prototype as a live food-assistance directory until verified data, current provider contacts, translated content review, Supabase integration tests, accessibility/user tests, persistent rate limiting, and privacy review are complete. Deployment credentials and account-specific setup are human-owned. No credential values are committed.

The installed Sites instructions were read. Their required local setup/source/publishing scripts were not mounted or readable here, so Sites publication could not be completed through its supported workflow. Vercel deployment is prepared instead; no fake deployment URL is supplied.

The [Sites skill](skill://plugin_connector_1p_689987207de08191979cf68eca2941c6/sites/SKILL.md) states: “For hosted work, package with the source helper using remaining checks/builds as ordered argument arrays and an absolute `archivePath`.” That helper was not available locally or readable from the skill package, preventing the supported Sites publishing workflow. This does not prevent running or building the Next.js app locally.
