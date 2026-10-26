-- Phase 3: review is not account activation or organization membership.
begin;
alter table public.provider_applications
 drop constraint provider_applications_status_check,
 add constraint provider_applications_status_check check(status in ('pending','approved','rejected')),
 add column reviewed_by uuid references auth.users(id),
 add column reviewed_at timestamptz,
 add column review_note text,
 add column verification_source_url text,
 add column verification_method text,
 add column verification_contact text,
 add column verification_contacted_at timestamptz;

alter table public.provider_applications add constraint application_review_consistency check (
 (status='pending' and reviewed_by is null and reviewed_at is null and review_note is null
  and verification_source_url is null and verification_method is null and verification_contact is null and verification_contacted_at is null)
 or
 (status in ('approved','rejected') and reviewed_by is not null and reviewed_at is not null
  and review_note is not null and length(review_note) between 10 and 2000
  -- Include ECMAScript trim characters that POSIX space may omit (NBSP/BOM).
  and review_note=regexp_replace(review_note,U&'^[[:space:]\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+|[[:space:]\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+$','','g')
  and (
   (status='rejected' and verification_source_url is null and verification_method is null and verification_contact is null and verification_contacted_at is null)
   or
   (status='approved' and verification_source_url is not null and length(verification_source_url)<=1000
    and verification_source_url ~ '^https://[^/?#[:space:]@\\]+([/?#][^[:space:]\\]*)?$'
    and verification_method is not null and verification_method in ('phone','email')
    and verification_contact is not null and length(btrim(verification_contact)) between 3 and 254
    and verification_contacted_at is not null and isfinite(verification_contacted_at)
    and verification_contacted_at>=timestamptz '0001-01-01 00:00:00+00' and verification_contacted_at<=reviewed_at
    and ((verification_method='phone' and verification_contact ~ '^[+0-9 ()-]{7,30}$'
       and length(regexp_replace(verification_contact,'[^0-9]','','g')) between 7 and 15)
      or (verification_method='email' and verification_contact ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')))
  ))
);
-- Preserve reviewed history while allowing a genuinely new pending application.
drop index public.provider_application_pending_identity;
create unique index provider_application_pending_identity on public.provider_applications
 (lower(contact_email),lower(regexp_replace(btrim(organization_name),'[[:space:]]+',' ','g'))) where status='pending';
create index provider_application_review_queue on public.provider_applications(reviewed_at desc nulls first,created_at,id);

create function public.guard_provider_application_review() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare reviewer_email text;
begin
 if not public.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if old.status<>'pending' then raise exception 'application_already_reviewed' using errcode='P0001'; end if;
 if new.status not in ('approved','rejected') or new.status is null then
  raise exception 'Invalid review transition' using errcode='22023'; end if;
 if (to_jsonb(new)-array['status','reviewed_by','reviewed_at','review_note','verification_source_url','verification_method','verification_contact','verification_contacted_at'])
  is distinct from (to_jsonb(old)-array['status','reviewed_by','reviewed_at','review_note','verification_source_url','verification_method','verification_contact','verification_contacted_at']) then
  raise exception 'Application contents are immutable' using errcode='22023'; end if;
 select lower(btrim(email)) into reviewer_email from auth.users where id=auth.uid();
 if reviewer_email is null or reviewer_email='' or reviewer_email=lower(btrim(old.contact_email)) then
  raise exception 'self_review_not_allowed' using errcode='42501'; end if;
 new.reviewed_by=auth.uid();
 new.reviewed_at=statement_timestamp();
 -- Keep private contact details and evidence out of the general audit payload.
 insert into public.audit_logs(actor,action,entity_id,after_data)
 values(auth.uid(),'provider_application_'||new.status,new.id,jsonb_build_object('status',new.status));
 return new;
end $$;
revoke all on function public.guard_provider_application_review() from public,anon,authenticated;
create trigger guard_application_review before update on public.provider_applications
 for each row execute function public.guard_provider_application_review();

create function public.review_provider_application(
 application_id uuid, decision text, decision_note text,
 evidence_source_url text default null, evidence_method text default null,
 evidence_contact text default null, evidence_contacted_at timestamptz default null,
 affiliation_confirmed boolean default false
) returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare current_status text; normalized_note text;
begin
 if not public.is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 normalized_note=regexp_replace(decision_note,U&'^[[:space:]\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+|[[:space:]\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+$','','g');
 if decision is null or decision not in ('approved','rejected') or decision_note is null
  or length(normalized_note) not between 10 and 2000 then
  raise exception 'Invalid review details' using errcode='22023'; end if;
 if decision='approved' and affiliation_confirmed is distinct from true then
  raise exception 'Independent affiliation confirmation required' using errcode='22023'; end if;
 if decision='rejected' and (affiliation_confirmed is true or evidence_source_url is not null
  or evidence_method is not null or evidence_contact is not null or evidence_contacted_at is not null) then
  raise exception 'Unexpected rejection evidence' using errcode='22023'; end if;
 select status into current_status from public.provider_applications where id=application_id for update;
 if not found then raise exception 'Application unavailable' using errcode='P0002'; end if;
 if current_status<>'pending' then raise exception 'application_already_reviewed' using errcode='P0001'; end if;
 update public.provider_applications set status=decision,review_note=normalized_note,
  verification_source_url=nullif(btrim(evidence_source_url),''),
  verification_method=evidence_method,verification_contact=nullif(btrim(evidence_contact),''),
  verification_contacted_at=evidence_contacted_at
 where id=application_id;
 -- The trigger assigns trusted reviewer/time and records the audit atomically.
end $$;
revoke all on function public.review_provider_application(uuid,text,text,text,text,text,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.review_provider_application(uuid,text,text,text,text,text,timestamptz,boolean) to authenticated;
-- No direct mutation privilege or new write policy, even for application admins.
revoke insert,update,delete,truncate,references,trigger on public.provider_applications from public,anon,authenticated;
commit;
