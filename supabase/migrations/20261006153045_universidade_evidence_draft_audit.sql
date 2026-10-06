-- Preserve the append-only audit requirement with minimal draft metadata.
create or replace function public.vc_university_evidence_write(
 p_actor uuid,p_enrollment uuid,p_module uuid,p_action text,p_payload jsonb,
 p_expected_version integer,p_request_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare e public.vc_university_enrollments%rowtype; m public.vc_university_module_versions%rowtype;
 d public.vc_university_evidence_definition_versions%rowtype; s public.vc_university_evidence_submissions%rowtype;
 rev public.vc_university_evidence_revisions%rowtype; created boolean:=false; sufficient boolean; ev text;
begin
 if p_action not in ('draft','submit') then raise exception 'invalid_evidence_action'; end if;
 select * into e from public.vc_university_enrollments where enrollment_id=p_enrollment and user_id=p_actor and status='active';
 select * into m from public.vc_university_module_versions where module_version_id=p_module and course_id=e.course_id and course_version=e.course_version and status='published';
 if e.enrollment_id is null or m.module_version_id is null then raise exception 'evidence_context_denied'; end if;
 if exists(select 1 from public.vc_university_module_dependencies dep where dep.module_version_id=p_module and dep.status='published'
 and not exists(select 1 from public.vc_university_module_progress mp where mp.enrollment_id=p_enrollment and mp.module_version_id=dep.depends_on_module_version_id and mp.completed_at is not null)) then raise exception 'previous_module_required'; end if;
 select dv.* into d from public.vc_university_evidence_definition_versions dv
 join public.vc_university_evidence_definitions def on def.evidence_definition_id=dv.evidence_definition_id
 join public.vc_university_module_requirements r on r.module_version_id=p_module and r.status='published' and r.requirement_type='evidence_completed'
 and r.configuration->>'evidence_definition_version_id'=dv.evidence_definition_version_id::text
 where def.module_id=m.module_id and dv.course_id=e.course_id and dv.course_version=e.course_version and dv.status='published';
 if d.evidence_definition_version_id is null then raise exception 'evidence_definition_unavailable'; end if;
 perform pg_advisory_xact_lock(hashtext(p_enrollment::text||':'||d.evidence_definition_version_id::text));
 select * into s from public.vc_university_evidence_submissions where enrollment_id=p_enrollment and evidence_definition_version_id=d.evidence_definition_version_id for update;
 if s.submission_id is null then
 if p_expected_version<>0 then raise exception 'draft_version_conflict'; end if;
 insert into public.vc_university_evidence_submissions(enrollment_id,learner_id,course_id,course_version,evidence_definition_version_id)
 values(p_enrollment,p_actor,e.course_id,e.course_version,d.evidence_definition_version_id) returning * into s;
 created:=true;
 insert into public.vc_university_academic_audit_log(actor_id,action,entity_type,entity_id,after_state)
 values(p_actor,'evidence_draft_created','submission',s.submission_id::text,jsonb_build_object('status','draft','definition_version_id',d.evidence_definition_version_id));
 end if;
 if p_action='submit' then
 if p_request_id is null then raise exception 'submission_request_id_required'; end if;
 select * into rev from public.vc_university_evidence_revisions where submission_id=s.submission_id and request_id=p_request_id;
 if rev.evidence_revision_id is not null then
 if rev.structured_data is distinct from p_payload then raise exception 'idempotency_payload_conflict'; end if;
 return jsonb_build_object('submission',to_jsonb(s),'revision_id',rev.evidence_revision_id,'idempotent',true); end if;
 end if;
 if s.status not in ('draft','revision_requested') then raise exception 'submission_locked'; end if;
 if p_expected_version is null or s.draft_version<>p_expected_version then raise exception 'draft_version_conflict'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>65536 then raise exception 'invalid_draft'; end if;
 if p_action='draft' then
 update public.vc_university_evidence_submissions set draft_data=p_payload,draft_version=draft_version+1,updated_at=now() where submission_id=s.submission_id returning * into s;
 return jsonb_build_object('submission',to_jsonb(s)); end if;
 if not public.vc_university_validate_evidence(d.form_schema,p_payload) then raise exception 'evidence_structure_invalid'; end if;
 ev:=case when s.current_revision=0 then 'evidence_submitted' else 'evidence_resubmitted' end;
 insert into public.vc_university_evidence_revisions(submission_id,revision,content,structured_data,authored_by,request_id)
 values(s.submission_id,s.current_revision+1,'Structured evidence; see structured_data',p_payload,p_actor,p_request_id) returning * into rev;
 update public.vc_university_evidence_submissions set draft_data=p_payload,draft_version=draft_version+1,current_revision=s.current_revision+1,
 status=case when s.current_revision=0 then 'submitted' else 'resubmitted' end,submitted_at=now(),updated_at=now(),
 review_selected=case when d.validation_mode='human_required' then true when d.validation_mode='sampled' then
 review_selected or (get_byte(decode(substr(md5(submission_id::text),1,2),'hex'),0)*100/256)<coalesce((d.validation_policy->>'sample_percent')::integer,0) else false end
 where submission_id=s.submission_id returning * into s;
 sufficient:=d.validation_mode in ('guided','structural','sampled') and d.validation_policy->>'sufficiency'='on_submission';
 perform public.vc_university_evidence_requirement(s.submission_id,sufficient);
 insert into public.vc_university_academic_audit_log(actor_id,action,entity_type,entity_id,after_state,request_id)
 values(p_actor,ev,'submission',s.submission_id::text,jsonb_build_object('revision_id',rev.evidence_revision_id,'status',s.status,'validation_mode',d.validation_mode),p_request_id);
 return jsonb_build_object('submission',to_jsonb(s),'revision_id',rev.evidence_revision_id,'requirement_satisfied',sufficient);
end $$;

