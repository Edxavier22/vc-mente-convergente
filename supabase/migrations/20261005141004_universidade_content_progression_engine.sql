-- Universidade V&C — motor multicursos de conteúdo e progressão.
--
-- Evolução aditiva sobre a fundação acadêmica do PR #11. O JSON e o
-- correct_index de Liderança v1.1 permanecem disponíveis durante a transição.

-- ---------------------------------------------------------------------------
-- 1. Metadados acadêmicos versionados e tipos de bloco reutilizáveis
-- ---------------------------------------------------------------------------

alter table public.vc_university_course_versions
 add column if not exists subtitle_snapshot text not null default '',
 add column if not exists institution_snapshot text not null default 'Universidade V&C',
 add column if not exists school_snapshot text not null default '',
 add column if not exists language_code text not null default 'pt-BR';

alter table public.vc_university_course_versions
 drop constraint if exists vc_university_course_versions_language_code_check;
alter table public.vc_university_course_versions
 add constraint vc_university_course_versions_language_code_check
 check (language_code ~ '^[a-z]{2}(?:-[A-Z]{2})?$');

alter table public.vc_university_content_blocks
 drop constraint if exists vc_university_content_blocks_block_type_check;
alter table public.vc_university_content_blocks
 add constraint vc_university_content_blocks_block_type_check
 check (block_type in (
  'opening','objective','study','concept','case','application','reflection',
  'workshop','evidence','rubric','checkpoint_review','summary','reference','tool',
  'heading','paragraph','callout','quote','diagram','example','exercise','warning',
  'video','download','checkpoint_link','evidence_link'
 ));

-- ---------------------------------------------------------------------------
-- 2. Requisitos, dependências e estados separados de progresso
-- ---------------------------------------------------------------------------

create table if not exists public.vc_university_module_requirements (
 requirement_id uuid primary key default gen_random_uuid(),
 course_id text not null,
 course_version text not null,
 module_version_id uuid,
 requirement_key text not null check (requirement_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
 requirement_type text not null check (requirement_type in (
  'content_completed','activity_completed','evidence_completed',
  'checkpoint_passed','application_cycle_stage','final_assessment_passed',
  'final_project_approved','administrative_requirement'
 )),
 configuration jsonb not null default '{}'::jsonb
  check (jsonb_typeof(configuration)='object'),
 required boolean not null default true,
 position integer not null default 1 check (position > 0),
 depends_on_requirement_id uuid
  references public.vc_university_module_requirements(requirement_id),
 status text not null default 'draft'
  check (status in ('draft','review','published','archived')),
 created_at timestamptz not null default now(),
 unique (course_id,course_version,module_version_id,requirement_key),
 foreign key (course_id,course_version)
  references public.vc_university_course_versions(course_id,version),
 foreign key (module_version_id)
  references public.vc_university_module_versions(module_version_id),
 check (depends_on_requirement_id is null or depends_on_requirement_id<>requirement_id)
);

create table if not exists public.vc_university_module_dependencies (
 module_dependency_id uuid primary key default gen_random_uuid(),
 course_id text not null,
 course_version text not null,
 module_version_id uuid not null
  references public.vc_university_module_versions(module_version_id),
 depends_on_module_version_id uuid not null
  references public.vc_university_module_versions(module_version_id),
 dependency_type text not null default 'completed'
  check (dependency_type in ('completed','requirement_satisfied')),
 configuration jsonb not null default '{}'::jsonb
  check (jsonb_typeof(configuration)='object'),
 status text not null default 'published'
  check (status in ('draft','review','published','archived')),
 created_at timestamptz not null default now(),
 unique (module_version_id,depends_on_module_version_id),
 foreign key (course_id,course_version)
  references public.vc_university_course_versions(course_id,version),
 check (module_version_id<>depends_on_module_version_id)
);

create table if not exists public.vc_university_lesson_progress (
 enrollment_id uuid not null references public.vc_university_enrollments(enrollment_id),
 lesson_version_id uuid not null
  references public.vc_university_lesson_versions(lesson_version_id),
 status text not null default 'not_started'
  check (status in ('not_started','in_progress','requirements_pending','completed')),
 first_viewed_at timestamptz,
 started_at timestamptz,
 content_completed_at timestamptz,
 last_content_block_id uuid references public.vc_university_content_blocks(content_block_id),
 updated_at timestamptz not null default now(),
 primary key (enrollment_id,lesson_version_id),
 check (started_at is null or first_viewed_at is not null),
 check (content_completed_at is null or started_at is not null)
);

create table if not exists public.vc_university_requirement_progress (
 enrollment_id uuid not null references public.vc_university_enrollments(enrollment_id),
 requirement_id uuid not null
  references public.vc_university_module_requirements(requirement_id),
 status text not null default 'not_started'
  check (status in ('not_started','in_progress','requirements_pending','completed')),
 source_type text,
 source_id text,
 satisfied_at timestamptz,
 details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
 updated_at timestamptz not null default now(),
 primary key (enrollment_id,requirement_id),
 check ((status='completed' and satisfied_at is not null) or
        (status<>'completed' and satisfied_at is null))
);

alter table public.vc_university_module_progress
 add column if not exists module_version_id uuid
  references public.vc_university_module_versions(module_version_id),
 add column if not exists status text not null default 'not_started',
 add column if not exists started_at timestamptz,
 add column if not exists content_completed_at timestamptz,
 add column if not exists requirements_completed_at timestamptz;

alter table public.vc_university_module_progress
 drop constraint if exists vc_university_module_progress_status_check;
alter table public.vc_university_module_progress
 add constraint vc_university_module_progress_status_check
 check (status in ('not_started','in_progress','requirements_pending','completed'));

update public.vc_university_module_progress p
set module_version_id=mv.module_version_id,
 status=case
  when p.completed_at is not null then 'completed'
  when p.submitted_at is not null or p.opened_at is not null then 'in_progress'
  else 'not_started'
 end,
 started_at=coalesce(p.started_at,p.opened_at,p.submitted_at,p.completed_at),
 content_completed_at=coalesce(p.content_completed_at,p.submitted_at,p.completed_at),
 requirements_completed_at=coalesce(p.requirements_completed_at,p.completed_at)
from public.vc_university_enrollments e
join public.vc_university_module_versions mv
 on mv.course_id=e.course_id and mv.course_version=e.course_version
where p.enrollment_id=e.enrollment_id and mv.module_no=p.module_no
 and p.module_version_id is null;

create index if not exists vc_university_module_requirements_version_idx
 on public.vc_university_module_requirements(course_id,course_version,module_version_id,status,position);
create index if not exists vc_university_module_requirements_depends_idx
 on public.vc_university_module_requirements(depends_on_requirement_id)
 where depends_on_requirement_id is not null;
create index if not exists vc_university_module_dependencies_version_idx
 on public.vc_university_module_dependencies(course_id,course_version,module_version_id,status);
create index if not exists vc_university_module_dependencies_target_idx
 on public.vc_university_module_dependencies(depends_on_module_version_id);
create index if not exists vc_university_lesson_progress_lesson_idx
 on public.vc_university_lesson_progress(lesson_version_id,status);
create index if not exists vc_university_requirement_progress_requirement_idx
 on public.vc_university_requirement_progress(requirement_id,status);
create index if not exists vc_university_module_progress_version_idx
 on public.vc_university_module_progress(module_version_id,status);

-- ---------------------------------------------------------------------------
-- 3. Tentativas preservam versão, respostas e snapshot das questões
-- ---------------------------------------------------------------------------

alter table public.vc_university_checkpoint_attempts
 add column if not exists course_version text,
 add column if not exists module_version_id uuid
  references public.vc_university_module_versions(module_version_id),
 add column if not exists attempt_no integer,
 add column if not exists score_percent numeric(5,2),
 add column if not exists passed boolean,
 add column if not exists question_snapshot jsonb not null default '[]'::jsonb,
 add column if not exists answers jsonb not null default '[]'::jsonb,
 add column if not exists feedback jsonb not null default '[]'::jsonb;

update public.vc_university_checkpoint_attempts a
set course_version=e.course_version,
 module_version_id=mv.module_version_id,
 score_percent=round(a.score::numeric*100/a.question_count,2),
 passed=a.score>=mv.checkpoint_pass_count
from public.vc_university_enrollments e
join public.vc_university_module_versions mv
 on mv.course_id=e.course_id and mv.course_version=e.course_version
where a.enrollment_id=e.enrollment_id and mv.module_no=a.module_no
 and (a.course_version is null or a.module_version_id is null or
      a.score_percent is null or a.passed is null);

with numbered as (
 select attempt_id,row_number() over (
  partition by enrollment_id,module_no order by submitted_at,attempt_id
 ) as attempt_no
 from public.vc_university_checkpoint_attempts
)
update public.vc_university_checkpoint_attempts a
set attempt_no=n.attempt_no
from numbered n
where n.attempt_id=a.attempt_id and a.attempt_no is null;

alter table public.vc_university_checkpoint_attempts
 alter column course_version set not null,
 alter column module_version_id set not null,
 alter column attempt_no set not null,
 alter column score_percent set not null,
 alter column passed set not null;

alter table public.vc_university_checkpoint_attempts
 add constraint vc_university_checkpoint_attempts_version_fkey
 foreign key (course_id,course_version)
 references public.vc_university_course_versions(course_id,version);

alter table public.vc_university_checkpoint_attempts
 add constraint vc_university_checkpoint_attempts_score_percent_check
 check (score_percent between 0 and 100),
 add constraint vc_university_checkpoint_attempts_snapshot_check
 check (jsonb_typeof(question_snapshot)='array' and jsonb_typeof(answers)='array'
  and jsonb_typeof(feedback)='array');

create unique index if not exists vc_university_checkpoint_attempts_number_uidx
 on public.vc_university_checkpoint_attempts(enrollment_id,module_version_id,attempt_no);

create or replace function public.vc_university_prepare_checkpoint_attempt()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
 v_minimum integer;
begin
 perform pg_advisory_xact_lock(hashtext(new.enrollment_id::text||':'||new.module_no::text));
 select e.course_version,mv.module_version_id,mv.checkpoint_pass_count
 into new.course_version,new.module_version_id,v_minimum
 from public.vc_university_enrollments e
 join public.vc_university_module_versions mv
  on mv.course_id=e.course_id and mv.course_version=e.course_version
  and mv.module_no=new.module_no
 where e.enrollment_id=new.enrollment_id and e.course_id=new.course_id;
 if new.module_version_id is null then raise exception 'attempt_version_context_required'; end if;
 new.attempt_no:=coalesce(new.attempt_no,(
  select max(existing.attempt_no)+1
  from public.vc_university_checkpoint_attempts existing
  where existing.enrollment_id=new.enrollment_id
   and existing.module_version_id=new.module_version_id
 ),1);
 new.score_percent:=round(new.score::numeric*100/new.question_count,2);
 new.passed:=new.score>=v_minimum;
 return new;
end
$$;

revoke all on function public.vc_university_prepare_checkpoint_attempt()
 from public,anon,authenticated;
drop trigger if exists vc_university_checkpoint_attempt_prepare
 on public.vc_university_checkpoint_attempts;
create trigger vc_university_checkpoint_attempt_prepare
 before insert on public.vc_university_checkpoint_attempts
 for each row execute function public.vc_university_prepare_checkpoint_attempt();

-- ---------------------------------------------------------------------------
-- 4. Requisitos/dependências de Liderança reproduzem o contrato v1.1
-- ---------------------------------------------------------------------------

insert into public.vc_university_module_requirements
 (course_id,course_version,module_version_id,requirement_key,requirement_type,
  configuration,required,position,status)
select mv.course_id,mv.course_version,mv.module_version_id,'evidence',
 'evidence_completed',jsonb_build_object('legacy_field','evidence'),true,1,'published'
from public.vc_university_module_versions mv
where mv.course_id='lideranca-estrategica-aplicada' and mv.evidence_required
on conflict (course_id,course_version,module_version_id,requirement_key) do nothing;

insert into public.vc_university_module_requirements
 (course_id,course_version,module_version_id,requirement_key,requirement_type,
  configuration,required,position,status)
select mv.course_id,mv.course_version,mv.module_version_id,'checkpoint',
 'checkpoint_passed',jsonb_build_object(
  'question_count',5,'minimum_correct',mv.checkpoint_pass_count,
  'pass_percent',mv.checkpoint_pass_count*20,'answer_identity','option_id'
 ),true,2,'published'
from public.vc_university_module_versions mv
where mv.course_id='lideranca-estrategica-aplicada'
on conflict (course_id,course_version,module_version_id,requirement_key) do nothing;

insert into public.vc_university_module_dependencies
 (course_id,course_version,module_version_id,depends_on_module_version_id,
  dependency_type,status)
select current.course_id,current.course_version,current.module_version_id,
 previous.module_version_id,'completed','published'
from public.vc_university_module_versions current
join public.vc_university_module_versions previous
 on previous.course_id=current.course_id
 and previous.course_version=current.course_version
 and previous.module_no=current.module_no-1
where current.course_id='lideranca-estrategica-aplicada'
on conflict (module_version_id,depends_on_module_version_id) do nothing;

insert into public.vc_university_requirement_progress
 (enrollment_id,requirement_id,status,source_type,source_id,satisfied_at,details)
select p.enrollment_id,r.requirement_id,'completed',r.requirement_type,
 case when r.requirement_type='checkpoint_passed' then latest.attempt_id::text
      else p.enrollment_id::text||':'||p.module_no::text end,
 case when r.requirement_type='checkpoint_passed' then p.checkpoint_passed_at
      else p.submitted_at end,
 jsonb_build_object('migrated_from','vc_university_module_progress')
from public.vc_university_module_progress p
join public.vc_university_module_requirements r
 on r.module_version_id=p.module_version_id and r.status='published'
left join lateral (
 select a.attempt_id from public.vc_university_checkpoint_attempts a
 where a.enrollment_id=p.enrollment_id and a.module_version_id=p.module_version_id
  and a.passed
 order by a.submitted_at desc limit 1
) latest on true
where (r.requirement_type='evidence_completed' and p.submitted_at is not null
       and nullif(btrim(p.evidence),'') is not null)
   or (r.requirement_type='checkpoint_passed' and p.checkpoint_passed_at is not null
       and latest.attempt_id is not null)
on conflict (enrollment_id,requirement_id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Conclusão e desbloqueio autoritativos no banco
-- ---------------------------------------------------------------------------

create or replace function public.vc_university_validate_module_completion()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
 v_version text;
 v_module_version uuid;
 v_has_requirements boolean;
 v_missing integer;
 v_blocked integer;
 v_minimum integer;
 v_was_complete boolean := false;
begin
 if tg_op='UPDATE' then
  v_was_complete := old.completed_at is not null;
  if (new.enrollment_id,new.course_id,new.module_no) is distinct from
     (old.enrollment_id,old.course_id,old.module_no) then
   raise exception 'module_identity_immutable';
  end if;
  if v_was_complete and new.completed_at is distinct from old.completed_at then
   raise exception 'module_completion_immutable';
  end if;
 end if;

 select e.course_version,mv.module_version_id
 into v_version,v_module_version
 from public.vc_university_enrollments e
 join public.vc_university_module_versions mv
  on mv.course_id=e.course_id and mv.course_version=e.course_version
  and mv.module_no=new.module_no
 where e.enrollment_id=new.enrollment_id and e.course_id=new.course_id
  and e.status='active';
 if v_module_version is null then raise exception 'active_versioned_enrollment_required'; end if;
 if new.module_version_id is null then new.module_version_id:=v_module_version; end if;
 if new.module_version_id<>v_module_version then raise exception 'enrollment_version_mismatch'; end if;

 if new.completed_at is not null and not v_was_complete then
  select exists (
   select 1 from public.vc_university_module_requirements r
   where r.module_version_id=v_module_version and r.status='published'
  ) into v_has_requirements;

  if v_has_requirements then
   select count(*) into v_missing
   from public.vc_university_module_requirements r
   where r.module_version_id=v_module_version and r.status='published' and r.required
    and not exists (
     select 1 from public.vc_university_requirement_progress rp
     where rp.enrollment_id=new.enrollment_id and rp.requirement_id=r.requirement_id
      and rp.status='completed' and rp.satisfied_at is not null
    );
   if v_missing>0 then raise exception 'required_module_requirements_pending'; end if;

   select count(*) into v_blocked
   from public.vc_university_module_dependencies d
   where d.module_version_id=v_module_version and d.status='published'
    and not exists (
     select 1 from public.vc_university_module_progress previous
     where previous.enrollment_id=new.enrollment_id
      and previous.module_version_id=d.depends_on_module_version_id
      and previous.completed_at is not null
    );
   if v_blocked>0 then raise exception 'module_dependency_pending'; end if;
  else
   -- Compatibilidade de segurança para versões ainda não migradas.
   select checkpoint_pass_count into v_minimum
   from public.vc_university_modules
   where course_id=new.course_id and module_no=new.module_no;
   if v_minimum is null or nullif(btrim(new.evidence),'') is null or
      new.submitted_at is null or new.checkpoint_passed_at is null then
    raise exception 'evidence_and_checkpoint_required';
   end if;
   if not exists (
    select 1 from public.vc_university_checkpoint_attempts a
    where a.enrollment_id=new.enrollment_id and a.course_id=new.course_id
     and a.module_no=new.module_no and a.score>=v_minimum
     and a.submitted_at<=new.completed_at
   ) then raise exception 'passing_checkpoint_required'; end if;
  end if;
  new.status:='completed';
  new.requirements_completed_at:=coalesce(new.requirements_completed_at,new.completed_at);
 end if;
 return new;
end
$$;

revoke all on function public.vc_university_validate_module_completion()
 from public,anon,authenticated;

create or replace function public.vc_university_complete_module_if_ready(
 p_enrollment_id uuid,
 p_module_version_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
 v_module public.vc_university_module_versions%rowtype;
 v_enrollment public.vc_university_enrollments%rowtype;
 v_missing integer;
 v_blocked integer;
 v_now timestamptz:=clock_timestamp();
begin
 select * into v_module from public.vc_university_module_versions
 where module_version_id=p_module_version_id;
 select * into v_enrollment from public.vc_university_enrollments
 where enrollment_id=p_enrollment_id and status='active';
 if v_module.module_version_id is null or v_enrollment.enrollment_id is null then
  raise exception 'active_context_required';
 end if;
 if (v_enrollment.course_id,v_enrollment.course_version) is distinct from
    (v_module.course_id,v_module.course_version) then
  raise exception 'enrollment_version_mismatch';
 end if;

 select count(*) into v_blocked
 from public.vc_university_module_dependencies d
 where d.module_version_id=p_module_version_id and d.status='published'
  and not exists (
   select 1 from public.vc_university_module_progress p
   where p.enrollment_id=p_enrollment_id
    and p.module_version_id=d.depends_on_module_version_id
    and p.completed_at is not null
  );
 select count(*) into v_missing
 from public.vc_university_module_requirements r
 where r.module_version_id=p_module_version_id and r.status='published' and r.required
  and not exists (
   select 1 from public.vc_university_requirement_progress rp
   where rp.enrollment_id=p_enrollment_id and rp.requirement_id=r.requirement_id
    and rp.status='completed' and rp.satisfied_at is not null
  );
 if v_blocked>0 or v_missing>0 then
  update public.vc_university_module_progress
  set status=case when started_at is null then 'not_started' else 'requirements_pending' end
  where enrollment_id=p_enrollment_id and module_no=v_module.module_no
   and completed_at is null;
  return jsonb_build_object('completed',false,'blocked_dependencies',v_blocked,
   'pending_requirements',v_missing);
 end if;

 insert into public.vc_university_module_progress
  (enrollment_id,course_id,module_no,module_version_id,status,started_at,
   requirements_completed_at,completed_at)
 values (p_enrollment_id,v_module.course_id,v_module.module_no,p_module_version_id,
  'completed',v_now,v_now,v_now)
 on conflict (enrollment_id,module_no) do update
 set module_version_id=excluded.module_version_id,status='completed',
  started_at=coalesce(public.vc_university_module_progress.started_at,excluded.started_at),
  requirements_completed_at=coalesce(public.vc_university_module_progress.requirements_completed_at,excluded.requirements_completed_at),
  completed_at=coalesce(public.vc_university_module_progress.completed_at,excluded.completed_at);
 return jsonb_build_object('completed',true,'blocked_dependencies',0,
  'pending_requirements',0,'completed_at',v_now);
end
$$;

revoke all on function public.vc_university_complete_module_if_ready(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.vc_university_complete_module_if_ready(uuid,uuid)
 to service_role;

-- ---------------------------------------------------------------------------
-- 6. Estrutura acadêmica aprovada de Inteligência Emocional (sem aulas)
-- ---------------------------------------------------------------------------

insert into public.vc_university_courses
 (course_id,product_id,title,description,audience,modality,hours_minutes,version,
  status,final_pass_percent,certificate_requires_project_review)
values ('inteligencia-emocional-aplicada',null,'Inteligência Emocional Aplicada',
 'Da reação automática à decisão consciente','','curso livre online',1200,'1.0',
 'draft',70,false)
on conflict (course_id) do nothing;

insert into public.vc_university_course_versions
 (course_id,version,title_snapshot,subtitle_snapshot,description_snapshot,
  audience_snapshot,modality_snapshot,institution_snapshot,school_snapshot,
  language_code,hours_minutes,final_pass_percent,
  certificate_requires_project_review,content_model,status)
values ('inteligencia-emocional-aplicada','1.0','Inteligência Emocional Aplicada',
 'Da reação automática à decisão consciente','', '', 'curso livre online',
 'Universidade V&C','Escola de Inteligência Emocional','pt-BR',1200,70,false,
 'structured_blocks','draft')
on conflict (course_id,version) do update set
 subtitle_snapshot=excluded.subtitle_snapshot,
 institution_snapshot=excluded.institution_snapshot,
 school_snapshot=excluded.school_snapshot,
 language_code=excluded.language_code;

insert into public.vc_university_modules
 (course_id,module_no,title,estimated_minutes,evidence_required,checkpoint_pass_count)
values
 ('inteligencia-emocional-aplicada',1,'Emoções: Entender Antes de Controlar',120,false,4),
 ('inteligencia-emocional-aplicada',2,'Autoconsciência: Perceber Antes de Mudar',120,false,4),
 ('inteligencia-emocional-aplicada',3,'Gatilhos, Padrões e Contexto',120,false,4),
 ('inteligencia-emocional-aplicada',4,'PAUSA: O Espaço Entre Impulso e Resposta',120,false,4),
 ('inteligencia-emocional-aplicada',5,'Regulação Emocional',120,false,4),
 ('inteligencia-emocional-aplicada',6,'Fatos, Histórias e Interpretações',120,false,4),
 ('inteligencia-emocional-aplicada',7,'Comunicação Emocionalmente Inteligente',120,false,4),
 ('inteligencia-emocional-aplicada',8,'Inteligência Emocional nos Relacionamentos',120,false,4),
 ('inteligencia-emocional-aplicada',9,'Decisões sob Emoção',120,false,4),
 ('inteligencia-emocional-aplicada',10,'Integração e Desenvolvimento',120,false,4)
on conflict (course_id,module_no) do update set title=excluded.title;

insert into public.vc_university_module_versions
 (module_id,course_id,course_version,module_no,title,estimated_minutes,
  evidence_required,checkpoint_pass_count,status)
select m.module_id,m.course_id,'1.0',m.module_no,m.title,m.estimated_minutes,
 m.evidence_required,m.checkpoint_pass_count,'draft'
from public.vc_university_modules m
where m.course_id='inteligencia-emocional-aplicada'
on conflict (course_id,course_version,module_no) do update set title=excluded.title;

insert into public.vc_university_module_dependencies
 (course_id,course_version,module_version_id,depends_on_module_version_id,
  dependency_type,status)
select current.course_id,current.course_version,current.module_version_id,
 previous.module_version_id,'completed','draft'
from public.vc_university_module_versions current
join public.vc_university_module_versions previous
 on previous.course_id=current.course_id
 and previous.course_version=current.course_version
 and previous.module_no=current.module_no-1
where current.course_id='inteligencia-emocional-aplicada'
 and current.course_version='1.0'
on conflict (module_version_id,depends_on_module_version_id) do nothing;

insert into public.vc_university_module_requirements
 (course_id,course_version,module_version_id,requirement_key,requirement_type,
  configuration,required,position,status)
select mv.course_id,mv.course_version,mv.module_version_id,'checkpoint',
 'checkpoint_passed',jsonb_build_object(
  'question_count',5,'option_count',4,'pass_percent',70,
  'retry_allowed',true,'answer_identity','option_id'
 ),true,10,'draft'
from public.vc_university_module_versions mv
where mv.course_id='inteligencia-emocional-aplicada' and mv.course_version='1.0'
on conflict (course_id,course_version,module_version_id,requirement_key) do nothing;

-- ---------------------------------------------------------------------------
-- 7. RLS e grants mínimos: escrita acadêmica continua server-side
-- ---------------------------------------------------------------------------

alter table public.vc_university_module_requirements enable row level security;
alter table public.vc_university_module_dependencies enable row level security;
alter table public.vc_university_lesson_progress enable row level security;
alter table public.vc_university_requirement_progress enable row level security;

revoke all on public.vc_university_module_requirements,
 public.vc_university_module_dependencies,public.vc_university_lesson_progress,
 public.vc_university_requirement_progress from public,anon,authenticated;
grant select,insert,update,delete on public.vc_university_module_requirements,
 public.vc_university_module_dependencies,public.vc_university_lesson_progress,
 public.vc_university_requirement_progress to service_role;

create policy vc_university_module_requirements_browser_deny
 on public.vc_university_module_requirements for all to anon,authenticated
 using (false) with check (false);
create policy vc_university_module_dependencies_browser_deny
 on public.vc_university_module_dependencies for all to anon,authenticated
 using (false) with check (false);
create policy vc_university_lesson_progress_browser_deny
 on public.vc_university_lesson_progress for all to anon,authenticated
 using (false) with check (false);
create policy vc_university_requirement_progress_browser_deny
 on public.vc_university_requirement_progress for all to anon,authenticated
 using (false) with check (false);

comment on table public.vc_university_module_requirements is
 'Requisitos acadêmicos genéricos por versão; status e configuração não são decididos pelo cliente.';
comment on table public.vc_university_module_dependencies is
 'Grafo explícito de desbloqueio. A ordem visual do módulo não é usada como autorização.';
comment on table public.vc_university_lesson_progress is
 'Separa visualização, início e conclusão de conteúdo da conclusão acadêmica do módulo.';
comment on table public.vc_university_requirement_progress is
 'Satisfação server-side de requisitos; não recebe grants de escrita para o navegador.';

-- Garantias finais: nenhum conteúdo pedagógico ou questão de IE foi inventado.
do $$
begin
 if exists (
  select 1 from public.vc_university_lessons l
  join public.vc_university_modules m on m.module_id=l.module_id
  where m.course_id='inteligencia-emocional-aplicada'
 ) then raise exception 'ie_lessons_must_be_imported_only_from_approved_content'; end if;
 if exists (
  select 1 from public.vc_university_questions q
  where q.course_id='inteligencia-emocional-aplicada'
 ) then raise exception 'ie_questions_must_be_imported_only_from_approved_bank'; end if;
end
$$;
