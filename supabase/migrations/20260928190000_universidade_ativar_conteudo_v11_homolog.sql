-- Ativa a versão pedagógica 1.1 apenas para homologação do curso de Liderança.
-- A troca preserva progresso, tentativas e eventos, que pertencem à matrícula.
-- O trigger de imutabilidade é removido e recriado na mesma transação da migration.
do $$
declare
 module_count integer;
 checkpoint_count integer;
 final_count integer;
begin
 select jsonb_array_length(content->'modules') into module_count
 from public.vc_university_course_content
 where course_id='lideranca-estrategica-aplicada' and course_version='1.1';

 select count(*) into checkpoint_count
 from public.vc_university_questions
 where course_id='lideranca-estrategica-aplicada' and course_version='1.1'
  and purpose='checkpoint' and active=true;

 select count(*) into final_count
 from public.vc_university_questions
 where course_id='lideranca-estrategica-aplicada' and course_version='1.1'
  and purpose='final' and active=true;

 if module_count is distinct from 10 then
  raise exception 'leadership_v11_requires_10_modules';
 end if;
 if checkpoint_count is distinct from 50 then
  raise exception 'leadership_v11_requires_50_checkpoint_questions';
 end if;
 if final_count < 30 then
  raise exception 'leadership_v11_requires_30_final_questions';
 end if;
end
$$;

drop trigger if exists vc_university_pin_enrollment_version_guard
 on public.vc_university_enrollments;

update public.vc_university_courses
set version='1.1'
where course_id='lideranca-estrategica-aplicada'
 and status='review'
 and version='1.0';

update public.vc_university_enrollments e
set course_version='1.1'
from public.vc_university_cohorts c, auth.users u
where e.cohort_id=c.cohort_id
 and e.user_id=u.id
 and e.course_id='lideranca-estrategica-aplicada'
 and e.course_version='1.0'
 and c.label='Turma de revisão V&C'
 and lower(u.email)='vcmenteconvergente@gmail.com';

create trigger vc_university_pin_enrollment_version_guard
 before insert or update of course_id, course_version
 on public.vc_university_enrollments
 for each row execute function public.vc_university_pin_enrollment_version();

do $$
begin
 if not exists (
  select 1 from public.vc_university_enrollments e
  join public.vc_university_cohorts c on c.cohort_id=e.cohort_id
  join auth.users u on u.id=e.user_id
  where e.course_id='lideranca-estrategica-aplicada'
   and e.course_version='1.1'
   and c.label='Turma de revisão V&C'
   and lower(u.email)='vcmenteconvergente@gmail.com'
 ) then
  raise exception 'review_enrollment_not_upgraded';
 end if;
end
$$;
