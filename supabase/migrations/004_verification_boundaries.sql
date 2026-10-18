-- Preserve fictional labels and close SQL's three-valued-logic validation gaps.
begin;

create function public.guard_proposal_values() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare offering jsonb; requirement jsonb; field_name text;
begin
 if new.payload->>'programId' is distinct from new.program_id::text then
  raise exception 'Invalid proposal identity';
 end if;
 if jsonb_typeof(new.payload->'offerings') = 'array' then
  for offering in select * from jsonb_array_elements(new.payload->'offerings') loop
   foreach field_name in array array['equipment','diets'] loop
    if jsonb_typeof(offering->field_name) = 'array' then
     for requirement in select * from jsonb_array_elements(offering->field_name) loop
      if jsonb_typeof(requirement) is distinct from 'string' then
       raise exception 'Invalid food requirement';
      end if;
     end loop;
    end if;
   end loop;
  end loop;
 end if;
 return new;
end $$;
create trigger guard_change_values before insert on public.change_requests
 for each row execute function public.guard_proposal_values();
revoke all on function public.guard_proposal_values() from public,anon,authenticated;

create or replace function public.record_verification(
 program uuid, verification_method text, fields text[], verification_notes text
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
 insert into public.verification_events(program_id,verifier_id,method,confirmed_fields,notes)
  values(program,auth.uid(),verification_method,fields,verification_notes);
 insert into public.audit_logs(actor,action,entity_id,after_data)
  values(auth.uid(),case when verification_method='flag_outdated' then 'flag_outdated' else 'verification_recorded' end,
   program,jsonb_build_object('method',verification_method,'fields',fields,'notes',verification_notes));
end $$;

-- Remove impossible claims left by older versions without fabricating evidence.
update public.service_programs s set verified_at=null from public.providers p
 where p.id=s.provider_id and p.demo;
update public.service_locations l set coordinates_verified=false from public.providers p
 where p.id=l.provider_id and p.demo;
update public.providers set phone_verified=false where demo;
commit;
