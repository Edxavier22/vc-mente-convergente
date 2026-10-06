-- Run with BEGIN + base migration + this file + ROLLBACK in vc-core-homolog.
-- Every assertion runs before rollback; no synthetic academic record persists.
begin;
do $$
declare
 owner_id uuid;
 v_cohort_id uuid;
 v_enrollment_id uuid;
 v_m1 uuid;
 v_m2 uuid;
 v_m1_evidence uuid;
 v_m1_checkpoint uuid;
 v_m2_evidence uuid;
 v_m2_checkpoint uuid;
begin
 if (select count(*) from public.vc_university_modules
     where course_id='lideranca-estrategica-aplicada')<>10 then
  raise exception 'expected_ten_leadership_modules';
 end if;
 if has_table_privilege('authenticated','public.vc_university_questions','SELECT')
    or has_table_privilege('authenticated','public.vc_university_module_progress','INSERT')
    or has_table_privilege('authenticated','public.vc_university_module_progress','UPDATE')
    or has_table_privilege('anon','public.vc_university_certificates','SELECT') then
  raise exception 'academic_table_privileges_too_broad';
 end if;
 select id into owner_id from auth.users
 where email='vcmenteconvergente@gmail.com' and email_confirmed_at is not null;
 if owner_id is null then raise exception 'homolog_account_missing'; end if;
 insert into public.vc_university_cohorts(course_id,label)
 values('lideranca-estrategica-aplicada','TESTE REVERSÍVEL')
 returning vc_university_cohorts.cohort_id into v_cohort_id;
 insert into public.vc_university_enrollments(cohort_id,course_id,user_id)
 values(v_cohort_id,'lideranca-estrategica-aplicada',owner_id)
 returning vc_university_enrollments.enrollment_id into v_enrollment_id;
 select mv.module_version_id into v_m1 from public.vc_university_module_versions mv
 join public.vc_university_enrollments e on e.course_id=mv.course_id and e.course_version=mv.course_version
 where e.enrollment_id=v_enrollment_id and mv.module_no=1;
 select mv.module_version_id into v_m2 from public.vc_university_module_versions mv
 join public.vc_university_enrollments e on e.course_id=mv.course_id and e.course_version=mv.course_version
 where e.enrollment_id=v_enrollment_id and mv.module_no=2;
 select requirement_id into v_m1_evidence from public.vc_university_module_requirements where module_version_id=v_m1 and requirement_type='evidence_completed' and status='published';
 select requirement_id into v_m1_checkpoint from public.vc_university_module_requirements where module_version_id=v_m1 and requirement_type='checkpoint_passed' and status='published';
 select requirement_id into v_m2_evidence from public.vc_university_module_requirements where module_version_id=v_m2 and requirement_type='evidence_completed' and status='published';
 select requirement_id into v_m2_checkpoint from public.vc_university_module_requirements where module_version_id=v_m2 and requirement_type='checkpoint_passed' and status='published';
 -- A passing checkpoint in M2 alone cannot bypass M1.
 insert into public.vc_university_checkpoint_attempts
 (enrollment_id,course_id,module_no,score)
 values(v_enrollment_id,'lideranca-estrategica-aplicada',2,5);
 insert into public.vc_university_requirement_progress(enrollment_id,requirement_id,status,source_type,source_id,satisfied_at)
 values(v_enrollment_id,v_m2_evidence,'completed','fixture','m2-evidence',now()),
       (v_enrollment_id,v_m2_checkpoint,'completed','fixture','m2-checkpoint',now());
 begin
  insert into public.vc_university_module_progress
  (enrollment_id,course_id,module_no,module_version_id,evidence,submitted_at,checkpoint_passed_at,completed_at)
  values(v_enrollment_id,'lideranca-estrategica-aplicada',2,v_m2,'Evidência completa',now(),now(),now());
  raise exception 'test_failure_m2_was_unlocked';
 exception when raise_exception then
  if sqlerrm<>'module_dependency_pending' then raise; end if;
 end;
 -- A written evidence does not substitute a passing checkpoint.
 insert into public.vc_university_requirement_progress(enrollment_id,requirement_id,status,source_type,source_id,satisfied_at)
 values(v_enrollment_id,v_m1_evidence,'completed','fixture','m1-evidence',now());
 begin
  insert into public.vc_university_module_progress
  (enrollment_id,course_id,module_no,module_version_id,evidence,submitted_at,checkpoint_passed_at,completed_at)
  values(v_enrollment_id,'lideranca-estrategica-aplicada',1,v_m1,'Evidência completa',now(),now(),now());
  raise exception 'test_failure_checkpoint_was_skipped';
 exception when raise_exception then
  if sqlerrm<>'required_module_requirements_pending' then raise; end if;
 end;
 insert into public.vc_university_checkpoint_attempts
 (enrollment_id,course_id,module_no,score)
 values(v_enrollment_id,'lideranca-estrategica-aplicada',1,4);
 insert into public.vc_university_requirement_progress(enrollment_id,requirement_id,status,source_type,source_id,satisfied_at)
 values(v_enrollment_id,v_m1_checkpoint,'completed','fixture','m1-checkpoint',now());
 insert into public.vc_university_module_progress
 (enrollment_id,course_id,module_no,module_version_id,evidence,submitted_at,checkpoint_passed_at,completed_at)
 values(v_enrollment_id,'lideranca-estrategica-aplicada',1,v_m1,'Evidência completa',now(),now(),now());
 insert into public.vc_university_module_progress
 (enrollment_id,course_id,module_no,module_version_id,evidence,submitted_at,checkpoint_passed_at,completed_at)
 values(v_enrollment_id,'lideranca-estrategica-aplicada',2,v_m2,'Evidência completa',now(),now(),now());
 if (select count(*) from public.vc_university_module_progress
     where vc_university_module_progress.enrollment_id=v_enrollment_id and completed_at is not null)<>2 then
  raise exception 'expected_two_completed_modules';
 end if;
end
$$;
rollback;
