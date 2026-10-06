-- Entire integration, including editorial publication and Auth fixtures, rolls back.
begin;
create function pg_temp.exam_answers(s uuid,n integer) returns jsonb language sql as $$
 select jsonb_agg(jsonb_build_object('question_id',q->>'question_id','selected_option_id',case when i<=n then q->>'correct_option_id' else (select value->>'option_id' from jsonb_array_elements(q->'options') where value->>'option_id'<>q->>'correct_option_id' limit 1) end) order by i) from public.vc_university_final_sessions cross join lateral jsonb_array_elements(question_snapshot) with ordinality as x(q,i) where session_id=s;
$$;
create function pg_temp.exam_denied(actor uuid,enrollment uuid,s uuid,answers jsonb,expected text) returns void language plpgsql as $$
begin
 begin perform public.vc_university_assessment_submit(actor,enrollment,s,answers);exception when others then if sqlerrm=expected then return;else raise;end if;end;
 raise exception 'expected_denial_missing:%',expected;
end $$;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();cohort uuid;e uuid;mv record;r record;res jsonb;s uuid;ans jsonb;old uuid;original jsonb;setup jsonb:='{}';f jsonb;section jsonb;cfg jsonb;c uuid;caught boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values(a,'pr5-a-'||a||'@example.invalid',now()),(b,'pr5-b-'||b||'@example.invalid',now());
 perform set_config('pr5.a',a::text,true);perform set_config('pr5.b',b::text,true);
 update public.vc_university_course_versions set status='published',published_at=now() where course_id='inteligencia-emocional-aplicada' and version='1.0';
 update public.vc_university_module_versions set status='published' where course_id='inteligencia-emocional-aplicada';
 update public.vc_university_module_requirements set status='published' where course_id='inteligencia-emocional-aplicada';
 update public.vc_university_module_dependencies set status='published' where course_id='inteligencia-emocional-aplicada';
 update public.vc_university_application_cycle_versions set status='published' where course_id='inteligencia-emocional-aplicada';
 update public.vc_university_questions set status='published',active=true where course_id='inteligencia-emocional-aplicada';
 insert into public.vc_university_cohorts(course_id,label,status) values('inteligencia-emocional-aplicada','PR5 rollback fixture','active') returning cohort_id into cohort;
 insert into public.vc_university_enrollments(cohort_id,course_id,user_id,course_version) values(cohort,'inteligencia-emocional-aplicada',a,'1.0') returning enrollment_id into e;
 perform set_config('pr5.e',e::text,true);
 execute 'set local role service_role';
 caught:=false;begin perform public.vc_university_assessment_begin(a,e,'final');exception when others then caught:=sqlerrm='modules_required';end;if not caught then raise exception 'final_before_m10';end if;
 caught:=false;begin perform public.vc_university_assessment_begin(a,e,'checkpoint',2);exception when others then caught:=sqlerrm='module_locked';end;if not caught then raise exception 'locked_module';end if;
 caught:=false;begin perform public.vc_university_assessment_begin(b,e,'checkpoint',1);exception when others then caught:=sqlerrm='assessment_context_denied';end;if not caught then raise exception 'student_b_accesses_a';end if;
 for mv in select * from public.vc_university_module_versions where course_id='inteligencia-emocional-aplicada' order by module_no loop
  for r in select * from public.vc_university_module_requirements where module_version_id=mv.module_version_id and required and requirement_type<>'checkpoint_passed' loop
   insert into public.vc_university_requirement_progress(enrollment_id,requirement_id,status,source_type,source_id,satisfied_at) values(e,r.requirement_id,'completed','transactional_fixture',gen_random_uuid()::text,now());
  end loop;
  res:=public.vc_university_assessment_begin(a,e,'checkpoint',mv.module_no);s:=(res->>'sessionId')::uuid;
  if res::text like '%correct_option_id%' or res::text like '%is_correct%' or res::text like '%correct_feedback%' then raise exception 'answer_key_leaked';end if;
  if(public.vc_university_assessment_begin(a,e,'checkpoint',mv.module_no)->>'sessionId')::uuid<>s then raise exception 'session_resume_changed';end if;
  ans:=pg_temp.exam_answers(s,4);
  if mv.module_no=1 then
   perform pg_temp.exam_denied(b,e,s,ans,'assessment_context_denied');
   perform pg_temp.exam_denied(a,e,s,ans-0,'answers_invalid');
   perform pg_temp.exam_denied(a,e,s,ans||jsonb_build_array(ans->0),'answers_invalid');
   perform pg_temp.exam_denied(a,e,s,jsonb_set(ans,'{0,selected_option_id}',to_jsonb(ans->1->>'selected_option_id')),'answers_invalid');
   perform pg_temp.exam_denied(a,e,s,jsonb_set(ans,'{0,question_id}','"00000000-0000-4000-8000-000000000000"'),'answers_invalid');
   res:=public.vc_university_assessment_submit(a,e,s,pg_temp.exam_answers(s,3));
   if(res->>'passed')::boolean or (res->>'scorePercent')::numeric<>60 then raise exception '3_of_5_passed';end if;
   res:=public.vc_university_complete_module_if_ready(e,mv.module_version_id);if(res->>'completed')::boolean then raise exception 'failed_checkpoint_completed';end if;
   res:=public.vc_university_assessment_begin(a,e,'checkpoint',1);s:=(res->>'sessionId')::uuid;ans:=pg_temp.exam_answers(s,4);
  end if;
  res:=public.vc_university_assessment_submit(a,e,s,ans);
  if not(res->>'passed')::boolean or(res->>'scorePercent')::numeric<>80 then raise exception '4_of_5_failed';end if;
  if public.vc_university_assessment_submit(a,e,s,ans)<>res then raise exception 'submission_not_idempotent';end if;
  perform pg_temp.exam_denied(a,e,s,pg_temp.exam_answers(s,3),'idempotency_payload_conflict');
  if not exists(select 1 from public.vc_university_module_progress where enrollment_id=e and module_version_id=mv.module_version_id and completed_at is not null) then raise exception 'module_not_completed';end if;
  if mv.module_no=7 then
   select configuration into cfg from public.vc_university_application_cycle_versions where course_id='inteligencia-emocional-aplicada';
   for section in select value from jsonb_array_elements(cfg->'forms'->'setup'->'sections') loop for f in select value from jsonb_array_elements(section->'fields') loop setup:=setup||jsonb_build_object(f->>'field_key',case when f->>'type'='select' then f->'options'->0->'value' else '"Fixture técnica observável"'::jsonb end);end loop;end loop;
   res:=public.vc_university_cycle_write(a,e,'setup_draft',setup,0);
  end if;
  if mv.module_no=9 then res:=public.vc_university_cycle_write(a,e,'start',setup,1,gen_random_uuid());c:=(res->'cycle'->>'application_cycle_id')::uuid;end if;
 end loop;
 if public.vc_university_cycle_state(c)<>'active' then raise exception 'cycle_not_active';end if;
 res:=public.vc_university_assessment_begin(a,e,'final');s:=(res->>'sessionId')::uuid;
 select question_snapshot into original from public.vc_university_final_sessions where session_id=s;
 select (question_snapshot->0->>'question_id')::uuid into old from public.vc_university_final_sessions where session_id=s;
 caught:=false;begin update public.vc_university_questions set prompt='silent edit' where question_id=old;exception when others then caught:=sqlerrm='published_question_immutable';end;if not caught then raise exception 'published_item_edited';end if;
 caught:=false;begin update public.vc_university_question_options set option_text='silent edit' where question_id=old;exception when others then caught:=sqlerrm='published_question_immutable';end;if not caught then raise exception 'published_option_edited';end if;
 -- Archiving affects future selection, not this historical instrument.
 update public.vc_university_questions set status='archived',active=false where question_id=old;
 if(select question_snapshot from public.vc_university_final_sessions where session_id=s)<>original then raise exception 'snapshot_changed';end if;
 res:=public.vc_university_assessment_submit(a,e,s,pg_temp.exam_answers(s,13));
 if(res->>'passed')::boolean or(res->>'scorePercent')::numeric<>65 then raise exception '13_of_20_passed';end if;
 -- A new version of the archived editorial item, preserving the human ID.
 execute 'set local role postgres';
 declare newq uuid:=gen_random_uuid();correct uuid:=gen_random_uuid();opt record;begin
 insert into public.vc_university_questions(question_id,question_key,question_version,course_id,course_version,module_no,purpose,kind,prompt,choices,correct_index,correct_option_id,correct_feedback,review_concept,status,active,editorial_id,competency_id,difficulty,movement)
 select newq,question_key,2,course_id,course_version,module_no,purpose,kind,prompt,choices,null,correct,correct_feedback,review_concept,'draft',false,editorial_id,competency_id,difficulty,movement from public.vc_university_questions where question_id=old;
 for opt in select * from public.vc_university_question_options where question_id=old loop insert into public.vc_university_question_options(option_id,question_id,option_order,option_text,feedback,is_correct)values(case when opt.is_correct then correct else gen_random_uuid() end,newq,opt.option_order,opt.option_text,opt.feedback,opt.is_correct);end loop;
 insert into public.vc_university_source_links(source_id,question_id,relationship) select source_id,newq,relationship from public.vc_university_source_links where question_id=old;
 update public.vc_university_questions set status='published',active=true where question_id=newq;
 end;
 execute 'set local role service_role';
 res:=public.vc_university_assessment_begin(a,e,'final');s:=(res->>'sessionId')::uuid;ans:=pg_temp.exam_answers(s,14);res:=public.vc_university_assessment_submit(a,e,s,ans);
 if not(res->>'passed')::boolean or(res->>'scorePercent')::numeric<>70 then raise exception '14_of_20_failed';end if;
 if public.vc_university_assessment_submit(a,e,s,ans)<>res then raise exception 'duplicate_final';end if;
 if(select count(*) from public.vc_university_final_attempts where session_id=s)<>1 then raise exception 'double_final_attempt';end if;
 caught:=false;begin update public.vc_university_final_attempts set score=20 where session_id=s;exception when others then caught:=true;end;if not caught then raise exception 'historical_attempt_edited';end if;
 if not exists(select 1 from public.vc_university_requirement_progress rp join public.vc_university_module_requirements mr using(requirement_id) where rp.enrollment_id=e and mr.requirement_type='final_assessment_passed' and rp.status='completed') then raise exception 'final_requirement_unsatisfied';end if;
 if exists(select 1 from public.vc_university_requirement_progress rp join public.vc_university_module_requirements mr using(requirement_id) where rp.enrollment_id=e and mr.requirement_type='final_project_approved' and rp.status='completed') or public.vc_university_cycle_state(c)<>'active' then raise exception 'exam_approved_e10_or_changed_cycle';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('pr5.b'),true);
do $$begin
 if exists(select 1 from public.vc_university_final_attempts where enrollment_id=current_setting('pr5.e')::uuid) then raise exception 'student_b_reads_a';end if;
 begin perform question_snapshot from public.vc_university_final_attempts;raise exception 'snapshot_leaked';exception when insufficient_privilege then null;end;
 begin perform * from public.vc_university_questions;raise exception 'bank_leaked';exception when insufficient_privilege then null;end;
 begin perform * from public.vc_university_final_sessions;raise exception 'session_key_leaked';exception when insufficient_privilege then null;end;
 begin perform public.vc_university_assessment_begin(current_setting('pr5.b')::uuid,current_setting('pr5.e')::uuid,'final');raise exception 'student_rpc_allowed';exception when insufficient_privilege then null;end;
end $$;
set local role postgres;
do $$begin
 if exists(select 1 from public.vc_university_academic_audit_log where entity_type='assessment_session' and (after_state::text like '%selected_option_id%' or after_state::text like '%answers%')) then raise exception 'student_answers_in_audit';end if;
end $$;
rollback;
