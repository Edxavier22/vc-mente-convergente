-- Idempotent owner review cohort. This is not a paid enrollment.
do $$
declare
 v_cohort uuid;
 v_owner uuid;
begin
 select cohort_id into v_cohort from public.vc_university_cohorts
 where course_id='lideranca-estrategica-aplicada' and label='Turma de revisão V&C'
 limit 1;
 if v_cohort is null then
  insert into public.vc_university_cohorts(course_id,label,status,capacity)
  values('lideranca-estrategica-aplicada','Turma de revisão V&C','active',10)
  returning cohort_id into v_cohort;
 end if;
 select id into v_owner from auth.users
 where email='vcmenteconvergente@gmail.com' and email_confirmed_at is not null;
 if v_owner is null then raise exception 'owner_not_found'; end if;
 if not exists (
  select 1 from public.vc_entitlements
  where subject_id=v_owner::text and subject_type='person'
   and product_id='P-021' and status='active' and starts_at<=now()
   and (ends_at is null or ends_at>now())
 ) then raise exception 'owner_without_entitlement'; end if;
 insert into public.vc_university_enrollments(cohort_id,course_id,user_id,status)
 values(v_cohort,'lideranca-estrategica-aplicada',v_owner,'active')
 on conflict(cohort_id,user_id) do nothing;
end
$$;
