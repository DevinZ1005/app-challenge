-- Public field evidence contains no reviewer identity or private notes.
begin;
alter table public.service_programs add column verification jsonb not null default '{}'::jsonb;

alter function public.record_verification(uuid,text,text[],text,text) rename to record_verification_aggregate;
revoke all on function public.record_verification_aggregate(uuid,text,text[],text,text) from public,anon,authenticated;
create function public.record_verification(
 program uuid, verification_method text, fields text[], verification_notes text,
 eligibility_classification text default null, evidence_source_url text default null
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare field text; fictional boolean; oldest timestamptz;
begin
 if not public.is_admin() then raise exception 'Administrator required'; end if;
 if evidence_source_url is not null and (length(evidence_source_url)>2000 or evidence_source_url !~ '^https://[^/[:space:]]+') then
  raise exception 'Public evidence URL must use HTTPS'; end if;
 -- Existing implementation validates fields and locks organization before program.
 perform public.record_verification_aggregate(program,verification_method,fields,verification_notes,eligibility_classification);
 select p.demo into fictional from public.service_programs s join public.providers p on p.id=s.provider_id where s.id=program;
 if verification_method='flag_outdated' then
  update public.service_programs set verification='{}'::jsonb where id=program;
 else
  foreach field in array fields loop
   update public.service_programs set verification=verification || jsonb_build_object(field,
    jsonb_build_object('checkedAt',now(),'method',verification_method,'sourceUrl',evidence_source_url)) where id=program;
  end loop;
 end if;
 -- Separate checks may complete the core set. The oldest check governs freshness.
 select least((verification->'hours'->>'checkedAt')::timestamptz,
  (verification->'offerings'->>'checkedAt')::timestamptz,
  (verification->'eligibility'->>'checkedAt')::timestamptz) into oldest
 from public.service_programs where id=program and verification ?& array['hours','offerings','eligibility'];
 update public.service_programs set verified_at=case when fictional then null else oldest end where id=program;
 insert into public.audit_logs(actor,action,entity_id,after_data)
 values(auth.uid(),'field_evidence_recorded',program,jsonb_build_object('method',verification_method,'fields',fields,'sourceUrl',evidence_source_url));
end $$;
revoke all on function public.record_verification(uuid,text,text[],text,text,text) from public,anon;
grant execute on function public.record_verification(uuid,text,text[],text,text,text) to authenticated;

-- Phone and location are shared: invalidation must reach every related program.
create function public.invalidate_shared_field_evidence() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_table_name='providers' then
  if new.phone is distinct from old.phone or not new.phone_verified then
   update public.service_programs set verification=verification-'phone' where provider_id=new.id and verification ? 'phone';
  end if;
 else
  if new.latitude is distinct from old.latitude or new.longitude is distinct from old.longitude or new.address is distinct from old.address or not new.coordinates_verified then
   update public.service_programs set verification=verification-'coordinates' where location_id=new.id and verification ? 'coordinates';
  end if;
 end if;
 return new;
end $$;
create trigger invalidate_phone_evidence after update on public.providers for each row execute function public.invalidate_shared_field_evidence();
create trigger invalidate_location_evidence after update on public.service_locations for each row execute function public.invalidate_shared_field_evidence();
revoke all on function public.invalidate_shared_field_evidence() from public,anon,authenticated;

alter function public.review_change(uuid,text,text) rename to review_change_aggregate;
revoke all on function public.review_change_aggregate(uuid,text,text) from public,anon,authenticated;
create function public.review_change(request_id uuid,decision text,review_reason text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.review_change_aggregate(request_id,decision,review_reason);
 if decision='approved' then
  update public.service_programs set verification=verification-array['hours','offerings','eligibility']
   where id=(select program_id from public.change_requests where id=request_id);
 end if;
end $$;
revoke all on function public.review_change(uuid,text,text) from public,anon;
grant execute on function public.review_change(uuid,text,text) to authenticated;

create or replace view public.public_provider_documents with (security_invoker=true) as
select jsonb_build_object(
 'id',s.id,'organizationId',p.id,'revision',s.revision,'organizationRevision',p.revision,'name',p.name,'description',p.description,'address',l.address,
 'coordinates',jsonb_build_object('lat',l.latitude,'lng',l.longitude),'coordinatesVerified',l.coordinates_verified,
 'phone',p.phone,'phoneVerified',p.phone_verified,'demo',p.demo,'verifiedAt',s.verified_at,'updatedAt',s.updated_at,'accessibility',l.accessibility,
 'verification',s.verification,
 'source',jsonb_build_object('url',d.url,'name',d.name,'collectedAt',d.collected_at),
 'program',jsonb_build_object('type',s.service_type,
 'hours',case when s.hours_known then coalesce((select jsonb_agg(jsonb_build_object('day',h.day,'start',h.start_minute,'end',h.end_minute) order by h.day,h.start_minute) from public.operating_hours h where h.program_id=s.id),'[]'::jsonb) else null end,
 'exceptions',coalesce((select jsonb_agg(jsonb_build_object('date',x.local_date,'closed',x.closed)) from public.schedule_exceptions x where x.program_id=s.id),'[]'::jsonb),
 'offerings',case when s.offerings_known then coalesce((select jsonb_agg(jsonb_build_object('name',f.name,'equipment',f.equipment,'storage',f.storage,'diets',f.diets,'verified',f.verified)) from public.food_offerings f where f.program_id=s.id),'[]'::jsonb) else null end,
 'appointment',s.appointment,'eligibility',e.details,'eligibilityStatus',coalesce(e.status,'unknown'))
) as document from public.providers p join public.service_programs s on s.provider_id=p.id join public.service_locations l on l.id=s.location_id join public.data_sources d on d.provider_id=p.id left join public.eligibility_requirements e on e.program_id=s.id where p.published;
commit;
