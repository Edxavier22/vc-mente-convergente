begin;
set local role service_role;
do $$
declare n integer;bad integer;target uuid;
begin
 select count(*),count(*) filter(where l.status<>'draft' or b.status<>'draft' or l.revision<>2 or b.revision<>2
  or encode(sha256(convert_to(b.content->>'text','UTF8')),'hex')<>b.content->'provenance'->>'source_sha256') into n,bad
 from public.vc_university_lesson_versions l join public.vc_university_content_blocks b using(lesson_version_id)
 join public.vc_university_module_versions m using(module_version_id) where m.course_id='inteligencia-emocional-aplicada' and l.revision=2;
 if n<>50 or bad<>0 then raise exception 'revision2_integrity_failed';end if;
 if(select count(distinct l.lesson_id) from public.vc_university_lesson_versions l join public.vc_university_module_versions m using(module_version_id) where m.course_id='inteligencia-emocional-aplicada')<>50 then raise exception 'logical_lesson_count_changed';end if;
 if exists(select 1 from(select row_number() over(partition by l.module_version_id order by l.created_at) position_no,right(b.content->'provenance'->>'lesson_code',2)::integer expected from public.vc_university_lesson_versions l join public.vc_university_content_blocks b using(lesson_version_id) join public.vc_university_module_versions m using(module_version_id) where m.course_id='inteligencia-emocional-aplicada' and l.revision=2) ordered where ordered.position_no<>ordered.expected) then raise exception 'prospective_lesson_order_invalid';end if;
 if exists(select 1 from public.vc_university_content_blocks b join public.vc_university_lesson_versions l using(lesson_version_id) join public.vc_university_module_versions m using(module_version_id) where m.course_id='inteligencia-emocional-aplicada' and l.revision=2 and not exists(select 1 from public.vc_university_content_blocks parent join public.vc_university_lesson_versions pl on pl.lesson_version_id=parent.lesson_version_id where pl.lesson_id=l.lesson_id and pl.revision=1 and parent.content->'provenance'->>'source_sha256'=b.content->'provenance'->>'parent_source_sha256')) then raise exception 'parent_provenance_missing';end if;
 if(select count(*) from public.vc_university_question_options o join public.vc_university_questions q using(question_id) where q.course_id='inteligencia-emocional-aplicada' and q.question_version=2 and length(trim(o.feedback))>20)<>24 then raise exception 'contextual_feedback_missing';end if;
 if exists(select 1 from public.vc_university_questions q join public.vc_university_question_options o on o.option_id=q.correct_option_id where q.course_id='inteligencia-emocional-aplicada' and q.question_version=2 and (q.correct_feedback is distinct from o.feedback or q.status<>'draft' or q.active or q.editorial_gap is null)) then raise exception 'candidate_state_invalid';end if;
 if(select md5(jsonb_agg(to_jsonb(l) order by lesson_version_id)::text) from public.vc_university_lesson_versions l join public.vc_university_module_versions m using(module_version_id) where m.course_id='inteligencia-emocional-aplicada' and revision=1)<>'89a9d8f7082bb7a40a41fe21fe2626d9' then raise exception 'historical_lessons_changed';end if;
 if(select md5(jsonb_agg(to_jsonb(b) order by content_block_id)::text) from public.vc_university_content_blocks b join public.vc_university_lesson_versions l using(lesson_version_id) join public.vc_university_module_versions m using(module_version_id) where m.course_id='inteligencia-emocional-aplicada' and l.revision=1)<>'f137506bf4f1e3ab632cb356df7a464a' then raise exception 'historical_blocks_changed';end if;
 if exists(select 1 from public.vc_university_editorial_reviews where course_id='inteligencia-emocional-aplicada' and state in('approved_for_publication','published')) then raise exception 'academic_approval_created';end if;
 select content_block_id into target from public.vc_university_content_blocks b join public.vc_university_lesson_versions l using(lesson_version_id) where l.revision=2 limit 1;
 begin update public.vc_university_content_blocks set status='published' where content_block_id=target;raise exception 'unreviewed_publication_allowed';exception when others then if sqlerrm<>'editorial_approval_required' then raise;end if;end;
end $$;
set local role authenticated;
do $$begin
 begin perform * from public.vc_university_content_blocks;raise exception 'browser_content_leaked';exception when insufficient_privilege then null;end;
 begin update public.vc_university_questions set active=true;raise exception 'browser_grade_publication_allowed';exception when insufficient_privilege then null;end;
end $$;
select 'sanitation: 50 prospective revisions, 24 feedbacks, historical hashes, Draft gates and RLS passed; rollback' result;
rollback;
