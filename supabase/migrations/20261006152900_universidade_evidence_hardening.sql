-- Remove the obsolete JSON enrollment dependency; the canonical version FK stays in place.
alter table public.vc_university_enrollments drop constraint if exists vc_university_enrollments_content_version_fkey;
create or replace function public.vc_university_pin_enrollment_version() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.course_id,new.course_version) is distinct from (old.course_id,old.course_version) then raise exception 'enrollment_course_version_immutable';end if;
 if new.course_version is null then
 select c.version into new.course_version from public.vc_university_courses c
 join public.vc_university_course_versions v on v.course_id=c.course_id and v.version=c.version
 where c.course_id=new.course_id and ((v.content_model='structured_blocks' and v.status='published')
 or (v.content_model='legacy_json' and exists(select 1 from public.vc_university_course_content cc where cc.course_id=c.course_id and cc.course_version=c.version)));
 end if;
 if new.course_version is null then raise exception 'course_version_unavailable';end if;
 return new;
end $$;
revoke all on function public.vc_university_pin_enrollment_version() from public,anon,authenticated;
grant execute on function public.vc_university_pin_enrollment_version() to service_role;
-- Prevent cross-course/version links even in privileged maintenance.
alter table public.vc_university_evidence_definitions
 add constraint evidence_definition_module_context foreign key(course_id,module_id) references public.vc_university_modules(course_id,module_id),
 add constraint evidence_definition_course_identity unique(evidence_definition_id,course_id);
alter table public.vc_university_evidence_definition_versions
 add constraint evidence_version_definition_context foreign key(evidence_definition_id,course_id) references public.vc_university_evidence_definitions(evidence_definition_id,course_id),
 add constraint evidence_version_course_identity unique(evidence_definition_version_id,course_id,course_version),
 add constraint evidence_policy_sufficiency check(validation_policy='{}' or (validation_policy->>'sufficiency' in('on_submission','on_approval') and validation_policy ? 'sufficiency')),
 add constraint evidence_policy_sampling check(not(validation_policy ? 'sample_percent') or (jsonb_typeof(validation_policy->'sample_percent')='number' and (validation_policy->>'sample_percent')::numeric between 0 and 100));
alter table public.vc_university_evidence_submissions
 add constraint evidence_submission_definition_context foreign key(evidence_definition_version_id,course_id,course_version) references public.vc_university_evidence_definition_versions(evidence_definition_version_id,course_id,course_version);
create index evidence_definition_module_context_idx on public.vc_university_evidence_definitions(course_id,module_id);
create index evidence_version_definition_context_idx on public.vc_university_evidence_definition_versions(evidence_definition_id,course_id);
create index evidence_submission_definition_context_idx on public.vc_university_evidence_submissions(evidence_definition_version_id,course_id,course_version);
create trigger evidence_review_immutable before update or delete on public.vc_university_evidence_reviews
 for each row execute function public.vc_university_reject_version_mutation();
