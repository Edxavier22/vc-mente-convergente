-- Tighten retry context and explicit teacher review transition.
create or replace function public.vc_university_cycle_write(p_actor uuid,p_enrollment uuid,p_action text,p_payload jsonb,p_expected_version integer,p_request uuid default null,p_key text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.vc_university_enrollments%rowtype; v public.vc_university_application_cycle_versions%rowtype; c public.vc_university_application_cycles%rowtype; s public.vc_university_evidence_submissions%rowtype; d public.vc_university_evidence_definition_versions%rowtype; rev public.vc_university_evidence_revisions%rowtype; en public.vc_university_application_cycle_entries%rowtype; phase jsonb; state text; typ text; key text; id uuid; snapshot jsonb; previous jsonb; event text;
begin
 if p_action not in('setup_draft','weekly_draft','final_draft','start','goal_revise','pause','resume','log','weekly_complete','final_complete','submit') or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>65536 then raise exception 'invalid_cycle_request';end if;
 select * into e from public.vc_university_enrollments where enrollment_id=p_enrollment and user_id=p_actor and status='active';if e.enrollment_id is null then raise exception 'cycle_context_denied';end if;
 select * into v from public.vc_university_application_cycle_versions where course_id=e.course_id and course_version=e.course_version and status='published' order by created_at desc limit 1;if v.cycle_version_id is null then raise exception 'cycle_definition_unavailable';end if;
 perform pg_advisory_xact_lock(hashtext(p_enrollment::text||':'||v.cycle_version_id::text));
 select * into c from public.vc_university_application_cycles where enrollment_id=p_enrollment and cycle_version_id=v.cycle_version_id for update;
 if c.application_cycle_id is null then
 if p_action<>'setup_draft' or p_expected_version<>0 then raise exception 'cycle_setup_required';end if;
 if not exists(select 1 from public.vc_university_module_progress where enrollment_id=p_enrollment and module_no=(v.configuration->>'setup_after_module')::integer and completed_at is not null) then raise exception 'cycle_setup_ineligible';end if;
 insert into public.vc_university_application_cycles(cycle_version_id,enrollment_id,learner_id) values(v.cycle_version_id,p_enrollment,p_actor) returning * into c;
 perform public.vc_university_cycle_audit(p_actor,c.application_cycle_id,'cycle_setup_created',jsonb_build_object('status','setup'));
 end if;
 state:=public.vc_university_cycle_state(c.application_cycle_id);
 select * into c from public.vc_university_application_cycles where application_cycle_id=c.application_cycle_id;
 -- Same mutation request is safe to retry after any subsequent state/version change.
 if p_request is not null and p_action in('start','goal_revise','log','weekly_complete','final_complete') then
 select * into en from public.vc_university_application_cycle_entries where application_cycle_id=c.application_cycle_id and request_id=p_request;
 if en.cycle_entry_id is not null then if en.payload is distinct from p_payload or (p_action='log' and (en.entry_type<>'log' or en.entry_key is distinct from p_key)) or (p_action='weekly_complete' and (en.entry_type<>'weekly_review' or en.entry_key is distinct from p_key)) or (p_action='final_complete' and en.entry_type<>'final_reflection') or (p_action in('start','goal_revise') and en.entry_type<>'objective') then raise exception 'idempotency_payload_conflict';end if;return public.vc_university_cycle_read(p_actor,p_enrollment);end if;end if;
 if p_action='submit' and c.evidence_submission_id is not null then
 select * into rev from public.vc_university_evidence_revisions where submission_id=c.evidence_submission_id and request_id=p_request;
 if rev.evidence_revision_id is not null then if rev.structured_data->'selected_entry_ids' is distinct from p_payload->'selected_entry_ids' then raise exception 'idempotency_payload_conflict';end if;return public.vc_university_cycle_read(p_actor,p_enrollment);end if;end if;
 if c.draft_version is distinct from p_expected_version then raise exception 'draft_version_conflict';end if;
 if state in('approved','closed_incomplete','submitted','resubmitted','under_review','completed','abandoned') then raise exception 'cycle_locked';end if;
 if c.special_review_required then raise exception 'pedagogical_review_required';end if;
 if p_action like '%_draft' then
 typ:=case p_action when 'setup_draft' then 'setup' when 'weekly_draft' then 'weekly_review' else 'final_reflection' end;
 if typ='setup' and state<>'setup' then raise exception 'cycle_transition_denied';end if;
 if typ<>'setup' and (c.started_at is null or state='paused') then raise exception 'cycle_transition_denied';end if;
 key:=case when typ='weekly_review' then 'weekly-'||coalesce(p_key,'') else typ end;
 if typ='weekly_review' and not exists(select 1 from jsonb_array_elements(v.configuration->'phases') ph where ph->>'key'=p_key) then raise exception 'cycle_entry_key_invalid';end if;
 if typ='weekly_review' and exists(select 1 from public.vc_university_application_cycle_entries where application_cycle_id=c.application_cycle_id and entry_type=typ and entry_key=p_key) then raise exception 'weekly_review_immutable';end if;
 update public.vc_university_application_cycles set drafts=jsonb_set(drafts,array[key],p_payload,true),draft_version=draft_version+1 where application_cycle_id=c.application_cycle_id;
 elsif p_action='start' then
 if state<>'setup' or not exists(select 1 from public.vc_university_module_progress where enrollment_id=p_enrollment and module_no=(v.configuration->>'start_after_module')::integer and completed_at is not null) then raise exception 'cycle_start_ineligible';end if;
 if not public.vc_university_validate_evidence(v.configuration->'forms'->'setup',p_payload) then raise exception 'cycle_structure_invalid';end if;
 id:=public.vc_university_cycle_entry(p_actor,c.application_cycle_id,'objective','principal',p_payload,p_request);
 update public.vc_university_application_cycles set status='active',started_at=now(),operational_deadline=now()+make_interval(days=>(v.configuration->>'window_days')::integer),draft_version=draft_version+1 where application_cycle_id=c.application_cycle_id;
 perform public.vc_university_cycle_audit(p_actor,c.application_cycle_id,'cycle_started',jsonb_build_object('entry_id',id,'status','active'));
 elsif p_action='pause' then
 if state not in('active','resumed','awaiting_weekly_review','final_reflection') or coalesce(p_payload->>'reason','') not in('rotina','disponibilidade','seguranca','outro','prefiro_nao_informar') or p_payload-'reason'<>'{}'::jsonb then raise exception 'cycle_transition_denied';end if;
 update public.vc_university_application_cycles set status='paused',paused_at=now(),draft_version=draft_version+1 where application_cycle_id=c.application_cycle_id;
 perform public.vc_university_cycle_audit(p_actor,c.application_cycle_id,'cycle_paused',jsonb_build_object('reason',p_payload->>'reason','status','paused'));
 elsif p_action='resume' then
 if state<>'paused' then raise exception 'cycle_transition_denied';end if;
 update public.vc_university_application_cycles set status='resumed',resumed_at=now(),draft_version=draft_version+1 where application_cycle_id=c.application_cycle_id;
 perform public.vc_university_cycle_audit(p_actor,c.application_cycle_id,'cycle_resumed',jsonb_build_object('status','resumed'));
 elsif p_action='goal_revise' then
 if state not in('active','resumed','awaiting_weekly_review','final_reflection') or length(btrim(p_payload->>'motivo_alteracao')) not between 3 and 1200 then raise exception 'cycle_transition_denied';end if;
 if (select count(*) from public.vc_university_application_cycle_entries where application_cycle_id=c.application_cycle_id and entry_type='objective')>(v.configuration->>'goal_change_limit')::integer then raise exception 'goal_change_limit_reached';end if;
 if not public.vc_university_validate_evidence(v.configuration->'forms'->'setup',p_payload-'motivo_alteracao') then raise exception 'cycle_structure_invalid';end if;
 id:=public.vc_university_cycle_entry(p_actor,c.application_cycle_id,'objective','principal',p_payload,p_request);
 update public.vc_university_application_cycles set draft_version=draft_version+1 where application_cycle_id=c.application_cycle_id;
 perform public.vc_university_cycle_audit(p_actor,c.application_cycle_id,'cycle_goal_revised',jsonb_build_object('entry_id',id));
 elsif p_action in('log','weekly_complete','final_complete') then
 if state not in('active','resumed','awaiting_weekly_review','final_reflection','revision_requested') then raise exception 'cycle_transition_denied';end if;
 typ:=case p_action when 'log' then 'log' when 'weekly_complete' then 'weekly_review' else 'final_reflection' end;
 key:=case when typ='final_reflection' then 'final' else p_key end;
 if key is null or key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or length(key)>80 then raise exception 'cycle_entry_key_invalid';end if;
 if not public.vc_university_validate_evidence(v.configuration->'forms'->typ,p_payload) then raise exception 'cycle_structure_invalid';end if;
 if typ='log' then
 if p_payload->>'data' !~ '^\d{4}-\d{2}-\d{2}$' or (p_payload->>'data')::date<c.started_at::date or (p_payload->>'data')::date>least(now()::date,c.operational_deadline::date) then raise exception 'cycle_log_date_invalid';end if;
 select payload into previous from public.vc_university_application_cycle_entries where application_cycle_id=c.application_cycle_id and entry_type='objective' order by revision desc limit 1;
 for i in 1..3 loop if coalesce(p_payload->>('indicador_'||i),'')<>'' and not exists(select 1 from generate_series(1,3) n where previous->>('indicador_'||n)=p_payload->>('indicador_'||i)) then raise exception 'cycle_indicator_invalid';end if;end loop;
 elsif typ='weekly_review' then
 select value into phase from jsonb_array_elements(v.configuration->'phases') where value->>'key'=key;
 if phase is null or now()<c.started_at+make_interval(days=>(phase->>'end')::integer) then raise exception 'weekly_review_not_due';end if;
 if exists(select 1 from public.vc_university_application_cycle_entries where application_cycle_id=c.application_cycle_id and entry_type=typ and entry_key=key) and state<>'revision_requested' then raise exception 'weekly_review_immutable';end if;
 elsif now()<c.started_at+make_interval(days=>v.duration_days) then raise exception 'cycle_duration_pending';end if;
 id:=public.vc_university_cycle_entry(p_actor,c.application_cycle_id,typ,key,p_payload,p_request);
 update public.vc_university_application_cycles set draft_version=draft_version+1,status=case when status='awaiting_weekly_review' then 'active' else status end where application_cycle_id=c.application_cycle_id;
 perform public.vc_university_cycle_audit(p_actor,c.application_cycle_id,case typ when 'log' then 'cycle_log_created' when 'weekly_review' then 'weekly_review_completed' else 'cycle_final_reflection_completed' end,jsonb_build_object('entry_id',id));
 elsif p_action='submit' then
 if state not in('final_reflection','revision_requested') or p_request is null or p_payload->>'privacy_confirmed' is distinct from 'true' or p_payload-array['privacy_confirmed','selected_entry_ids']<>'{}'::jsonb then raise exception 'cycle_transition_denied';end if;
 snapshot:=public.vc_university_cycle_integrator(c.application_cycle_id,p_payload->'selected_entry_ids')||jsonb_build_object('selected_entry_ids',p_payload->'selected_entry_ids');
 select dv.* into d from public.vc_university_evidence_definition_versions dv join public.vc_university_evidence_definitions def using(evidence_definition_id) where dv.course_id=e.course_id and dv.course_version=e.course_version and dv.status='published' and def.evidence_key=v.configuration->>'final_evidence_key' and dv.validation_mode='human_required';
 if d.evidence_definition_version_id is null then raise exception 'evidence_definition_unavailable';end if;
 select * into s from public.vc_university_evidence_submissions where submission_id=c.evidence_submission_id;
 if s.submission_id is null then insert into public.vc_university_evidence_submissions(enrollment_id,learner_id,course_id,course_version,evidence_definition_version_id) values(p_enrollment,p_actor,e.course_id,e.course_version,d.evidence_definition_version_id) returning * into s;end if;
 if s.current_revision> (v.configuration->>'included_revisions')::integer+c.special_revisions_granted then raise exception 'pedagogical_review_required';end if;
 insert into public.vc_university_evidence_revisions(submission_id,revision,content,structured_data,authored_by,request_id) values(s.submission_id,s.current_revision+1,'Structured evidence; see structured_data',snapshot,p_actor,p_request) returning * into rev;
 event:=case when s.current_revision=0 then 'e10_submitted' else 'e10_resubmitted' end;
 state:=case when s.current_revision=0 then 'submitted' else 'resubmitted' end;
 update public.vc_university_evidence_submissions set status=state,current_revision=s.current_revision+1,submitted_at=now(),review_selected=true,updated_at=now() where submission_id=s.submission_id;
 update public.vc_university_application_cycles set status=state,evidence_submission_id=s.submission_id,draft_version=draft_version+1 where application_cycle_id=c.application_cycle_id;
 perform public.vc_university_cycle_audit(p_actor,c.application_cycle_id,event,jsonb_build_object('submission_id',s.submission_id,'revision_id',rev.evidence_revision_id,'status',state));
 end if;
 return public.vc_university_cycle_read(p_actor,p_enrollment);
end $$;
create or replace function public.vc_university_cycle_review(p_actor uuid,p_submission uuid,p_revision uuid,p_points jsonb,p_feedback jsonb,p_action text default 'evaluate') returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.vc_university_application_cycles%rowtype; s public.vc_university_evidence_submissions%rowtype; v public.vc_university_application_cycle_versions%rowtype; criterion jsonb; val numeric; total numeric:=0; decision text; current_id uuid; key text;
begin
 select * into s from public.vc_university_evidence_submissions where submission_id=p_submission for update;
 if not vc_private.vc_university_teacher_can_review(p_actor,p_submission) then raise exception 'evidence_review_denied';end if;
 select * into c from public.vc_university_application_cycles where evidence_submission_id=p_submission for update;
 if c.application_cycle_id is null then raise exception 'cycle_context_denied';end if;
 select * into v from public.vc_university_application_cycle_versions where cycle_version_id=c.cycle_version_id;
 select evidence_revision_id into current_id from public.vc_university_evidence_revisions where submission_id=p_submission and revision=s.current_revision;
 if current_id is distinct from p_revision then raise exception 'review_revision_stale';end if;
 if p_action='begin_review' then
 if s.status not in('submitted','resubmitted') then raise exception 'review_state_conflict';end if;
 update public.vc_university_evidence_submissions set status='under_review',updated_at=now() where submission_id=p_submission;
 update public.vc_university_application_cycles set status='under_review' where application_cycle_id=c.application_cycle_id;
 perform public.vc_university_cycle_audit(p_actor,c.application_cycle_id,'cycle_under_review',jsonb_build_object('revision_id',p_revision,'status','under_review'));
 return jsonb_build_object('status','under_review');end if;
 if p_action='authorize_special_revision' then
 if not c.special_review_required or c.special_revisions_granted>=10 then raise exception 'review_state_conflict';end if;
 update public.vc_university_application_cycles set special_review_required=false,special_revisions_granted=special_revisions_granted+1,revision_deadline=now()+make_interval(days=>(v.configuration->>'revision_response_days')::integer) where application_cycle_id=c.application_cycle_id;
 perform public.vc_university_cycle_audit(p_actor,c.application_cycle_id,'cycle_special_revision_authorized',jsonb_build_object('revision_id',p_revision));
 return jsonb_build_object('status','revision_requested','special_review_required',false);end if;
 if p_action<>'evaluate' or s.status not in('submitted','resubmitted','under_review') or jsonb_typeof(p_points) is distinct from 'object' or jsonb_typeof(p_feedback) is distinct from 'object' then raise exception 'invalid_rubric_review';end if;
 for criterion in select value from jsonb_array_elements(v.configuration->'rubric'->'criteria') loop
 key:=criterion->>'key';if jsonb_typeof(p_points->key) is distinct from 'number' then raise exception 'invalid_rubric_review';end if;
 val:=(p_points->>key)::numeric;if val<0 or val>(criterion->>'max_points')::numeric then raise exception 'invalid_rubric_review';end if;total:=total+val;end loop;
 if (select count(*) from jsonb_object_keys(p_points))<>jsonb_array_length(v.configuration->'rubric'->'criteria') then raise exception 'invalid_rubric_review';end if;
 for key in select unnest(array['reconhecer_evidencia','localizar_lacuna','retornar_ao_criterio','orientar_proxima_acao']) loop
 if jsonb_typeof(p_feedback->key) is distinct from 'string' or length(btrim(p_feedback->>key)) not between 3 and 900 then raise exception 'invalid_rubric_review';end if;end loop;
 if (select count(*) from jsonb_object_keys(p_feedback))<>4 then raise exception 'invalid_rubric_review';end if;
 decision:=case when total>=(v.configuration->'rubric'->>'pass_points')::numeric then 'approved' else 'revision_requested' end;
 insert into public.vc_university_evidence_reviews(submission_id,evidence_revision_id,reviewer_id,decision,feedback,rubric_version,criterion_points,total_points,structured_feedback)
 values(p_submission,p_revision,p_actor,decision,concat_ws(E'\n',p_feedback->>'reconhecer_evidencia',p_feedback->>'localizar_lacuna',p_feedback->>'retornar_ao_criterio',p_feedback->>'orientar_proxima_acao'),v.configuration->'rubric'->>'version',p_points,total,p_feedback);
 update public.vc_university_evidence_submissions set status=decision,approved_at=case when decision='approved' then now() else null end,updated_at=now() where submission_id=p_submission;
 update public.vc_university_application_cycles set status=decision,completed_at=case when decision='approved' then now() else null end,
 revision_deadline=case when decision='revision_requested' then now()+make_interval(days=>(v.configuration->>'revision_response_days')::integer) else null end,
 special_review_required=decision='revision_requested' and s.current_revision>=1+(v.configuration->>'included_revisions')::integer+c.special_revisions_granted where application_cycle_id=c.application_cycle_id;
 perform public.vc_university_evidence_requirement(p_submission,decision='approved');
 perform public.vc_university_cycle_audit(p_actor,c.application_cycle_id,case when decision='approved' then 'e10_approved' else 'e10_revision_requested' end,jsonb_build_object('submission_id',p_submission,'revision_id',p_revision,'status',decision,'points',total));
 return jsonb_build_object('status',decision,'total_points',total,'revision_id',p_revision);
end $$;
