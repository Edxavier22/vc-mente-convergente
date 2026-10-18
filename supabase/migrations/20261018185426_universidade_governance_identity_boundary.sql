-- Narrow private identity lookup. No public SECURITY DEFINER RPC and no blanket auth.users grant.
create function vc_private.vc_university_confirmed_identity(p_actor uuid,p_owner_only boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select (auth.uid() is null or auth.uid()=p_actor) and exists(select 1 from auth.users where id=p_actor and email_confirmed_at is not null and (not p_owner_only or (id='70aa4d75-bbb9-4839-aad8-670b7654664d' and lower(email)='vcmenteconvergente@gmail.com')));
$$;
revoke all on function vc_private.vc_university_confirmed_identity(uuid,boolean) from public,anon,authenticated;
grant execute on function vc_private.vc_university_confirmed_identity(uuid,boolean) to service_role;
create or replace function public.vc_university_governance_owner(p_actor uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select vc_private.vc_university_confirmed_identity(p_actor,true);
$$;
create or replace function public.vc_university_editor_can(p_actor uuid,p_course text) returns boolean language sql stable security invoker set search_path='' as $$
 select public.vc_university_governance_owner(p_actor) or exists(select 1 from public.vc_university_teachers t join public.vc_university_cohorts c using(cohort_id) where t.user_id=p_actor and t.can_edit_academic and c.course_id=p_course and vc_private.vc_university_confirmed_identity(t.user_id,false));
$$;
create or replace function public.vc_university_editorial_decide(p_actor uuid,p_kind text,p_id text,p_state text,p_expected integer,p_author uuid,p_note text,p_gaps jsonb default '[]',p_sources uuid[] default '{}') returns jsonb language plpgsql security invoker set search_path='' as $$
declare m jsonb;previous public.vc_university_editorial_reviews%rowtype;result public.vc_university_editorial_reviews%rowtype;oldstate text;table_name text;key_name text;next_status text;
begin
 perform pg_advisory_xact_lock(hashtext('editorial:'||p_kind||':'||p_id));
 select value into m from public.vc_university_academic_materials() value where value->>'kind'=p_kind and value->>'id'=p_id;
 if m is null then raise exception 'material_not_found';end if;
 if not public.vc_university_editor_can(p_actor,m->>'course_id') then raise exception 'editorial_scope_denied';end if;
 if p_expected is null or p_author is null or not vc_private.vc_university_confirmed_identity(p_author,false) or length(trim(coalesce(p_note,''))) not between 3 and 2000 or jsonb_typeof(p_gaps) is distinct from 'array' or p_sources is null or exists(select 1 from unnest(p_sources) id where not exists(select 1 from public.vc_university_sources where source_id=id)) then raise exception 'editorial_metadata_invalid';end if;
 select * into previous from public.vc_university_editorial_reviews where material_kind=p_kind and material_id=p_id for update;
 if coalesce(previous.revision,0)<>p_expected then raise exception 'editorial_revision_conflict';end if;
 oldstate:=coalesce(previous.state,case when m->>'status' in('published','verified') then 'published' when m->>'status'='archived' then 'archived' else 'draft' end);
 if p_state not in('draft','in_review','approved_for_publication','published','archived') or not (
 (p_state='draft' and oldstate in('draft','in_review','approved_for_publication')) or
 (p_state='in_review' and oldstate='draft') or
 (p_state='approved_for_publication' and oldstate='in_review') or
 (p_state='published' and oldstate='approved_for_publication') or
 (p_state='archived' and oldstate in('published','approved_for_publication','in_review','draft'))) then raise exception 'editorial_transition_denied';end if;
 if p_state in('approved_for_publication','published') and (jsonb_array_length(p_gaps)>0 or length(trim(coalesce(m->'payload'->>'editorial_gap','')))>0 or cardinality(p_sources)=0) then raise exception 'editorial_gaps_or_sources_pending';end if;
 if p_state in('approved_for_publication','published') and previous.fingerprint is distinct from m->>'fingerprint' then raise exception 'editorial_content_changed';end if;
 if p_state='published' and m->>'course_id'='inteligencia-emocional-aplicada' then raise exception 'ie_publication_disabled';end if;
 if p_state in('published','archived') and not public.vc_university_governance_owner(p_actor) then raise exception 'owner_required';end if;
 -- Keep the approved decision visible to the publication trigger; synchronize physical status only at publication/archive.
 if p_state in('published','archived') then
  table_name:=case p_kind when 'course' then 'course_versions' when 'module' then 'module_versions' when 'lesson' then 'lesson_versions' when 'block' then 'content_blocks' when 'question' then 'questions' when 'evidence' then 'evidence_definition_versions' when 'cycle' then 'application_cycle_versions' when 'requirement' then 'module_requirements' when 'dependency' then 'module_dependencies' when 'tool' then 'learning_tool_versions' when 'source' then 'sources' end;
  key_name:=case p_kind when 'module' then 'module_version_id' when 'lesson' then 'lesson_version_id' when 'block' then 'content_block_id' when 'question' then 'question_id' when 'evidence' then 'evidence_definition_version_id' when 'cycle' then 'cycle_version_id' when 'requirement' then 'requirement_id' when 'dependency' then 'module_dependency_id' when 'tool' then 'learning_tool_version_id' when 'source' then 'source_id' end;
  next_status:=case when p_kind='source' and p_state='published' then 'verified' else p_state end;
  if p_kind='course' then execute 'update public.vc_university_course_versions set status=$1,published_at=case when $1=''published'' then now() else published_at end where course_id=$2 and version=$3' using next_status,m->>'course_id',m->>'course_version';
  else execute format('update public.vc_university_%I set status=$1%s where %I::text=$2',table_name,case when p_kind='question' then ',active=($1=''published'')' else '' end,key_name) using next_status,p_id;end if;
 end if;
 insert into public.vc_university_editorial_reviews(material_kind,material_id,course_id,course_version,state,revision,fingerprint,author_id,decided_by,note,gaps,source_ids)
 values(p_kind,p_id,m->>'course_id',m->>'course_version',p_state,p_expected+1,m->>'fingerprint',p_author,p_actor,trim(p_note),p_gaps,p_sources)
 on conflict(material_kind,material_id) do update set state=excluded.state,revision=excluded.revision,fingerprint=excluded.fingerprint,author_id=excluded.author_id,decided_by=excluded.decided_by,note=excluded.note,gaps=excluded.gaps,source_ids=excluded.source_ids,updated_at=now() returning * into result;
 insert into public.vc_university_academic_audit_log(actor_id,action,entity_type,entity_id,before_state,after_state,reason)
 values(p_actor,'editorial_decision','editorial_material',p_kind||':'||p_id,jsonb_build_object('state',oldstate),jsonb_build_object('state',p_state,'revision',result.revision,'fingerprint',result.fingerprint,'author_id',p_author,'source_ids',p_sources,'gaps',p_gaps),trim(p_note));
 return to_jsonb(result);
end $$;
create or replace function public.vc_university_teacher_assignment(p_actor uuid,p_cohort uuid,p_teacher uuid,p_action text,p_editor boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not public.vc_university_governance_owner(p_actor) then raise exception 'owner_required';end if;
 if not exists(select 1 from public.vc_university_cohorts where cohort_id=p_cohort) or not vc_private.vc_university_confirmed_identity(p_teacher,false) or p_action not in('assign','remove') then raise exception 'assignment_invalid';end if;
 if p_action='remove' then delete from public.vc_university_teachers where cohort_id=p_cohort and user_id=p_teacher;
 else insert into public.vc_university_teachers(cohort_id,user_id,can_edit_academic) values(p_cohort,p_teacher,p_editor) on conflict(cohort_id,user_id) do update set can_edit_academic=excluded.can_edit_academic;end if;
 insert into public.vc_university_academic_audit_log(actor_id,action,entity_type,entity_id,after_state) values(p_actor,'teacher_assignment_'||p_action,'cohort',p_cohort::text,jsonb_build_object('teacher_id',p_teacher,'editor',p_editor));
 return jsonb_build_object('updated',true);
end $$;
