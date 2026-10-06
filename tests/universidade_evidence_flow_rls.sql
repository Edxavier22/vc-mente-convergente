-- Technical fixtures only: every write (including Auth fixtures) is rolled back.
begin;
do $$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); teacher uuid:=gen_random_uuid(); business uuid:=gen_random_uuid(); cohort uuid;
 enrollment uuid; m1 uuid; m2 uuid; m3 uuid; m5 uuid; d record; section jsonb; f jsonb; item jsonb; payload jsonb; entries jsonb;
 data1 jsonb; result jsonb; submission uuid; v_revision uuid; request uuid:=gen_random_uuid(); req uuid; attempt uuid; caught boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values(a,'pr3-a-'||a||'@example.invalid',now()),(b,'pr3-b-'||b||'@example.invalid',now()),(teacher,'pr3-teacher-'||teacher||'@example.invalid',now()),(business,'pr3-b2b-'||business||'@example.invalid',now());
 update public.vc_university_course_versions set status='published',published_at=now() where course_id='inteligencia-emocional-aplicada' and version='1.0';
 update public.vc_university_module_versions set status='published' where course_id='inteligencia-emocional-aplicada' and course_version='1.0' and module_no in(1,2,3,5);
 update public.vc_university_module_requirements set status='published' where course_id='inteligencia-emocional-aplicada' and course_version='1.0';
 update public.vc_university_module_dependencies set status='published' where module_version_id in(select module_version_id from public.vc_university_module_versions where course_id='inteligencia-emocional-aplicada' and module_no=2);
 -- Test policy variants before the version becomes immutable.
 update public.vc_university_evidence_definition_versions dv set validation_policy=jsonb_set(dv.validation_policy,'{sample_percent}','100') from public.vc_university_evidence_definitions def where def.evidence_definition_id=dv.evidence_definition_id and def.course_id='inteligencia-emocional-aplicada' and def.evidence_key in('e03','e05');
 update public.vc_university_evidence_definition_versions dv set validation_policy=jsonb_set(dv.validation_policy,'{sufficiency}','"on_approval"') from public.vc_university_evidence_definitions def where def.evidence_definition_id=dv.evidence_definition_id and def.course_id='inteligencia-emocional-aplicada' and def.evidence_key='e05';
 update public.vc_university_evidence_definition_versions set status='published' where course_id='inteligencia-emocional-aplicada';
 insert into public.vc_university_cohorts(course_id,label,status) values('inteligencia-emocional-aplicada','PR3 transactional fixture','active') returning cohort_id into cohort;
 insert into public.vc_university_enrollments(cohort_id,course_id,user_id,course_version) values(cohort,'inteligencia-emocional-aplicada',a,'1.0') returning enrollment_id into enrollment;
 insert into public.vc_university_teachers(cohort_id,user_id) values(cohort,teacher);
 select module_version_id into m1 from public.vc_university_module_versions where course_id='inteligencia-emocional-aplicada' and course_version='1.0' and module_no=1;
 select module_version_id into m2 from public.vc_university_module_versions where course_id='inteligencia-emocional-aplicada' and course_version='1.0' and module_no=2;
 select module_version_id into m3 from public.vc_university_module_versions where course_id='inteligencia-emocional-aplicada' and course_version='1.0' and module_no=3;
 select module_version_id into m5 from public.vc_university_module_versions where course_id='inteligencia-emocional-aplicada' and course_version='1.0' and module_no=5;
 perform set_config('pr3.a',a::text,true);perform set_config('pr3.b',b::text,true);perform set_config('pr3.teacher',teacher::text,true);perform set_config('pr3.b2b',business::text,true);
 execute 'set local role service_role';
 -- Exercise DB validation independently for every evidence and every repeat/range.
 for d in select dv.*,def.evidence_key from public.vc_university_evidence_definition_versions dv join public.vc_university_evidence_definitions def using(evidence_definition_id) where dv.course_id='inteligencia-emocional-aplicada' loop
 payload:='{}';
 for section in select value from jsonb_array_elements(d.form_schema->'sections') loop
 item:='{}';for f in select value from jsonb_array_elements(section->'fields') loop
 item:=item||jsonb_build_object(f->>'field_key',case f->>'type' when 'number' then '0'::jsonb when 'select' then f->'options'->0->'value' else '"Fixture técnica anonimizada"'::jsonb end);
 end loop;
 if (section->>'repeatable')::boolean then
 entries:='[]';for i in 1..(section->>'min_items')::integer loop entries:=entries||jsonb_build_array(item);end loop;
 payload:=payload||jsonb_build_object(section->>'section_key',entries);
 else payload:=payload||item;end if;
 end loop;
 if not public.vc_university_validate_evidence(d.form_schema,payload) then raise exception 'valid_structure_rejected_%',d.evidence_key;end if;
 if public.vc_university_validate_evidence(d.form_schema,'{}') then raise exception 'missing_fields_accepted';end if;
 if d.evidence_key in('e02','e04','e05','e06') then
 select value into section from jsonb_array_elements(d.form_schema->'sections') where (value->>'repeatable')::boolean limit 1;
 if public.vc_university_validate_evidence(d.form_schema,jsonb_set(payload,array[section->>'section_key'],(payload->(section->>'section_key'))-0)) then raise exception 'record_count_not_enforced';end if;
 end if;
 if d.evidence_key='e06' and public.vc_university_validate_evidence(d.form_schema,jsonb_set(payload,'{situacoes,0,certeza_antes_0_100}','101')) then raise exception 'certainty_range_not_enforced';end if;
 if d.evidence_key='e01' then
 data1:=payload;
 if public.vc_university_validate_evidence(d.form_schema,jsonb_set(payload,'{intensidade_0_10}','11')) then raise exception 'intensity_range_not_enforced';end if;
 result:=public.vc_university_evidence_write(a,enrollment,m1,'draft','{}',0,null);
 submission:=(result->'submission'->>'submission_id')::uuid;
 if exists(select 1 from public.vc_university_requirement_progress where enrollment_id=enrollment and status='completed') then raise exception 'draft_satisfied_requirement';end if;
 result:=public.vc_university_evidence_write(a,enrollment,m1,'draft',payload,1,null);
 if result->'submission'->'draft_data' is distinct from payload then raise exception 'autosave_not_persisted';end if;
 caught:=false;begin perform public.vc_university_evidence_write(a,enrollment,m1,'draft',payload,1,null);exception when others then caught:=sqlerrm='draft_version_conflict';end;if not caught then raise exception 'stale_autosave_accepted';end if;
 caught:=false;begin perform public.vc_university_evidence_write(b,enrollment,m1,'draft',payload,2,null);exception when others then caught:=sqlerrm='evidence_context_denied';end;if not caught then raise exception 'arbitrary_learner_accepted';end if;
 result:=public.vc_university_evidence_write(a,enrollment,m1,'submit',payload,2,request);
 v_revision:=(result->>'revision_id')::uuid;
 if not (result->>'requirement_satisfied')::boolean then raise exception 'type_a_not_satisfied';end if;
 result:=public.vc_university_evidence_write(a,enrollment,m1,'submit',payload,2,request);
 if not(result->>'idempotent')::boolean or (select count(*) from public.vc_university_evidence_revisions where submission_id=submission)<>1 then raise exception 'duplicate_revision';end if;
 caught:=false;begin perform public.vc_university_evidence_write(a,enrollment,m1,'submit',payload||'{"contexto":"different"}',2,request);exception when others then caught:=sqlerrm='idempotency_payload_conflict';end;if not caught then raise exception 'idempotency_reused_for_other_payload';end if;
 caught:=false;begin update public.vc_university_evidence_revisions set structured_data='{}' where evidence_revision_id=v_revision;exception when others then caught:=sqlerrm='versioned_record_is_immutable';end;if not caught then raise exception 'submitted_revision_changed';end if;
 if exists(select 1 from public.vc_university_module_progress where enrollment_id=enrollment and module_no=1 and completed_at is not null) then raise exception 'completed_without_checkpoint';end if;
 result:=public.vc_university_complete_module_if_ready(enrollment,m1);if(result->>'completed')::boolean then raise exception 'engine_completed_without_checkpoint';end if;
 caught:=false;begin perform public.vc_university_evidence_write(a,enrollment,m2,'draft','{}',0,null);exception when others then caught:=sqlerrm='previous_module_required';end;if not caught then raise exception 'm2_unlocked_before_m1';end if;
 if vc_private.vc_university_teacher_can_review(teacher,submission) then raise exception 'teacher_reads_type_a';end if;
 perform set_config('pr3.a_submission',submission::text,true);
 end if;
 if d.evidence_key in('e03','e05') then
 result:=public.vc_university_evidence_write(a,enrollment,case d.evidence_key when 'e03' then m3 else m5 end,'submit',payload,0,gen_random_uuid());
 submission:=(result->'submission'->>'submission_id')::uuid;v_revision:=(result->>'revision_id')::uuid;
 if not vc_private.vc_university_teacher_can_review(teacher,submission) then raise exception 'assigned_teacher_denied';end if;
 if vc_private.vc_university_teacher_can_review(b,submission) or vc_private.vc_university_teacher_can_review(business,submission) or vc_private.vc_university_teacher_can_review(a,submission) then raise exception 'teacher_scope_bypass';end if;
 if d.evidence_key='e03' then
 if not(result->>'requirement_satisfied')::boolean then raise exception 'sampled_on_submission_not_satisfied';end if;
 caught:=false;begin perform public.vc_university_evidence_review(b,submission,v_revision,'approved','fixture feedback');exception when others then caught:=sqlerrm='evidence_review_denied';end;if not caught then raise exception 'unassigned_teacher_approved';end if;
 perform public.vc_university_evidence_review(teacher,submission,v_revision,'revision_requested','Ajuste estrutural da fixture');
 result:=public.vc_university_evidence_write(a,enrollment,m3,'draft',payload,1,null);
 result:=public.vc_university_evidence_write(a,enrollment,m3,'submit',payload,2,gen_random_uuid());
 if (result->'submission'->>'current_revision')::integer<>2 or result->'submission'->>'status'<>'resubmitted' then raise exception 'resubmission_not_new_revision';end if;
 caught:=false;begin perform public.vc_university_evidence_review(teacher,submission,v_revision,'approved','fixture feedback');exception when others then caught:=sqlerrm='review_revision_stale';end;if not caught then raise exception 'teacher_reviewed_stale_revision';end if;
 perform set_config('pr3.b_submission',submission::text,true);
 else
 if(result->>'requirement_satisfied')::boolean then raise exception 'on_approval_policy_ignored';end if;
 perform public.vc_university_evidence_review(teacher,submission,v_revision,'approved','Estrutura aprovada na fixture');
 if not exists(select 1 from public.vc_university_requirement_progress rp join public.vc_university_module_requirements mr using(requirement_id) where rp.enrollment_id=enrollment and mr.module_version_id=m5 and mr.requirement_type='evidence_completed' and rp.status='completed') then raise exception 'approval_did_not_satisfy_requirement';end if;
 end if;
 end if;
 end loop;
 -- Full M1 -> checkpoint -> M2, using the actual PR2 completion RPC.
 select requirement_id into req from public.vc_university_module_requirements where module_version_id=m1 and requirement_type='checkpoint_passed';
 insert into public.vc_university_checkpoint_attempts(enrollment_id,course_id,module_no,score,question_snapshot,answers,feedback)
 values(enrollment,'inteligencia-emocional-aplicada',1,4,'[{"fixture":true}]','[]','[{"fixture":true}]') returning attempt_id into attempt;
 insert into public.vc_university_requirement_progress(enrollment_id,requirement_id,status,source_type,source_id,satisfied_at) values(enrollment,req,'completed','checkpoint_attempt',attempt::text,now());
 result:=public.vc_university_complete_module_if_ready(enrollment,m1);if not(result->>'completed')::boolean then raise exception 'm1_not_completed_after_checkpoint';end if;
 result:=public.vc_university_evidence_write(a,enrollment,m2,'draft','{}',0,null);if result->'submission'->>'status'<>'draft' then raise exception 'm2_not_unlocked';end if;
 if exists(select 1 from public.vc_university_academic_audit_log where entity_type='submission' and (after_state::text like '%Fixture%' or before_state::text like '%Fixture%')) then raise exception 'content_leaked_to_audit';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('pr3.b'),true);
do $$ declare caught boolean; begin
 if exists(select 1 from public.vc_university_evidence_submissions where submission_id in(current_setting('pr3.a_submission')::uuid,current_setting('pr3.b_submission')::uuid)) then raise exception 'student_b_reads_a';end if;
 caught:=false;begin update public.vc_university_evidence_submissions set status='approved' where submission_id=current_setting('pr3.a_submission')::uuid;exception when insufficient_privilege then caught:=true;end;if not caught then raise exception 'student_b_writes_a';end if;
 caught:=false;begin insert into public.vc_university_evidence_reviews(submission_id,evidence_revision_id,reviewer_id,decision,feedback,rubric_version) values(gen_random_uuid(),gen_random_uuid(),auth.uid(),'approved','fixture','1');exception when insufficient_privilege then caught:=true;end;if not caught then raise exception 'student_writes_review';end if;
 caught:=false;begin update public.vc_university_evidence_revisions set content='tampered v_revision fixture';exception when insufficient_privilege then caught:=true;end;if not caught then raise exception 'student_mutates_revision';end if;
 if has_function_privilege('authenticated','public.vc_university_evidence_write(uuid,uuid,uuid,text,jsonb,integer,uuid)','EXECUTE') then raise exception 'browser_calls_service_rpc';end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('pr3.teacher'),true);
do $$ declare caught boolean;begin
 if exists(select 1 from public.vc_university_evidence_submissions where submission_id=current_setting('pr3.a_submission')::uuid) then raise exception 'teacher_reads_guided_evidence';end if;
 if not exists(select 1 from public.vc_university_evidence_revisions where submission_id=current_setting('pr3.b_submission')::uuid) then raise exception 'assigned_teacher_cannot_read_sample';end if;
 caught:=false;begin perform draft_data from public.vc_university_evidence_submissions where submission_id=current_setting('pr3.b_submission')::uuid;exception when insufficient_privilege then caught:=true;end;if not caught then raise exception 'teacher_reads_mutable_draft';end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('pr3.b2b'),true);
do $$ begin if exists(select 1 from public.vc_university_evidence_revisions where submission_id in(current_setting('pr3.a_submission')::uuid,current_setting('pr3.b_submission')::uuid)) then raise exception 'business_reads_text';end if;end $$;
select set_config('request.jwt.claim.sub','70aa4d75-bbb9-4839-aad8-670b7654664d',true);
do $$ begin if exists(select 1 from public.vc_university_evidence_revisions where submission_id in(current_setting('pr3.a_submission')::uuid,current_setting('pr3.b_submission')::uuid)) then raise exception 'owner_bypass';end if;end $$;
select set_config('request.jwt.claim.sub',current_setting('pr3.a'),true);
do $$ begin if (select count(*) from public.vc_university_evidence_submissions where submission_id=current_setting('pr3.a_submission')::uuid)<>1 then raise exception 'learner_cannot_read_own_submission';end if;end $$;
reset role;
rollback;
select 'PR3 structural validation, revisions, policies, RLS and E01->checkpoint->M2 passed; all fixtures rolled back' as result;
