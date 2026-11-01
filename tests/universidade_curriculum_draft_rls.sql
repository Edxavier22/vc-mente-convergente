-- Homologation metadata only; no learner text, no publication survives this transaction.
begin;
set local role service_role;
do $$
declare n integer;bad integer;id uuid;caught boolean;
begin
 select count(*),count(*) filter(where l.status<>'draft' or b.status<>'draft' or b.content->>'format'<>'markdown'
  or encode(sha256(convert_to(b.content->>'text','UTF8')),'hex')<>b.content->'provenance'->>'source_sha256')
 into n,bad from public.vc_university_lesson_versions l
 join public.vc_university_module_versions m using(module_version_id)
 join public.vc_university_content_blocks b using(lesson_version_id)
 where m.course_id='inteligencia-emocional-aplicada' and m.course_version='1.0' and l.revision=1;
 if n<>50 or bad<>0 then raise exception 'curriculum_draft_integrity_failed';end if;
 if exists(select 1 from public.vc_university_lesson_versions l join public.vc_university_module_versions m using(module_version_id)
  where m.course_id='inteligencia-emocional-aplicada' and l.revision=1 group by m.module_no having count(*)<>5) then raise exception 'curriculum_distribution_failed';end if;
 if exists(select 1 from public.vc_university_content_blocks b join public.vc_university_lesson_versions l using(lesson_version_id)
  join public.vc_university_module_versions m using(module_version_id)
  where m.course_id='inteligencia-emocional-aplicada' and not exists(select 1 from public.vc_university_editorial_reviews r where r.material_kind='block' and r.material_id=b.content_block_id::text and r.state='draft' and jsonb_array_length(r.gaps)>0)) then raise exception 'curriculum_review_gate_missing';end if;
 select content_block_id into id from public.vc_university_content_blocks b join public.vc_university_lesson_versions l using(lesson_version_id)
  join public.vc_university_module_versions m using(module_version_id) where m.course_id='inteligencia-emocional-aplicada' limit 1;
 caught:=false;begin update public.vc_university_content_blocks set status='published' where content_block_id=id;
 exception when others then caught:=sqlerrm='editorial_approval_required';end;
 if not caught then raise exception 'unreviewed_block_publication_allowed';end if;
 if(select count(*) from public.vc_university_questions where course_id='inteligencia-emocional-aplicada' and question_version=1 and status='draft' and not active)<>70 then raise exception 'original_bank_changed';end if;
 if(select count(*) from public.vc_university_questions where course_id='inteligencia-emocional-aplicada' and question_version=2 and status='draft' and not active and editorial_gap is not null)<>6 then raise exception 'question_candidates_missing';end if;
 if(select count(distinct editorial_id) from public.vc_university_questions where course_id='inteligencia-emocional-aplicada')<>70 then raise exception 'question_bank_identity_changed';end if;
 select question_id into id from public.vc_university_questions where course_id='inteligencia-emocional-aplicada' and question_version=2 limit 1;
 caught:=false;begin update public.vc_university_questions set status='published',active=true where question_id=id;
 exception when others then caught:=sqlerrm='editorial_approval_required';end;
 if not caught then raise exception 'unreviewed_question_publication_allowed';end if;
 if exists(select 1 from public.vc_university_editorial_reviews where course_id='inteligencia-emocional-aplicada' and state in('approved_for_publication','published')) then raise exception 'unexpected_academic_approval';end if;
end $$;
set local role authenticated;
do $$begin
 begin perform * from public.vc_university_lesson_versions;raise exception 'lesson_browser_access';exception when insufficient_privilege then null;end;
 begin perform * from public.vc_university_content_blocks;raise exception 'block_browser_access';exception when insufficient_privilege then null;end;
 begin perform * from public.vc_university_question_options;raise exception 'answer_browser_access';exception when insufficient_privilege then null;end;
 begin perform public.vc_university_editorial_decide('70aa4d75-bbb9-4839-aad8-670b7654664d','course','inteligencia-emocional-aplicada@1.0','approved_for_publication',0,'70aa4d75-bbb9-4839-aad8-670b7654664d','Untrusted browser');raise exception 'editorial_browser_access';exception when insufficient_privilege then null;end;
end $$;
select 'PR17: 50 source hashes, 5 lessons/module, original 70, 6 Draft revisions, editorial publication guards and browser denial passed; rollback' as result;
rollback;
