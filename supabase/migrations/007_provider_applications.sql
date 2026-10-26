-- Phase 2 only: accepting an application never creates Auth users or membership.
begin;

create table public.provider_applications (
 id uuid primary key default gen_random_uuid(),
 organization_name text not null check(length(btrim(organization_name)) between 2 and 160),
 organization_address text not null check(length(btrim(organization_address)) between 5 and 400),
 contact_name text not null check(length(btrim(contact_name)) between 2 and 120),
 contact_email text not null check(length(contact_email) between 3 and 254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
 contact_phone text check(contact_phone is null or contact_phone ~ '^[+0-9 ()-]{7,30}$'),
 organization_website text check(organization_website is null or (length(organization_website)<=500 and organization_website ~ '^https://[^/[:space:]@]+([/?#][^[:space:]]*)?$')),
 description text not null check(length(btrim(description)) between 20 and 1000),
 status text not null default 'pending' check(status='pending'),
 created_at timestamptz not null default now()
);
create unique index provider_application_pending_identity on public.provider_applications
 (lower(contact_email),lower(regexp_replace(btrim(organization_name),'[[:space:]]+',' ','g')));
create index provider_application_created_idx on public.provider_applications(created_at);

create table public.provider_application_limits (
 bucket text primary key,
 attempts integer not null check(attempts>0),
 expires_at timestamptz not null
);
create index provider_application_limit_expiry_idx on public.provider_application_limits(expires_at);
alter table public.provider_applications enable row level security;
alter table public.provider_application_limits enable row level security;
revoke all on public.provider_applications,public.provider_application_limits from public,anon,authenticated;
grant select on public.provider_applications to authenticated;
create policy applications_admin_read on public.provider_applications for select to authenticated using(public.is_admin());
-- No client INSERT/UPDATE/DELETE policies, including for administrators. Phase 3
-- will introduce separately reviewed decision functions and additional states.

create function public.consume_provider_application_limit(bucket_key text, maximum integer, window_seconds integer)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare count_used integer;
begin
 insert into public.provider_application_limits(bucket,attempts,expires_at)
 values(bucket_key,1,now()+make_interval(secs=>window_seconds))
 on conflict(bucket) do update set
  attempts=case when provider_application_limits.expires_at<=now() then 1 else provider_application_limits.attempts+1 end,
  expires_at=case when provider_application_limits.expires_at<=now() then now()+make_interval(secs=>window_seconds) else provider_application_limits.expires_at end
 returning attempts into count_used;
 -- An over-limit exception rolls back this statement's increment, not earlier
 -- committed calls. The bucket stays at the cap and its expiry is not extended.
 if count_used>maximum then raise exception 'application_rate_limited' using errcode='P0001'; end if;
end $$;
revoke all on function public.consume_provider_application_limit(text,integer,integer) from public,anon,authenticated;

create function public.submit_provider_application(application jsonb) returns void
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare field text; email text; website text; phone text;
begin
 if jsonb_typeof(application) is distinct from 'object' or octet_length(application::text)>8192 then
  raise exception 'Invalid application' using errcode='22023'; end if;
 if application-array['organizationName','organizationAddress','contactName','contactEmail','contactPhone','organizationWebsite','description']<>'{}'::jsonb then
  raise exception 'Unexpected application fields' using errcode='22023'; end if;
 foreach field in array array['organizationName','organizationAddress','contactName','contactEmail','description'] loop
  if jsonb_typeof(application->field) is distinct from 'string' then
   raise exception 'Missing application field' using errcode='22023'; end if;
 end loop;
 foreach field in array array['contactPhone','organizationWebsite'] loop
  if application ? field and jsonb_typeof(application->field) is distinct from 'string' then
   raise exception 'Invalid optional field' using errcode='22023'; end if;
 end loop;
 email=lower(btrim(application->>'contactEmail'));
 phone=nullif(btrim(application->>'contactPhone'),'');
 website=nullif(btrim(application->>'organizationWebsite'),'');
 if length(btrim(application->>'organizationName')) not between 2 and 160
  or length(btrim(application->>'organizationAddress')) not between 5 and 400
  or length(btrim(application->>'contactName')) not between 2 and 120
  or length(btrim(application->>'description')) not between 20 and 1000
  or length(email) not between 3 and 254 or email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  or (phone is not null and phone !~ '^[+0-9 ()-]{7,30}$')
  or (website is not null and (length(website)>500 or website !~ '^https://[^/[:space:]@]+([/?#][^[:space:]]*)?$')) then
  raise exception 'Invalid application fields' using errcode='22023'; end if;

 -- All application tables and helper calls are schema-qualified; public is not
 -- searched, preventing malicious public-schema function overload resolution.
 -- Do not use a global rejection bucket: one caller can rotate claimed emails
 -- and exhaust it for everyone. Source/bot controls belong at a trusted gateway.
 -- This shared per-email limit also governs direct RPC callers. The email hash
 -- is a private counter identifier, not proof of ownership or an anonymity claim.
 perform public.consume_provider_application_limit('email:'||md5(email),3,86400);
 delete from public.provider_application_limits where expires_at<now()-interval '1 day';
 insert into public.provider_applications(organization_name,organization_address,contact_name,contact_email,contact_phone,organization_website,description)
 values(btrim(application->>'organizationName'),btrim(application->>'organizationAddress'),btrim(application->>'contactName'),email,phone,website,btrim(application->>'description'))
 on conflict do nothing;
 -- No identifiers, email-existence results, or application details returned.
end $$;
revoke all on function public.submit_provider_application(jsonb) from public,anon,authenticated;
grant execute on function public.submit_provider_application(jsonb) to anon,authenticated;
commit;
