-- Reversible fixture: no real learner, entry or review is retained.
begin;
create function pg_temp.cycle_fixture_data(schema jsonb) returns jsonb language plpgsql as $$
declare f jsonb;s jsonb;data jsonb:='{}';begin for s in select value from jsonb_array_elements(schema->'sections') loop for f in select value from jsonb_array_elements(s->'fields') loop
 data:=data||jsonb_build_object(f->>'field_key',case when f->>'type'='select' then f->'options'->0->'value' when f->>'type'='date' then to_jsonb(now()::date::text) else '"Fixture técnica anonimizada"'::jsonb end);end loop;end loop;return data;end $$;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();teacher uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();business uuid:=gen_random_uuid();cohort uuid;enrollment uuid;c uuid;cfg jsonb;data jsonb;result jsonb;payload jsonb;setup jsonb;req record;mv record;phase jsonb;cycle_version uuid;selected jsonb:='[]';entry uuid;submission uuid;v_revision uuid;oldrev uuid;points jsonb;feedback jsonb;request uuid;ver integer;deadline timestamptz;caught boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values(a,'pr4-a-'||a||'@example.invalid',now()),(b,'pr4-b-'||b||'@example.invalid',now()),(teacher,'pr4-t-'||teacher||'@example.invalid',now()),(outsider,'pr4-o-'||outsider||'@example.invalid',now()),(business,'pr4-b2b-'||business||'@example.invalid',now());
 update public.vc_university_course_versions set status='published',published_at=now() where course_id='inteligencia-emocional-aplicada' and version='1.0';
 update public.vc_university_module_versions set status='published' where course_id='inteligencia-emocional-aplicada';
 update public.vc_university_module_requirements set status='published' where course_id='inteligencia-emocional-aplicada';
 update public.vc_university_module_dependencies set status='published' where course_id='inteligencia-emocional-aplicada';
 update public.vc_university_evidence_definition_versions set status='published' where course_id='inteligencia-emocional-aplicada';
 update public.vc_university_application_cycle_versions set status='published' where course_id='inteligencia-emocional-aplicada';
 select cycle_version_id,configuration into cycle_version,cfg from public.vc_university_application_cycle_versions where course_id='inteligencia-emocional-aplicada';
 insert into public.vc_university_cohorts(course_id,label,status) values('inteligencia-emocional-aplicada','PR4 rollback fixture','active') returning cohort_id into cohort;
 insert into public.vc_university_enrollments(cohort_id,course_id,user_id,course_version) values(cohort,'inteligencia-emocional-aplicada',a,'1.0') returning enrollment_id into enrollment;
 insert into public.vc_university_teachers(cohort_id,user_id) values(cohort,teacher);
 perform set_config('pr4.a',a::text,true);perform set_config('pr4.b',b::text,true);perform set_config('pr4.teacher',teacher::text,true);perform set_config('pr4.outsider',outsider::text,true);perform set_config('pr4.business',business::text,true);
 execute 'set local role service_role';
 setup:=pg_temp.cycle_fixture_data(cfg->'forms'->'setup');
 caught:=false;begin perform public.vc_university_cycle_write(a,enrollment,'setup_draft',setup,0);exception when others then caught:=sqlerrm='cycle_setup_ineligible';end;if not caught then raise exception 'setup_before_m7';end if;
 -- Complete the approved PR2 module requirements via the canonical RPC (fixture sources).
 for mv in select * from public.vc_university_module_versions where course_id='inteligencia-emocional-aplicada' and module_no<=7 order by module_no loop
 for req in select * from public.vc_university_module_requirements where module_version_id=mv.module_version_id and required and status='published' loop
 insert into public.vc_university_requirement_progress(enrollment_id,requirement_id,status,source_type,source_id,satisfied_at) values(enrollment,req.requirement_id,'completed','transactional_fixture',gen_random_uuid()::text,now());end loop;
 result:=public.vc_university_complete_module_if_ready(enrollment,mv.module_version_id);if not(result->>'completed')::boolean then raise exception 'fixture_module_not_complete';end if;end loop;
 result:=public.vc_university_cycle_write(a,enrollment,'setup_draft',setup,0);c:=(result->'cycle'->>'application_cycle_id')::uuid;
 if result->'cycle'->>'started_at' is not null or result->>'state'<>'setup' then raise exception 'preparation_started_clock';end if;
 caught:=false;begin perform public.vc_university_cycle_write(a,enrollment,'start',setup,1,gen_random_uuid());exception when others then caught:=sqlerrm='cycle_start_ineligible';end;if not caught then raise exception 'start_before_m9';end if;
 for mv in select * from public.vc_university_module_versions where course_id='inteligencia-emocional-aplicada' and module_no in(8,9,10) order by module_no loop
 for req in select * from public.vc_university_module_requirements where module_version_id=mv.module_version_id and required and status='published' loop
 insert into public.vc_university_requirement_progress(enrollment_id,requirement_id,status,source_type,source_id,satisfied_at) values(enrollment,req.requirement_id,'completed','transactional_fixture',gen_random_uuid()::text,now());end loop;
 result:=public.vc_university_complete_module_if_ready(enrollment,mv.module_version_id);if not(result->>'completed')::boolean then raise exception 'm10_waited_for_cycle';end if;end loop;
 request:=gen_random_uuid();result:=public.vc_university_cycle_write(a,enrollment,'start',setup,1,request);deadline:=(result->'cycle'->>'operational_deadline')::timestamptz;
 if deadline<>(result->'cycle'->>'started_at')::timestamptz+interval '45 days' then raise exception 'window_not_45';end if;
 result:=public.vc_university_cycle_write(a,enrollment,'start',setup,1,request);if (select count(*) from public.vc_university_application_cycle_entries where application_cycle_id=c and entry_type='objective')<>1 then raise exception 'start_duplicated';end if;
 result:=public.vc_university_cycle_write(a,enrollment,'pause','{"reason":"prefiro_nao_informar"}',2);if result->>'state'<>'paused' then raise exception 'pause_failed';end if;
 result:=public.vc_university_cycle_write(a,enrollment,'resume','{}',3);if result->>'state'<>'resumed' or (result->'cycle'->>'operational_deadline')::timestamptz<>deadline then raise exception 'resume_extended_deadline';end if;
 result:=public.vc_university_cycle_write(a,enrollment,'goal_revise',setup||'{"motivo_alteracao":"Simplificação educacional"}',4,gen_random_uuid());
 if (select count(*) from public.vc_university_application_cycle_entries where application_cycle_id=c and entry_type='objective')<>2 then raise exception 'goal_history_missing';end if;
 caught:=false;begin perform public.vc_university_cycle_write(a,enrollment,'final_complete',pg_temp.cycle_fixture_data(cfg->'forms'->'final_reflection'),5,gen_random_uuid(),'final');exception when others then caught:=sqlerrm='cycle_duration_pending';end;if not caught then raise exception 'final_before_day30';end if;
 caught:=false;begin perform public.vc_university_cycle_write(b,enrollment,'resume','{}',5);exception when others then caught:=sqlerrm='cycle_context_denied';end;if not caught then raise exception 'learner_b_mutates_a';end if;
 -- Controlled clock fixture; production callers cannot alter started_at.
 update public.vc_university_application_cycles set started_at=now()-interval '30 days',operational_deadline=now()+interval '15 days' where application_cycle_id=c;
 result:=public.vc_university_cycle_read(a,enrollment);if result->>'state'<>'final_reflection' then raise exception 'no_log_broke_cycle';end if;
 ver:=5;
 for i in 1..5 loop payload:=pg_temp.cycle_fixture_data(cfg->'forms'->'log');payload:=jsonb_set(payload,'{ferramenta}',to_jsonb(case when i<=3 then 'PAUSA' when i=4 then 'CLARO' else 'DECIDE' end));request:=gen_random_uuid();result:=public.vc_university_cycle_write(a,enrollment,'log',payload,ver,request,'log-'||i);ver:=ver+1;select cycle_entry_id into entry from public.vc_university_application_cycle_entries where application_cycle_id=c and request_id=request;selected:=selected||to_jsonb(entry::text);
 result:=public.vc_university_cycle_write(a,enrollment,'log',payload,ver-1,request,'log-'||i);end loop;
 -- Correction appends, prior log immutable; keep selected current revision.
 result:=public.vc_university_cycle_write(a,enrollment,'log',payload||'{"aprendizado":"Correção técnica anonimizada"}',ver,gen_random_uuid(),'log-5');ver:=ver+1;
 select cycle_entry_id into entry from public.vc_university_application_cycle_entries where application_cycle_id=c and entry_key='log-5' order by revision desc limit 1;selected:=jsonb_set(selected,'{4}',to_jsonb(entry::text));
 for phase in select value from jsonb_array_elements(cfg->'phases') loop
 payload:=pg_temp.cycle_fixture_data(cfg->'forms'->'weekly_review');if phase->>'key'='observar' then payload:='{"oportunidade":"nenhuma"}';end if;
 result:=public.vc_university_cycle_write(a,enrollment,'weekly_draft',payload,ver,null,phase->>'key');ver:=ver+1;
 result:=public.vc_university_cycle_write(a,enrollment,'weekly_complete',payload,ver,gen_random_uuid(),phase->>'key');ver:=ver+1;end loop;
 payload:=pg_temp.cycle_fixture_data(cfg->'forms'->'final_reflection');result:=public.vc_university_cycle_write(a,enrollment,'final_draft',payload,ver);ver:=ver+1;
 result:=public.vc_university_cycle_write(a,enrollment,'final_complete',payload,ver,gen_random_uuid(),'final');ver:=ver+1;
 caught:=false;begin perform public.vc_university_cycle_integrator(c,'[]');exception when others then caught:=sqlerrm='required_applications_pending';end;if not caught then raise exception 'applications_not_enforced';end if;
 request:=gen_random_uuid();payload:=jsonb_build_object('selected_entry_ids',selected,'privacy_confirmed',true);result:=public.vc_university_cycle_write(a,enrollment,'submit',payload,ver,request);ver:=ver+1;submission:=(result->'evidence'->>'submission_id')::uuid;
 result:=public.vc_university_cycle_write(a,enrollment,'submit',payload,ver-1,request);if (select count(*) from public.vc_university_evidence_revisions where submission_id=submission)<>1 then raise exception 'duplicate_e10';end if;
 select evidence_revision_id into v_revision from public.vc_university_evidence_revisions where submission_id=submission;oldrev:=v_revision;
 if exists(select 1 from public.vc_university_requirement_progress rp join public.vc_university_module_requirements mr using(requirement_id) where rp.enrollment_id=enrollment and mr.requirement_type='final_project_approved' and rp.satisfied_at is not null) then raise exception 'submitted_satisfied_final';end if;
 feedback:='{"reconhecer_evidencia":"Evidência observável", "localizar_lacuna":"Lacuna acadêmica", "retornar_ao_criterio":"Critério de aplicabilidade", "orientar_proxima_acao":"Revise a aplicação descrita"}';points:='{"padroes":10,"ferramentas":15,"reflexao":10,"coerencia":10,"aplicabilidade":10,"indicadores":9,"clareza":5}';
 caught:=false;begin perform public.vc_university_cycle_review(outsider,submission,v_revision,points,feedback);exception when others then caught:=sqlerrm='evidence_review_denied';end;if not caught then raise exception 'unassigned_review';end if;
 caught:=false;begin perform public.vc_university_evidence_review(teacher,submission,v_revision,'approved','Bypass de rubrica');exception when others then caught:=sqlerrm='mandatory_rubric_required';end;if not caught then raise exception 'rubric_bypass';end if;
 result:=public.vc_university_cycle_review(teacher,submission,v_revision,'{}','{}','begin_review');if result->>'status'<>'under_review' then raise exception 'under_review_not_set';end if;
 result:=public.vc_university_cycle_review(teacher,submission,v_revision,points,feedback);if result->>'status'<>'revision_requested' or (result->>'total_points')::numeric<>69 then raise exception '69_approved';end if;
 result:=public.vc_university_cycle_write(a,enrollment,'submit',payload,ver,gen_random_uuid());ver:=ver+1;
 select evidence_revision_id into v_revision from public.vc_university_evidence_revisions where submission_id=submission order by revision desc limit 1;if v_revision=oldrev then raise exception 'revision_overwritten';end if;
 caught:=false;begin update public.vc_university_evidence_revisions set structured_data='{}' where evidence_revision_id=oldrev;exception when others then caught:=true;end;if not caught then raise exception 'old_revision_mutated';end if;
 -- Two included revisions; further correction requires explicit pedagogical authorization.
 for i in 1..2 loop
 result:=public.vc_university_cycle_review(teacher,submission,v_revision,points,feedback);
 if i=1 then result:=public.vc_university_cycle_write(a,enrollment,'submit',payload,ver,gen_random_uuid());ver:=ver+1;select evidence_revision_id into v_revision from public.vc_university_evidence_revisions where submission_id=submission order by revision desc limit 1;end if;
 end loop;
 if not(select special_review_required from public.vc_university_application_cycles where application_cycle_id=c) then raise exception 'special_review_missing';end if;
 caught:=false;begin perform public.vc_university_cycle_write(a,enrollment,'submit',payload,ver,gen_random_uuid());exception when others then caught:=sqlerrm='pedagogical_review_required';end;if not caught then raise exception 'included_revision_limit_not_enforced';end if;
 result:=public.vc_university_cycle_review(teacher,submission,v_revision,'{}','{}','authorize_special_revision');
 result:=public.vc_university_cycle_write(a,enrollment,'submit',payload,ver,gen_random_uuid());ver:=ver+1;select evidence_revision_id into v_revision from public.vc_university_evidence_revisions where submission_id=submission order by revision desc limit 1;
 points:=jsonb_set(points,'{indicadores}','10');result:=public.vc_university_cycle_review(teacher,submission,v_revision,points,feedback);if result->>'status'<>'approved' or (result->>'total_points')::numeric<>70 then raise exception '70_not_approved';end if;
 if not exists(select 1 from public.vc_university_requirement_progress rp join public.vc_university_module_requirements mr using(requirement_id) where rp.enrollment_id=enrollment and mr.requirement_type='final_project_approved' and rp.satisfied_at is not null) then raise exception 'final_requirement_missing';end if;
 if exists(select 1 from public.vc_university_academic_audit_log where entity_id=c::text and after_state::text like '%anonimizada%') then raise exception 'text_leaked_to_audit';end if;
 if jsonb_array_length(public.vc_university_evidence_queue(outsider,'inteligencia-emocional-aplicada'))<>0 then raise exception 'unassigned_queue';end if;
 -- Independent expired fixture proves a pause cannot extend the window or erase history.
 declare expired_enrollment uuid;expired_cycle uuid;begin
 insert into public.vc_university_enrollments(cohort_id,course_id,user_id,course_version) values(cohort,'inteligencia-emocional-aplicada',b,'1.0') returning enrollment_id into expired_enrollment;
 insert into public.vc_university_application_cycles(cycle_version_id,enrollment_id,learner_id,status,started_at,operational_deadline) values(cycle_version,expired_enrollment,b,'paused',now()-interval '46 days',now()-interval '1 day') returning application_cycle_id into expired_cycle;
 perform public.vc_university_cycle_entry(b,expired_cycle,'objective','principal',setup,gen_random_uuid());
 result:=public.vc_university_cycle_read(b,expired_enrollment);if result->>'state'<>'closed_incomplete' or jsonb_array_length(result->'entries')<>1 then raise exception 'expired_cycle_not_preserved';end if;
 end;
 perform set_config('pr4.cycle',c::text,true);perform set_config('pr4.submission',submission::text,true);perform set_config('pr4.revision',v_revision::text,true);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('pr4.b'),true);
do $$declare caught boolean;begin
 if exists(select 1 from public.vc_university_application_cycles where application_cycle_id=current_setting('pr4.cycle')::uuid) then raise exception 'B_reads_A_cycle';end if;
 caught:=false;begin update public.vc_university_application_cycles set status='approved';exception when insufficient_privilege then caught:=true;end;if not caught then raise exception 'learner_writes_state';end if;
 if has_function_privilege('authenticated','public.vc_university_cycle_review(uuid,uuid,uuid,jsonb,jsonb,text)','EXECUTE') then raise exception 'learner_calls_review';end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('pr4.teacher'),true);
do $$begin
 if exists(select 1 from public.vc_university_application_cycle_entries where application_cycle_id=current_setting('pr4.cycle')::uuid) then raise exception 'teacher_reads_private_logs';end if;
 if not exists(select 1 from public.vc_university_evidence_revisions where evidence_revision_id=current_setting('pr4.revision')::uuid) then raise exception 'assigned_no_e10';end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('pr4.outsider'),true);
do $$begin if exists(select 1 from public.vc_university_evidence_revisions where submission_id=current_setting('pr4.submission')::uuid) then raise exception 'unassigned_reads_e10';end if;end $$;
select set_config('request.jwt.claim.sub',current_setting('pr4.business'),true);
do $$begin if exists(select 1 from public.vc_university_application_cycle_entries where application_cycle_id=current_setting('pr4.cycle')::uuid) or exists(select 1 from public.vc_university_evidence_revisions where submission_id=current_setting('pr4.submission')::uuid) then raise exception 'B2B_reads_content';end if;end $$;
select set_config('request.jwt.claim.sub','70aa4d75-bbb9-4839-aad8-670b7654664d',true);
do $$begin if exists(select 1 from public.vc_university_evidence_revisions where submission_id=current_setting('pr4.submission')::uuid) then raise exception 'owner_bypass';end if;end $$;
select set_config('request.jwt.claim.sub',current_setting('pr4.a'),true);
do $$begin if not exists(select 1 from public.vc_university_application_cycle_entries where application_cycle_id=current_setting('pr4.cycle')::uuid) then raise exception 'learner_no_history';end if;end $$;
reset role;
rollback;
select 'PR4 full M7->M9->30 days->E10->69->resubmission->70->final_project_approved and RLS passed; rollback complete' as result;
