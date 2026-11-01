begin;
set local role service_role;
do $sanitation$
declare p jsonb:=/*PAYLOAD*/; actor uuid:='70aa4d75-bbb9-4839-aad8-670b7654664d';
 src uuid:=(p->>'source_id')::uuid;item jsonb;opt jsonb;old_l public.vc_university_lesson_versions%rowtype;
 l public.vc_university_lesson_versions%rowtype;b public.vc_university_content_blocks%rowtype;
 q public.vc_university_questions%rowtype;code text;kind text;ident text;meta record;changed boolean;
begin
 perform pg_advisory_xact_lock(hashtext('ie-official-curriculum:1.0'));
 if not public.vc_university_governance_owner(actor) or p->>'course_id'<>'inteligencia-emocional-aplicada' or p->>'course_version'<>'1.0'
  or jsonb_array_length(p->'lessons')<>50 or jsonb_array_length(p->'questions')<>6
  or not exists(select 1 from public.vc_university_course_versions where course_id=p->>'course_id' and version='1.0' and status='draft')
 then raise exception 'sanitation_context_denied';end if;
 insert into public.vc_university_sources(source_id,title,authors,citation,editorial_classification,status)
 values(src,'Saneamento editorial PR17 — revisão 2 — 01/11/2026','V&C Mente Convergente','Proposta de saneamento. Alterações SHA-256 '||(p->>'amendments_sha256')||'; feedback SHA-256 '||(p->>'feedback_sha256')||'. D classifica a proposta didática, sem validar alegações científicas.','D','draft') on conflict(source_id) do nothing;
 if not exists(select 1 from public.vc_university_sources where source_id=src and status='draft' and position(p->>'amendments_sha256' in citation)>0) then raise exception 'sanitation_source_conflict';end if;
 for item in select value from jsonb_array_elements(p->'lessons') loop
  select * into old_l from public.vc_university_lesson_versions where lesson_version_id=(item->>'parent_lesson_version_id')::uuid for update;
  if old_l.revision<>1 or old_l.status<>'draft' or old_l.lesson_version_id is null
   or not exists(select 1 from public.vc_university_module_versions where module_version_id=old_l.module_version_id and course_id=p->>'course_id' and course_version='1.0' and status='draft')
   or not exists(select 1 from public.vc_university_content_blocks where content_block_id=(item->>'parent_block_id')::uuid and lesson_version_id=old_l.lesson_version_id and encode(sha256(convert_to(content->>'text','UTF8')),'hex')=item->>'parent_hash') then raise exception 'sanitation_parent_changed';end if;
  if exists(select 1 from public.vc_university_lesson_versions where lesson_id=old_l.lesson_id and module_version_id=old_l.module_version_id and revision>2) then raise exception 'sanitation_newer_revision';end if;
  select * into l from public.vc_university_lesson_versions where lesson_id=old_l.lesson_id and module_version_id=old_l.module_version_id and revision=2 for update;
  if l.lesson_version_id is null then
   insert into public.vc_university_lesson_versions(lesson_version_id,lesson_id,module_version_id,revision,title,learning_objectives,estimated_minutes,status,created_by,created_at)
   values((item->>'lesson_version_id')::uuid,old_l.lesson_id,old_l.module_version_id,2,item->>'title',item->'learning_objectives',old_l.estimated_minutes,'draft',actor,now()+(right(item->>'code',2)::integer-1)*interval '1 microsecond') returning * into l;
  elsif l.status<>'draft' or l.lesson_version_id<>(item->>'lesson_version_id')::uuid or l.title<>item->>'title' or l.learning_objectives<>item->'learning_objectives' then raise exception 'sanitation_lesson_conflict';end if;
  select * into b from public.vc_university_content_blocks where lesson_version_id=l.lesson_version_id for update;
  if b.content_block_id is null then
   insert into public.vc_university_content_blocks(content_block_id,lesson_version_id,block_key,block_type,position,revision,content,status,created_by)
   values((item->>'content_block_id')::uuid,l.lesson_version_id,'official-text','study',1,2,item->'content','draft',actor) returning * into b;
  elsif b.status<>'draft' or b.content<>item->'content' or b.content_block_id<>(item->>'content_block_id')::uuid then raise exception 'sanitation_block_conflict';end if;
  if(select count(*) from public.vc_university_content_blocks where lesson_version_id=l.lesson_version_id)<>1 then raise exception 'sanitation_extra_blocks';end if;
  insert into public.vc_university_source_links(source_id,lesson_version_id,relationship)
   select src,l.lesson_version_id,'informs' where not exists(select 1 from public.vc_university_source_links where source_id=src and lesson_version_id=l.lesson_version_id);
  foreach kind in array array['lesson','block'] loop
   ident:=case when kind='lesson' then l.lesson_version_id::text else b.content_block_id::text end;
   if not exists(select 1 from public.vc_university_editorial_reviews where material_kind=kind and material_id=ident) then
    perform public.vc_university_editorial_decide(actor,kind,ident,'draft',0,actor,'Saneamento prospectivo; revisão 1 preservada. Aceite acadêmico não concedido.',item->'gaps',array[src]);
   end if;
  end loop;
 end loop;
 for item in select value from jsonb_array_elements(p->'questions') loop
  select * into q from public.vc_university_questions where question_id=(item->>'question_id')::uuid for update;
  select c.code into code from public.vc_university_competencies c where competency_id=q.competency_id;
  if q.question_id is null or q.question_version<>2 or q.status<>'draft' or q.active or q.course_id<>p->>'course_id' or q.course_version<>'1.0' or q.editorial_id<>item->>'editorial_id'
   or code is distinct from item->>'expected_competency' or q.correct_option_id<>(item->>'correct_option_id')::uuid
   or exists(select 1 from public.vc_university_final_sessions where q.question_id=any(question_ids)) then raise exception 'feedback_context_denied';end if;
  if (q.correct_feedback is not null and q.correct_feedback<>item->>'correct_feedback') or q.editorial_gap is null
   or q.editorial_gap not in(item->>'previous_editorial_gap',item->>'editorial_gap') then raise exception 'feedback_draft_changed';end if;
  changed:=q.correct_feedback is distinct from item->>'correct_feedback' or q.editorial_gap is distinct from item->>'editorial_gap';
  for opt in select value from jsonb_array_elements(item->'options') loop
   if not exists(select 1 from public.vc_university_question_options where question_id=q.question_id and option_id=(opt->>'option_id')::uuid and option_order=(opt->>'option_order')::integer and option_text=opt->>'option_text' and is_correct=(opt->>'is_correct')::boolean and (feedback is null or feedback=opt->>'feedback')) then raise exception 'feedback_option_conflict';end if;
   update public.vc_university_question_options set feedback=opt->>'feedback' where question_id=q.question_id and option_id=(opt->>'option_id')::uuid and feedback is distinct from opt->>'feedback';
  end loop;
  update public.vc_university_questions set correct_feedback=item->>'correct_feedback',editorial_gap=item->>'editorial_gap' where question_id=q.question_id and changed;
  insert into public.vc_university_source_links(source_id,question_id,relationship)
   select src,q.question_id,'informs' where not exists(select 1 from public.vc_university_source_links where source_id=src and question_id=q.question_id);
  if changed then
   select revision,state into meta from public.vc_university_editorial_reviews where material_kind='question' and material_id=q.question_id::text;
   if meta.state is distinct from 'draft' then raise exception 'feedback_editorial_conflict';end if;
   perform public.vc_university_editorial_decide(actor,'question',q.question_id::text,'draft',meta.revision,actor,'Feedback contextual do parecer recebido como proposta; códigos existentes conferidos, nível/distratores/pertinência ainda não homologados.',jsonb_build_array(item->>'editorial_gap'),array[src]);
  end if;
 end loop;
end $sanitation$;
select 'sanitation_draft_validated' result,
 (select count(*) from public.vc_university_lesson_versions l join public.vc_university_module_versions m using(module_version_id) where m.course_id='inteligencia-emocional-aplicada' and revision=2) revision2_lessons,
 (select count(*) from public.vc_university_question_options o join public.vc_university_questions q using(question_id) where q.course_id='inteligencia-emocional-aplicada' and question_version=2 and length(feedback)>20) contextual_feedbacks;
/*END*/
