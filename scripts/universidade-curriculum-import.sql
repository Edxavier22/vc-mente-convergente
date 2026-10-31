-- Generated values are JSON data, not executable source code. Default caller uses ROLLBACK.
begin;
set local standard_conforming_strings=on;
set local role service_role;
do $import$
declare
 p jsonb:=/*PAYLOAD*/;
 actor uuid:='70aa4d75-bbb9-4839-aad8-670b7654664d';
 src uuid:=(p->>'source_id')::uuid;
 item jsonb; m public.vc_university_module_versions%rowtype;
 l public.vc_university_lesson_versions%rowtype;
 b public.vc_university_content_blocks%rowtype;
 q_old public.vc_university_questions%rowtype;q_new public.vc_university_questions%rowtype;opt jsonb;
 lesson uuid; source_row public.vc_university_sources%rowtype;
 kind text; ident text; inserted_count integer:=0;
begin
 perform pg_advisory_xact_lock(hashtext('ie-official-curriculum:1.0'));
 if not public.vc_university_governance_owner(actor) then raise exception 'curriculum_import_owner_required';end if;
 if p->>'course_id'<>'inteligencia-emocional-aplicada' or p->>'course_version'<>'1.0' or jsonb_array_length(p->'lessons')<>50
  or not exists(select 1 from public.vc_university_course_versions where course_id=p->>'course_id' and version=p->>'course_version' and content_model='structured_blocks' and status='draft')
 then raise exception 'curriculum_import_context_invalid';end if;
 select * into source_row from public.vc_university_sources where source_id=src;
 if source_row.source_id is null then
  insert into public.vc_university_sources(source_id,title,authors,citation,editorial_classification,status)
  values(src,'Consolidado editorial IE — 50 aulas — 31/10/2026','V&C Mente Convergente',
   'Pacote editorial SHA-256 '||(p->>'package_sha256')||'. Fonte de textos em revisão. D classifica o pacote didático, não valida as afirmações científicas ou a bibliografia nele citada.','D','draft');
 elsif source_row.status<>'draft' or position(p->>'package_sha256' in source_row.citation)=0 then raise exception 'curriculum_source_conflict';end if;
 for item in select value from jsonb_array_elements(p->'lessons') loop
  select * into m from public.vc_university_module_versions where course_id=p->>'course_id' and course_version=p->>'course_version' and module_no=(item->>'module_no')::integer for update;
  if m.module_version_id is null or m.status<>'draft' then raise exception 'curriculum_module_not_draft';end if;
  insert into public.vc_university_lessons(lesson_id,module_id,lesson_key)
   values((item->>'lesson_id')::uuid,m.module_id,item->>'key') on conflict(module_id,lesson_key) do nothing;
  select lesson_id into lesson from public.vc_university_lessons where module_id=m.module_id and lesson_key=item->>'key';
  select * into l from public.vc_university_lesson_versions where lesson_id=lesson and module_version_id=m.module_version_id and revision=1 for update;
  if l.lesson_version_id is null then
   insert into public.vc_university_lesson_versions(lesson_version_id,lesson_id,module_version_id,revision,title,learning_objectives,estimated_minutes,status,created_by,created_at)
   values((item->>'lesson_version_id')::uuid,lesson,m.module_version_id,1,item->>'title',item->'learning_objectives',24,'draft',actor,now()+((item->>'lesson_no')::integer-1)*interval '1 microsecond') returning * into l;
   inserted_count:=inserted_count+1;
  elsif l.status<>'draft' or l.title<>item->>'title' or l.learning_objectives<>item->'learning_objectives' or l.estimated_minutes<>24 then raise exception 'curriculum_lesson_conflict';end if;
  if exists(select 1 from public.vc_university_lesson_versions where lesson_id=lesson and module_version_id=m.module_version_id and revision<>1) then raise exception 'curriculum_newer_revision_exists';end if;
  select * into b from public.vc_university_content_blocks where lesson_version_id=l.lesson_version_id and block_key='official-text' and revision=1 for update;
  if b.content_block_id is null then
   insert into public.vc_university_content_blocks(content_block_id,lesson_version_id,block_key,block_type,position,revision,content,status,created_by)
   values((item->>'content_block_id')::uuid,l.lesson_version_id,'official-text','study',1,1,item->'content','draft',actor) returning * into b;
  elsif b.status<>'draft' or b.content<>item->'content' or b.block_type<>'study' or b.position<>1 then raise exception 'curriculum_block_conflict';end if;
  if (select count(*) from public.vc_university_content_blocks where lesson_version_id=l.lesson_version_id)<>1 then raise exception 'curriculum_extra_blocks_exist';end if;
  insert into public.vc_university_source_links(source_id,lesson_version_id,relationship)
   select src,l.lesson_version_id,'informs' where not exists(select 1 from public.vc_university_source_links where source_id=src and lesson_version_id=l.lesson_version_id);
  foreach kind in array array['lesson','block'] loop
   ident:=case when kind='lesson' then l.lesson_version_id::text else b.content_block_id::text end;
   if not exists(select 1 from public.vc_university_editorial_reviews where material_kind=kind and material_id=ident) then
    perform public.vc_university_editorial_decide(actor,kind,ident,'draft',0,actor,'Importação técnica fiel do pacote de 50 aulas; autoria cadastrada como responsável pela importação, sem aprovação acadêmica.',item->'gaps',array[src]);
   end if;
  end loop;
 end loop;
 -- Six proposals become new inactive Draft revisions, never approval of the proposal.
 for item in select value from jsonb_array_elements(coalesce(p->'questions','[]')) loop
  select * into q_old from public.vc_university_questions where question_id=(item->>'original_id')::uuid for update;
  if q_old.course_id<>p->>'course_id' or q_old.course_version<>p->>'course_version' or q_old.question_version<>1
   or q_old.editorial_id<>item->>'editorial_id' or q_old.question_key<>(item->>'question_key')::uuid
   or q_old.prompt<>item->>'original_prompt' or q_old.correct_option_id<>(item->>'original_correct_option_id')::uuid
   or q_old.question_id is null then raise exception 'question_original_changed';end if;
  select * into q_new from public.vc_university_questions where question_key=q_old.question_key and question_version=2 for update;
  if q_new.question_id is null then
   insert into public.vc_university_questions
   select (jsonb_populate_record(null::public.vc_university_questions,to_jsonb(q_old)||jsonb_build_object(
    'question_id',item->>'question_id','question_version',2,'prompt',item->>'prompt',
    'choices',(select jsonb_agg(o->>'option_text' order by (o->>'option_order')::integer) from jsonb_array_elements(item->'options')o),
    'correct_index',null,'correct_option_id',item->>'correct_option_id','correct_feedback',null,
    'editorial_gap',item->>'editorial_gap','status','draft','active',false,'created_at',now()))).* returning * into q_new;
   for opt in select value from jsonb_array_elements(item->'options') loop
    insert into public.vc_university_question_options(option_id,question_id,option_order,option_text,feedback,is_correct)
    values((opt->>'option_id')::uuid,q_new.question_id,(opt->>'option_order')::integer,opt->>'option_text',null,(opt->>'is_correct')::boolean);
   end loop;
  elsif q_new.status<>'draft' or q_new.active or q_new.question_id<>(item->>'question_id')::uuid
   or q_new.prompt<>item->>'prompt' or q_new.correct_option_id<>(item->>'correct_option_id')::uuid
   or q_new.editorial_gap is distinct from item->>'editorial_gap' then raise exception 'question_candidate_conflict';end if;
  if (select jsonb_agg(jsonb_build_object('option_id',option_id,'option_order',option_order,'option_text',option_text,'is_correct',is_correct,'feedback',feedback) order by option_order) from public.vc_university_question_options where question_id=q_new.question_id)<>item->'options' then raise exception 'question_candidate_options_conflict';end if;
  insert into public.vc_university_source_links(source_id,question_id,relationship)
   select src,q_new.question_id,'informs' where not exists(select 1 from public.vc_university_source_links where source_id=src and question_id=q_new.question_id);
  if not exists(select 1 from public.vc_university_editorial_reviews where material_kind='question' and material_id=q_new.question_id::text) then
   perform public.vc_university_editorial_decide(actor,'question',q_new.question_id::text,'draft',0,actor,'Proposta versionada sem aprovação acadêmica. Feedback não fornecido permanece nulo e bloqueia publicação.',jsonb_build_array(item->>'editorial_gap'),array[src]);
  end if;
 end loop;
 if inserted_count>0 then
  insert into public.vc_university_academic_audit_log(actor_id,action,entity_type,entity_id,after_state)
  values(actor,'curriculum_draft_imported','course_version',(p->>'course_id')||'@'||(p->>'course_version'),jsonb_build_object('package_sha256',p->>'package_sha256','lessons_created',inserted_count,'status','draft'));
 end if;
end $import$;
select 'draft_import_validated' as result,
 count(*) as lessons,count(*) filter(where l.status='draft') as draft_lessons
 from public.vc_university_lesson_versions l join public.vc_university_module_versions m using(module_version_id)
 where m.course_id='inteligencia-emocional-aplicada' and m.course_version='1.0';
/*END_TRANSACTION*/
