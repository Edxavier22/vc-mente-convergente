-- Universidade V&C — PR 1 follow-up hardening.
-- Server-only catalog tables use explicit deny policies for browser roles.
-- service_role continues to bypass RLS and is only available to Edge Functions.

create index if not exists vc_university_cycle_entries_supersedes_idx
  on public.vc_university_application_cycle_entries (supersedes_entry_id);
create index if not exists vc_university_cycle_entries_created_by_idx
  on public.vc_university_application_cycle_entries (created_by);
create index if not exists vc_university_cycle_versions_course_idx
  on public.vc_university_application_cycle_versions (course_id, course_version);
create index if not exists vc_university_cycles_enrollment_learner_idx
  on public.vc_university_application_cycles (enrollment_id, learner_id);
create index if not exists vc_university_content_blocks_created_by_idx
  on public.vc_university_content_blocks (created_by);
create index if not exists vc_university_course_competencies_competency_idx
  on public.vc_university_course_competencies (competency_id);
create index if not exists vc_university_course_versions_supersedes_idx
  on public.vc_university_course_versions (course_id, supersedes_version);
create index if not exists vc_university_course_versions_created_by_idx
  on public.vc_university_course_versions (created_by);
create index if not exists vc_university_evidence_definition_versions_course_idx
  on public.vc_university_evidence_definition_versions (course_id, course_version);
create index if not exists vc_university_evidence_definition_versions_created_by_idx
  on public.vc_university_evidence_definition_versions (created_by);
create index if not exists vc_university_evidence_definitions_module_idx
  on public.vc_university_evidence_definitions (module_id);
create index if not exists vc_university_evidence_reviews_revision_idx
  on public.vc_university_evidence_reviews (evidence_revision_id);
create index if not exists vc_university_evidence_reviews_reviewer_idx
  on public.vc_university_evidence_reviews (reviewer_id);
create index if not exists vc_university_evidence_revisions_author_idx
  on public.vc_university_evidence_revisions (authored_by);
create index if not exists vc_university_evidence_submissions_enrollment_course_idx
  on public.vc_university_evidence_submissions (enrollment_id, course_id, course_version);
create index if not exists vc_university_evidence_submissions_definition_version_idx
  on public.vc_university_evidence_submissions (evidence_definition_version_id);
create index if not exists vc_university_evidence_submissions_enrollment_learner_idx
  on public.vc_university_evidence_submissions (enrollment_id, learner_id);
create index if not exists vc_university_learning_tool_versions_course_idx
  on public.vc_university_learning_tool_versions (course_id, course_version);
create index if not exists vc_university_lesson_versions_created_by_idx
  on public.vc_university_lesson_versions (created_by);
create index if not exists vc_university_module_versions_module_idx
  on public.vc_university_module_versions (course_id, module_id);
create index if not exists vc_university_preview_sessions_actor_idx
  on public.vc_university_preview_sessions (actor_id);
create index if not exists vc_university_preview_sessions_course_idx
  on public.vc_university_preview_sessions (course_id, course_version);
create index if not exists vc_university_source_links_content_block_idx
  on public.vc_university_source_links (content_block_id);
create index if not exists vc_university_source_links_course_idx
  on public.vc_university_source_links (course_id, course_version);
create index if not exists vc_university_source_links_tool_version_idx
  on public.vc_university_source_links (learning_tool_version_id);
create index if not exists vc_university_source_links_lesson_version_idx
  on public.vc_university_source_links (lesson_version_id);
create index if not exists vc_university_source_links_module_version_idx
  on public.vc_university_source_links (module_version_id);
create index if not exists vc_university_source_links_question_idx
  on public.vc_university_source_links (question_id);

do $policy$
declare
  table_name text;
  server_only_tables constant text[] := array[
    'vc_university_academic_audit_log',
    'vc_university_application_cycle_definitions',
    'vc_university_application_cycle_versions',
    'vc_university_competencies',
    'vc_university_content_blocks',
    'vc_university_course_competencies',
    'vc_university_course_versions',
    'vc_university_evidence_definition_versions',
    'vc_university_evidence_definitions',
    'vc_university_learning_tool_versions',
    'vc_university_learning_tools',
    'vc_university_lesson_versions',
    'vc_university_lessons',
    'vc_university_module_versions',
    'vc_university_preview_sessions',
    'vc_university_question_options',
    'vc_university_source_links',
    'vc_university_sources'
  ];
begin
  foreach table_name in array server_only_tables loop
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      table_name || '_browser_deny',
      table_name
    );
  end loop;
end
$policy$;
