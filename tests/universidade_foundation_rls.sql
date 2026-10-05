-- Execute after 20261005013102_ie_course_academic_foundation.sql.
-- The transaction is always rolled back and does not retain test data.
begin;

do $$
declare
 owner_id constant uuid := '70aa4d75-bbb9-4839-aad8-670b7654664d';
 v_definition_id constant uuid := '11000000-0000-4000-8000-000000000001';
 v_definition_version_id constant uuid := '22000000-0000-4000-8000-000000000001';
 v_submission_id constant uuid := '33000000-0000-4000-8000-000000000001';
begin
 if has_table_privilege('anon','public.vc_university_evidence_submissions','SELECT') then
  raise exception 'anon_must_not_read_evidence';
 end if;
 if has_table_privilege('authenticated','public.vc_university_preview_sessions','INSERT') then
  raise exception 'browser_must_not_create_preview_sessions';
 end if;
 if has_table_privilege('authenticated','public.vc_university_academic_audit_log','UPDATE') then
  raise exception 'browser_must_not_mutate_audit_log';
 end if;

 insert into public.vc_university_evidence_definitions
  (evidence_definition_id,course_id,module_id,evidence_key)
 select v_definition_id,m.course_id,m.module_id,'foundation-rls-homologation'
 from public.vc_university_modules m
 where m.course_id='lideranca-estrategica-aplicada' and m.module_no=1;

 insert into public.vc_university_evidence_definition_versions
  (evidence_definition_version_id,evidence_definition_id,course_id,course_version,
   revision,title,prompt,validation_mode,rubric_version,status)
 values (v_definition_version_id,v_definition_id,'lideranca-estrategica-aplicada','1.1',
  1,'Teste RLS','Conteúdo temporário de homologação','human_required','test-1','draft');

 insert into public.vc_university_evidence_submissions
  (submission_id,enrollment_id,learner_id,course_id,course_version,
   evidence_definition_version_id,status,current_revision)
 select v_submission_id,e.enrollment_id,owner_id,e.course_id,e.course_version,
  v_definition_version_id,'draft',0
 from public.vc_university_enrollments e
 where e.user_id=owner_id and e.course_id='lideranca-estrategica-aplicada'
 order by e.enrolled_at desc limit 1;

 if not exists (
  select 1 from public.vc_university_evidence_submissions
  where vc_university_evidence_submissions.submission_id=v_submission_id
 ) then raise exception 'rls_fixture_not_created'; end if;
end
$$;

set local role authenticated;

select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $$ begin
 if exists (
  select 1 from public.vc_university_evidence_submissions
  where submission_id='33000000-0000-4000-8000-000000000001'
 ) then raise exception 'student_b_read_student_a_evidence'; end if;
end $$;

-- The same identity has no teacher assignment, so it must still see nothing.
do $$ begin
 if exists (
  select 1 from public.vc_university_evidence_submissions
  where submission_id='33000000-0000-4000-8000-000000000001'
 ) then raise exception 'unassigned_teacher_read_private_evidence'; end if;
end $$;

select set_config('request.jwt.claim.sub','70aa4d75-bbb9-4839-aad8-670b7654664d',true);
do $$ begin
 if (select count(*) from public.vc_university_evidence_submissions
     where submission_id='33000000-0000-4000-8000-000000000001')<>1 then
  raise exception 'student_cannot_read_own_evidence';
 end if;
end $$;

reset role;
rollback;
