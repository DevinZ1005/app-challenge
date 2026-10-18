-- Optimistic approvals, submission validation and evidence-backed classification.
begin;
alter table public.providers add column revision integer not null default 0;
alter table public.service_programs add column revision integer not null default 0;
alter table public.change_requests add column base_revision integer;
alter table public.change_requests add column base_organization_revision integer;
-- Existing queued proposals have no trustworthy base: reject approval until resubmitted.
create function public.bump_revision() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin new.revision=old.revision+1; return new; end $$;
create trigger provider_revision before update on public.providers for each row execute function public.bump_revision();
create trigger program_revision before update on public.service_programs for each row execute function public.bump_revision();
revoke all on function public.bump_revision() from public,anon,authenticated;
create or replace view public.public_provider_documents with (security_invoker=true) as
select jsonb_build_object(
 'id',s.id,'organizationId',p.id,'revision',s.revision,'organizationRevision',p.revision,'name',p.name,'description',p.description,'address',l.address,
 'coordinates',jsonb_build_object('lat',l.latitude,'lng',l.longitude),'coordinatesVerified',l.coordinates_verified,
 'phone',p.phone,'phoneVerified',p.phone_verified,'demo',p.demo,'verifiedAt',s.verified_at,'updatedAt',s.updated_at,'accessibility',l.accessibility,
 'source',jsonb_build_object('url',d.url,'name',d.name,'collectedAt',d.collected_at),
 'program',jsonb_build_object('type',s.service_type,
 'hours',case when s.hours_known then coalesce((select jsonb_agg(jsonb_build_object('day',h.day,'start',h.start_minute,'end',h.end_minute) order by h.day,h.start_minute) from public.operating_hours h where h.program_id=s.id),'[]'::jsonb) else null end,
 'exceptions',coalesce((select jsonb_agg(jsonb_build_object('date',x.local_date,'closed',x.closed)) from public.schedule_exceptions x where x.program_id=s.id),'[]'::jsonb),
 'offerings',case when s.offerings_known then coalesce((select jsonb_agg(jsonb_build_object('name',f.name,'equipment',f.equipment,'storage',f.storage,'diets',f.diets,'verified',f.verified)) from public.food_offerings f where f.program_id=s.id),'[]'::jsonb) else null end,
 'appointment',s.appointment,'eligibility',e.details,'eligibilityStatus',coalesce(e.status,'unknown'))
) as document from public.providers p join public.service_programs s on s.provider_id=p.id join public.service_locations l on l.id=s.location_id join public.data_sources d on d.provider_id=p.id left join public.eligibility_requirements e on e.program_id=s.id where p.published;

create function public.check_proposal_revision() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare pr integer; orgrev integer;
begin
 select s.revision,p.revision into pr,orgrev from public.service_programs s join public.providers p on p.id=s.provider_id where s.id=new.program_id;
 if not found then raise exception 'Program not found'; end if;
 -- Direct clients may capture the base at submission; snapshot editors supply their base.
 new.base_revision=coalesce((new.payload->>'baseRevision')::integer,pr);
 new.base_organization_revision=coalesce((new.payload->>'baseOrganizationRevision')::integer,orgrev);
 if new.base_revision<>pr or new.base_organization_revision<>orgrev then
  raise exception 'Listing changed; reload, compare, and resubmit' using errcode='40001';
 end if;
 new.payload=new.payload || jsonb_build_object('baseRevision',pr,'baseOrganizationRevision',orgrev);
 if new.payload->'hours'<>'null'::jsonb and exists(
  select 1 from jsonb_array_elements(new.payload->'hours') h group by h->>'day',h->>'start',h->>'end' having count(*)>1
 ) then raise exception 'Duplicate hours window'; end if;
 if exists(select 1 from jsonb_array_elements(new.payload->'exceptions') e group by e->>'date' having count(*)>1) then
  raise exception 'Duplicate closure date'; end if;
 return new;
end $$;
-- Run after the existing value/shape validators.
create trigger zz_proposal_revision before insert on public.change_requests for each row execute function public.check_proposal_revision();
revoke all on function public.check_proposal_revision() from public,anon,authenticated;
alter function public.review_change(uuid,text,text) rename to review_change_unversioned;
revoke all on function public.review_change_unversioned(uuid,text,text) from public,anon,authenticated;
create function public.review_change(request_id uuid,decision text,review_reason text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.change_requests; org uuid; pr integer; orgrev integer;
begin
 if not public.is_admin() then raise exception 'Administrator required'; end if;
 select * into c from public.change_requests where id=request_id;
 if not found then raise exception 'Request unavailable'; end if;
 select provider_id into org from public.service_programs where id=c.program_id;
 -- Every reviewer locks the shared organization before its program, including verification.
 select revision into orgrev from public.providers where id=org for update;
 select revision into pr from public.service_programs where id=c.program_id for update;
 select * into c from public.change_requests where id=request_id for update;
 if c.status<>'pending' then raise exception 'Request unavailable'; end if;
 if decision='approved' and (c.base_revision is distinct from pr or c.base_organization_revision is distinct from orgrev) then
  raise exception 'Stale proposal; compare current values and explicitly resubmit for review' using errcode='40001';
 end if;
 perform public.review_change_unversioned(request_id,decision,review_reason);
end $$;
revoke all on function public.review_change(uuid,text,text) from public,anon;
grant execute on function public.review_change(uuid,text,text) to authenticated;
drop function public.record_verification(uuid,text,text[],text);
create function public.record_verification(
 program uuid, verification_method text, fields text[], verification_notes text, eligibility_classification text default null
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid; loc uuid; fictional boolean;
begin
 if not public.is_admin() then raise exception 'Administrator required'; end if;
 if verification_method is null or verification_method not in ('phone','official_source','in_person','flag_outdated')
  or verification_notes is null or length(verification_notes) not between 10 and 1000
  or fields is null or array_position(fields,null) is not null
  or cardinality(fields)>5 or not fields <@ array['hours','offerings','eligibility','coordinates','phone'] then
  raise exception 'Invalid evidence';
 end if;
 if verification_method<>'flag_outdated' and 'eligibility'=any(fields) and
  (eligibility_classification is null or eligibility_classification not in ('unrestricted','restricted','unknown')) then
  raise exception 'Choose evidence-confirmed eligibility classification'; end if;
 -- Use the same organization-before-program lock order as approvals.
 select provider_id into org from public.service_programs where id=program;
 perform 1 from public.providers where id=org for update;
 select s.provider_id,s.location_id,p.demo into org,loc,fictional
  from public.service_programs s join public.providers p on p.id=s.provider_id
  where s.id=program for update of s;
 if not found then raise exception 'Program not found'; end if;
 if verification_method='flag_outdated' then
  update public.service_programs set verified_at=null where id=program;
  update public.food_offerings set verified=false where program_id=program;
  update public.service_locations set coordinates_verified=false where id=loc;
  update public.providers set phone_verified=false where id=org;
 else
  if cardinality(fields)=0 then raise exception 'Select confirmed fields'; end if;
  -- Offering flags can illustrate matching in fixtures. Real-world identity,
  -- contact and freshness claims must remain false for fictional services.
  if not fictional then
   if 'hours'=any(fields) and 'offerings'=any(fields) and 'eligibility'=any(fields) then
    update public.service_programs set verified_at=now() where id=program;
   end if;
   if 'phone'=any(fields) then update public.providers set phone_verified=true where id=org; end if;
   if 'coordinates'=any(fields) then update public.service_locations set coordinates_verified=true where id=loc; end if;
  end if;
  if 'offerings'=any(fields) then update public.food_offerings set verified=true where program_id=program; end if;
 end if;
 -- Repair any earlier fictional claims when the record is next reviewed.
 if fictional then
  update public.service_programs set verified_at=null where id=program;
  update public.service_locations set coordinates_verified=false where id=loc;
  update public.providers set phone_verified=false where id=org;
 end if;
 if verification_method='flag_outdated' then
  update public.eligibility_requirements set status='unknown' where program_id=program;
 elsif 'eligibility'=any(fields) then
  insert into public.eligibility_requirements(program_id,status) values(program,eligibility_classification)
   on conflict(program_id) do update set status=excluded.status;
 end if;
 -- Also invalidate snapshots when only offerings or eligibility were checked.
 update public.service_programs set updated_at=now() where id=program;
 insert into public.verification_events(program_id,verifier_id,method,confirmed_fields,notes)
  values(program,auth.uid(),verification_method,fields,verification_notes);
 insert into public.audit_logs(actor,action,entity_id,after_data)
  values(auth.uid(),case when verification_method='flag_outdated' then 'flag_outdated' else 'verification_recorded' end,
   program,jsonb_build_object('method',verification_method,'fields',fields,'notes',verification_notes,'eligibilityStatus',eligibility_classification));
end $$;

revoke all on function public.record_verification(uuid,text,text[],text,text) from public,anon;
grant execute on function public.record_verification(uuid,text,text[],text,text) to authenticated;
commit;
