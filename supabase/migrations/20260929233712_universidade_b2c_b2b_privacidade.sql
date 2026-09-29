-- Universidade V&C — arquitetura B2C/B2B com privacidade por padrão.
-- Reutiliza a camada corporativa canônica (vc_organizations, memberships e seats)
-- sem duplicar identidade empresarial ou expor conteúdo acadêmico sensível.

alter table public.vc_university_organizations
 add column if not exists core_organization_id uuid unique
  references public.vc_organizations(organization_id),
 add column if not exists status text not null default 'active'
  check (status in ('active','suspended','closed')),
 add column if not exists privacy_mode text not null default 'aggregated_only'
  check (privacy_mode = 'aggregated_only'),
 add column if not exists minimum_report_group_size smallint not null default 5
  check (minimum_report_group_size between 3 and 50);

alter table public.vc_university_cohorts
 add column if not exists market_segment text not null default 'b2c'
  check (market_segment in ('b2c','b2b')),
 add column if not exists commercial_modality text not null default 'individual'
  check (commercial_modality in ('individual','professional','enterprise')),
 add column if not exists delivery_mode text not null default 'online'
  check (delivery_mode in ('online','in_person','hybrid')),
 add column if not exists seat_pool_id uuid references public.vc_seat_pools(seat_pool_id),
 add column if not exists starts_at timestamptz,
 add column if not exists ends_at timestamptz,
 add column if not exists reporting_enabled boolean not null default false,
 add constraint vc_university_cohorts_period_check
  check (ends_at is null or starts_at is null or ends_at >= starts_at),
 add constraint vc_university_cohorts_b2b_org_check
  check (market_segment <> 'b2b' or organization_id is not null),
 add constraint vc_university_cohorts_enterprise_check
  check (commercial_modality <> 'enterprise' or market_segment = 'b2b'),
 add constraint vc_university_cohorts_org_course_unique
  unique (cohort_id, course_id, organization_id);

alter table public.vc_university_enrollments
 add column if not exists seat_assignment_id uuid unique
  references public.vc_seat_assignments(seat_assignment_id);

create index if not exists vc_university_organizations_core_idx
 on public.vc_university_organizations(core_organization_id)
 where core_organization_id is not null;
create index if not exists vc_university_cohorts_organization_idx
 on public.vc_university_cohorts(organization_id,status);
create index if not exists vc_university_cohorts_seat_pool_idx
 on public.vc_university_cohorts(seat_pool_id)
 where seat_pool_id is not null;
create index if not exists vc_university_enrollments_cohort_status_idx
 on public.vc_university_enrollments(cohort_id,status);
create index if not exists vc_university_enrollments_seat_idx
 on public.vc_university_enrollments(seat_assignment_id)
 where seat_assignment_id is not null;

create or replace function public.vc_university_guard_cohort_capacity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
 cohort_row public.vc_university_cohorts%rowtype;
 occupied integer;
 pool_row public.vc_seat_pools%rowtype;
 assignment_row public.vc_seat_assignments%rowtype;
 course_product text;
begin
 select * into cohort_row
 from public.vc_university_cohorts
 where cohort_id = new.cohort_id
 for update;

 if cohort_row.cohort_id is null or cohort_row.course_id <> new.course_id then
  raise exception 'cohort_course_mismatch';
 end if;

 if new.status <> 'cancelled' and cohort_row.capacity is not null then
  select count(*) into occupied
  from public.vc_university_enrollments e
  where e.cohort_id = new.cohort_id
    and e.status <> 'cancelled'
    and (tg_op = 'INSERT' or e.enrollment_id <> new.enrollment_id);
  if occupied >= cohort_row.capacity then
   raise exception 'cohort_capacity_exceeded';
  end if;
 end if;

 if cohort_row.seat_pool_id is not null and new.status <> 'cancelled' then
  if new.seat_assignment_id is null then
   raise exception 'seat_assignment_required';
  end if;
  select * into pool_row from public.vc_seat_pools
   where seat_pool_id = cohort_row.seat_pool_id;
  select * into assignment_row from public.vc_seat_assignments
   where seat_assignment_id = new.seat_assignment_id;
  select product_id into course_product from public.vc_university_courses
   where course_id = new.course_id;
  if pool_row.seat_pool_id is null or pool_row.status <> 'active'
    or pool_row.product_id <> course_product then
   raise exception 'active_matching_seat_pool_required';
  end if;
  if assignment_row.seat_assignment_id is null
    or assignment_row.seat_pool_id <> cohort_row.seat_pool_id
    or assignment_row.status not in ('invited','active')
    or assignment_row.person_ref <> new.user_id::text then
   raise exception 'valid_user_seat_assignment_required';
  end if;
 end if;
 return new;
end
$$;

revoke all on function public.vc_university_guard_cohort_capacity()
 from public, anon, authenticated;

drop trigger if exists vc_university_cohort_capacity_guard
 on public.vc_university_enrollments;
create trigger vc_university_cohort_capacity_guard
 before insert or update of cohort_id, course_id, user_id, status, seat_assignment_id
 on public.vc_university_enrollments
 for each row execute function public.vc_university_guard_cohort_capacity();

create table if not exists public.vc_university_corporate_reports (
 report_id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 cohort_id uuid not null,
 course_id text not null,
 period_start date not null,
 period_end date not null,
 participant_count integer not null check (participant_count >= 0),
 started_count integer not null check (started_count between 0 and participant_count),
 completed_count integer not null check (completed_count between 0 and participant_count),
 certified_count integer not null check (certified_count between 0 and participant_count),
 average_progress_percent numeric(5,2)
  check (average_progress_percent between 0 and 100),
 average_assessment_percent numeric(5,2)
  check (average_assessment_percent between 0 and 100),
 assessment_sample_size integer not null default 0 check (assessment_sample_size >= 0),
 assessment_suppressed boolean not null default true,
 status text not null default 'draft'
  check (status in ('draft','published','archived')),
 generated_at timestamptz not null default now(),
 published_at timestamptz,
 generated_by uuid references auth.users(id),
 check (period_end >= period_start),
 check (not assessment_suppressed or (average_assessment_percent is null and assessment_sample_size = 0)),
 check (average_assessment_percent is null or assessment_sample_size > 0),
 foreign key (cohort_id, course_id, organization_id)
  references public.vc_university_cohorts(cohort_id, course_id, organization_id),
 unique (cohort_id, period_start, period_end)
);

comment on table public.vc_university_corporate_reports is
 'Relatórios corporativos exclusivamente agregados; não armazenam evidências, respostas, reflexões ou identidade individual.';

create index if not exists vc_university_corporate_reports_org_idx
 on public.vc_university_corporate_reports(organization_id,generated_at desc);
create index if not exists vc_university_corporate_reports_cohort_idx
 on public.vc_university_corporate_reports(cohort_id,generated_at desc);

create or replace function public.vc_university_guard_corporate_report_privacy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare minimum_group smallint;
begin
 select minimum_report_group_size into minimum_group
 from public.vc_university_organizations
 where organization_id = new.organization_id;
 if minimum_group is null then raise exception 'organization_required'; end if;
 if new.participant_count < minimum_group or new.assessment_sample_size < minimum_group then
  new.assessment_suppressed := true;
  new.average_assessment_percent := null;
  new.assessment_sample_size := 0;
 end if;
 return new;
end
$$;
revoke all on function public.vc_university_guard_corporate_report_privacy()
 from public, anon, authenticated;
create trigger vc_university_corporate_report_privacy_guard
 before insert or update on public.vc_university_corporate_reports
 for each row execute function public.vc_university_guard_corporate_report_privacy();

alter table public.vc_university_corporate_reports enable row level security;
revoke all on public.vc_university_organizations,
 public.vc_university_corporate_reports from public, anon, authenticated;
grant select, insert, update on public.vc_university_corporate_reports to service_role;
grant select, insert, update on public.vc_university_organizations to service_role;

-- Nenhuma policy de navegador é criada para relatórios corporativos. O acesso
-- passa por Edge Function autenticada, que valida membership e devolve agregados.
