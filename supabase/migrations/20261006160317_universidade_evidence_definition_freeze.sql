-- Publication cannot be undone to mutate an already published definition version.
create or replace function public.vc_university_guard_evidence_definition() returns trigger
language plpgsql security invoker set search_path='' as $$
declare frozen boolean;
begin
 frozen:=old.status in ('published','archived') or exists(select 1 from public.vc_university_evidence_submissions s where s.evidence_definition_version_id=old.evidence_definition_version_id);
 if tg_op='DELETE' then
 if frozen then raise exception 'evidence_definition_version_immutable';end if;return old;
 end if;
 if old.status in ('published','archived') and new.status<>old.status and not(old.status='published' and new.status='archived') then raise exception 'evidence_definition_version_immutable';end if;
 if frozen and (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then raise exception 'evidence_definition_version_immutable';end if;
 return new;
end $$;
create trigger evidence_definition_version_delete_guard before delete on public.vc_university_evidence_definition_versions
 for each row execute function public.vc_university_guard_evidence_definition();
