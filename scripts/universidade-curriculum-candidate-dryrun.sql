-- A candidate simulation, not authorization to import. NEVER change ROLLBACK to COMMIT.
begin;
set local role service_role;
do $f01$
declare items jsonb:=/*CANDIDATES*/; item jsonb; parent public.vc_university_lesson_versions%rowtype;
 actor uuid:='70aa4d75-bbb9-4839-aad8-670b7654664d'; pass integer; historical_before text; historical_after text;
begin
 perform pg_advisory_xact_lock(hashtext('ie-official-curriculum:1.0'));
 if jsonb_array_length(items)<>50 or not public.vc_university_governance_owner(actor)
  or not exists(select 1 from public.vc_university_course_versions where course_id='inteligencia-emocional-aplicada' and version='1.0' and status='draft')
  or exists(select 1 from public.vc_university_lesson_versions l join public.vc_university_module_versions m using(module_version_id) where m.course_id='inteligencia-emocional-aplicada' and l.revision>2)
 then raise exception 'candidate_simulation_context_denied';end if;
 select md5(jsonb_agg(to_jsonb(b) order by b.content_block_id)::text) into historical_before from public.vc_university_content_blocks b join public.vc_university_lesson_versions l using(lesson_version_id) join public.vc_university_module_versions m using(module_version_id) where m.course_id='inteligencia-emocional-aplicada' and l.revision<=2;
 for pass in 1..2 loop
  for item in select value from jsonb_array_elements(items) loop
   select l.* into parent from public.vc_university_lesson_versions l join public.vc_university_module_versions m using(module_version_id)
    where l.lesson_version_id=(item->>'parent_lesson_version_id')::uuid and l.revision=2 and l.status='draft'
    and m.course_id='inteligencia-emocional-aplicada' and m.course_version='1.0' and m.status='draft';
   if parent.lesson_version_id is null or not exists(select 1 from public.vc_university_content_blocks where lesson_version_id=parent.lesson_version_id and encode(sha256(convert_to(content->>'text','UTF8')),'hex')=item->>'parent_hash')
    or encode(sha256(convert_to(item->>'text','UTF8')),'hex')<>item->>'candidate_sha256' then raise exception 'candidate_parent_or_payload_changed';end if;
   insert into public.vc_university_lesson_versions(lesson_version_id,lesson_id,module_version_id,revision,title,learning_objectives,estimated_minutes,status,created_by,created_at)
    values((item->>'lesson_version_id')::uuid,parent.lesson_id,parent.module_version_id,3,item->>'title',parent.learning_objectives,parent.estimated_minutes,'draft',actor,now()+(right(item->>'code',2)::integer-1)*interval '1 microsecond') on conflict(lesson_version_id) do nothing;
   if not exists(select 1 from public.vc_university_lesson_versions where lesson_version_id=(item->>'lesson_version_id')::uuid and lesson_id=parent.lesson_id and module_version_id=parent.module_version_id and revision=3 and status='draft' and title=item->>'title') then raise exception 'candidate_simulation_conflict';end if;
   insert into public.vc_university_content_blocks(content_block_id,lesson_version_id,block_key,block_type,position,revision,content,status,created_by)
    values((item->>'content_block_id')::uuid,(item->>'lesson_version_id')::uuid,'official-text','study',1,3,jsonb_build_object('format','markdown','text',item->>'text','provenance',jsonb_build_object('lesson_code',item->>'code','source_sha256',item->>'candidate_sha256','parent_source_sha256',item->>'parent_hash','academic_status','candidate_not_approved','simulation_only',true)),'draft',actor) on conflict(content_block_id) do nothing;
   if not exists(select 1 from public.vc_university_content_blocks where content_block_id=(item->>'content_block_id')::uuid and lesson_version_id=(item->>'lesson_version_id')::uuid and status='draft' and content->>'text'=item->>'text') then raise exception 'candidate_simulation_block_conflict';end if;
  end loop;
 end loop;
 select md5(jsonb_agg(to_jsonb(b) order by b.content_block_id)::text) into historical_after from public.vc_university_content_blocks b join public.vc_university_lesson_versions l using(lesson_version_id) join public.vc_university_module_versions m using(module_version_id) where m.course_id='inteligencia-emocional-aplicada' and l.revision<=2;
 if historical_before is distinct from historical_after then raise exception 'candidate_history_modified';end if;
 if(select count(*) from public.vc_university_lesson_versions l join public.vc_university_module_versions m using(module_version_id) where m.course_id='inteligencia-emocional-aplicada' and l.revision=3)<>50 then raise exception 'candidate_double_pass_not_idempotent';end if;
end $f01$;
select 'F01: 50 temporary candidates; double pass idempotent; historical blocks unchanged; rollback required' result;
rollback;
