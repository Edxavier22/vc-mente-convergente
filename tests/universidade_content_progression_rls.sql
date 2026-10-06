-- Execute after 20261005141004_universidade_content_progression_engine.sql.
-- Read/write isolation assertions only; no fixture is retained.
begin;

do $$
begin
 if has_table_privilege('anon','public.vc_university_module_requirements','SELECT')
    or has_table_privilege('authenticated','public.vc_university_module_requirements','SELECT')
    or has_table_privilege('authenticated','public.vc_university_requirement_progress','INSERT')
    or has_table_privilege('authenticated','public.vc_university_lesson_progress','UPDATE') then
  raise exception 'browser_progress_privileges_too_broad';
 end if;
 if has_function_privilege('authenticated',
   'public.vc_university_complete_module_if_ready(uuid,uuid)','EXECUTE') then
  raise exception 'browser_must_not_complete_module';
 end if;
 if not has_function_privilege('service_role',
   'public.vc_university_complete_module_if_ready(uuid,uuid)','EXECUTE') then
  raise exception 'server_completion_rpc_missing';
 end if;
 if not exists (
  select 1 from pg_policies
  where schemaname='public' and tablename='vc_university_requirement_progress'
   and policyname='vc_university_requirement_progress_browser_deny'
 ) then raise exception 'requirement_progress_deny_policy_missing'; end if;
 if not exists (
  select 1 from pg_policies
  where schemaname='public' and tablename='vc_university_lesson_progress'
   and policyname='vc_university_lesson_progress_browser_deny'
 ) then raise exception 'lesson_progress_deny_policy_missing'; end if;
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);

do $$
begin
 begin
  perform public.vc_university_complete_module_if_ready(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  );
  raise exception 'student_b_completed_student_a_module';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into public.vc_university_requirement_progress
   (enrollment_id,requirement_id,status,satisfied_at)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','completed',now());
  raise exception 'student_wrote_requirement_progress_directly';
 exception when insufficient_privilege then null;
 end;
end
$$;

reset role;
rollback;
