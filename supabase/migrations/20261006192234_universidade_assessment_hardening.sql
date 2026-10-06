-- Correct PL/pgSQL alias and freeze full instrument metadata.
create or replace function public.vc_university_assessment_begin(p_actor uuid,p_enrollment uuid,p_purpose text,p_module integer default null) returns jsonb language plpgsql security invoker set search_path='' as $$
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
  for q in select bankq.*,c.code competency from public.vc_university_questions bankq join public.vc_university_competencies c using(competency_id) where bankq.course_id=e.course_id and bankq.course_version=e.course_version and bankq.purpose=p_purpose and bankq.status='published' and bankq.active and bankq.module_version_id is not distinct from mv order by random() loop
   select jsonb_agg(x) into opts from(select jsonb_build_object('option_id',option_id,'option_text',option_text,'feedback',feedback) x from public.vc_university_question_options where question_id=q.question_id order by random())o;
   if jsonb_array_length(opts)<>4 then raise exception 'assessment_bank_unavailable';end if;
   snap:=snap||jsonb_build_array(jsonb_build_object('course_id',e.course_id,'course_version',e.course_version,'module_version_id',mv,'purpose',p_purpose,'sources',(select jsonb_agg(jsonb_build_object('source_id',l.source_id,'relationship',l.relationship,'classification',sr.editorial_classification,'citation',sr.citation)) from public.vc_university_source_links l join public.vc_university_sources sr using(source_id) where l.question_id=q.question_id),'question_id',q.question_id,'editorial_id',q.editorial_id,'question_key',q.question_key,'question_version',q.question_version,'prompt',q.prompt,'correct_option_id',q.correct_option_id,'correct_feedback',q.correct_feedback,'options',opts,'competency',q.competency,'difficulty',q.difficulty,'review_concept',q.review_concept,'pass_percent',percent));
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
