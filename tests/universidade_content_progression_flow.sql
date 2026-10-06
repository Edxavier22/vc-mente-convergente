-- Fluxo reversível de integração do motor M1 -> M2 com fixture técnica.
begin;

do $$
declare
 v_user_id uuid;
 v_cohort_id uuid;
 v_enrollment_id uuid;
 v_m1 uuid;
 v_m2 uuid;
 v_evidence_requirement uuid;
 v_checkpoint_requirement uuid;
 v_low_attempt uuid;
 v_high_attempt uuid;
 v_result jsonb;
begin
 select id into v_user_id from auth.users
 where email='vcmenteconvergente@gmail.com' and email_confirmed_at is not null;
 if v_user_id is null then raise exception 'homolog_account_missing'; end if;

 insert into public.vc_university_cohorts(course_id,label,status)
 values ('lideranca-estrategica-aplicada','PR2 FLOW TEST','active')
 returning cohort_id into v_cohort_id;
 insert into public.vc_university_enrollments(cohort_id,course_id,user_id)
 values (v_cohort_id,'lideranca-estrategica-aplicada',v_user_id)
 returning enrollment_id into v_enrollment_id;

 select mv.module_version_id into v_m1
 from public.vc_university_module_versions mv
 join public.vc_university_enrollments e
  on e.course_id=mv.course_id and e.course_version=mv.course_version
 where e.enrollment_id=v_enrollment_id and mv.module_no=1;
 select mv.module_version_id into v_m2
 from public.vc_university_module_versions mv
 join public.vc_university_enrollments e
  on e.course_id=mv.course_id and e.course_version=mv.course_version
 where e.enrollment_id=v_enrollment_id and mv.module_no=2;

 select requirement_id into v_evidence_requirement
 from public.vc_university_module_requirements
 where module_version_id=v_m1 and requirement_type='evidence_completed' and status='published';
 select requirement_id into v_checkpoint_requirement
 from public.vc_university_module_requirements
 where module_version_id=v_m1 and requirement_type='checkpoint_passed' and status='published';

 insert into public.vc_university_module_progress
  (enrollment_id,course_id,module_no,module_version_id,status,opened_at,started_at,
   evidence,submitted_at)
 values (v_enrollment_id,'lideranca-estrategica-aplicada',1,v_m1,
  'requirements_pending',now(),now(),'Fixture técnica sem conteúdo pedagógico',now());
 insert into public.vc_university_requirement_progress
  (enrollment_id,requirement_id,status,source_type,source_id,satisfied_at)
 values (v_enrollment_id,v_evidence_requirement,'completed','evidence','fixture',now());

 insert into public.vc_university_checkpoint_attempts
  (enrollment_id,course_id,module_no,score,question_snapshot,answers,feedback)
 values (v_enrollment_id,'lideranca-estrategica-aplicada',1,3,
  '[{"fixture":true}]','[]','[{"review":"fixture"}]')
 returning attempt_id into v_low_attempt;
 if (select passed from public.vc_university_checkpoint_attempts where attempt_id=v_low_attempt) then
  raise exception 'score_below_threshold_passed';
 end if;

 insert into public.vc_university_checkpoint_attempts
  (enrollment_id,course_id,module_no,score,question_snapshot,answers,feedback)
 values (v_enrollment_id,'lideranca-estrategica-aplicada',1,4,
  '[{"fixture":true}]','[]','[{"correct":true}]')
 returning attempt_id into v_high_attempt;
 if not (select passed from public.vc_university_checkpoint_attempts where attempt_id=v_high_attempt) then
  raise exception 'score_at_threshold_failed';
 end if;

 insert into public.vc_university_requirement_progress
  (enrollment_id,requirement_id,status,source_type,source_id,satisfied_at)
 values (v_enrollment_id,v_checkpoint_requirement,'completed','checkpoint_attempt',v_high_attempt::text,now());
 update public.vc_university_module_progress
 set checkpoint_passed_at=now()
 where enrollment_id=v_enrollment_id and module_no=1;

 select public.vc_university_complete_module_if_ready(v_enrollment_id,v_m1) into v_result;
 if not (v_result->>'completed')::boolean then raise exception 'm1_not_completed'; end if;
 if exists (
  select 1 from public.vc_university_module_dependencies d
  where d.module_version_id=v_m2 and d.status='published'
   and not exists (
    select 1 from public.vc_university_module_progress p
    where p.enrollment_id=v_enrollment_id
     and p.module_version_id=d.depends_on_module_version_id and p.completed_at is not null
   )
 ) then raise exception 'm2_not_unlocked'; end if;

 select public.vc_university_complete_module_if_ready(v_enrollment_id,v_m2) into v_result;
 if (v_result->>'completed')::boolean or (v_result->>'pending_requirements')::integer=0 then
  raise exception 'm2_completed_without_requirements';
 end if;
end
$$;

rollback;
