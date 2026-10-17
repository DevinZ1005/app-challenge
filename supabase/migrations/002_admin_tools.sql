begin;
create function public.create_listing(listing jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid; loc uuid; program uuid;
begin
 if not public.is_admin() then raise exception 'Administrator required'; end if;
 if length(coalesce(listing->>'sourceUrl',''))<9 or listing->>'sourceUrl' !~ '^https://' then raise exception 'Source URL required'; end if;
 if not (listing->'name' ?& array['en','es']) or not (listing->'address' ?& array['en','es']) then raise exception 'Bilingual identity required'; end if;
 insert into public.providers(name,description,published) values(listing->'name',listing->'description',true) returning id into org;
 insert into public.data_sources(provider_id,name,url,collected_at) values(org,listing->'sourceName',listing->>'sourceUrl',(listing->>'collectedAt')::timestamptz);
 insert into public.service_locations(provider_id,address,postal_code,city,latitude,longitude) values(org,listing->'address',listing->>'zip','New York',(listing->>'lat')::float8,(listing->>'lng')::float8) returning id into loc;
 insert into public.service_programs(provider_id,location_id,service_type) values(org,loc,listing->>'type') returning id into program;
 insert into public.eligibility_requirements(program_id,status) values(program,'unknown');
 insert into public.audit_logs(actor,action,entity_id,after_data) values(auth.uid(),'listing_created',program,listing);
 return program;
end $$;
create function public.record_verification(program uuid,verification_method text,fields text[],verification_notes text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid; loc uuid;
begin
 if not public.is_admin() then raise exception 'Administrator required'; end if;
 if verification_method not in ('phone','official_source','in_person','flag_outdated') or length(verification_notes) not between 10 and 1000 or not fields <@ array['hours','offerings','eligibility','coordinates','phone'] then raise exception 'Invalid evidence'; end if;
 select provider_id,location_id into org,loc from public.service_programs where id=program for update;
 if not found then raise exception 'Program not found'; end if;
 if verification_method='flag_outdated' then
  update public.service_programs set verified_at=null where id=program;
  update public.food_offerings set verified=false where program_id=program;
  update public.service_locations set coordinates_verified=false where id=loc;
  update public.providers set phone_verified=false where id=org;
 else
  if cardinality(fields)=0 then raise exception 'Select confirmed fields'; end if;
  if 'hours'=any(fields) and 'offerings'=any(fields) and 'eligibility'=any(fields) then update public.service_programs set verified_at=now() where id=program; end if;
  if 'offerings'=any(fields) then update public.food_offerings set verified=true where program_id=program; end if;
  if 'phone'=any(fields) then update public.providers set phone_verified=true where id=org; end if;
  if 'coordinates'=any(fields) then update public.service_locations set coordinates_verified=true where id=loc; end if;
 end if;
 insert into public.verification_events(program_id,verifier_id,method,confirmed_fields,notes) values(program,auth.uid(),verification_method,fields,verification_notes);
 insert into public.audit_logs(actor,action,entity_id,after_data) values(auth.uid(),case when verification_method='flag_outdated' then 'flag_outdated' else 'verification_recorded' end,program,jsonb_build_object('method',verification_method,'fields',fields,'notes',verification_notes));
end $$;
create function public.submit_feedback(feedback_message text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if length(feedback_message) not between 5 and 1000 then raise exception 'Invalid feedback'; end if;
 insert into public.feedback(message) values(feedback_message);
end $$;
revoke all on function public.create_listing(jsonb) from public,anon;
revoke all on function public.record_verification(uuid,text,text[],text) from public,anon;
revoke all on function public.submit_feedback(text) from public;
grant execute on function public.create_listing(jsonb),public.record_verification(uuid,text,text[],text) to authenticated;
-- Anonymous reports are intentionally allowed, with no read access. Add gateway-level
-- rate limiting before a public launch; per-process Next limits are only a demo guard.
grant execute on function public.submit_feedback(text) to anon,authenticated;
commit;
