-- Universidade V&C — fundação acadêmica multicursos e versionável.
--
-- Esta migration amplia o modelo existente sem substituir as tabelas e os
-- contratos usados por Liderança Estratégica Aplicada. Nenhum conteúdo de
-- Inteligência Emocional é criado aqui: o PR 1 entrega apenas a fundação.

-- ---------------------------------------------------------------------------
-- 1. Versões canônicas de curso e módulo
-- ---------------------------------------------------------------------------

alter table public.vc_university_modules
 add column if not exists module_id uuid not null default gen_random_uuid();

create unique index if not exists vc_university_modules_module_id_uidx
 on public.vc_university_modules(module_id);
create unique index if not exists vc_university_modules_course_module_id_uidx
 on public.vc_university_modules(course_id,module_id);

create table if not exists public.vc_university_course_versions (
 course_id text not null references public.vc_university_courses(course_id),
 version text not null check (version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$'),
 title_snapshot text not null,
 description_snapshot text not null default '',
 audience_snapshot text not null default '',
 modality_snapshot text not null,
 hours_minutes integer not null check (hours_minutes > 0),
 final_pass_percent smallint not null check (final_pass_percent between 1 and 100),
 certificate_requires_project_review boolean not null default false,
 content_model text not null default 'structured_blocks'
  check (content_model in ('legacy_json','structured_blocks')),
 status text not null default 'draft'
  check (status in ('draft','review','published','archived')),
 supersedes_version text,
 published_at timestamptz,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 primary key (course_id,version),
 foreign key (course_id,supersedes_version)
  references public.vc_university_course_versions(course_id,version),
 check (supersedes_version is null or supersedes_version <> version),
 check ((status = 'published' and published_at is not null) or status <> 'published')
);

insert into public.vc_university_course_versions
 (course_id,version,title_snapshot,description_snapshot,audience_snapshot,
  modality_snapshot,hours_minutes,final_pass_percent,
  certificate_requires_project_review,content_model,status,published_at)
select c.course_id, cc.course_version,
 coalesce(nullif(cc.content->>'title',''),c.title), c.description, c.audience,
 c.modality, c.hours_minutes, c.final_pass_percent,
 c.certificate_requires_project_review, 'legacy_json',
 case when cc.course_version=c.version then c.status else 'archived' end,
 case when cc.course_version=c.version and c.status='published' then cc.imported_at else null end
from public.vc_university_course_content cc
join public.vc_university_courses c on c.course_id=cc.course_id
on conflict (course_id,version) do nothing;

insert into public.vc_university_course_versions
 (course_id,version,title_snapshot,description_snapshot,audience_snapshot,
  modality_snapshot,hours_minutes,final_pass_percent,
  certificate_requires_project_review,content_model,status,published_at)
select c.course_id,c.version,c.title,c.description,c.audience,c.modality,
 c.hours_minutes,c.final_pass_percent,c.certificate_requires_project_review,
 'structured_blocks',c.status,
 case when c.status='published' then c.created_at else null end
from public.vc_university_courses c
where not exists (
 select 1 from public.vc_university_course_versions v
 where v.course_id=c.course_id and v.version=c.version
)
on conflict (course_id,version) do nothing;

do $$ begin
 if not exists (
  select 1 from pg_constraint
  where conname='vc_university_course_content_version_fkey'
   and conrelid='public.vc_university_course_content'::regclass
 ) then
  alter table public.vc_university_course_content
   add constraint vc_university_course_content_version_fkey
   foreign key (course_id,course_version)
   references public.vc_university_course_versions(course_id,version);
 end if;
end $$;

do $$ begin
 if not exists (
  select 1 from pg_constraint
  where conname='vc_university_enrollments_course_version_catalog_fkey'
   and conrelid='public.vc_university_enrollments'::regclass
 ) then
  alter table public.vc_university_enrollments
   add constraint vc_university_enrollments_course_version_catalog_fkey
   foreign key (course_id,course_version)
   references public.vc_university_course_versions(course_id,version);
 end if;
end $$;

create table if not exists public.vc_university_module_versions (
 module_version_id uuid primary key default gen_random_uuid(),
 module_id uuid not null,
 course_id text not null,
 course_version text not null,
 module_no integer not null check (module_no > 0),
 title text not null,
 estimated_minutes integer not null check (estimated_minutes > 0),
 evidence_required boolean not null default true,
 checkpoint_pass_count smallint not null default 4
  check (checkpoint_pass_count between 1 and 5),
 status text not null default 'draft'
  check (status in ('draft','review','published','archived')),
 created_at timestamptz not null default now(),
 unique (course_id,course_version,module_no),
 unique (module_id,course_version),
 foreign key (course_id,module_id)
  references public.vc_university_modules(course_id,module_id),
 foreign key (course_id,course_version)
  references public.vc_university_course_versions(course_id,version)
);

insert into public.vc_university_module_versions
 (module_id,course_id,course_version,module_no,title,estimated_minutes,
  evidence_required,checkpoint_pass_count,status)
select m.module_id,m.course_id,v.version,m.module_no,m.title,m.estimated_minutes,
 m.evidence_required,m.checkpoint_pass_count,
 case when v.status='archived' then 'archived' else v.status end
from public.vc_university_modules m
join public.vc_university_course_versions v on v.course_id=m.course_id
on conflict (course_id,course_version,module_no) do nothing;

create index if not exists vc_university_module_versions_course_idx
 on public.vc_university_module_versions(course_id,course_version,module_no);

-- ---------------------------------------------------------------------------
-- 2. Aulas e blocos de conteúdo estruturado (sem substituir o JSON legado)
-- ---------------------------------------------------------------------------

create table if not exists public.vc_university_lessons (
 lesson_id uuid primary key default gen_random_uuid(),
 module_id uuid not null references public.vc_university_modules(module_id),
 lesson_key text not null check (lesson_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
 created_at timestamptz not null default now(),
 unique (module_id,lesson_key)
);

create table if not exists public.vc_university_lesson_versions (
 lesson_version_id uuid primary key default gen_random_uuid(),
 lesson_id uuid not null references public.vc_university_lessons(lesson_id),
 module_version_id uuid not null
  references public.vc_university_module_versions(module_version_id),
 revision integer not null default 1 check (revision > 0),
 title text not null,
 learning_objectives jsonb not null default '[]'::jsonb
  check (jsonb_typeof(learning_objectives)='array'),
 estimated_minutes integer not null check (estimated_minutes > 0),
 status text not null default 'draft'
  check (status in ('draft','review','published','archived')),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique (lesson_id,module_version_id,revision)
);

create table if not exists public.vc_university_content_blocks (
 content_block_id uuid primary key default gen_random_uuid(),
 lesson_version_id uuid not null
  references public.vc_university_lesson_versions(lesson_version_id),
 block_key text not null check (block_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
 block_type text not null check (block_type in (
  'opening','objective','study','concept','case','application','reflection',
  'workshop','evidence','rubric','checkpoint_review','summary','reference','tool'
 )),
 position integer not null check (position > 0),
 revision integer not null default 1 check (revision > 0),
 content jsonb not null check (jsonb_typeof(content)='object'),
 status text not null default 'draft'
  check (status in ('draft','review','published','archived')),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique (lesson_version_id,block_key,revision),
 unique (lesson_version_id,position,revision)
);

create index if not exists vc_university_lessons_module_idx
 on public.vc_university_lessons(module_id);
create index if not exists vc_university_lesson_versions_module_idx
 on public.vc_university_lesson_versions(module_version_id,status);
create index if not exists vc_university_content_blocks_lesson_idx
 on public.vc_university_content_blocks(lesson_version_id,position);

-- ---------------------------------------------------------------------------
-- 3. Competências e banco de questões com opções estáveis
-- ---------------------------------------------------------------------------

create table if not exists public.vc_university_competencies (
 competency_id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9._-]{1,63}$'),
 title text not null,
 description text not null default '',
 domain text not null default 'general',
 status text not null default 'draft'
  check (status in ('draft','review','published','archived')),
 created_at timestamptz not null default now()
);

create table if not exists public.vc_university_course_competencies (
 course_id text not null,
 course_version text not null,
 competency_id uuid not null
  references public.vc_university_competencies(competency_id),
 position integer not null default 1 check (position > 0),
 required boolean not null default true,
 metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
 primary key (course_id,course_version,competency_id),
 foreign key (course_id,course_version)
  references public.vc_university_course_versions(course_id,version)
);

alter table public.vc_university_questions
 add column if not exists question_key uuid not null default gen_random_uuid(),
 add column if not exists question_version integer not null default 1,
 add column if not exists difficulty text,
 add column if not exists competency_id uuid
  references public.vc_university_competencies(competency_id),
 add column if not exists status text not null default 'published',
 add column if not exists correct_option_id uuid,
 add column if not exists correct_feedback text;

do $$ begin
 if not exists (
  select 1 from pg_constraint
  where conname='vc_university_questions_question_version_check'
   and conrelid='public.vc_university_questions'::regclass
 ) then
  alter table public.vc_university_questions
   add constraint vc_university_questions_question_version_check
   check (question_version > 0);
 end if;
 if not exists (
  select 1 from pg_constraint
  where conname='vc_university_questions_difficulty_check'
   and conrelid='public.vc_university_questions'::regclass
 ) then
  alter table public.vc_university_questions
   add constraint vc_university_questions_difficulty_check
   check (difficulty is null or difficulty in ('N1','N2','N3'));
 end if;
 if not exists (
  select 1 from pg_constraint
  where conname='vc_university_questions_status_check'
   and conrelid='public.vc_university_questions'::regclass
 ) then
  alter table public.vc_university_questions
   add constraint vc_university_questions_status_check
   check (status in ('draft','review','published','archived'));
 end if;
end $$;

update public.vc_university_questions
set status=case when active then 'published' else 'archived' end
where status='published' and active=false;

create unique index if not exists vc_university_questions_key_version_uidx
 on public.vc_university_questions(question_key,question_version);

create table if not exists public.vc_university_question_options (
 option_id uuid primary key default gen_random_uuid(),
 question_id uuid not null references public.vc_university_questions(question_id),
 option_order smallint not null check (option_order between 0 and 15),
 option_text text not null,
 feedback text,
 is_correct boolean not null default false,
 created_at timestamptz not null default now(),
 unique (question_id,option_id),
 unique (question_id,option_order)
);

create unique index if not exists vc_university_question_options_correct_uidx
 on public.vc_university_question_options(question_id) where is_correct;

insert into public.vc_university_question_options
 (question_id,option_order,option_text,is_correct)
select q.question_id, choice.ordinality-1, choice.value,
 (choice.ordinality-1)=q.correct_index
from public.vc_university_questions q
cross join lateral jsonb_array_elements_text(q.choices)
 with ordinality as choice(value,ordinality)
where not exists (
 select 1 from public.vc_university_question_options existing
 where existing.question_id=q.question_id
)
on conflict (question_id,option_order) do nothing;

update public.vc_university_questions q
set correct_option_id=o.option_id
from public.vc_university_question_options o
where o.question_id=q.question_id and o.is_correct
 and q.correct_option_id is null;

do $$ begin
 if exists (select 1 from public.vc_university_questions where correct_option_id is null) then
  raise exception 'question_option_backfill_incomplete';
 end if;
 if not exists (
  select 1 from pg_constraint
  where conname='vc_university_questions_correct_option_fkey'
   and conrelid='public.vc_university_questions'::regclass
 ) then
  alter table public.vc_university_questions
   add constraint vc_university_questions_correct_option_fkey
   foreign key (question_id,correct_option_id)
   references public.vc_university_question_options(question_id,option_id);
 end if;
end $$;

alter table public.vc_university_questions
 alter column correct_option_id set not null;

comment on column public.vc_university_questions.correct_index is
 'Campo legado mantido temporariamente para compatibilidade do runtime v1.1; novas correções devem usar correct_option_id.';

-- ---------------------------------------------------------------------------
-- 4. Evidências versionáveis e revisão com finalidade separada
-- ---------------------------------------------------------------------------

create table if not exists public.vc_university_evidence_definitions (
 evidence_definition_id uuid primary key default gen_random_uuid(),
 course_id text not null references public.vc_university_courses(course_id),
 module_id uuid not null references public.vc_university_modules(module_id),
 evidence_key text not null check (evidence_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
 created_at timestamptz not null default now(),
 unique (course_id,evidence_key)
);

create table if not exists public.vc_university_evidence_definition_versions (
 evidence_definition_version_id uuid primary key default gen_random_uuid(),
 evidence_definition_id uuid not null
  references public.vc_university_evidence_definitions(evidence_definition_id),
 course_id text not null,
 course_version text not null,
 revision integer not null default 1 check (revision > 0),
 title text not null,
 prompt text not null,
 validation_mode text not null check (validation_mode in (
  'structural','guided','sampled','human_required'
 )),
 rubric_version text not null,
 rubric jsonb not null default '{}'::jsonb check (jsonb_typeof(rubric)='object'),
 status text not null default 'draft'
  check (status in ('draft','review','published','archived')),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique (evidence_definition_id,course_version,revision),
 foreign key (course_id,course_version)
  references public.vc_university_course_versions(course_id,version)
);

create unique index if not exists vc_university_enrollments_identity_uidx
 on public.vc_university_enrollments(enrollment_id,user_id);
create unique index if not exists vc_university_enrollments_version_identity_uidx
 on public.vc_university_enrollments(enrollment_id,course_id,course_version);

create table if not exists public.vc_university_evidence_submissions (
 submission_id uuid primary key default gen_random_uuid(),
 enrollment_id uuid not null,
 learner_id uuid not null references auth.users(id),
 course_id text not null,
 course_version text not null,
 evidence_definition_version_id uuid not null
  references public.vc_university_evidence_definition_versions(evidence_definition_version_id),
 status text not null default 'draft' check (status in (
  'draft','submitted','under_review','revision_requested','resubmitted','approved'
 )),
 current_revision integer not null default 0 check (current_revision >= 0),
 contains_sensitive_data boolean not null default true,
 submitted_at timestamptz,
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (enrollment_id,evidence_definition_version_id),
 foreign key (enrollment_id,learner_id)
  references public.vc_university_enrollments(enrollment_id,user_id),
 foreign key (enrollment_id,course_id,course_version)
  references public.vc_university_enrollments(enrollment_id,course_id,course_version),
 check (status='draft' or submitted_at is not null),
 check (status<>'approved' or approved_at is not null)
);

create table if not exists public.vc_university_evidence_revisions (
 evidence_revision_id uuid primary key default gen_random_uuid(),
 submission_id uuid not null
  references public.vc_university_evidence_submissions(submission_id),
 revision integer not null check (revision > 0),
 content text not null check (length(btrim(content)) between 20 and 12000),
 authored_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique (submission_id,revision)
);

create table if not exists public.vc_university_evidence_reviews (
 evidence_review_id uuid primary key default gen_random_uuid(),
 submission_id uuid not null
  references public.vc_university_evidence_submissions(submission_id),
 evidence_revision_id uuid not null
  references public.vc_university_evidence_revisions(evidence_revision_id),
 reviewer_id uuid not null references auth.users(id),
 decision text not null check (decision in (
  'under_review','revision_requested','approved'
 )),
 feedback text not null check (length(btrim(feedback)) between 3 and 4000),
 rubric_version text not null,
 created_at timestamptz not null default now()
);

create index if not exists vc_university_evidence_submissions_enrollment_idx
 on public.vc_university_evidence_submissions(enrollment_id,status);
create index if not exists vc_university_evidence_submissions_learner_idx
 on public.vc_university_evidence_submissions(learner_id,updated_at desc);
create index if not exists vc_university_evidence_revisions_submission_idx
 on public.vc_university_evidence_revisions(submission_id,revision desc);
create index if not exists vc_university_evidence_reviews_submission_idx
 on public.vc_university_evidence_reviews(submission_id,created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Fontes científicas/editoriais e ferramentas de aprendizagem
-- ---------------------------------------------------------------------------

create table if not exists public.vc_university_sources (
 source_id uuid primary key default gen_random_uuid(),
 title text not null,
 authors text not null default '',
 publication_year smallint check (publication_year between 1800 and 2200),
 citation text not null,
 url text,
 doi text,
 editorial_classification text not null
  check (editorial_classification in ('E','C','D','H','P')),
 status text not null default 'review'
  check (status in ('draft','review','verified','archived')),
 verified_at timestamptz,
 created_at timestamptz not null default now()
);

create table if not exists public.vc_university_learning_tools (
 learning_tool_id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9._-]{1,63}$'),
 title text not null,
 description text not null default '',
 created_at timestamptz not null default now()
);

create table if not exists public.vc_university_learning_tool_versions (
 learning_tool_version_id uuid primary key default gen_random_uuid(),
 learning_tool_id uuid not null
  references public.vc_university_learning_tools(learning_tool_id),
 course_id text not null,
 course_version text not null,
 version text not null,
 instructions jsonb not null default '{}'::jsonb check (jsonb_typeof(instructions)='object'),
 status text not null default 'draft'
  check (status in ('draft','review','published','archived')),
 created_at timestamptz not null default now(),
 unique (learning_tool_id,course_id,course_version,version),
 foreign key (course_id,course_version)
  references public.vc_university_course_versions(course_id,version)
);

create table if not exists public.vc_university_source_links (
 source_link_id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.vc_university_sources(source_id),
 course_id text,
 course_version text,
 module_version_id uuid references public.vc_university_module_versions(module_version_id),
 lesson_version_id uuid references public.vc_university_lesson_versions(lesson_version_id),
 content_block_id uuid references public.vc_university_content_blocks(content_block_id),
 learning_tool_version_id uuid
  references public.vc_university_learning_tool_versions(learning_tool_version_id),
 question_id uuid references public.vc_university_questions(question_id),
 relationship text not null default 'supports'
  check (relationship in ('supports','informs','adapts','critiques','contextualizes')),
 created_at timestamptz not null default now(),
 foreign key (course_id,course_version)
  references public.vc_university_course_versions(course_id,version),
 check (num_nonnulls(module_version_id,lesson_version_id,content_block_id,
  learning_tool_version_id,question_id) +
  case when course_id is not null and course_version is not null then 1 else 0 end = 1),
 check ((course_id is null)=(course_version is null))
);

create index if not exists vc_university_source_links_source_idx
 on public.vc_university_source_links(source_id);

-- ---------------------------------------------------------------------------
-- 6. Motor genérico de ciclos aplicados (IE30, Liderança30, Foco30...)
-- ---------------------------------------------------------------------------

create table if not exists public.vc_university_application_cycle_definitions (
 cycle_definition_id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9._-]{1,63}$'),
 title text not null,
 description text not null default '',
 created_at timestamptz not null default now()
);

create table if not exists public.vc_university_application_cycle_versions (
 cycle_version_id uuid primary key default gen_random_uuid(),
 cycle_definition_id uuid not null
  references public.vc_university_application_cycle_definitions(cycle_definition_id),
 course_id text not null,
 course_version text not null,
 version text not null,
 duration_days smallint not null check (duration_days between 1 and 366),
 requirements jsonb not null default '{}'::jsonb check (jsonb_typeof(requirements)='object'),
 configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration)='object'),
 status text not null default 'draft'
  check (status in ('draft','review','published','archived')),
 created_at timestamptz not null default now(),
 unique (cycle_definition_id,course_id,course_version,version),
 foreign key (course_id,course_version)
  references public.vc_university_course_versions(course_id,version)
);

create table if not exists public.vc_university_application_cycles (
 application_cycle_id uuid primary key default gen_random_uuid(),
 cycle_version_id uuid not null
  references public.vc_university_application_cycle_versions(cycle_version_id),
 enrollment_id uuid not null,
 learner_id uuid not null references auth.users(id),
 status text not null default 'draft'
  check (status in ('draft','active','completed','abandoned')),
 started_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 unique (cycle_version_id,enrollment_id),
 foreign key (enrollment_id,learner_id)
  references public.vc_university_enrollments(enrollment_id,user_id),
 check (completed_at is null or started_at is not null)
);

create table if not exists public.vc_university_application_cycle_entries (
 cycle_entry_id uuid primary key default gen_random_uuid(),
 application_cycle_id uuid not null
  references public.vc_university_application_cycles(application_cycle_id),
 entry_type text not null check (entry_type in (
  'objective','context','signal','strategy','implementation_intention',
  'indicator','log','weekly_review','final_reflection','academic_evaluation'
 )),
 entry_key text not null check (entry_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
 revision integer not null default 1 check (revision > 0),
 supersedes_entry_id uuid
  references public.vc_university_application_cycle_entries(cycle_entry_id),
 payload jsonb not null check (jsonb_typeof(payload)='object'),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique (application_cycle_id,entry_type,entry_key,revision),
 check (supersedes_entry_id is null or supersedes_entry_id<>cycle_entry_id)
);

create index if not exists vc_university_application_cycles_learner_idx
 on public.vc_university_application_cycles(learner_id,status);
create index if not exists vc_university_cycle_entries_cycle_idx
 on public.vc_university_application_cycle_entries(application_cycle_id,entry_type,created_at);

-- ---------------------------------------------------------------------------
-- 7. Preview sem matrícula/progresso e auditoria acadêmica append-only
-- ---------------------------------------------------------------------------

create table if not exists public.vc_university_preview_sessions (
 preview_session_id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references auth.users(id),
 course_id text not null,
 course_version text not null,
 perspective text not null check (perspective in (
  'student','teacher','content_master'
 )),
 purpose text not null check (length(btrim(purpose)) between 3 and 500),
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 foreign key (course_id,course_version)
  references public.vc_university_course_versions(course_id,version),
 check (expires_at>created_at)
);

comment on table public.vc_university_preview_sessions is
 'Preview isolado: não possui enrollment_id e não pode produzir progresso, tentativa ou certificado.';

create table if not exists public.vc_university_academic_audit_log (
 audit_id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id),
 action text not null,
 entity_type text not null,
 entity_id text not null,
 before_state jsonb,
 after_state jsonb,
 reason text,
 request_id uuid,
 occurred_at timestamptz not null default now(),
 check (before_state is not null or after_state is not null),
 check (reason is null or length(btrim(reason)) between 3 and 2000)
);

create index if not exists vc_university_audit_entity_idx
 on public.vc_university_academic_audit_log(entity_type,entity_id,occurred_at desc);
create index if not exists vc_university_audit_actor_idx
 on public.vc_university_academic_audit_log(actor_id,occurred_at desc)
 where actor_id is not null;

create or replace function public.vc_university_reject_version_mutation()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
 raise exception 'versioned_record_is_immutable';
end
$$;

revoke all on function public.vc_university_reject_version_mutation()
 from public,anon,authenticated;

drop trigger if exists vc_university_evidence_revision_immutable
 on public.vc_university_evidence_revisions;
create trigger vc_university_evidence_revision_immutable
 before update or delete on public.vc_university_evidence_revisions
 for each row execute function public.vc_university_reject_version_mutation();

drop trigger if exists vc_university_cycle_entry_immutable
 on public.vc_university_application_cycle_entries;
create trigger vc_university_cycle_entry_immutable
 before update or delete on public.vc_university_application_cycle_entries
 for each row execute function public.vc_university_reject_version_mutation();

drop trigger if exists vc_university_audit_log_immutable
 on public.vc_university_academic_audit_log;
create trigger vc_university_audit_log_immutable
 before update or delete on public.vc_university_academic_audit_log
 for each row execute function public.vc_university_reject_version_mutation();

-- ---------------------------------------------------------------------------
-- 8. RLS: conteúdo/governança separados de dados íntimos de alunos
-- ---------------------------------------------------------------------------

create or replace function vc_private.vc_university_can_read_submission(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select exists (
  select 1
  from public.vc_university_evidence_submissions s
  where s.submission_id=p_submission_id
   and s.learner_id=(select auth.uid())
 ) or exists (
  select 1
  from public.vc_university_evidence_submissions s
  join public.vc_university_enrollments e on e.enrollment_id=s.enrollment_id
  join public.vc_university_teachers t on t.cohort_id=e.cohort_id
  join public.vc_university_evidence_definition_versions d
   on d.evidence_definition_version_id=s.evidence_definition_version_id
  where s.submission_id=p_submission_id
   and t.user_id=(select auth.uid())
   and d.validation_mode in ('sampled','human_required')
 )
$$;

create or replace function vc_private.vc_university_owns_application_cycle(p_cycle_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select exists (
  select 1 from public.vc_university_application_cycles c
  where c.application_cycle_id=p_cycle_id
   and c.learner_id=(select auth.uid())
 )
$$;

revoke all on function vc_private.vc_university_can_read_submission(uuid)
 from public,anon,authenticated,service_role;
revoke all on function vc_private.vc_university_owns_application_cycle(uuid)
 from public,anon,authenticated,service_role;
grant usage on schema vc_private to authenticated;
grant execute on function vc_private.vc_university_can_read_submission(uuid)
 to authenticated;
grant execute on function vc_private.vc_university_owns_application_cycle(uuid)
 to authenticated;

alter table public.vc_university_course_versions enable row level security;
alter table public.vc_university_module_versions enable row level security;
alter table public.vc_university_lessons enable row level security;
alter table public.vc_university_lesson_versions enable row level security;
alter table public.vc_university_content_blocks enable row level security;
alter table public.vc_university_competencies enable row level security;
alter table public.vc_university_course_competencies enable row level security;
alter table public.vc_university_question_options enable row level security;
alter table public.vc_university_evidence_definitions enable row level security;
alter table public.vc_university_evidence_definition_versions enable row level security;
alter table public.vc_university_evidence_submissions enable row level security;
alter table public.vc_university_evidence_revisions enable row level security;
alter table public.vc_university_evidence_reviews enable row level security;
alter table public.vc_university_sources enable row level security;
alter table public.vc_university_learning_tools enable row level security;
alter table public.vc_university_learning_tool_versions enable row level security;
alter table public.vc_university_source_links enable row level security;
alter table public.vc_university_application_cycle_definitions enable row level security;
alter table public.vc_university_application_cycle_versions enable row level security;
alter table public.vc_university_application_cycles enable row level security;
alter table public.vc_university_application_cycle_entries enable row level security;
alter table public.vc_university_preview_sessions enable row level security;
alter table public.vc_university_academic_audit_log enable row level security;

revoke all on public.vc_university_course_versions,
 public.vc_university_module_versions,public.vc_university_lessons,
 public.vc_university_lesson_versions,public.vc_university_content_blocks,
 public.vc_university_competencies,public.vc_university_course_competencies,
 public.vc_university_question_options,public.vc_university_evidence_definitions,
 public.vc_university_evidence_definition_versions,
 public.vc_university_evidence_submissions,public.vc_university_evidence_revisions,
 public.vc_university_evidence_reviews,public.vc_university_sources,
 public.vc_university_learning_tools,public.vc_university_learning_tool_versions,
 public.vc_university_source_links,
 public.vc_university_application_cycle_definitions,
 public.vc_university_application_cycle_versions,
 public.vc_university_application_cycles,
 public.vc_university_application_cycle_entries,
 public.vc_university_preview_sessions,public.vc_university_academic_audit_log
 from public,anon,authenticated;

grant select,insert,update,delete on public.vc_university_course_versions,
 public.vc_university_module_versions,public.vc_university_lessons,
 public.vc_university_lesson_versions,public.vc_university_content_blocks,
 public.vc_university_competencies,public.vc_university_course_competencies,
 public.vc_university_question_options,public.vc_university_evidence_definitions,
 public.vc_university_evidence_definition_versions,
 public.vc_university_evidence_submissions,public.vc_university_evidence_revisions,
 public.vc_university_evidence_reviews,public.vc_university_sources,
 public.vc_university_learning_tools,public.vc_university_learning_tool_versions,
 public.vc_university_source_links,
 public.vc_university_application_cycle_definitions,
 public.vc_university_application_cycle_versions,
 public.vc_university_application_cycles,
 public.vc_university_application_cycle_entries,
 public.vc_university_preview_sessions,public.vc_university_academic_audit_log
 to service_role;

grant usage,select on sequence public.vc_university_academic_audit_log_audit_id_seq
 to service_role;

grant select on public.vc_university_evidence_submissions,
 public.vc_university_evidence_revisions,public.vc_university_evidence_reviews,
 public.vc_university_application_cycles,
 public.vc_university_application_cycle_entries
 to authenticated;

create policy university_evidence_submissions_scoped_read
 on public.vc_university_evidence_submissions
 for select to authenticated
 using ((select vc_private.vc_university_can_read_submission(submission_id)));

create policy university_evidence_revisions_scoped_read
 on public.vc_university_evidence_revisions
 for select to authenticated
 using ((select vc_private.vc_university_can_read_submission(submission_id)));

create policy university_evidence_reviews_scoped_read
 on public.vc_university_evidence_reviews
 for select to authenticated
 using ((select vc_private.vc_university_can_read_submission(submission_id)));

create policy university_application_cycles_own_read
 on public.vc_university_application_cycles
 for select to authenticated
 using (learner_id=(select auth.uid()));

create policy university_application_cycle_entries_own_read
 on public.vc_university_application_cycle_entries
 for select to authenticated
 using ((select vc_private.vc_university_owns_application_cycle(application_cycle_id)));

comment on table public.vc_university_evidence_submissions is
 'Dados potencialmente sensíveis. Proprietário não recebe bypass por governança; leitura exige titularidade ou atribuição docente e modo sampled/human_required.';
comment on table public.vc_university_application_cycle_entries is
 'Registros privados do aluno. Empresa, administrador e professor não possuem leitura direta; evidências avaliáveis usam o fluxo de submissions.';
comment on table public.vc_university_academic_audit_log is
 'Trilha acadêmica append-only para publicação, versionamento, avaliações, revisões, exceções e certificados.';

-- ---------------------------------------------------------------------------
-- 9. Guardas de compatibilidade: Liderança permanece íntegra
-- ---------------------------------------------------------------------------

do $$
declare
 leadership_modules integer;
 leadership_content_versions integer;
 leadership_catalog_versions integer;
 invalid_questions integer;
begin
 select count(*) into leadership_modules
 from public.vc_university_modules
 where course_id='lideranca-estrategica-aplicada';
 if leadership_modules<>10 then
  raise exception 'leadership_modules_changed:%',leadership_modules;
 end if;

 select count(*) into leadership_content_versions
 from public.vc_university_course_content
 where course_id='lideranca-estrategica-aplicada';
 select count(*) into leadership_catalog_versions
 from public.vc_university_course_versions
 where course_id='lideranca-estrategica-aplicada';
 if leadership_catalog_versions<leadership_content_versions then
  raise exception 'leadership_version_backfill_incomplete';
 end if;

 select count(*) into invalid_questions
 from public.vc_university_questions q
 where q.correct_option_id is null or not exists (
  select 1 from public.vc_university_question_options o
  where o.question_id=q.question_id and o.option_id=q.correct_option_id
   and o.is_correct
 );
 if invalid_questions<>0 then
  raise exception 'question_option_integrity_failed:%',invalid_questions;
 end if;
end
$$;
