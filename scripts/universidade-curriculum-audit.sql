-- PR7: read-only inventory of canonical academic metadata; no learner data.
-- Run through the authorized database connection, never from a public browser.
begin transaction read only;
with materials as (
  select x from public.vc_university_academic_materials('inteligencia-emocional-aplicada') x
)
select jsonb_build_object(
  'course_id', 'inteligencia-emocional-aplicada',
  'inventory', (select jsonb_object_agg(kind,n) from (
    select x->>'kind' kind,count(*) n from materials group by x->>'kind'
  ) counts),
  'modules', (select jsonb_agg(jsonb_build_object(
    'module_no',m.module_no,'title',m.title,'course_version',m.course_version,
    'status',m.status,'estimated_minutes',m.estimated_minutes,
    'lesson_versions',(select count(*) from public.vc_university_lesson_versions l
      where l.module_version_id=m.module_version_id),
    'content_blocks',(select count(*) from public.vc_university_content_blocks b
      join public.vc_university_lesson_versions l using(lesson_version_id)
      where l.module_version_id=m.module_version_id),
    'checkpoint_items',(select count(*) from public.vc_university_questions q
      where q.module_version_id=m.module_version_id and q.purpose='checkpoint')
  ) order by m.module_no) from public.vc_university_module_versions m
    where m.course_id='inteligencia-emocional-aplicada' and m.course_version='1.0'),
  'evidence_definitions',(select jsonb_agg(jsonb_build_object(
    'title',x->>'title','revision',x->>'version','status',x->>'status'
  ) order by x->>'title') from materials where x->>'kind'='evidence'),
  'question_gaps',(select jsonb_agg(jsonb_build_object(
    'editorial_id',q.editorial_id,'gap',q.editorial_gap,'status',q.status,
    'version',q.question_version
  ) order by q.editorial_id) from public.vc_university_questions q
    where q.course_id='inteligencia-emocional-aplicada' and q.editorial_gap is not null),
  'question_status',(select jsonb_agg(to_jsonb(s)) from (
    select purpose,status,question_version,count(*) count,bool_or(active) any_active
    from public.vc_university_questions where course_id='inteligencia-emocional-aplicada'
    group by purpose,status,question_version
  ) s),
  'sources',(select jsonb_agg(jsonb_build_object(
    'title',x->>'title','status',x->>'status',
    'classification',x->'payload'->>'editorial_classification'
  ) order by x->>'title') from materials where x->>'kind'='source')
) as curriculum_inventory;
rollback;
