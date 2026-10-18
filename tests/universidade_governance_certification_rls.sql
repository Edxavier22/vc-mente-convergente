-- Appended inside the existing assessment BEGIN/ROLLBACK by the SQL suite emitter.
set local role postgres;
create function pg_temp.pr6_data(schema jsonb) returns jsonb language plpgsql as $$
declare section jsonb;f jsonb;item jsonb;payload jsonb:='{}';entries jsonb;begin
 for section in select value from jsonb_array_elements(schema->'sections') loop
 item:='{}';for f in select value from jsonb_array_elements(section->'fields') loop item:=item||jsonb_build_object(f->>'field_key',case f->>'type' when 'number' then '0'::jsonb when 'select' then f->'options'->0->'value' when 'date' then to_jsonb(now()::date::text) else '"PR6 technical fixture; no real narrative"'::jsonb end);end loop;
 if coalesce((section->>'repeatable')::boolean,false) then entries:='[]';for i in 1..(section->>'min_items')::integer loop entries:=entries||jsonb_build_array(item);end loop;payload:=payload||jsonb_build_object(section->>'section_key',entries);else payload:=payload||item;end if;end loop;return payload;end $$;
do $$
declare actor uuid:=current_setting('pr5.a')::uuid;enrollment uuid:=current_setting('pr5.e')::uuid;outsider uuid:=current_setting('pr5.b')::uuid;owner uuid:='70aa4d75-bbb9-4839-aad8-670b7654664d';teacher uuid:=gen_random_uuid();cohort uuid;c uuid;cfg jsonb;ver integer;phase jsonb;payload jsonb;selected jsonb:='[]';entry uuid;submission uuid;revision uuid;result jsonb;d record;module uuid;feedback jsonb;points jsonb;before_cert bigint;caught boolean;requirement uuid;prior_status text;target jsonb;incomplete uuid;
begin
 select count(*) into before_cert from public.vc_university_certificates;
 select cohort_id into cohort from public.vc_university_enrollments where enrollment_id=enrollment;
 insert into auth.users(id,email,email_confirmed_at) values(teacher,'pr6-cert-teacher-'||teacher||'@example.invalid',now());
 execute 'set local role service_role';
 perform public.vc_university_teacher_assignment(owner,cohort,teacher,'assign',false);
 result:=public.vc_university_certification_eligibility(actor,enrollment);
 if (result->>'eligible')::boolean or not(result->'gates'->>'final_assessment_passed')::boolean or (result->'gates'->>'final_project_approved')::boolean then raise exception 'exam_equals_project';end if;
 caught:=false;begin perform public.vc_university_certification_eligibility(outsider,enrollment);exception when others then caught:=sqlerrm='academic_scope_denied';end;if not caught then raise exception 'learner_b_reads_a';end if;
 perform pg_temp.pr6_refresh_editorial_fixture();
 update public.vc_university_evidence_definition_versions set status='published' where course_id='inteligencia-emocional-aplicada';
 -- Submit all nine actual structural evidences through the existing engine.
 for d in select dv.*,def.module_id,def.evidence_key from public.vc_university_evidence_definition_versions dv join public.vc_university_evidence_definitions def using(evidence_definition_id) where dv.course_id='inteligencia-emocional-aplicada' and def.evidence_key<>'e10' order by def.evidence_key loop
 select module_version_id into module from public.vc_university_module_versions where module_id=d.module_id and course_version='1.0';
 result:=public.vc_university_evidence_write(actor,enrollment,module,'submit',pg_temp.pr6_data(d.form_schema),0,gen_random_uuid());
 end loop;
 select application_cycle_id,draft_version into c,ver from public.vc_university_application_cycles where enrollment_id=enrollment;
 select v.configuration into cfg from public.vc_university_application_cycle_versions v join public.vc_university_application_cycles ac using(cycle_version_id) where ac.application_cycle_id=c;
 update public.vc_university_application_cycles set started_at=now()-interval '30 days',operational_deadline=now()+interval '15 days' where application_cycle_id=c;
 select ce.payload into target from public.vc_university_application_cycle_entries ce where application_cycle_id=c and entry_type='objective' order by ce.revision desc limit 1;
 for i in 1..5 loop payload:=pg_temp.pr6_data(cfg->'forms'->'log')||jsonb_build_object('indicador_1',target->>'indicador_1','indicador_2',target->>'indicador_2','indicador_3',target->>'indicador_3');payload:=jsonb_set(payload,'{ferramenta}',to_jsonb(case when i<=3 then 'PAUSA' when i=4 then 'CLARO' else 'DECIDE' end));result:=public.vc_university_cycle_write(actor,enrollment,'log',payload,ver,gen_random_uuid(),'pr6-log-'||i);ver:=ver+1;select cycle_entry_id into entry from public.vc_university_application_cycle_entries where application_cycle_id=c and entry_key='pr6-log-'||i;selected:=selected||to_jsonb(entry::text);end loop;
 for phase in select value from jsonb_array_elements(cfg->'phases') loop result:=public.vc_university_cycle_write(actor,enrollment,'weekly_complete',pg_temp.pr6_data(cfg->'forms'->'weekly_review'),ver,gen_random_uuid(),phase->>'key');ver:=ver+1;end loop;
 result:=public.vc_university_cycle_write(actor,enrollment,'final_complete',pg_temp.pr6_data(cfg->'forms'->'final_reflection'),ver,gen_random_uuid(),'final');ver:=ver+1;
 result:=public.vc_university_cycle_write(actor,enrollment,'submit',jsonb_build_object('selected_entry_ids',selected,'privacy_confirmed',true),ver,gen_random_uuid());submission:=(result->'evidence'->>'submission_id')::uuid;
 select evidence_revision_id into revision from public.vc_university_evidence_revisions where submission_id=submission;
 result:=public.vc_university_teacher_operations(teacher,cohort);
 if not exists(select 1 from jsonb_array_elements(result->'queue') q where q->>'submission_id'=submission::text) or result::text like '%no real narrative%' then raise exception 'teacher_queue_metadata_leak_or_missing';end if;
 if exists(select 1 from jsonb_array_elements(public.vc_university_evidence_queue(owner,'inteligencia-emocional-aplicada')) q where q->>'submission_id'=submission::text) then raise exception 'owner_reads_unassigned_e10';end if;
 result:=public.vc_university_teacher_revision(teacher,submission,revision);
 if result->'structured_data' is null then raise exception 'exact_revision_missing';end if;
 caught:=false;begin perform public.vc_university_teacher_revision(outsider,submission,revision);exception when others then caught:=sqlerrm='evidence_review_denied';end;if not caught then raise exception 'unassigned_historical_revision';end if;
 points:='{"padroes":15,"ferramentas":20,"reflexao":15,"coerencia":15,"aplicabilidade":20,"indicadores":10,"clareza":5}';feedback:='{"reconhecer_evidencia":"Evidência técnica observável","localizar_lacuna":"Lacuna técnica revisada","retornar_ao_criterio":"Critério técnico aplicado","orientar_proxima_acao":"Próximo passo da fixture"}';
 result:=public.vc_university_cycle_review(teacher,submission,revision,points,feedback);
 result:=public.vc_university_certification_eligibility(actor,enrollment);
 if not(result->>'eligible')::boolean then raise exception 'all_gates_not_eligible:%',result;end if;
 if (result->>'issuanceEnabled')::boolean then raise exception 'ie_issuance_enabled';end if;
 -- Remove just the proof requirement, keeping E10 approved: certification must fail.
 select requirement_id into requirement from public.vc_university_module_requirements where course_id='inteligencia-emocional-aplicada' and requirement_type='final_assessment_passed';
 update public.vc_university_requirement_progress set status='requirements_pending',satisfied_at=null where enrollment_id=enrollment and requirement_id=requirement;
 result:=public.vc_university_certification_eligibility(actor,enrollment);if (result->>'eligible')::boolean or (result->'gates'->>'final_assessment_passed')::boolean then raise exception 'eligible_without_exam';end if;
 update public.vc_university_requirement_progress set status='completed',satisfied_at=now() where enrollment_id=enrollment and requirement_id=requirement;
 insert into public.vc_university_enrollments(cohort_id,course_id,user_id,course_version) values(cohort,'inteligencia-emocional-aplicada',outsider,'1.0') returning enrollment_id into incomplete;
 result:=public.vc_university_certification_eligibility(outsider,incomplete);if (result->>'eligible')::boolean or not exists(select 1 from jsonb_array_elements(result->'missing') m where m->>'code'='module_incomplete') then raise exception 'eligible_without_module';end if;
 select mr.requirement_id into requirement from public.vc_university_module_requirements mr join public.vc_university_module_versions m using(module_version_id) where mr.course_id='inteligencia-emocional-aplicada' and m.module_no=1 and mr.requirement_type='evidence_completed';
 update public.vc_university_requirement_progress set status='requirements_pending',satisfied_at=null where enrollment_id=enrollment and requirement_id=requirement;
 result:=public.vc_university_certification_eligibility(actor,enrollment);if (result->>'eligible')::boolean then raise exception 'eligible_without_evidence_requirement';end if;
 if (select count(*) from public.vc_university_certificates)<>before_cert then raise exception 'ie_certificate_emitted';end if;
 if exists(select 1 from public.vc_university_academic_audit_log where after_state::text like '%no real narrative%' or before_state::text like '%no real narrative%') then raise exception 'private_payload_in_audit';end if;
end $$;
select 'PR6 authoritative certification: exam independent of E10, exact human revision, all gates, A/B, privacy and no issuance passed' result;
