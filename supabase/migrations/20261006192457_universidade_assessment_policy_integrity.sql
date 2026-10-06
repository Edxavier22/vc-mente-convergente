create or replace function public.vc_university_question_guard() returns trigger language plpgsql security invoker set search_path='' as $$
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
   if new.difficulty is null or new.competency_id is null or length(trim(new.editorial_id))<3 then raise exception 'question_metadata_invalid';end if;
   if tg_op='INSERT' then
    if new.question_version<>coalesce((select max(question_version)+1 from public.vc_university_questions where course_id=new.course_id and course_version=new.course_version and editorial_id=new.editorial_id),1) or exists(select 1 from public.vc_university_questions where course_id=new.course_id and course_version=new.course_version and editorial_id=new.editorial_id and question_key<>new.question_key) then raise exception 'question_version_sequence_invalid';end if;
   elsif new.question_key<>old.question_key or new.editorial_id<>old.editorial_id or new.question_version<>old.question_version or new.course_id<>old.course_id or new.course_version<>old.course_version then raise exception 'question_identity_immutable';end if;
   if not exists(select 1 from public.vc_university_course_competencies where course_id=new.course_id and course_version=new.course_version and competency_id=new.competency_id) or new.difficulty not in('N1','N2','N3') then raise exception 'question_metadata_invalid';end if;
   if new.purpose='checkpoint' and not exists(select 1 from public.vc_university_module_versions where module_version_id=new.module_version_id and course_id=new.course_id and course_version=new.course_version and module_no=new.module_no) then raise exception 'question_module_context_invalid';end if;
   if new.active<>(new.status='published') then raise exception 'question_publication_state_invalid';end if;
   if new.status='published' and ((select count(*) from public.vc_university_question_options where question_id=new.question_id)<>4 or (select count(*) from public.vc_university_question_options where question_id=new.question_id and is_correct and option_id=new.correct_option_id)<>1 or exists(select 1 from public.vc_university_question_options where question_id=new.question_id and length(trim(coalesce(feedback,'')))<10) or not exists(select 1 from public.vc_university_source_links where question_id=new.question_id)) then raise exception 'question_editorial_incomplete';end if;
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create or replace function public.vc_university_prepare_checkpoint_attempt()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
 v_minimum integer;
begin
 perform pg_advisory_xact_lock(hashtext(new.enrollment_id::text||':'||new.module_no::text));
 select e.course_version,mv.module_version_id,mv.checkpoint_pass_count
 into new.course_version,new.module_version_id,v_minimum
 from public.vc_university_enrollments e
 join public.vc_university_module_versions mv
  on mv.course_id=e.course_id and mv.course_version=e.course_version
  and mv.module_no=new.module_no
 where e.enrollment_id=new.enrollment_id and e.course_id=new.course_id;
 if new.module_version_id is null then raise exception 'attempt_version_context_required'; end if;
 new.attempt_no:=coalesce(new.attempt_no,(
  select max(existing.attempt_no)+1
  from public.vc_university_checkpoint_attempts existing
  where existing.enrollment_id=new.enrollment_id
   and existing.module_version_id=new.module_version_id
 ),1);
 new.score_percent:=new.score::numeric*100/new.question_count;
 new.passed:=new.score>=v_minimum;
 if new.session_id is not null then
  select new.score*100 >= new.question_count*(question_snapshot->0->>'pass_percent')::numeric into new.passed from public.vc_university_final_sessions where session_id=new.session_id and enrollment_id=new.enrollment_id and module_version_id=new.module_version_id;
  if new.passed is null then raise exception 'attempt_session_context_invalid';end if;
 end if;
 return new;
end
$$;

revoke all on function public.vc_university_prepare_checkpoint_attempt()
 from public,anon,authenticated;

-- Explicit heuristic classification supplements the didactic course basis.
insert into public.vc_university_sources(title,authors,citation,editorial_classification,status)
values('Heurísticas educacionais V&C — banco IE PR5','V&C Mente Convergente','Regra dos Três, Teste da Câmera, escalas subjetivas e pre-mortem são usados como recursos heurísticos da especificação editorial; não como provas, medidas psicológicas ou técnicas de efeito garantido.','H','draft');
insert into public.vc_university_source_links(source_id,question_id,relationship)
select s.source_id,q.question_id,'contextualizes' from public.vc_university_sources s cross join public.vc_university_questions q where s.title='Heurísticas educacionais V&C — banco IE PR5' and q.course_id='inteligencia-emocional-aplicada' and (q.review_concept ilike '%Regra dos Três%' or q.review_concept ilike '%Teste da Câmera%' or q.review_concept ilike '%certeza%' or q.review_concept ilike '%Semáforo%' or q.review_concept ilike '%pre-mortem%' or q.prompt ilike '%pre-mortem%');
create function public.vc_university_question_annul(p_actor uuid,p_question uuid,p_reason text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from auth.users where id=p_actor and id='70aa4d75-bbb9-4839-aad8-670b7654664d' and email='vcmenteconvergente@gmail.com' and email_confirmed_at is not null) then raise exception 'owner_required';end if;
 if length(trim(coalesce(p_reason,''))) not between 3 and 2000 then raise exception 'editorial_reason_required';end if;
 update public.vc_university_questions set status='archived',active=false where question_id=p_question and editorial_id is not null and status='published';
 if not found then raise exception 'question_annul_context_invalid';end if;
 insert into public.vc_university_academic_audit_log(actor_id,action,entity_type,entity_id,after_state,reason) values(p_actor,'question_annulled','question',p_question::text,'{"status":"archived","historical_scores_unchanged":true}',p_reason);
end $$;
revoke all on function public.vc_university_question_annul(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.vc_university_question_annul(uuid,uuid,text) to service_role;
-- Annulment excludes future selection; human historical score remediation is a
-- separate explicit future policy, never a silent mutation of stored attempts.
