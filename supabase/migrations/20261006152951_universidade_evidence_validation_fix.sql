-- Disambiguate SQL aliases from PL/pgSQL local field variables.
create or replace function public.vc_university_validate_evidence_fields(p_fields jsonb,p_data jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare f jsonb; v jsonb; k text; n numeric;
begin
 if jsonb_typeof(p_data) is distinct from 'object' then return false; end if;
 for f in select value from jsonb_array_elements(p_fields) loop
 k:=f->>'field_key'; v:=p_data->k;
 if v is null or v='null'::jsonb or v='""'::jsonb then
 if coalesce((f->>'required')::boolean,false) then return false; else continue; end if; end if;
 if f->>'type'='number' then
 if jsonb_typeof(v)<>'number' then return false; end if;
 n:=(v#>>'{}')::numeric;
 if n<(f->>'min')::numeric or n>(f->>'max')::numeric or
 (coalesce((f->'validation_rules'->>'integer')::boolean,false) and n<>trunc(n)) then return false; end if;
 elsif f->>'type'='select' then
 if jsonb_typeof(v)<>'string' or not exists(select 1 from jsonb_array_elements(f->'options') o where o->>'value'=v#>>'{}') then return false; end if;
 else
 if jsonb_typeof(v)<>'string' or length(btrim(v#>>'{}'))<coalesce((f->>'min')::integer,0)
 or length(v#>>'{}')>coalesce((f->>'max')::integer,1200) then return false; end if;
 end if;
 end loop;
 if exists(select 1 from jsonb_object_keys(p_data) x where not exists(select 1 from jsonb_array_elements(p_fields) as defined(value) where defined.value->>'field_key'=x)) then return false; end if;
 return true;
end $$;
