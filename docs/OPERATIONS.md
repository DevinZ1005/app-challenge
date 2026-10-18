# PantryFit operations and release runbook

Prepared October 18, 2026. No production service, alert receiver, backup policy or on-call person is configured by this document. Assign actual names and record setup evidence before closing LAUNCH-04/06.

## Environments and health

- Local development: both public Supabase variables unset; fictional data and demo accounts enabled. Temporary files use `os.tmpdir()`; `PANTRYFIT_DEMO_FILE` optionally overrides only the data file.
- Production fictional demo: explicitly set `PANTRYFIT_ALLOW_DEMO=true`. Demo data is ephemeral and isolated per instance. Do not use this mode for a real directory.
- Real staging/production: set both public Supabase variables, apply migrations, provision trusted memberships, and leave demo opt-in false. Production requires HTTPS Supabase URLs. Never supply a service-role key to this app.
- `GET /api/health`: 200 `{status:"ok"}` if public provider data is readable, 503 `{status:"unavailable"}` otherwise; no-store. This checks dependency availability, not record accuracy, nonempty data, backups or privileged Auth workflows. Rate/cache checks at the gateway must keep polling inexpensive.

## Monitoring and ownership

Proposed pilot defaults, to approve and tune in staging: external health check every 5 minutes; alert on two consecutive failures; API 5xx/error spike, elevated p95 latency, database connection/storage pressure and budget alerts. Establish baseline traffic before setting error percentages on a low-volume service. Route actionable alerts to a named primary and backup; test delivery with a controlled failure.

API failures with status 500 or greater emit a JSON console event containing event name, random request ID, status and UTC timestamp, including configuration/dependency 503s. API error responses expose the corresponding request ID for support. Known 4xx errors are not logged by the shared error handler; external health checks detect readiness failure. Existing provider/admin audit records describe publication actions separately. Central log ingestion, browser error reporting, security-event coverage and retention still need a deployment-specific decision. Avoid exception text, request bodies, credentials, emails, cookies, household answers and location in operational logs.

Draft retention decisions for review: operational logs 14 days; resolved feedback 30 days; publication audit retention chosen for provenance needs. These are proposals, not implemented automatic deletion. Decide backup retention, access and deletion propagation before publishing policy promises. Free-text feedback can contain accidental personal data; restrict admin access and create a deletion workflow. Review default host/CDN access logs, including IP addresses, separately.

Support owner reviews reports each working day during pilot. Public support, privacy and security contacts require a real team-controlled address/channel and response expectation; none is invented in the UI. Do not ask users to include sensitive household details in feedback. A contact form without an accountable responder does not close support readiness.

## Backup, restore and rollback rehearsal

1. Platform owner configures backup and, if available/needed for the chosen plan, point-in-time recovery. Inventory protected tables, Auth data, functions/policies and any provider-managed assets. Keep migration source under team version control.
2. Define founder-approved RPO/RTO. Suggested pilot starting point: <=24 hours of data loss and <=4 hours to restore; these are untested objectives, not guarantees.
3. Restore a representative backup into isolated staging. Confirm row counts, public-document view, memberships, proposal/review integrity and audit records. Test all four access roles and one publication flow. Record backup ID/date, restore duration, observed data loss, tester and result; never put secrets in the repository.
4. Retain the prior application deployment. Revert through the deployment provider if a release breaks critical tasks; verify health and household/admin smoke tests afterward.
5. Database migrations must be reviewed for backward compatibility. Do not blindly reverse a migration or overwrite production with an older backup: identify post-backup writes and an approved recovery plan. Prefer a reviewed forward repair where feasible.

## Incident procedure

Primary engineer assesses impact and stops a faulty rollout. For bad food-service information, data lead flags it stale and corrects it through the evidence/review workflow; user safety and accuracy take priority over uptime. For access-control failure, restrict affected writes/access and rotate/revoke relevant credentials/sessions using trusted provider controls. Founder owns user/provider communication and any required policy assessment. Preserve sanitized evidence. Restore service, verify public and privileged tasks, record incident timeline and follow-up owner.

## Release checklist

1. Put the source in a team-controlled repository; configure protected default-branch checks. Workflow files are present, but no repository/branch protection is claimed in this workspace.
2. Run `npm run check`, dependency audit and browser tests on the exact release candidate. Confirm CI actually ran; workflow existence is not execution evidence.
3. Complete real staging role/session tests, manual accessibility/bilingual review, real-data verification, restore/rollback rehearsal and performance/cost check.
4. Review all LAUNCH items with named owners. Attach evidence and run `npm run readiness:release`; it deliberately fails while any release blocker remains pending. Record founder go/no-go separately.
5. Deploy through the team-owned provider, verify HTTPS/security headers/cache/cookies, smoke-test core tasks and confirm alerts. Monitor closely during the pilot with a named support owner.
6. Revisit metadata/robots only after real public data is ready. Private dashboard/API access always depends on authentication and RLS, not crawler exclusions.
