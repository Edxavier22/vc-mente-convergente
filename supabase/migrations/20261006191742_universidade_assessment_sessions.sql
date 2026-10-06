-- Reuse the final-session model for immutable checkpoint and final snapshots.
alter table public.vc_university_questions
 add column editorial_id text,
 add column module_version_id uuid references public.vc_university_module_versions(module_version_id),
 add column movement text,
 add column editorial_gap text,
 alter column correct_index drop not null;
alter table public.vc_university_questions alter constraint vc_university_questions_correct_option_fkey deferrable initially deferred;
create unique index university_question_editorial_version_idx on public.vc_university_questions(course_id,course_version,editorial_id,question_version) where editorial_id is not null;
create unique index university_question_published_editorial_idx on public.vc_university_questions(course_id,course_version,editorial_id) where editorial_id is not null and status='published';
create index university_question_module_version_idx on public.vc_university_questions(module_version_id);
alter table public.vc_university_final_sessions
 drop constraint vc_university_final_sessions_question_ids_check,
 drop constraint vc_university_final_sessions_course_id_course_version_fkey,
 add foreign key(course_id,course_version) references public.vc_university_course_versions(course_id,version),
 add column assessment_purpose text not null default 'final' check(assessment_purpose in('checkpoint','final')),
 add column module_version_id uuid references public.vc_university_module_versions(module_version_id),
 add column question_snapshot jsonb not null default '[]',
 add column result jsonb,
 add column submitted_answers jsonb,
 add check(cardinality(question_ids)=case when assessment_purpose='checkpoint' then 5 else 20 end),
 add check(assessment_purpose='final' or module_version_id is not null);
create index university_session_module_idx on public.vc_university_final_sessions(module_version_id);
alter table public.vc_university_checkpoint_attempts add column session_id uuid references public.vc_university_final_sessions(session_id);
create unique index university_checkpoint_session_idx on public.vc_university_checkpoint_attempts(session_id) where session_id is not null;
alter table public.vc_university_final_attempts
 drop constraint vc_university_final_attempts_content_version_fkey,
 add foreign key(course_id,course_version) references public.vc_university_course_versions(course_id,version),
 add column question_snapshot jsonb not null default '[]',
 add column answers jsonb not null default '[]',
 add column feedback jsonb not null default '[]',
 add column score_percent numeric,
 add column passed boolean,
 add column attempt_no integer;
-- Old learner grants must not expose newly added private answer-key snapshots.
revoke select on public.vc_university_final_attempts from authenticated;
grant select(attempt_id,enrollment_id,course_id,course_version,session_id,score,question_count,review_concepts,submitted_at,score_percent,passed,attempt_no) on public.vc_university_final_attempts to authenticated;

create function public.vc_university_question_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare q public.vc_university_questions%rowtype;
begin
 if tg_table_name='vc_university_question_options' then
  select * into q from public.vc_university_questions where question_id=coalesce(new.question_id,old.question_id);
  if q.editorial_id is not null and (q.status in('published','archived') or exists(select 1 from public.vc_university_final_sessions where q.question_id=any(question_ids))) then raise exception 'published_question_immutable';end if;
  if tg_op='UPDATE' and new.question_id<>old.question_id then raise exception 'question_option_reparent_denied';end if;
 else
  if tg_op<>'INSERT' and old.editorial_id is not null and (old.status in('published','archived') or exists(select 1 from public.vc_university_final_sessions where old.question_id=any(question_ids))) then
   if tg_op='DELETE' or (to_jsonb(new)-'status'-'active')<>(to_jsonb(old)-'status'-'active') or not(old.status='published' and new.status='archived' and new.active=false) then raise exception 'published_question_immutable';end if;
  end if;
  if tg_op<>'DELETE' and new.editorial_id is not null then
   if not exists(select 1 from public.vc_university_course_competencies where course_id=new.course_id and course_version=new.course_version and competency_id=new.competency_id) or new.difficulty not in('N1','N2','N3') then raise exception 'question_metadata_invalid';end if;
   if new.purpose='checkpoint' and not exists(select 1 from public.vc_university_module_versions where module_version_id=new.module_version_id and course_id=new.course_id and course_version=new.course_version and module_no=new.module_no) then raise exception 'question_module_context_invalid';end if;
   if new.active<>(new.status='published') then raise exception 'question_publication_state_invalid';end if;
   if new.status='published' and ((select count(*) from public.vc_university_question_options where question_id=new.question_id)<>4 or (select count(*) from public.vc_university_question_options where question_id=new.question_id and is_correct and option_id=new.correct_option_id)<>1 or exists(select 1 from public.vc_university_question_options where question_id=new.question_id and length(trim(coalesce(feedback,'')))<10) or not exists(select 1 from public.vc_university_source_links where question_id=new.question_id)) then raise exception 'question_editorial_incomplete';end if;
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger university_question_guard before insert or update or delete on public.vc_university_questions for each row execute function public.vc_university_question_guard();
create trigger university_option_guard before insert or update or delete on public.vc_university_question_options for each row execute function public.vc_university_question_guard();
revoke all on function public.vc_university_question_guard() from public,anon,authenticated;

create function public.vc_university_question_audit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.editorial_id is not null then
 insert into public.vc_university_academic_audit_log(actor_id,action,entity_type,entity_id,after_state)
 values(auth.uid(),case when tg_op='INSERT' then 'question_version_created' when new.status='published' and old.status<>new.status then 'question_published' when new.status='archived' and old.status<>new.status then 'question_archived' else 'question_editorial_corrected' end,'question',new.question_id::text,jsonb_build_object('editorial_id',new.editorial_id,'version',new.question_version,'status',new.status));
 end if;return new;
end $$;
create trigger university_question_audit after insert or update on public.vc_university_questions for each row execute function public.vc_university_question_audit();
revoke all on function public.vc_university_question_audit() from public,anon,authenticated;

create function public.vc_university_assessment_public_snapshot(p_snapshot jsonb) returns jsonb language sql immutable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('question_id',q->>'question_id','editorial_id',q->>'editorial_id','question_version',q->'question_version','prompt',q->>'prompt','options',(select jsonb_agg(jsonb_build_object('id',o->>'option_id','text',o->>'option_text')) from jsonb_array_elements(q->'options') o))),'[]') from jsonb_array_elements(p_snapshot) q;
$$;
revoke all on function public.vc_university_assessment_public_snapshot(jsonb) from public,anon,authenticated;
grant execute on function public.vc_university_assessment_public_snapshot(jsonb) to service_role;

create function public.vc_university_assessment_context(p_actor uuid,p_enrollment uuid,p_purpose text,p_module integer) returns uuid language plpgsql security invoker set search_path='' as $$
declare e public.vc_university_enrollments%rowtype;mv uuid;
begin
 select * into e from public.vc_university_enrollments where enrollment_id=p_enrollment and user_id=p_actor and status in('active','completed') for update;
 if e.enrollment_id is null or not exists(select 1 from public.vc_university_course_versions where course_id=e.course_id and version=e.course_version and content_model='structured_blocks' and status='published') then raise exception 'assessment_context_denied';end if;
 if p_purpose='final' then
  if (select count(*) from public.vc_university_module_versions where course_id=e.course_id and course_version=e.course_version and status='published')<>10 or exists(select 1 from public.vc_university_module_versions m where m.course_id=e.course_id and m.course_version=e.course_version and m.status='published' and not exists(select 1 from public.vc_university_module_progress where enrollment_id=p_enrollment and module_version_id=m.module_version_id and completed_at is not null)) then raise exception 'modules_required';end if;
 elsif p_purpose='checkpoint' then
  select module_version_id into mv from public.vc_university_module_versions where course_id=e.course_id and course_version=e.course_version and module_no=p_module and status='published';
  if mv is null or exists(select 1 from public.vc_university_module_dependencies d where d.module_version_id=mv and d.status='published' and not exists(select 1 from public.vc_university_module_progress where enrollment_id=p_enrollment and module_version_id=d.depends_on_module_version_id and completed_at is not null)) then raise exception 'module_locked';end if;
 else raise exception 'assessment_purpose_invalid';end if;return mv;
end $$;
revoke all on function public.vc_university_assessment_context(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.vc_university_assessment_context(uuid,uuid,text,integer) to service_role;

create function public.vc_university_assessment_begin(p_actor uuid,p_enrollment uuid,p_purpose text,p_module integer default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.vc_university_enrollments%rowtype;mv uuid;s public.vc_university_final_sessions%rowtype;snap jsonb;ids uuid[];q record;opts jsonb;expected integer;percent numeric;
begin
 mv:=public.vc_university_assessment_context(p_actor,p_enrollment,p_purpose,p_module);
 select * into e from public.vc_university_enrollments where enrollment_id=p_enrollment;
 expected:=case when p_purpose='checkpoint' then 5 else 20 end;
 if p_purpose='checkpoint' then
  select (configuration->>'pass_percent')::numeric into percent from public.vc_university_module_requirements where module_version_id=mv and requirement_type='checkpoint_passed' and status='published';
 else select final_pass_percent into percent from public.vc_university_course_versions where course_id=e.course_id and version=e.course_version;end if;
 if percent is null or percent not between 1 and 100 then raise exception 'assessment_config_unavailable';end if;
 select * into s from public.vc_university_final_sessions where enrollment_id=p_enrollment and course_version=e.course_version and assessment_purpose=p_purpose and module_version_id is not distinct from mv and submitted_at is null and expires_at>now() and jsonb_array_length(question_snapshot)=expected order by started_at desc limit 1;
 if s.session_id is null then
  if (select count(*) from public.vc_university_questions where course_id=e.course_id and course_version=e.course_version and purpose=p_purpose and status='published' and active and module_version_id is not distinct from mv)<>expected then raise exception 'assessment_bank_unavailable';end if;
  snap:='[]';ids:='{}';
  for q in select q.*,c.code competency from public.vc_university_questions q join public.vc_university_competencies c using(competency_id) where q.course_id=e.course_id and q.course_version=e.course_version and q.purpose=p_purpose and q.status='published' and q.active and q.module_version_id is not distinct from mv order by random() loop
   select jsonb_agg(x) into opts from(select jsonb_build_object('option_id',option_id,'option_text',option_text,'feedback',feedback) x from public.vc_university_question_options where question_id=q.question_id order by random())o;
   if jsonb_array_length(opts)<>4 then raise exception 'assessment_bank_unavailable';end if;
   snap:=snap||jsonb_build_array(jsonb_build_object('question_id',q.question_id,'editorial_id',q.editorial_id,'question_key',q.question_key,'question_version',q.question_version,'prompt',q.prompt,'correct_option_id',q.correct_option_id,'correct_feedback',q.correct_feedback,'options',opts,'competency',q.competency,'difficulty',q.difficulty,'review_concept',q.review_concept,'pass_percent',percent));
   ids:=array_append(ids,q.question_id);
  end loop;
  insert into public.vc_university_final_sessions(enrollment_id,course_id,course_version,question_ids,assessment_purpose,module_version_id,question_snapshot,expires_at) values(p_enrollment,e.course_id,e.course_version,ids,p_purpose,mv,snap,now()+interval '24 hours') returning * into s;
 end if;
 -- Policy is frozen with the instrument, including a harmless resume expiry.
 percent:=(s.question_snapshot->0->>'pass_percent')::numeric;
 return jsonb_build_object('sessionId',s.session_id,'expiresAt',s.expires_at,'minimum',ceil(expected*percent/100),'passPercent',percent,'questions',public.vc_university_assessment_public_snapshot(s.question_snapshot));
end $$;
revoke all on function public.vc_university_assessment_begin(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.vc_university_assessment_begin(uuid,uuid,text,integer) to service_role;

create function public.vc_university_assessment_submit(p_actor uuid,p_enrollment uuid,p_session uuid,p_answers jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.vc_university_final_sessions%rowtype;e public.vc_university_enrollments%rowtype;q jsonb;o jsonb;answer jsonb;idx integer:=0;score integer:=0;expected integer;percent numeric;passed boolean;details jsonb:='[]';review jsonb;attempt uuid;req record;mv uuid;completion jsonb;is_correct boolean;
begin
 select * into e from public.vc_university_enrollments where enrollment_id=p_enrollment and user_id=p_actor and status in('active','completed') for update;
 if e.enrollment_id is null then raise exception 'assessment_context_denied';end if;
 select * into s from public.vc_university_final_sessions where session_id=p_session for update;
 if s.session_id is null or s.enrollment_id<>p_enrollment or s.course_id<>e.course_id or s.course_version<>e.course_version then raise exception 'assessment_session_invalid';end if;
 if s.submitted_at is not null then if s.submitted_answers=p_answers then return s.result;else raise exception 'idempotency_payload_conflict';end if;end if;
 if s.expires_at<=now() or jsonb_array_length(s.question_snapshot)=0 then raise exception 'assessment_session_invalid';end if;
 select module_no into idx from public.vc_university_module_versions where module_version_id=s.module_version_id;
 mv:=public.vc_university_assessment_context(p_actor,p_enrollment,s.assessment_purpose,idx);idx:=0;
 expected:=jsonb_array_length(s.question_snapshot);
 if jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers)<>expected then raise exception 'answers_invalid';end if;
 if s.assessment_purpose='checkpoint' and exists(select 1 from public.vc_university_module_requirements r where r.module_version_id=mv and r.status='published' and r.required and r.requirement_type='evidence_completed' and not exists(select 1 from public.vc_university_requirement_progress where enrollment_id=p_enrollment and requirement_id=r.requirement_id and status='completed' and satisfied_at is not null)) then raise exception 'evidence_required';end if;
 for q in select value from jsonb_array_elements(s.question_snapshot) loop
  answer:=p_answers->idx;
  if jsonb_typeof(answer) is distinct from 'object' or answer->>'question_id' is distinct from q->>'question_id' or (select count(*) from jsonb_object_keys(answer))<>2 then raise exception 'answers_invalid';end if;
  select value into o from jsonb_array_elements(q->'options') where value->>'option_id'=answer->>'selected_option_id';
  if o is null then raise exception 'answers_invalid';end if;
  is_correct:=o->>'option_id'=q->>'correct_option_id';
  if is_correct then score:=score+1;end if;
  details:=details||jsonb_build_array(jsonb_build_object('questionId',q->>'question_id','correct',is_correct,'message',case when is_correct then q->>'correct_feedback' else o->>'feedback' end,'competency',q->>'competency','concept',q->>'review_concept'));
  idx:=idx+1;
 end loop;
 percent:=score::numeric*100/expected;passed:=score*100 >= expected*(s.question_snapshot->0->>'pass_percent')::numeric;
 select coalesce(jsonb_agg(distinct to_jsonb(value->>'concept')),'[]') into review from jsonb_array_elements(details) where not(value->>'correct')::boolean;
 if s.assessment_purpose='checkpoint' then
  insert into public.vc_university_checkpoint_attempts(enrollment_id,course_id,module_no,score,question_count,review_concepts,session_id,question_snapshot,answers,feedback)
  select p_enrollment,e.course_id,module_no,score,expected,review,p_session,s.question_snapshot,p_answers,details from public.vc_university_module_versions where module_version_id=mv returning attempt_id into attempt;
  if passed then
   for req in select requirement_id from public.vc_university_module_requirements where module_version_id=mv and requirement_type='checkpoint_passed' and status='published' loop
    insert into public.vc_university_requirement_progress(enrollment_id,requirement_id,status,source_type,source_id,satisfied_at) values(p_enrollment,req.requirement_id,'completed','checkpoint_attempt',attempt::text,now()) on conflict(enrollment_id,requirement_id) do update set status='completed',source_type=excluded.source_type,source_id=excluded.source_id,satisfied_at=excluded.satisfied_at;
   end loop;
   insert into public.vc_university_module_progress(enrollment_id,course_id,module_no,module_version_id,status,started_at,checkpoint_passed_at) select p_enrollment,e.course_id,module_no,mv,'requirements_pending',now(),now() from public.vc_university_module_versions where module_version_id=mv on conflict(enrollment_id,module_no) do update set checkpoint_passed_at=excluded.checkpoint_passed_at;
   completion:=public.vc_university_complete_module_if_ready(p_enrollment,mv);
  end if;
 else
  insert into public.vc_university_final_attempts(enrollment_id,course_id,course_version,session_id,score,question_count,review_concepts,question_snapshot,answers,feedback,score_percent,passed,attempt_no) values(p_enrollment,e.course_id,e.course_version,p_session,score,expected,review,s.question_snapshot,p_answers,details,percent,passed,coalesce((select max(attempt_no)+1 from public.vc_university_final_attempts where enrollment_id=p_enrollment and course_version=e.course_version),1)) returning attempt_id into attempt;
  if passed then
   for req in select requirement_id from public.vc_university_module_requirements where course_id=e.course_id and course_version=e.course_version and requirement_type='final_assessment_passed' and status='published' loop
    insert into public.vc_university_requirement_progress(enrollment_id,requirement_id,status,source_type,source_id,satisfied_at) values(p_enrollment,req.requirement_id,'completed','final_attempt',attempt::text,now()) on conflict(enrollment_id,requirement_id) do update set status='completed',source_type=excluded.source_type,source_id=excluded.source_id,satisfied_at=excluded.satisfied_at;
   end loop;
  end if;
 end if;
 s.result:=jsonb_build_object('attemptId',attempt,'score',score,'total',expected,'scorePercent',percent,'passed',passed,'review',review,'feedback',details,'retryAllowed',true,'guidance',case when passed then 'Desempenho acadêmico aprovado neste instrumento.' else 'Revise os conceitos indicados e faça uma nova tentativa.' end);
 update public.vc_university_final_sessions set submitted_at=now(),result=s.result,submitted_answers=p_answers where session_id=p_session;
 insert into public.vc_university_academic_audit_log(actor_id,action,entity_type,entity_id,after_state) values(p_actor,'assessment_submitted','assessment_session',p_session::text,jsonb_build_object('purpose',s.assessment_purpose,'score',score,'total',expected,'passed',passed));
 return s.result;
end $$;
revoke all on function public.vc_university_assessment_submit(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.vc_university_assessment_submit(uuid,uuid,uuid,jsonb) to service_role;

create function public.vc_university_assessment_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_table_name='vc_university_final_sessions' then
  if jsonb_array_length(old.question_snapshot)>0 and (tg_op='DELETE' or old.submitted_at is not null or (to_jsonb(new)-'submitted_at'-'result'-'submitted_answers')<>(to_jsonb(old)-'submitted_at'-'result'-'submitted_answers')) then raise exception 'assessment_history_immutable';end if;
 else
  if old.session_id is not null and exists(select 1 from public.vc_university_final_sessions where session_id=old.session_id and jsonb_array_length(question_snapshot)>0) then raise exception 'assessment_history_immutable';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger university_session_immutable before update or delete on public.vc_university_final_sessions for each row execute function public.vc_university_assessment_immutable();
create trigger university_final_attempt_immutable before update or delete on public.vc_university_final_attempts for each row execute function public.vc_university_assessment_immutable();
create trigger university_checkpoint_attempt_immutable before update or delete on public.vc_university_checkpoint_attempts for each row execute function public.vc_university_assessment_immutable();
revoke all on function public.vc_university_assessment_immutable() from public,anon,authenticated;
comment on column public.vc_university_final_sessions.question_snapshot is 'Private immutable instrument, options in presented order, historical key/policy. Never return this column to a learner.';
