-- Phase 11: auditable, versioned and publicly verifiable certificates.
-- The certificate table remains private. Public verification is served only by
-- a narrow Edge Function that returns the minimum fields approved for display.

alter table public.vc_university_courses
 add column if not exists certificate_prefix text;

update public.vc_university_courses
set certificate_prefix = 'LEA'
where course_id = 'lideranca-estrategica-aplicada'
  and certificate_prefix is null;

alter table public.vc_university_courses
 add constraint vc_university_courses_certificate_prefix_format
 check (certificate_prefix is null or certificate_prefix ~ '^[A-Z0-9]{2,8}$');

create unique index if not exists vc_university_courses_certificate_prefix_uidx
 on public.vc_university_courses(certificate_prefix)
 where certificate_prefix is not null;

alter table public.vc_university_certificates
 add column if not exists course_id_snapshot text,
 add column if not exists nature_snapshot text,
 add column if not exists modality_snapshot text,
 add column if not exists period_start_snapshot date,
 add column if not exists completion_date_snapshot date,
 add column if not exists issuer_snapshot text,
 add column if not exists issuer_legal_name_snapshot text,
 add column if not exists issuer_document_snapshot text,
 add column if not exists responsible_snapshot text,
 add column if not exists result_percent_snapshot smallint,
 add column if not exists program_snapshot jsonb,
 add column if not exists validation_url_snapshot text,
 add column if not exists revoked_reason text,
 add column if not exists revoked_by uuid references auth.users(id);

alter table public.vc_university_certificates
 add constraint vc_university_certificates_result_percent_check
 check (result_percent_snapshot is null or result_percent_snapshot between 0 and 100),
 add constraint vc_university_certificates_program_array_check
 check (program_snapshot is null or jsonb_typeof(program_snapshot) = 'array'),
 add constraint vc_university_certificates_revocation_check
 check ((revoked_at is null and revoked_reason is null and revoked_by is null)
     or (revoked_at is not null and nullif(btrim(revoked_reason), '') is not null));

create sequence if not exists public.vc_university_certificate_number_seq;
revoke all on sequence public.vc_university_certificate_number_seq from public, anon, authenticated;

create or replace function public.vc_university_prepare_certificate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
 enrollment_row public.vc_university_enrollments%rowtype;
 course_row public.vc_university_courses%rowtype;
 module_count integer;
 completed_count integer;
 evidence_count integer;
 checkpoint_count integer;
 final_percent integer;
 project_module integer;
 program jsonb;
 sequence_number bigint;
begin
 select * into enrollment_row
 from public.vc_university_enrollments
 where enrollment_id = new.enrollment_id
 for update;

 if enrollment_row.enrollment_id is null or enrollment_row.status not in ('active', 'completed') then
  raise exception 'eligible_enrollment_required';
 end if;

 select * into course_row
 from public.vc_university_courses
 where course_id = enrollment_row.course_id;

 if course_row.course_id is null or course_row.certificate_prefix is null then
  raise exception 'certificate_configuration_unavailable';
 end if;

 select count(*), coalesce(jsonb_agg(
   jsonb_build_object('module_no', module_no, 'title', title, 'estimated_minutes', estimated_minutes)
   order by module_no
  ), '[]'::jsonb), max(module_no)
 into module_count, program, project_module
 from public.vc_university_modules
 where course_id = enrollment_row.course_id;

 select count(*) filter (where completed_at is not null),
        count(*) filter (where nullif(btrim(evidence), '') is not null and submitted_at is not null),
        count(*) filter (where checkpoint_passed_at is not null)
 into completed_count, evidence_count, checkpoint_count
 from public.vc_university_module_progress
 where enrollment_id = enrollment_row.enrollment_id
   and course_id = enrollment_row.course_id;

 if module_count = 0 or completed_count <> module_count or evidence_count <> module_count
    or checkpoint_count <> module_count then
  raise exception 'academic_requirements_incomplete';
 end if;

 select max(floor(score * 100.0 / question_count))::integer
 into final_percent
 from public.vc_university_final_attempts
 where enrollment_id = enrollment_row.enrollment_id
   and course_id = enrollment_row.course_id
   and course_version = enrollment_row.course_version;

 if final_percent is null or final_percent < course_row.final_pass_percent then
  raise exception 'final_assessment_required';
 end if;

 if course_row.certificate_requires_project_review and not exists (
  select 1 from public.vc_university_module_progress
  where enrollment_id = enrollment_row.enrollment_id
    and course_id = enrollment_row.course_id
    and module_no = project_module
    and review_status = 'approved'
    and reviewed_at is not null
 ) then
  raise exception 'project_approval_required';
 end if;

 if nullif(btrim(new.learner_name_snapshot), '') is null
    or length(btrim(new.learner_name_snapshot)) < 3
    or length(new.learner_name_snapshot) > 160 then
  raise exception 'learner_name_required';
 end if;

 if new.public_code is null or btrim(new.public_code) = '' then
  sequence_number := nextval('public.vc_university_certificate_number_seq');
  new.public_code := format('VC-%s-%s-%s', course_row.certificate_prefix,
    to_char(now() at time zone 'America/Sao_Paulo', 'YYYY'), lpad(sequence_number::text, 6, '0'));
 end if;

 new.course_id_snapshot := course_row.course_id;
 new.course_title_snapshot := course_row.title;
 new.course_version_snapshot := enrollment_row.course_version;
 new.nature_snapshot := 'Curso Livre de Capacitação';
 new.modality_snapshot := case when lower(course_row.modality) = 'online' then 'on-line' else course_row.modality end;
 new.hours_minutes_snapshot := course_row.hours_minutes;
 new.period_start_snapshot := enrollment_row.enrolled_at::date;
 new.completion_date_snapshot := (now() at time zone 'America/Sao_Paulo')::date;
 new.issuer_snapshot := 'V&C Mente Convergente';
 new.responsible_snapshot := 'Coordenação da Formação V&C';
 new.result_percent_snapshot := final_percent;
 new.program_snapshot := program;
 new.validation_url_snapshot := 'https://vc-mente-convergente.vercel.app/validar-certificado.html?codigo=' || new.public_code;
 new.learner_name_snapshot := btrim(new.learner_name_snapshot);
 return new;
end
$$;

revoke all on function public.vc_university_prepare_certificate() from public, anon, authenticated;

drop trigger if exists vc_university_certificate_prepare_guard on public.vc_university_certificates;
create trigger vc_university_certificate_prepare_guard
 before insert on public.vc_university_certificates
 for each row execute function public.vc_university_prepare_certificate();

create or replace function public.vc_university_certificate_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
 if (to_jsonb(new) - array['revoked_at', 'revoked_reason', 'revoked_by'])
    is distinct from
    (to_jsonb(old) - array['revoked_at', 'revoked_reason', 'revoked_by']) then
  raise exception 'issued_certificate_is_immutable';
 end if;
 if old.revoked_at is not null and
    (new.revoked_at, new.revoked_reason, new.revoked_by)
      is distinct from (old.revoked_at, old.revoked_reason, old.revoked_by) then
  raise exception 'certificate_revocation_is_immutable';
 end if;
 return new;
end
$$;

revoke all on function public.vc_university_certificate_immutable() from public, anon, authenticated;

drop trigger if exists vc_university_certificate_immutable_guard on public.vc_university_certificates;
create trigger vc_university_certificate_immutable_guard
 before update on public.vc_university_certificates
 for each row execute function public.vc_university_certificate_immutable();

create or replace function public.vc_university_complete_after_certificate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
 update public.vc_university_enrollments
 set status = 'completed', completed_at = coalesce(completed_at, new.issued_at)
 where enrollment_id = new.enrollment_id;

 insert into public.vc_university_events
  (enrollment_id, actor_id, event_type, details)
 select e.enrollment_id, e.user_id, 'certificate_issued',
  jsonb_build_object('certificate_id', new.certificate_id, 'public_code', new.public_code,
   'course_id', new.course_id_snapshot, 'course_version', new.course_version_snapshot)
 from public.vc_university_enrollments e
 where e.enrollment_id = new.enrollment_id;
 return new;
end
$$;

revoke all on function public.vc_university_complete_after_certificate() from public, anon, authenticated;

drop trigger if exists vc_university_certificate_completion_event on public.vc_university_certificates;
create trigger vc_university_certificate_completion_event
 after insert on public.vc_university_certificates
 for each row execute function public.vc_university_complete_after_certificate();

create index if not exists vc_university_certificates_active_code_idx
 on public.vc_university_certificates(public_code)
 where revoked_at is null;

-- Keep the table private even after the additive migration.
alter table public.vc_university_certificates enable row level security;
revoke all on public.vc_university_certificates from public, anon, authenticated;
