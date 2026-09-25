-- The v1.1 content deepens the same competency map as v1.0. Preserve the
-- reviewed question wording while pinning a separate, immutable bank to v1.1.
insert into public.vc_university_questions
 (question_id, course_id, course_version, module_no, purpose, kind, prompt,
  choices, correct_index, review_concept, active)
select gen_random_uuid(), q.course_id, '1.1', q.module_no, q.purpose, q.kind,
 q.prompt, q.choices, q.correct_index, q.review_concept, true
from public.vc_university_questions q
where q.course_id = 'lideranca-estrategica-aplicada'
 and q.course_version = '1.0'
 and q.purpose = 'checkpoint'
 and q.active = true
 and not exists (
  select 1 from public.vc_university_questions target
  where target.course_id = q.course_id
   and target.course_version = '1.1'
   and target.purpose = q.purpose
   and target.module_no = q.module_no
   and target.prompt = q.prompt
 );

do $$
declare
 invalid_modules integer;
begin
 select count(*) into invalid_modules
 from (
  select m.module_no
  from public.vc_university_modules m
  left join public.vc_university_questions q
   on q.course_id = m.course_id
   and q.course_version = '1.1'
   and q.purpose = 'checkpoint'
   and q.module_no = m.module_no
   and q.active = true
  where m.course_id = 'lideranca-estrategica-aplicada'
  group by m.module_no
  having count(q.question_id) <> 5
   or count(*) filter (where q.kind = 'concept') <> 2
   or count(*) filter (where q.kind = 'application') <> 2
   or count(*) filter (where q.kind = 'decision') <> 1
 ) invalid;
 if invalid_modules <> 0 then
  raise exception 'checkpoint_v11_distribution_invalid:%', invalid_modules;
 end if;
end
$$;
