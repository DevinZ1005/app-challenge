-- PantryFit reference schema. Apply to a new Supabase project; no household data is stored.
begin;
create extension if not exists pgcrypto;
create table public.providers (
 id uuid primary key default gen_random_uuid(), name jsonb not null check (name ?& array['en','es']),
 description jsonb not null, phone text, phone_verified boolean not null default false,
 demo boolean not null default false, published boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.data_sources (
 id uuid primary key default gen_random_uuid(), provider_id uuid not null references public.providers on delete cascade,
 name jsonb not null, url text check (url is null or url ~ '^https://'), collected_at timestamptz not null,
 attribution text, license text, unique(provider_id)
);
create table public.service_locations (
 id uuid primary key default gen_random_uuid(), provider_id uuid not null references public.providers on delete cascade,
 address jsonb not null, postal_code text not null check (postal_code ~ '^\d{5}$'), city text not null,
 latitude double precision not null check(latitude between -90 and 90), longitude double precision not null check(longitude between -180 and 180),
 coordinates_verified boolean not null default false, timezone text not null default 'America/New_York', accessibility jsonb
);
create table public.service_programs (
 id uuid primary key default gen_random_uuid(), provider_id uuid not null references public.providers on delete cascade,
 location_id uuid not null references public.service_locations on delete cascade,
 service_type text not null check(service_type in ('pantry','meals','community')),
 hours_known boolean not null default false, offerings_known boolean not null default false,
 appointment text not null default 'unknown' check(appointment in ('yes','no','unknown')),
 verified_at timestamptz, updated_at timestamptz not null default now()
);
create table public.operating_hours (
 id uuid primary key default gen_random_uuid(), program_id uuid not null references public.service_programs on delete cascade,
 day integer not null check(day between 0 and 6), start_minute integer not null check(start_minute between 0 and 1439),
 end_minute integer not null check(end_minute between 1 and 1440 and end_minute>start_minute),
 unique(program_id,day,start_minute,end_minute)
);
create table public.schedule_exceptions (
 id uuid primary key default gen_random_uuid(), program_id uuid not null references public.service_programs on delete cascade,
 local_date date not null, closed boolean not null default true, unique(program_id,local_date)
);
create table public.food_offerings (
 id uuid primary key default gen_random_uuid(), program_id uuid not null references public.service_programs on delete cascade,
 name jsonb not null, equipment text[] not null check(cardinality(equipment)>0 and equipment <@ array['none','microwave','stovetop','oven']),
 storage text not null default 'unknown' check(storage in ('shelf','cold','unknown')),
 diets text[] not null default '{}' check(diets <@ array['vegetarian','vegan','halal','kosher']), verified boolean not null default false
);
create table public.eligibility_requirements (
 program_id uuid primary key references public.service_programs on delete cascade,
 details jsonb, status text not null default 'unknown' check(status in ('unrestricted','restricted','unknown'))
);
create table public.administrators (user_id uuid primary key references auth.users on delete cascade);
create table public.provider_users (
 user_id uuid not null references auth.users on delete cascade, provider_id uuid not null references public.providers on delete cascade,
 approved boolean not null default false, approved_by uuid references auth.users, approved_at timestamptz,
 primary key(user_id,provider_id), check(not approved or (approved_by is not null and approved_at is not null))
);
create table public.verification_events (
 id uuid primary key default gen_random_uuid(), program_id uuid not null references public.service_programs on delete cascade,
 verifier_id uuid not null references auth.users, verified_at timestamptz not null default now(), method text not null,
 confirmed_fields text[] not null, notes text not null
);
create table public.change_requests (
 id uuid primary key default gen_random_uuid(), program_id uuid not null references public.service_programs on delete cascade,
 submitted_by uuid not null references auth.users, submitted_at timestamptz not null default now(),
 payload jsonb not null check(jsonb_typeof(payload)='object'), status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references auth.users, reviewed_at timestamptz, review_note text
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), actor uuid references auth.users,
 action text not null, change_id uuid references public.change_requests, entity_id uuid,
 created_at timestamptz not null default now(), before_data jsonb, after_data jsonb
);
create table public.feedback (
 id uuid primary key default gen_random_uuid(), provider_id uuid references public.providers on delete cascade,
 message text not null check(char_length(message) between 5 and 1000), created_at timestamptz not null default now(), reviewed boolean not null default false
);
-- Reserved for future aggregates only. No event-level household profiles.
create table public.analytics_events (
 day date not null, metric text not null check(metric in ('searches','walking','limited_refrigeration')),
 count integer not null check(count>=10), primary key(day,metric)
);
create index service_locations_zip_idx on public.service_locations(postal_code);
create index programs_provider_idx on public.service_programs(provider_id);
create index hours_program_idx on public.operating_hours(program_id,day);
create index exceptions_program_idx on public.schedule_exceptions(program_id,local_date);
create index offerings_program_idx on public.food_offerings(program_id);
create index requests_status_idx on public.change_requests(status,submitted_at);
create index requests_author_idx on public.change_requests(submitted_by);
create index membership_provider_idx on public.provider_users(provider_id,user_id);
create index verification_program_idx on public.verification_events(program_id,verified_at desc);
create index audit_entity_idx on public.audit_logs(entity_id,created_at desc);
create index sources_provider_idx on public.data_sources(provider_id);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select exists(select 1 from public.administrators where user_id=auth.uid()) $$;
create or replace function public.can_manage(organization uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select public.is_admin() or exists(select 1 from public.provider_users where user_id=auth.uid() and provider_id=organization and approved) $$;
create or replace function public.is_published(organization uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select exists(select 1 from public.providers where id=organization and published) $$;
create or replace function public.program_public(program uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select exists(select 1 from public.service_programs s join public.providers p on p.id=s.provider_id where s.id=program and p.published) $$;
-- All tables use RLS. No user may directly mutate published records or approve themselves.
do $$ declare t text; begin foreach t in array array['providers','data_sources','service_locations','service_programs','operating_hours','schedule_exceptions','food_offerings','eligibility_requirements','administrators','provider_users','verification_events','change_requests','audit_logs','feedback','analytics_events'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
create policy provider_read on public.providers for select using(published or public.can_manage(id));
create policy source_read on public.data_sources for select using(public.is_published(provider_id) or public.can_manage(provider_id));
create policy location_read on public.service_locations for select using(public.is_published(provider_id) or public.can_manage(provider_id));
create policy program_read on public.service_programs for select using(public.is_published(provider_id) or public.can_manage(provider_id));
create policy hours_read on public.operating_hours for select using(public.program_public(program_id) or public.is_admin());
create policy exception_read on public.schedule_exceptions for select using(public.program_public(program_id) or public.is_admin());
create policy offering_read on public.food_offerings for select using(public.program_public(program_id) or public.is_admin());
create policy eligibility_read on public.eligibility_requirements for select using(public.program_public(program_id) or public.is_admin());
create policy admin_self_read on public.administrators for select to authenticated using(user_id=auth.uid());
create policy membership_read on public.provider_users for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy request_read on public.change_requests for select to authenticated using(submitted_by=auth.uid() or public.is_admin());
create policy request_submit on public.change_requests for insert to authenticated with check(submitted_by=auth.uid() and status='pending' and reviewed_by is null and reviewed_at is null and review_note is null and exists(select 1 from public.service_programs where id=program_id and public.can_manage(provider_id)));
create policy audit_read on public.audit_logs for select to authenticated using(public.is_admin() or actor=auth.uid());
create policy verification_read on public.verification_events for select to authenticated using(public.is_admin());
create policy feedback_admin on public.feedback for select to authenticated using(public.is_admin());
create policy analytics_admin on public.analytics_events for select to authenticated using(public.is_admin());
-- Browser-safe view: security_invoker preserves the underlying policies.
create view public.public_provider_documents with (security_invoker=true) as
select jsonb_build_object(
 'id',s.id,'organizationId',p.id,'name',p.name,'description',p.description,'address',l.address,
 'coordinates',jsonb_build_object('lat',l.latitude,'lng',l.longitude),'coordinatesVerified',l.coordinates_verified,
 'phone',p.phone,'phoneVerified',p.phone_verified,'demo',p.demo,'verifiedAt',s.verified_at,'updatedAt',s.updated_at,'accessibility',l.accessibility,
 'source',jsonb_build_object('url',d.url,'name',d.name,'collectedAt',d.collected_at),
 'program',jsonb_build_object('type',s.service_type,
 'hours',case when s.hours_known then coalesce((select jsonb_agg(jsonb_build_object('day',h.day,'start',h.start_minute,'end',h.end_minute) order by h.day,h.start_minute) from public.operating_hours h where h.program_id=s.id),'[]'::jsonb) else null end,
 'exceptions',coalesce((select jsonb_agg(jsonb_build_object('date',x.local_date,'closed',x.closed)) from public.schedule_exceptions x where x.program_id=s.id),'[]'::jsonb),
 'offerings',case when s.offerings_known then coalesce((select jsonb_agg(jsonb_build_object('name',f.name,'equipment',f.equipment,'storage',f.storage,'diets',f.diets,'verified',f.verified)) from public.food_offerings f where f.program_id=s.id),'[]'::jsonb) else null end,
 'appointment',s.appointment,'eligibility',e.details,'eligibilityStatus',coalesce(e.status,'unknown'))
) as document from public.providers p join public.service_programs s on s.provider_id=p.id join public.service_locations l on l.id=s.location_id join public.data_sources d on d.provider_id=p.id left join public.eligibility_requirements e on e.program_id=s.id where p.published;
-- Validate even direct Supabase writes, not just Next.js requests. Never trust verification flags.
create function public.validate_proposal() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; v jsonb:=new.payload;
begin
 if jsonb_typeof(v) <> 'object' or length(coalesce(v->>'note','')) not between 5 and 1000 then raise exception 'Invalid note'; end if;
 if coalesce(v->>'appointment','') not in ('yes','no','unknown') then raise exception 'Invalid appointment'; end if;
 if v->'hours' <> 'null'::jsonb then
  if jsonb_typeof(v->'hours')<>'array' or jsonb_array_length(v->'hours')>50 then raise exception 'Invalid hours'; end if;
  for item in select * from jsonb_array_elements(v->'hours') loop
   if (item->>'day')::integer not between 0 and 6 or (item->>'start')::integer not between 0 and 1439 or (item->>'end')::integer not between 1 and 1440 or (item->>'end')::integer <= (item->>'start')::integer then raise exception 'Invalid interval'; end if;
  end loop;
 end if;
 if v->'offerings' <> 'null'::jsonb then
  if jsonb_typeof(v->'offerings')<>'array' or jsonb_array_length(v->'offerings')>30 then raise exception 'Invalid offerings'; end if;
  new.payload=jsonb_set(new.payload,'{offerings}',coalesce((select jsonb_agg(o || '{"verified":false}'::jsonb) from jsonb_array_elements(v->'offerings') o),'[]'::jsonb));
 end if;
 return new;
end $$;
create trigger validate_change before insert on public.change_requests for each row execute function public.validate_proposal();
create function public.audit_submission() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin insert into public.audit_logs(actor,action,change_id,entity_id,after_data) values(auth.uid(),'submitted',new.id,new.program_id,new.payload);return new;end $$;
create trigger log_submission after insert on public.change_requests for each row execute function public.audit_submission();
create function public.review_change(request_id uuid,decision text,review_reason text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.change_requests; v jsonb; org uuid; old_data jsonb;
begin
 if not public.is_admin() then raise exception 'Administrator required'; end if;
 if decision not in ('approved','rejected') or length(review_reason) not between 5 and 1000 then raise exception 'Invalid review'; end if;
 select * into c from public.change_requests where id=request_id for update;
 if not found or c.status<>'pending' then raise exception 'Request unavailable'; end if;
 v=c.payload; select provider_id into org from public.service_programs where id=c.program_id;
 select to_jsonb(s) into old_data from public.service_programs s where id=c.program_id;
 if decision='approved' then
  delete from public.operating_hours where program_id=c.program_id;
  insert into public.operating_hours(program_id,day,start_minute,end_minute) select c.program_id,(i->>'day')::int,(i->>'start')::int,(i->>'end')::int from jsonb_array_elements(coalesce(nullif(v->'hours','null'::jsonb),'[]'::jsonb)) i;
  delete from public.schedule_exceptions where program_id=c.program_id;
  insert into public.schedule_exceptions(program_id,local_date,closed) select c.program_id,(i->>'date')::date,(i->>'closed')::boolean from jsonb_array_elements(v->'exceptions') i;
  delete from public.food_offerings where program_id=c.program_id;
  insert into public.food_offerings(program_id,name,equipment,storage,diets,verified) select c.program_id,i->'name',array(select jsonb_array_elements_text(i->'equipment')),i->>'storage',array(select jsonb_array_elements_text(i->'diets')),false from jsonb_array_elements(coalesce(nullif(v->'offerings','null'::jsonb),'[]'::jsonb)) i;
  update public.service_programs set appointment=v->>'appointment',hours_known=v->'hours'<>'null'::jsonb,offerings_known=v->'offerings'<>'null'::jsonb,verified_at=null,updated_at=now() where id=c.program_id;
  insert into public.eligibility_requirements(program_id,details,status) values(c.program_id,nullif(v->'eligibility','null'::jsonb),'unknown') on conflict(program_id) do update set details=excluded.details,status='unknown';
  update public.providers set phone=nullif(v->>'phone',''),phone_verified=false,updated_at=now() where id=org;
 end if;
 update public.change_requests set status=decision,reviewed_by=auth.uid(),reviewed_at=now(),review_note=review_reason where id=request_id;
 insert into public.audit_logs(actor,action,change_id,entity_id,before_data,after_data) values(auth.uid(),decision,request_id,c.program_id,old_data,v);
end $$;
revoke all on function public.review_change(uuid,text,text) from public,anon;
grant execute on function public.review_change(uuid,text,text) to authenticated;
revoke all on function public.validate_proposal() from public,anon,authenticated;
revoke all on function public.audit_submission() from public,anon,authenticated;
-- Default Supabase grants vary. Explicitly restrict all tables; RLS still applies to reads.
revoke all on all tables in schema public from anon,authenticated;
grant select on public.providers,public.data_sources,public.service_locations,public.service_programs,public.operating_hours,public.schedule_exceptions,public.food_offerings,public.eligibility_requirements,public.public_provider_documents to anon,authenticated;
grant select on public.administrators,public.provider_users,public.change_requests,public.audit_logs,public.verification_events,public.feedback,public.analytics_events to authenticated;
grant insert on public.change_requests to authenticated;
commit;
