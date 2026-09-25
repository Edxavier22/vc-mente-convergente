-- Pin the academic version at enrollment time so a course update never changes
-- the content or question bank of an in-progress learner.
alter table public.vc_university_enrollments
 add column if not exists course_version text;

update public.vc_university_enrollments e
set course_version = c.version
from public.vc_university_courses c
where c.course_id = e.course_id
 and e.course_version is null;

create or replace function public.vc_university_pin_enrollment_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
 if tg_op = 'UPDATE' and
    (new.course_id, new.course_version) is distinct from (old.course_id, old.course_version) then
  raise exception 'enrollment_course_version_immutable';
 end if;
 if new.course_version is null then
  select c.version into new.course_version
  from public.vc_university_courses c
  join public.vc_university_course_content cc
    on cc.course_id = c.course_id and cc.course_version = c.version
  where c.course_id = new.course_id;
 end if;
 if new.course_version is null then
  raise exception 'course_version_unavailable';
 end if;
 return new;
end
$$;

revoke all on function public.vc_university_pin_enrollment_version()
 from public, anon, authenticated;

drop trigger if exists vc_university_pin_enrollment_version_guard
 on public.vc_university_enrollments;
create trigger vc_university_pin_enrollment_version_guard
 before insert or update of course_id, course_version
 on public.vc_university_enrollments
 for each row execute function public.vc_university_pin_enrollment_version();

alter table public.vc_university_enrollments
 alter column course_version set not null;

alter table public.vc_university_enrollments
 drop constraint if exists vc_university_enrollments_content_version_fkey;
alter table public.vc_university_enrollments
 add constraint vc_university_enrollments_content_version_fkey
 foreign key (course_id, course_version)
 references public.vc_university_course_content(course_id, course_version);

-- The 20 hours are a pedagogical workload, never a page-open timer.
-- Modules account for 19h; final assessment and review account for 1h.
update public.vc_university_modules
set estimated_minutes = case module_no
 when 1 then 105
 when 2 then 120
 when 3 then 105
 when 4 then 105
 when 5 then 105
 when 6 then 105
 when 7 then 105
 when 8 then 105
 when 9 then 105
 when 10 then 180
end
where course_id = 'lideranca-estrategica-aplicada'
 and module_no between 1 and 10;

-- Query-path indexes used by learner, teacher and cohort APIs.
create index if not exists vc_university_enrollments_user_course_status_idx
 on public.vc_university_enrollments(user_id, course_id, status);
create index if not exists vc_university_enrollments_cohort_course_idx
 on public.vc_university_enrollments(cohort_id, course_id);
create index if not exists vc_university_cohorts_course_idx
 on public.vc_university_cohorts(course_id);
create index if not exists vc_university_teachers_user_idx
 on public.vc_university_teachers(user_id);
