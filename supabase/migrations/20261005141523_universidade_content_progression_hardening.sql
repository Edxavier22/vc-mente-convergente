-- Universidade V&C — hardening do motor de progressão do PR 2.

-- O trigger autoritativo substitui a regra legada fixa
-- evidence + checkpoint para todas as futuras modalidades de requisito.
alter table public.vc_university_module_progress
 drop constraint if exists vc_university_module_progress_check;

-- Evita que um requirement/dependency associe acidentalmente IDs de outra
-- versão, ainda que cada FK isolada seja válida.
alter table public.vc_university_module_versions
 add constraint vc_university_module_versions_identity_uidx
 unique (module_version_id,course_id,course_version);

alter table public.vc_university_module_requirements
 add constraint vc_university_module_requirements_version_identity_fkey
 foreign key (module_version_id,course_id,course_version)
 references public.vc_university_module_versions(module_version_id,course_id,course_version);

alter table public.vc_university_module_dependencies
 add constraint vc_university_module_dependencies_version_identity_fkey
 foreign key (module_version_id,course_id,course_version)
 references public.vc_university_module_versions(module_version_id,course_id,course_version),
 add constraint vc_university_module_dependencies_target_version_fkey
 foreign key (depends_on_module_version_id,course_id,course_version)
 references public.vc_university_module_versions(module_version_id,course_id,course_version);

-- O snapshot da tentativa contém o gabarito histórico necessário à auditoria.
-- Ele permanece server-only; o aluno recebe apenas o feedback filtrado da API.
revoke select on public.vc_university_checkpoint_attempts from authenticated;

create or replace function public.vc_university_prepare_checkpoint_attempt()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
 v_minimum_percent numeric;
begin
 perform pg_advisory_xact_lock(hashtext(new.enrollment_id::text||':'||new.module_no::text));
 select e.course_version,mv.module_version_id,
  coalesce((r.configuration->>'pass_percent')::numeric,mv.checkpoint_pass_count*20)
 into new.course_version,new.module_version_id,v_minimum_percent
 from public.vc_university_enrollments e
 join public.vc_university_module_versions mv
  on mv.course_id=e.course_id and mv.course_version=e.course_version
  and mv.module_no=new.module_no
 left join public.vc_university_module_requirements r
  on r.module_version_id=mv.module_version_id
  and r.requirement_type='checkpoint_passed' and r.status='published'
 where e.enrollment_id=new.enrollment_id and e.course_id=new.course_id;
 if new.module_version_id is null then raise exception 'attempt_version_context_required'; end if;
 new.attempt_no:=coalesce(new.attempt_no,(
  select max(existing.attempt_no)+1
  from public.vc_university_checkpoint_attempts existing
  where existing.enrollment_id=new.enrollment_id
   and existing.module_version_id=new.module_version_id
 ),1);
 new.score_percent:=round(new.score::numeric*100/new.question_count,2);
 new.passed:=new.score_percent>=v_minimum_percent;
 return new;
end
$$;

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
 v_total integer;
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

 select count(*),count(*) filter (where r.required and not exists (
   select 1 from public.vc_university_requirement_progress rp
   where rp.enrollment_id=p_enrollment_id and rp.requirement_id=r.requirement_id
    and rp.status='completed' and rp.satisfied_at is not null
  )) into v_total,v_missing
 from public.vc_university_module_requirements r
 where r.module_version_id=p_module_version_id and r.status='published';
 if v_total=0 then raise exception 'module_requirements_unconfigured'; end if;

 select count(*) into v_blocked
 from public.vc_university_module_dependencies d
 where d.module_version_id=p_module_version_id and d.status='published'
  and not exists (
   select 1 from public.vc_university_module_progress p
   where p.enrollment_id=p_enrollment_id
    and p.module_version_id=d.depends_on_module_version_id
    and p.completed_at is not null
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
