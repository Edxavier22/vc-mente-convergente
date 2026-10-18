-- PR6: editorial governance references canonical materials; no duplicate curriculum or learner review model.
alter table public.vc_university_teachers add column can_edit_academic boolean not null default false;
create table public.vc_university_editorial_reviews (
 material_kind text not null,
 material_id text not null,
 course_id text references public.vc_university_courses(course_id),
 course_version text,
 state text not null default 'draft' check(state in('draft','in_review','approved_for_publication','published','archived')),
 revision integer not null default 1 check(revision>0),
 fingerprint text not null,
 author_id uuid not null references auth.users(id),
 decided_by uuid not null references auth.users(id),
 note text not null check(length(trim(note)) between 3 and 2000),
 gaps jsonb not null default '[]' check(jsonb_typeof(gaps)='array' and octet_length(gaps::text)<=4000),
 source_ids uuid[] not null default '{}',
 updated_at timestamptz not null default now(),
 primary key(material_kind,material_id),
 foreign key(course_id,course_version) references public.vc_university_course_versions(course_id,version)
);
create index university_editorial_course_idx on public.vc_university_editorial_reviews(course_id,course_version,state);
create index university_editorial_author_idx on public.vc_university_editorial_reviews(author_id);
create index university_editorial_decider_idx on public.vc_university_editorial_reviews(decided_by);
alter table public.vc_university_editorial_reviews enable row level security;
revoke all on public.vc_university_editorial_reviews from anon,authenticated;
grant all on public.vc_university_editorial_reviews to service_role;
-- Service-only RPCs resolve explicit actor IDs after Edge identity verification.
create function public.vc_university_governance_owner(p_actor uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from auth.users where id=p_actor and id='70aa4d75-bbb9-4839-aad8-670b7654664d' and lower(email)='vcmenteconvergente@gmail.com' and email_confirmed_at is not null);
$$;
create function public.vc_university_editor_can(p_actor uuid,p_course text) returns boolean language sql stable security invoker set search_path='' as $$
 select public.vc_university_governance_owner(p_actor) or exists(select 1 from public.vc_university_teachers t join public.vc_university_cohorts c using(cohort_id) join auth.users u on u.id=t.user_id where t.user_id=p_actor and t.can_edit_academic and c.course_id=p_course and u.email_confirmed_at is not null);
$$;
-- One projection of existing canonical objects, never student data.
create function public.vc_university_academic_materials(p_course text default null) returns setof jsonb language sql stable security invoker set search_path='' as $$
 with materials(kind,id,course_id,course_version,title,version,status,payload) as (
 select 'course',course_id||'@'||version,course_id,version,title_snapshot,version,status,to_jsonb(v) from public.vc_university_course_versions v
 union all select 'module',module_version_id::text,course_id,course_version,title,course_version,status,to_jsonb(v) from public.vc_university_module_versions v
 union all select 'lesson',v.lesson_version_id::text,m.course_id,m.course_version,v.title,v.revision::text,v.status,to_jsonb(v) from public.vc_university_lesson_versions v join public.vc_university_module_versions m using(module_version_id)
 union all select 'block',v.content_block_id::text,m.course_id,m.course_version,v.block_key,v.revision::text,v.status,to_jsonb(v) from public.vc_university_content_blocks v join public.vc_university_lesson_versions l using(lesson_version_id) join public.vc_university_module_versions m using(module_version_id)
 union all select 'question',v.question_id::text,v.course_id,v.course_version,coalesce(v.editorial_id,v.question_id::text),v.question_version::text,v.status,to_jsonb(v)||jsonb_build_object('options',(select jsonb_agg(to_jsonb(o) order by o.option_order) from public.vc_university_question_options o where o.question_id=v.question_id),'sources',(select jsonb_agg(l.source_id order by l.source_id) from public.vc_university_source_links l where l.question_id=v.question_id)) from public.vc_university_questions v
 union all select 'evidence',evidence_definition_version_id::text,course_id,course_version,title,revision::text,status,to_jsonb(v) from public.vc_university_evidence_definition_versions v
 union all select 'cycle',cycle_version_id::text,course_id,course_version,coalesce(configuration->>'title',version),version,status,to_jsonb(v) from public.vc_university_application_cycle_versions v
 union all select 'requirement',requirement_id::text,course_id,course_version,requirement_key,course_version,status,to_jsonb(v) from public.vc_university_module_requirements v
 union all select 'dependency',module_dependency_id::text,course_id,course_version,dependency_type,course_version,status,to_jsonb(v) from public.vc_university_module_dependencies v
 union all select 'tool',learning_tool_version_id::text,course_id,course_version,version,version,status,to_jsonb(v) from public.vc_university_learning_tool_versions v
 union all select 'source',source_id::text,null,null,title,coalesce(publication_year::text,'1'),status,to_jsonb(v) from public.vc_university_sources v
 ) select jsonb_build_object('kind',kind,'id',id,'course_id',course_id,'course_version',course_version,'title',title,'version',version,'status',status,'payload',payload,'fingerprint',md5((payload-'status'-'active'-'published_at'-'verified_at')::text)) from materials where p_course is null or course_id=p_course or kind='source';
$$;
-- Publisher trigger protects service-side accidental publication too; legacy published content is untouched.
create function public.vc_university_editorial_publish_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare kind text:=tg_argv[0];key text;material jsonb;decision public.vc_university_editorial_reviews%rowtype;
begin
 if tg_op='INSERT' then
  if new.status in('published','verified') and not (kind='course' and to_jsonb(new)->>'content_model'='legacy_json') and not(kind='question' and to_jsonb(new)->>'editorial_id' is null) then raise exception 'editorial_approval_required';end if;
  return new;
 end if;
 if new.status in('published','verified') and old.status is distinct from new.status then
  key:=case when kind='course' then (to_jsonb(old)->>'course_id')||'@'||(to_jsonb(old)->>'version') else to_jsonb(old)->>tg_argv[1] end;
  select value into material from public.vc_university_academic_materials() value where value->>'kind'=kind and value->>'id'=key;
  -- Legacy JSON runtime and legacy question banks stay unchanged.
  if kind='course' and material->'payload'->>'content_model'='legacy_json' then return new;end if;
  if kind='question' and material->'payload'->>'editorial_id' is null then return new;end if;
  select * into decision from public.vc_university_editorial_reviews where material_kind=kind and material_id=key;
  if decision.state is distinct from 'approved_for_publication' or decision.fingerprint is distinct from material->>'fingerprint' or jsonb_array_length(decision.gaps)>0 or length(trim(coalesce(material->'payload'->>'editorial_gap','')))>0 then raise exception 'editorial_approval_required';end if;
 end if;return new;
end $$;
create trigger editorial_publication_guard before insert or update on public.vc_university_course_versions for each row execute function public.vc_university_editorial_publish_guard('course','');
create trigger editorial_publication_guard before insert or update on public.vc_university_module_versions for each row execute function public.vc_university_editorial_publish_guard('module','module_version_id');
create trigger editorial_publication_guard before insert or update on public.vc_university_lesson_versions for each row execute function public.vc_university_editorial_publish_guard('lesson','lesson_version_id');
create trigger editorial_publication_guard before insert or update on public.vc_university_content_blocks for each row execute function public.vc_university_editorial_publish_guard('block','content_block_id');
create trigger editorial_publication_guard before insert or update on public.vc_university_questions for each row execute function public.vc_university_editorial_publish_guard('question','question_id');
create trigger editorial_publication_guard before insert or update on public.vc_university_evidence_definition_versions for each row execute function public.vc_university_editorial_publish_guard('evidence','evidence_definition_version_id');
create trigger editorial_publication_guard before insert or update on public.vc_university_application_cycle_versions for each row execute function public.vc_university_editorial_publish_guard('cycle','cycle_version_id');
create trigger editorial_publication_guard before insert or update on public.vc_university_module_requirements for each row execute function public.vc_university_editorial_publish_guard('requirement','requirement_id');
create trigger editorial_publication_guard before insert or update on public.vc_university_module_dependencies for each row execute function public.vc_university_editorial_publish_guard('dependency','module_dependency_id');
create trigger editorial_publication_guard before insert or update on public.vc_university_learning_tool_versions for each row execute function public.vc_university_editorial_publish_guard('tool','learning_tool_version_id');
create trigger editorial_publication_guard before insert or update on public.vc_university_sources for each row execute function public.vc_university_editorial_publish_guard('source','source_id');

create function public.vc_university_editorial_decide(p_actor uuid,p_kind text,p_id text,p_state text,p_expected integer,p_author uuid,p_note text,p_gaps jsonb default '[]',p_sources uuid[] default '{}') returns jsonb language plpgsql security invoker set search_path='' as $$
declare m jsonb;previous public.vc_university_editorial_reviews%rowtype;result public.vc_university_editorial_reviews%rowtype;oldstate text;table_name text;key_name text;next_status text;
begin
 perform pg_advisory_xact_lock(hashtext('editorial:'||p_kind||':'||p_id));
 select value into m from public.vc_university_academic_materials() value where value->>'kind'=p_kind and value->>'id'=p_id;
 if m is null then raise exception 'material_not_found';end if;
 if not public.vc_university_editor_can(p_actor,m->>'course_id') then raise exception 'editorial_scope_denied';end if;
 if p_expected is null or p_author is null or not exists(select 1 from auth.users where id=p_author and email_confirmed_at is not null) or length(trim(coalesce(p_note,''))) not between 3 and 2000 or jsonb_typeof(p_gaps) is distinct from 'array' or p_sources is null or exists(select 1 from unnest(p_sources) id where not exists(select 1 from public.vc_university_sources where source_id=id)) then raise exception 'editorial_metadata_invalid';end if;
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
-- No owner narrative bypass: all operation projections contain metadata only.
create function public.vc_university_teacher_operations(p_actor uuid,p_cohort uuid default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare cohorts jsonb;students jsonb;queue jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('cohort_id',c.cohort_id,'label',c.label,'course_id',c.course_id,'course_title',v.title,'can_edit_academic',t.can_edit_academic) order by c.label),'[]') into cohorts from public.vc_university_teachers t join public.vc_university_cohorts c using(cohort_id) join public.vc_university_courses v using(course_id) where t.user_id=p_actor;
 if p_cohort is not null and not exists(select 1 from public.vc_university_teachers where user_id=p_actor and cohort_id=p_cohort) then raise exception 'teacher_scope_required';end if;
 select coalesce(jsonb_agg(jsonb_build_object('enrollment_id',e.enrollment_id,'learner_id',e.user_id,'course_id',e.course_id,'course_version',e.course_version,'cohort_id',e.cohort_id,'status',e.status,'completed_modules',(select count(*) from public.vc_university_module_progress p join public.vc_university_module_versions mv using(module_version_id) where p.enrollment_id=e.enrollment_id and mv.course_id=e.course_id and mv.course_version=e.course_version and p.completed_at is not null),'total_modules',(select count(*) from public.vc_university_module_versions m where m.course_id=e.course_id and m.course_version=e.course_version),'cycle_state',(select public.vc_university_cycle_state(c.application_cycle_id) from public.vc_university_application_cycles c where c.enrollment_id=e.enrollment_id limit 1))),'[]') into students from public.vc_university_enrollments e join public.vc_university_teachers t using(cohort_id) where t.user_id=p_actor and (p_cohort is null or e.cohort_id=p_cohort);
 select coalesce(jsonb_agg(item order by priority,submitted_at,submission_id),'[]') into queue from (
 select s.submission_id,s.submitted_at,case when coalesce(c.special_review_required,false) then 0 when s.status='resubmitted' then 1 when s.status='submitted' then 2 when s.status='under_review' then 3 else 4 end priority,
 jsonb_build_object('submission_id',s.submission_id,'enrollment_id',s.enrollment_id,'learner_id',s.learner_id,'cohort_id',e.cohort_id,'course_id',s.course_id,'course_version',s.course_version,'evidence_key',d.evidence_key,'status',s.status,'current_revision',s.current_revision,'submitted_at',s.submitted_at,'special_review_required',coalesce(c.special_review_required,false),'revision_deadline',c.revision_deadline) item
 from public.vc_university_evidence_submissions s join public.vc_university_enrollments e using(enrollment_id) join public.vc_university_evidence_definition_versions v using(evidence_definition_version_id) join public.vc_university_evidence_definitions d using(evidence_definition_id) left join public.vc_university_application_cycles c on c.evidence_submission_id=s.submission_id
 where vc_private.vc_university_teacher_can_review(p_actor,s.submission_id) and (p_cohort is null or e.cohort_id=p_cohort)) items;
 return jsonb_build_object('cohorts',cohorts,'students',students,'queue',queue,'privacy','metadata_only; exact selected submissions use the authorized evidence queue');
end $$;
create function public.vc_university_teacher_revision(p_actor uuid,p_submission uuid,p_revision uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;begin
 if not vc_private.vc_university_teacher_can_review(p_actor,p_submission) then raise exception 'evidence_review_denied';end if;
 select jsonb_build_object('revision_id',r.evidence_revision_id,'revision',r.revision,'structured_data',r.structured_data,'created_at',r.created_at,'reviews',(select coalesce(jsonb_agg(jsonb_build_object('decision',v.decision,'criterion_points',v.criterion_points,'total_points',v.total_points,'structured_feedback',v.structured_feedback,'feedback',v.feedback,'created_at',v.created_at) order by v.created_at),'[]') from public.vc_university_evidence_reviews v where v.evidence_revision_id=r.evidence_revision_id)) into result from public.vc_university_evidence_revisions r where r.submission_id=p_submission and r.evidence_revision_id=p_revision;
 if result is null then raise exception 'review_revision_stale';end if;return result;
end $$;
create function public.vc_university_certification_eligibility(p_actor uuid,p_enrollment uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare e public.vc_university_enrollments%rowtype;v public.vc_university_course_versions%rowtype;m record;r record;d record;missing jsonb:='[]';count_modules integer;expected integer;proof boolean;project boolean;
begin
 select * into e from public.vc_university_enrollments where enrollment_id=p_enrollment;
 if e.enrollment_id is null or not (e.user_id=p_actor or public.vc_university_governance_owner(p_actor) or exists(select 1 from public.vc_university_teachers where cohort_id=e.cohort_id and user_id=p_actor)) then raise exception 'academic_scope_denied';end if;
 select * into v from public.vc_university_course_versions where course_id=e.course_id and version=e.course_version;
 if v.content_model<>'structured_blocks' then return jsonb_build_object('supported',false,'eligible',false,'issuanceEnabled',false,'reason','legacy_certificate_engine_preserved');end if;
 if e.status not in('active','completed') then missing:=missing||jsonb_build_array(jsonb_build_object('code','enrollment_inactive'));end if;
 if v.status<>'published' then missing:=missing||jsonb_build_array(jsonb_build_object('code','course_version_not_published'));end if;
 select count(*) into count_modules from public.vc_university_module_versions where course_id=e.course_id and course_version=e.course_version and status='published';
 expected:=case when e.course_id='inteligencia-emocional-aplicada' then 10 else count_modules end;
 if count_modules<>expected or expected=0 then missing:=missing||jsonb_build_array(jsonb_build_object('code','module_configuration_incomplete','expected',expected,'published',count_modules));end if;
 for m in select * from public.vc_university_module_versions where course_id=e.course_id and course_version=e.course_version and status='published' loop
  if not exists(select 1 from public.vc_university_module_progress p where p.enrollment_id=e.enrollment_id and p.module_version_id=m.module_version_id and p.completed_at is not null) then missing:=missing||jsonb_build_array(jsonb_build_object('code','module_incomplete','module',m.module_no));end if;
  if not exists(select 1 from public.vc_university_checkpoint_attempts a where a.enrollment_id=e.enrollment_id and a.module_version_id=m.module_version_id and a.passed) then missing:=missing||jsonb_build_array(jsonb_build_object('code','checkpoint_pending','module',m.module_no));end if;
  for r in select * from public.vc_university_module_requirements where module_version_id=m.module_version_id and status='published' and required loop
   if not exists(select 1 from public.vc_university_requirement_progress p where p.enrollment_id=e.enrollment_id and p.requirement_id=r.requirement_id and p.status='completed' and p.satisfied_at is not null) then missing:=missing||jsonb_build_array(jsonb_build_object('code','requirement_pending','requirement_id',r.requirement_id,'type',r.requirement_type,'module',m.module_no));end if;
  end loop;
 end loop;
 if e.course_id='inteligencia-emocional-aplicada' then
  for i in 1..9 loop
   select dv.* into d from public.vc_university_evidence_definition_versions dv join public.vc_university_evidence_definitions def using(evidence_definition_id) where dv.course_id=e.course_id and dv.course_version=e.course_version and dv.status='published' and def.evidence_key='e'||lpad(i::text,2,'0') order by dv.revision desc limit 1;
   if not found then missing:=missing||jsonb_build_array(jsonb_build_object('code','evidence_definition_pending','evidence','E'||lpad(i::text,2,'0')));
   elsif not exists(select 1 from public.vc_university_evidence_submissions s join public.vc_university_evidence_revisions er on er.submission_id=s.submission_id and er.revision=s.current_revision where s.enrollment_id=e.enrollment_id and s.evidence_definition_version_id=d.evidence_definition_version_id and s.status<>'draft' and ((d.validation_policy->>'sufficiency'='on_submission') or (s.status='approved' and exists(select 1 from public.vc_university_evidence_reviews rv where rv.evidence_revision_id=er.evidence_revision_id and rv.decision='approved')))) then missing:=missing||jsonb_build_array(jsonb_build_object('code','evidence_pending','evidence','E'||lpad(i::text,2,'0')));end if;
  end loop;
 end if;
 proof:=exists(select 1 from public.vc_university_requirement_progress p join public.vc_university_module_requirements mr using(requirement_id) where p.enrollment_id=e.enrollment_id and mr.course_id=e.course_id and mr.course_version=e.course_version and mr.status='published' and mr.requirement_type='final_assessment_passed' and p.status='completed' and p.satisfied_at is not null)
 and exists(select 1 from public.vc_university_final_attempts a join public.vc_university_final_sessions s using(session_id) where a.enrollment_id=e.enrollment_id and a.course_id=e.course_id and a.course_version=e.course_version and a.passed and a.score*100>=a.question_count*v.final_pass_percent and s.assessment_purpose='final' and s.submitted_at is not null);
 project:=exists(select 1 from public.vc_university_requirement_progress p join public.vc_university_module_requirements mr using(requirement_id) join public.vc_university_evidence_revisions er on er.evidence_revision_id::text=p.source_id join public.vc_university_evidence_submissions es on es.submission_id=er.submission_id and er.revision=es.current_revision join public.vc_university_evidence_reviews rv on rv.evidence_revision_id=er.evidence_revision_id where p.enrollment_id=e.enrollment_id and es.enrollment_id=e.enrollment_id and mr.course_id=e.course_id and mr.course_version=e.course_version and mr.status='published' and mr.requirement_type='final_project_approved' and p.status='completed' and p.satisfied_at is not null and es.status='approved' and es.approved_at is not null and rv.decision='approved' and rv.reviewer_id<>e.user_id and rv.total_points>=70 and rv.criterion_points is not null);
 if not proof then missing:=missing||jsonb_build_array(jsonb_build_object('code','final_assessment_pending'));end if;
 if (e.course_id='inteligencia-emocional-aplicada' or v.certificate_requires_project_review) and not project then missing:=missing||jsonb_build_array(jsonb_build_object('code','human_final_project_pending'));end if;
 return jsonb_build_object('supported',true,'enrollment_id',e.enrollment_id,'course_id',e.course_id,'course_version',e.course_version,'eligible',jsonb_array_length(missing)=0,'issuanceEnabled',false,'missing',missing,'gates',jsonb_build_object('final_assessment_passed',proof,'final_project_approved',project),'privacy','academic_metadata_only');
end $$;
create function public.vc_university_teacher_assignment(p_actor uuid,p_cohort uuid,p_teacher uuid,p_action text,p_editor boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not public.vc_university_governance_owner(p_actor) then raise exception 'owner_required';end if;
 if not exists(select 1 from public.vc_university_cohorts where cohort_id=p_cohort) or not exists(select 1 from auth.users where id=p_teacher and email_confirmed_at is not null) or p_action not in('assign','remove') then raise exception 'assignment_invalid';end if;
 if p_action='remove' then delete from public.vc_university_teachers where cohort_id=p_cohort and user_id=p_teacher;
 else insert into public.vc_university_teachers(cohort_id,user_id,can_edit_academic) values(p_cohort,p_teacher,p_editor) on conflict(cohort_id,user_id) do update set can_edit_academic=excluded.can_edit_academic;end if;
 insert into public.vc_university_academic_audit_log(actor_id,action,entity_type,entity_id,after_state) values(p_actor,'teacher_assignment_'||p_action,'cohort',p_cohort::text,jsonb_build_object('teacher_id',p_teacher,'editor',p_editor));
 return jsonb_build_object('updated',true);
end $$;
revoke all on function public.vc_university_governance_owner(uuid) from public,anon,authenticated;
grant execute on function public.vc_university_governance_owner(uuid) to service_role;
revoke all on function public.vc_university_editor_can(uuid,text) from public,anon,authenticated;
grant execute on function public.vc_university_editor_can(uuid,text) to service_role;
revoke all on function public.vc_university_academic_materials(text) from public,anon,authenticated;
grant execute on function public.vc_university_academic_materials(text) to service_role;
revoke all on function public.vc_university_editorial_publish_guard() from public,anon,authenticated;
grant execute on function public.vc_university_editorial_publish_guard() to service_role;
revoke all on function public.vc_university_editorial_decide(uuid,text,text,text,integer,uuid,text,jsonb,uuid[]) from public,anon,authenticated;
grant execute on function public.vc_university_editorial_decide(uuid,text,text,text,integer,uuid,text,jsonb,uuid[]) to service_role;
revoke all on function public.vc_university_teacher_operations(uuid,uuid) from public,anon,authenticated;
grant execute on function public.vc_university_teacher_operations(uuid,uuid) to service_role;
revoke all on function public.vc_university_teacher_revision(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.vc_university_teacher_revision(uuid,uuid,uuid) to service_role;
revoke all on function public.vc_university_certification_eligibility(uuid,uuid) from public,anon,authenticated;
grant execute on function public.vc_university_certification_eligibility(uuid,uuid) to service_role;
revoke all on function public.vc_university_teacher_assignment(uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.vc_university_teacher_assignment(uuid,uuid,uuid,text,boolean) to service_role;
create function public.vc_university_governance_read(p_actor uuid,p_course text default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare materials jsonb;cohorts jsonb;assignments jsonb;history jsonb;owner boolean:=public.vc_university_governance_owner(p_actor);
begin
 if not owner and not exists(select 1 from public.vc_university_teachers where user_id=p_actor and can_edit_academic) then raise exception 'editorial_scope_denied';end if;
 if p_course is not null and not public.vc_university_editor_can(p_actor,p_course) then raise exception 'editorial_scope_denied';end if;
 select coalesce(jsonb_agg(m.value||jsonb_build_object('editorial',to_jsonb(r)) order by m.value->>'course_id',m.value->>'course_version',m.value->>'kind',m.value->>'title'),'[]') into materials from public.vc_university_academic_materials(p_course) m(value) left join public.vc_university_editorial_reviews r on r.material_kind=m.value->>'kind' and r.material_id=m.value->>'id' where (owner or public.vc_university_editor_can(p_actor,m.value->>'course_id') or m.value->>'kind'='source');
 select coalesce(jsonb_agg(jsonb_build_object('cohort_id',c.cohort_id,'course_id',c.course_id,'label',c.label,'status',c.status)),'[]') into cohorts from public.vc_university_cohorts c where owner and (p_course is null or c.course_id=p_course);
 select coalesce(jsonb_agg(jsonb_build_object('cohort_id',t.cohort_id,'teacher_id',t.user_id,'can_edit_academic',t.can_edit_academic)),'[]') into assignments from public.vc_university_teachers t join public.vc_university_cohorts c using(cohort_id) where owner and (p_course is null or c.course_id=p_course);
 select coalesce(jsonb_agg(jsonb_build_object('actor_id',a.actor_id,'material',a.entity_id,'before',a.before_state,'after',a.after_state,'note',a.reason,'at',a.occurred_at) order by a.occurred_at desc,a.audit_id desc),'[]') into history from public.vc_university_academic_audit_log a where a.entity_type='editorial_material' and exists(select 1 from jsonb_array_elements(materials) m where a.entity_id=m->>'kind'||':'||(m->>'id'));
 return jsonb_build_object('role',case when owner then 'owner' else 'editor' end,'actor_id',p_actor,'materials',materials,'cohorts',cohorts,'assignments',assignments,'history',history,'health',jsonb_build_object('database','available','materials',jsonb_array_length(materials),'ie_issuance','disabled','integrations','not_probed'),'privacy','no_student_narratives');
end $$;
create function public.vc_university_material_draft_save(p_actor uuid,p_kind text,p_id text,p_expected integer,p_patch jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare m jsonb;review public.vc_university_editorial_reviews%rowtype;table_name text;key_name text;allowed text[];fields text;combined jsonb;
begin
 perform pg_advisory_xact_lock(hashtext('editorial:'||p_kind||':'||p_id));
 select value into m from public.vc_university_academic_materials() value where value->>'kind'=p_kind and value->>'id'=p_id;
 if m is null then raise exception 'material_not_found';end if;
 if not public.vc_university_editor_can(p_actor,m->>'course_id') then raise exception 'editorial_scope_denied';end if;
 if m->>'status' not in('draft','review') then raise exception 'published_material_immutable';end if;
 select * into review from public.vc_university_editorial_reviews where material_kind=p_kind and material_id=p_id;
 if coalesce(review.revision,0)<>p_expected then raise exception 'editorial_revision_conflict';end if;
 if jsonb_typeof(p_patch) is distinct from 'object' or p_patch='{}'::jsonb or octet_length(p_patch::text)>65536 then raise exception 'draft_patch_invalid';end if;
 table_name:=case p_kind when 'course' then 'course_versions' when 'module' then 'module_versions' when 'lesson' then 'lesson_versions' when 'block' then 'content_blocks' when 'question' then 'questions' when 'evidence' then 'evidence_definition_versions' when 'cycle' then 'application_cycle_versions' when 'requirement' then 'module_requirements' when 'tool' then 'learning_tool_versions' when 'source' then 'sources' end;
 key_name:=case p_kind when 'module' then 'module_version_id' when 'lesson' then 'lesson_version_id' when 'block' then 'content_block_id' when 'question' then 'question_id' when 'evidence' then 'evidence_definition_version_id' when 'cycle' then 'cycle_version_id' when 'requirement' then 'requirement_id' when 'tool' then 'learning_tool_version_id' when 'source' then 'source_id' end;
 allowed:=case p_kind when 'course' then array['title_snapshot','description_snapshot','audience_snapshot'] when 'module' then array['title','estimated_minutes'] when 'lesson' then array['title','learning_objectives','estimated_minutes'] when 'block' then array['content','block_type'] when 'question' then array['prompt','correct_feedback','review_concept','editorial_gap'] when 'evidence' then array['title','prompt','form_schema'] when 'cycle' then array['configuration'] when 'requirement' then array['configuration','required','position'] when 'tool' then array['instructions'] when 'source' then array['title','authors','citation','url','doi','publication_year','editorial_classification'] end;
 if table_name is null or exists(select 1 from jsonb_object_keys(p_patch) k where not k=any(allowed)) then raise exception 'draft_patch_invalid';end if;
 select string_agg(format('%I',k),',' order by k) into fields from jsonb_object_keys(p_patch) k;
 combined:=(m->'payload')||p_patch;
 if p_kind='course' then execute format('update public.vc_university_course_versions set (%s)=(select %s from jsonb_populate_record(null::public.vc_university_course_versions,$1)) where course_id=$2 and version=$3',fields,fields) using combined,m->>'course_id',m->>'course_version';
 else execute format('update public.vc_university_%I set (%s)=(select %s from jsonb_populate_record(null::public.vc_university_%I,$1)) where %I::text=$2',table_name,fields,fields,table_name,key_name) using combined,p_id;end if;
 return public.vc_university_editorial_decide(p_actor,p_kind,p_id,'draft',p_expected,coalesce(review.author_id,p_actor),'Edição de rascunho; nova revisão editorial obrigatória.',coalesce(review.gaps,'[]'),coalesce(review.source_ids,'{}'));
end $$;
revoke all on function public.vc_university_governance_read(uuid,text),public.vc_university_material_draft_save(uuid,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.vc_university_governance_read(uuid,text),public.vc_university_material_draft_save(uuid,text,text,integer,jsonb) to service_role;
