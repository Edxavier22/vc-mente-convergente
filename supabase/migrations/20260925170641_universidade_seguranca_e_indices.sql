-- Keep the entitlement helper out of the Data API exposed schema. It remains
-- callable only by authenticated RLS policies and returns a single boolean.
create or replace function vc_private.vc_course_has_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
 select exists(
  select 1 from public.vc_entitlements e
  where e.subject_type = 'person'
   and e.subject_id = (select auth.uid())::text
   and e.product_id = 'P-021'
   and e.status = 'active'
   and e.starts_at <= now()
   and (e.ends_at is null or now() < e.ends_at)
 )
$$;

revoke all on function vc_private.vc_course_has_access() from public, anon;
grant usage on schema vc_private to authenticated;
grant execute on function vc_private.vc_course_has_access() to authenticated;

drop policy if exists vc_course_evidence_select on public.vc_course_evidence;
create policy vc_course_evidence_select on public.vc_course_evidence
 for select to authenticated using (
  user_id = (select auth.uid()) and product_id = 'P-021'
  and (select vc_private.vc_course_has_access())
 );
drop policy if exists vc_course_evidence_insert on public.vc_course_evidence;
create policy vc_course_evidence_insert on public.vc_course_evidence
 for insert to authenticated with check (
  user_id = (select auth.uid()) and product_id = 'P-021'
  and (select vc_private.vc_course_has_access())
 );
drop policy if exists vc_course_evidence_update on public.vc_course_evidence;
create policy vc_course_evidence_update on public.vc_course_evidence
 for update to authenticated using (
  user_id = (select auth.uid()) and product_id = 'P-021'
  and (select vc_private.vc_course_has_access())
 ) with check (user_id = (select auth.uid()) and product_id = 'P-021');
drop policy if exists vc_course_attempts_student_read on public.vc_course_assessment_attempts;
create policy vc_course_attempts_student_read on public.vc_course_assessment_attempts
 for select to authenticated using (
  user_id = (select auth.uid()) and product_id = 'P-021'
  and (select vc_private.vc_course_has_access())
 );
drop policy if exists vc_course_reviews_student_read on public.vc_course_reviews;
create policy vc_course_reviews_student_read on public.vc_course_reviews
 for select to authenticated using (
  user_id = (select auth.uid()) and product_id = 'P-021'
  and (select vc_private.vc_course_has_access())
 );

drop function if exists public.vc_course_has_access();

-- Cover the remaining academic foreign-key and queue access paths.
create index if not exists vc_university_enrollments_course_version_idx
 on public.vc_university_enrollments(course_id, course_version);
create index if not exists vc_university_checkpoint_attempts_course_module_idx
 on public.vc_university_checkpoint_attempts(course_id, module_no);
create index if not exists vc_university_checkpoint_attempts_enrollment_course_idx
 on public.vc_university_checkpoint_attempts(enrollment_id, course_id);
create index if not exists vc_university_cohorts_organization_idx
 on public.vc_university_cohorts(organization_id);
create index if not exists vc_university_events_actor_idx
 on public.vc_university_events(actor_id);
create index if not exists vc_university_module_progress_course_module_idx
 on public.vc_university_module_progress(course_id, module_no);
create index if not exists vc_university_module_progress_enrollment_course_idx
 on public.vc_university_module_progress(enrollment_id, course_id);
create index if not exists vc_university_module_progress_reviewer_idx
 on public.vc_university_module_progress(reviewer_id);
create index if not exists vc_university_questions_course_module_idx
 on public.vc_university_questions(course_id, module_no);
