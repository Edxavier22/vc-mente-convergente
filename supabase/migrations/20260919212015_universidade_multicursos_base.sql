-- Foundation only. Do not activate sales/certificates from this migration.
-- Existing P-021 entitlements and evidence remain intact.
create table if not exists public.vc_university_courses (
 course_id text primary key,
 product_id text unique references public.vc_products(product_id),
 title text not null,
 description text not null default '',
 audience text not null default '',
 modality text not null default 'online',
 hours_minutes integer not null check (hours_minutes > 0),
 version text not null,
 status text not null default 'draft' check (status in ('draft','review','published','archived')),
 final_pass_percent smallint not null default 70 check (final_pass_percent between 1 and 100),
 certificate_requires_project_review boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.vc_university_modules (
 course_id text not null references public.vc_university_courses(course_id),
 module_no integer not null check (module_no > 0),
 title text not null,
 estimated_minutes integer not null check (estimated_minutes > 0),
 evidence_required boolean not null default true,
 checkpoint_pass_count smallint not null default 4 check (checkpoint_pass_count between 1 and 5),
 primary key (course_id,module_no)
);
create table if not exists public.vc_university_organizations (
 organization_id uuid primary key default gen_random_uuid(),
 legal_name text not null,
 created_at timestamptz not null default now()
);
create table if not exists public.vc_university_cohorts (
 cohort_id uuid primary key default gen_random_uuid(),
 course_id text not null references public.vc_university_courses(course_id),
 organization_id uuid references public.vc_university_organizations(organization_id),
 label text not null,
 capacity integer check(capacity > 0),
 status text not null default 'draft' check(status in ('draft','open','active','closed')),
 created_at timestamptz not null default now(),
 unique(cohort_id,course_id)
);
create table if not exists public.vc_university_enrollments (
 enrollment_id uuid primary key default gen_random_uuid(),
 cohort_id uuid not null,
 course_id text not null,
 user_id uuid not null references auth.users(id),
 status text not null default 'active' check(status in ('active','suspended','completed','cancelled')),
 enrolled_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(cohort_id,user_id),
 unique(enrollment_id,course_id),
 foreign key(cohort_id,course_id) references public.vc_university_cohorts(cohort_id,course_id)
);
create table if not exists public.vc_university_teachers (
 cohort_id uuid not null references public.vc_university_cohorts(cohort_id),
 user_id uuid not null references auth.users(id),
 primary key(cohort_id,user_id)
);
create table if not exists public.vc_university_events (
 event_id bigint generated always as identity primary key,
 enrollment_id uuid not null references public.vc_university_enrollments(enrollment_id),
 actor_id uuid references auth.users(id),
 event_type text not null,
 module_no integer,
 details jsonb not null default '{}'::jsonb,
 recorded_at timestamptz not null default now()
);
create index if not exists vc_university_events_enrollment_idx on public.vc_university_events(enrollment_id,recorded_at);
-- Answer keys stay in a table without grants for the browser.
create table if not exists public.vc_university_questions (
 question_id uuid primary key default gen_random_uuid(),
 course_id text not null references public.vc_university_courses(course_id),
 course_version text not null,
 module_no integer,
 purpose text not null check(purpose in ('checkpoint','final')),
 kind text not null check(kind in ('concept','application','decision','case')),
 prompt text not null,
 choices jsonb not null check(jsonb_typeof(choices)='array' and jsonb_array_length(choices)=4),
 correct_index smallint not null check(correct_index between 0 and 3),
 review_concept text not null,
 active boolean not null default false,
 foreign key(course_id,module_no) references public.vc_university_modules(course_id,module_no),
 check ((purpose='checkpoint' and module_no is not null) or (purpose='final' and module_no is null))
);
create index if not exists vc_university_questions_pool_idx
 on public.vc_university_questions(course_id,course_version,purpose,module_no) where active;
create table if not exists public.vc_university_checkpoint_attempts (
 attempt_id uuid primary key default gen_random_uuid(),
 enrollment_id uuid not null,
 course_id text not null,
 module_no integer not null,
 score smallint not null check(score between 0 and 5),
 question_count smallint not null default 5 check(question_count=5),
 review_concepts jsonb not null default '[]'::jsonb check(jsonb_typeof(review_concepts)='array'),
 submitted_at timestamptz not null default now(),
 foreign key(enrollment_id,course_id) references public.vc_university_enrollments(enrollment_id,course_id),
 foreign key(course_id,module_no) references public.vc_university_modules(course_id,module_no)
);
create index if not exists vc_university_checkpoint_attempts_idx
 on public.vc_university_checkpoint_attempts(enrollment_id,module_no,submitted_at desc);
create table if not exists public.vc_university_module_progress (
 enrollment_id uuid not null,
 course_id text not null,
 module_no integer not null,
 opened_at timestamptz,
 evidence text check(length(evidence)<=12000),
 submitted_at timestamptz,
 checkpoint_passed_at timestamptz,
 completed_at timestamptz,
 review_status text check(review_status in ('pending','approved','revise')),
 reviewed_at timestamptz,
 reviewer_id uuid references auth.users(id),
 review_feedback text check(length(review_feedback)<=2000),
 primary key(enrollment_id,module_no),
 foreign key(enrollment_id,course_id) references public.vc_university_enrollments(enrollment_id,course_id),
 foreign key(course_id,module_no) references public.vc_university_modules(course_id,module_no),
 check (completed_at is null or (submitted_at is not null and checkpoint_passed_at is not null))
);
create table if not exists public.vc_university_final_attempts (
 attempt_id uuid primary key default gen_random_uuid(),
 enrollment_id uuid not null references public.vc_university_enrollments(enrollment_id),
 score smallint not null check(score between 0 and 20),
 question_count smallint not null default 20 check(question_count=20),
 review_concepts jsonb not null default '[]'::jsonb check(jsonb_typeof(review_concepts)='array'),
 submitted_at timestamptz not null default now()
);
create index if not exists vc_university_final_attempts_idx
 on public.vc_university_final_attempts(enrollment_id,submitted_at desc);
-- Defense in depth: even a privileged API cannot mark a module complete out
-- of sequence or without an actual passing checkpoint attempt.
create or replace function public.vc_university_validate_module_completion()
returns trigger language plpgsql set search_path='' as $$
declare
 minimum_score integer;
 was_complete boolean := false;
begin
 if tg_op='UPDATE' then
  was_complete := old.completed_at is not null;
  if (new.enrollment_id,new.course_id,new.module_no) is distinct from
     (old.enrollment_id,old.course_id,old.module_no) then
   raise exception 'module_identity_immutable';
  end if;
  if was_complete and new.completed_at is distinct from old.completed_at then
   raise exception 'module_completion_immutable';
  end if;
 end if;
 if new.completed_at is not null and not was_complete then
  if not exists (
   select 1 from public.vc_university_enrollments e
   where e.enrollment_id=new.enrollment_id and e.course_id=new.course_id
    and e.status='active'
  ) then
   raise exception 'active_enrollment_required';
  end if;
  select checkpoint_pass_count into minimum_score
  from public.vc_university_modules
  where course_id=new.course_id and module_no=new.module_no;
  if minimum_score is null or nullif(btrim(new.evidence),'') is null or
     new.submitted_at is null or new.checkpoint_passed_at is null then
   raise exception 'evidence_and_checkpoint_required';
  end if;
  if not exists (
   select 1 from public.vc_university_checkpoint_attempts a
   where a.enrollment_id=new.enrollment_id and a.course_id=new.course_id
    and a.module_no=new.module_no and a.score>=minimum_score
    and a.submitted_at<=new.completed_at
  ) then
   raise exception 'passing_checkpoint_required';
  end if;
  if exists (
   select 1 from public.vc_university_modules m
   where m.course_id=new.course_id and m.module_no<new.module_no
    and not exists (
     select 1 from public.vc_university_module_progress p
     where p.enrollment_id=new.enrollment_id
      and p.module_no=m.module_no and p.completed_at is not null
    )
  ) then
   raise exception 'previous_module_required';
  end if;
 end if;
 return new;
end
$$;
revoke all on function public.vc_university_validate_module_completion() from public,anon,authenticated;
create trigger vc_university_module_completion_guard
 before insert or update on public.vc_university_module_progress
 for each row execute function public.vc_university_validate_module_completion();
create table if not exists public.vc_university_certificates (
 certificate_id uuid primary key default gen_random_uuid(),
 enrollment_id uuid not null unique references public.vc_university_enrollments(enrollment_id),
 public_code text not null unique,
 course_title_snapshot text not null,
 course_version_snapshot text not null,
 hours_minutes_snapshot integer not null,
 learner_name_snapshot text not null,
 issued_at timestamptz not null default now(),
 revoked_at timestamptz
);
-- Academic writes go through authenticated, server-side operations with explicit checks.
-- No direct client writes or public certificate lookup are granted here.
alter table public.vc_university_courses enable row level security;
alter table public.vc_university_modules enable row level security;
alter table public.vc_university_organizations enable row level security;
alter table public.vc_university_cohorts enable row level security;
alter table public.vc_university_enrollments enable row level security;
alter table public.vc_university_teachers enable row level security;
alter table public.vc_university_events enable row level security;
alter table public.vc_university_questions enable row level security;
alter table public.vc_university_checkpoint_attempts enable row level security;
alter table public.vc_university_module_progress enable row level security;
alter table public.vc_university_final_attempts enable row level security;
alter table public.vc_university_certificates enable row level security;
revoke all on public.vc_university_courses,public.vc_university_modules,
 public.vc_university_organizations,public.vc_university_cohorts,
 public.vc_university_enrollments,public.vc_university_teachers,
 public.vc_university_events,public.vc_university_questions,
 public.vc_university_checkpoint_attempts,public.vc_university_module_progress,
 public.vc_university_final_attempts,public.vc_university_certificates
 from public,anon,authenticated;
grant select on public.vc_university_courses,public.vc_university_modules,
 public.vc_university_cohorts,public.vc_university_enrollments,
 public.vc_university_teachers,public.vc_university_checkpoint_attempts,
 public.vc_university_module_progress,public.vc_university_final_attempts to authenticated;
create policy university_courses_read on public.vc_university_courses
 for select to authenticated using (status='published' or product_id='P-021');
create policy university_modules_read on public.vc_university_modules
 for select to authenticated using (exists (
  select 1 from public.vc_university_courses c
  where c.course_id=vc_university_modules.course_id and c.status='published'
 ));
create policy university_cohorts_own on public.vc_university_cohorts
 for select to authenticated using (exists (
  select 1 from public.vc_university_enrollments e
  where e.cohort_id=vc_university_cohorts.cohort_id and e.user_id=(select auth.uid())
 ));
create policy university_enrollments_own on public.vc_university_enrollments
 for select to authenticated using (user_id=(select auth.uid()));
create policy university_teachers_own on public.vc_university_teachers
 for select to authenticated using (user_id=(select auth.uid()));
create policy university_checkpoint_attempts_own on public.vc_university_checkpoint_attempts
 for select to authenticated using (exists (
  select 1 from public.vc_university_enrollments e
  where e.enrollment_id=vc_university_checkpoint_attempts.enrollment_id
   and e.user_id=(select auth.uid())
 ));
create policy university_module_progress_own on public.vc_university_module_progress
 for select to authenticated using (exists (
  select 1 from public.vc_university_enrollments e
  where e.enrollment_id=vc_university_module_progress.enrollment_id
   and e.user_id=(select auth.uid())
 ));
create policy university_final_attempts_own on public.vc_university_final_attempts
 for select to authenticated using (exists (
  select 1 from public.vc_university_enrollments e
  where e.enrollment_id=vc_university_final_attempts.enrollment_id
   and e.user_id=(select auth.uid())
 ));
insert into public.vc_university_courses
 (course_id,product_id,title,description,audience,modality,hours_minutes,version,status,final_pass_percent,certificate_requires_project_review)
 values ('lideranca-estrategica-aplicada','P-021','Liderança Estratégica Aplicada',
 'Diagnóstico, processos, delegação, comunicação e plano aplicado de liderança.',
 'Supervisores, coordenadores e pequenos negócios','online',1200,'1.0','review',70,true)
 on conflict(course_id) do nothing;
insert into public.vc_university_modules(course_id,module_no,title,estimated_minutes)
 values
 ('lideranca-estrategica-aplicada',1,'O papel do líder e o diagnóstico sem culpa',120),
 ('lideranca-estrategica-aplicada',2,'RADAR: processos que a equipe consegue usar',120),
 ('lideranca-estrategica-aplicada',3,'Delegação e autonomia com limites',120),
 ('lideranca-estrategica-aplicada',4,'Prioridade, capacidade e indicadores',120),
 ('lideranca-estrategica-aplicada',5,'Decidir sob pressão sem transformar emoção em fato',120),
 ('lideranca-estrategica-aplicada',6,'Comunicação, escuta e acordos de equipe',120),
 ('lideranca-estrategica-aplicada',7,'Feedback FOCO e desenvolvimento',120),
 ('lideranca-estrategica-aplicada',8,'Conflitos, limites e encaminhamento seguro',120),
 ('lideranca-estrategica-aplicada',9,'Ritmo de equipe e mudança sustentável',120),
 ('lideranca-estrategica-aplicada',10,'Projeto final: plano de liderança de 30 dias',120)
 on conflict(course_id,module_no) do nothing;
