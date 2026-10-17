-- Apply the same trust boundary to direct Supabase writes as to Next.js requests.
begin;
create or replace function public.validate_proposal() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; v jsonb:=new.payload; text_item text;
begin
 if not (v ?& array['programId','hours','exceptions','offerings','appointment','eligibility','phone','note']) then raise exception 'Missing proposal fields'; end if;
 if v->>'programId' <> new.program_id::text or jsonb_typeof(v->'note')<>'string' or length(v->>'note') not between 5 and 1000 then raise exception 'Invalid proposal identity or note'; end if;
 if coalesce(v->>'appointment','') not in ('yes','no','unknown') then raise exception 'Invalid appointment'; end if;
 if v->'phone'<>'null'::jsonb and (jsonb_typeof(v->'phone')<>'string' or (v->>'phone'<>'' and v->>'phone' !~ '^[+0-9 ()-]{7,30}$')) then raise exception 'Invalid contact'; end if;
 if v->'eligibility'<>'null'::jsonb and (jsonb_typeof(v->'eligibility')<>'object' or not(v->'eligibility' ?& array['en','es']) or jsonb_typeof(v->'eligibility'->'en')<>'string' or jsonb_typeof(v->'eligibility'->'es')<>'string' or length(v->'eligibility'->>'en') not between 1 and 240 or length(v->'eligibility'->>'es') not between 1 and 240) then raise exception 'Invalid eligibility'; end if;
 if v->'hours' <> 'null'::jsonb then
  if jsonb_typeof(v->'hours')<>'array' or jsonb_array_length(v->'hours')>50 then raise exception 'Invalid hours'; end if;
  for item in select * from jsonb_array_elements(v->'hours') loop
   if not(item ?& array['day','start','end']) or jsonb_typeof(item->'day')<>'number' or jsonb_typeof(item->'start')<>'number' or jsonb_typeof(item->'end')<>'number' or (item->>'day') !~ '^[0-6]$' or (item->>'start') !~ '^[0-9]{1,4}$' or (item->>'end') !~ '^[0-9]{1,4}$' or (item->>'start')::integer not between 0 and 1439 or (item->>'end')::integer not between 1 and 1440 or (item->>'end')::integer <= (item->>'start')::integer then raise exception 'Invalid interval'; end if;
  end loop;
 end if;
 if jsonb_typeof(v->'exceptions')<>'array' or jsonb_array_length(v->'exceptions')>50 then raise exception 'Invalid exceptions'; end if;
 for item in select * from jsonb_array_elements(v->'exceptions') loop
  if not(item ?& array['date','closed']) or jsonb_typeof(item->'closed')<>'boolean' or jsonb_typeof(item->'date')<>'string' or (item->>'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid closure'; end if;
  perform (item->>'date')::date;
 end loop;
 if v->'offerings' <> 'null'::jsonb then
  if jsonb_typeof(v->'offerings')<>'array' or jsonb_array_length(v->'offerings')>30 then raise exception 'Invalid offerings'; end if;
  for item in select * from jsonb_array_elements(v->'offerings') loop
   if not(item ?& array['name','equipment','storage','diets']) or jsonb_typeof(item->'name')<>'object' or not(item->'name' ?& array['en','es']) or jsonb_typeof(item->'name'->'en')<>'string' or jsonb_typeof(item->'name'->'es')<>'string' or length(item->'name'->>'en') not between 1 and 240 or length(item->'name'->>'es') not between 1 and 240 then raise exception 'Invalid food name'; end if;
   if jsonb_typeof(item->'storage')<>'string' or item->>'storage' not in ('shelf','cold','unknown') or jsonb_typeof(item->'equipment')<>'array' or jsonb_array_length(item->'equipment') not between 1 and 4 or jsonb_typeof(item->'diets')<>'array' or jsonb_array_length(item->'diets')>4 then raise exception 'Invalid food requirements'; end if;
   for text_item in select jsonb_array_elements_text(item->'equipment') loop if text_item not in ('none','microwave','stovetop','oven') then raise exception 'Invalid equipment'; end if;end loop;
   for text_item in select jsonb_array_elements_text(item->'diets') loop if text_item not in ('vegetarian','vegan','halal','kosher') then raise exception 'Invalid diet'; end if;end loop;
  end loop;
  new.payload=jsonb_set(new.payload,'{offerings}',coalesce((select jsonb_agg(o || '{"verified":false}'::jsonb) from jsonb_array_elements(v->'offerings') o),'[]'::jsonb));
 end if;
 return new;
end $$;
commit;
