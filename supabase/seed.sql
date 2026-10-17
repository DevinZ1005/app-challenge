-- Fictional data ONLY. No real provider records or verification claims.
do $$
declare org uuid; loc uuid; program uuid;
begin
 insert into public.providers(name,description,demo,published) values('{"en":"Demo Garden Table Pantry","es":"Despensa ficticia Mesa del Jardín"}','{"en":"Fictional development service. Do not visit.","es":"Servicio ficticio. No visites esta ubicación."}',true,true) returning id into org;
 insert into public.data_sources(provider_id,name,url,collected_at,attribution) values(org,'{"en":"Fictional development fixture","es":"Datos ficticios de desarrollo"}',null,now(),'AI-assisted fixture; not a real organization');
 insert into public.service_locations(provider_id,address,postal_code,city,latitude,longitude) values(org,'{"en":"Illustrative location, Bronx 10468","es":"Ubicación ilustrativa, Bronx 10468"}','10468','New York',40.873,-73.891) returning id into loc;
 insert into public.service_programs(provider_id,location_id,service_type,hours_known,offerings_known) values(org,loc,'pantry',true,true) returning id into program;
 insert into public.operating_hours(program_id,day,start_minute,end_minute) values(program,1,780,1020),(program,5,540,720);
 insert into public.food_offerings(program_id,name,equipment,storage,diets,verified) values(program,'{"en":"Demo shelf-stable groceries","es":"Alimentos ficticios sin refrigeración"}',array['none'],'shelf',array['vegetarian'],false);
 insert into public.eligibility_requirements(program_id,status) values(program,'unknown');
end $$;
-- Create Auth users in Supabase dashboard. A trusted operator adds administrators and
-- approved provider associations using the SQL editor. Never permit self-association.
