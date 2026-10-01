-- Fase 13 — formação para empresas e solicitações de proposta.
-- Dados comerciais permanecem privados e são acessados somente por funções controladas.

create sequence if not exists public.vc_university_proposal_reference_seq;
revoke all on sequence public.vc_university_proposal_reference_seq from public, anon, authenticated;
grant usage, select on sequence public.vc_university_proposal_reference_seq to service_role;

create table if not exists public.vc_university_proposal_requests (
  proposal_id uuid primary key default gen_random_uuid(),
  proposal_reference text not null unique default (
    'VC-PROP-' || to_char(current_date, 'YYYY') || '-' ||
    lpad(nextval('public.vc_university_proposal_reference_seq')::text, 6, '0')
  ),
  idempotency_key uuid not null unique,
  contact_name text not null check (char_length(contact_name) between 2 and 100),
  organization_name text not null check (char_length(organization_name) between 2 and 160),
  contact_role text check (contact_role is null or char_length(contact_role) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254),
  phone text not null check (char_length(phone) between 8 and 24),
  team_size text not null check (team_size in ('up_to_10','11_to_30','31_to_100','101_to_300','over_300','not_defined')),
  delivery_mode text not null check (delivery_mode in ('online','in_person','hybrid','to_define')),
  course_interest text not null default 'lideranca-estrategica-aplicada'
    check (char_length(course_interest) between 2 and 120),
  goals text not null check (char_length(goals) between 20 and 2000),
  consent_at timestamptz not null,
  source_path text not null default '/universidade/empresas'
    check (char_length(source_path) between 1 and 240),
  submission_fingerprint text not null check (char_length(submission_fingerprint) = 64),
  status text not null default 'received'
    check (status in ('received','reviewing','qualified','proposal_prepared','sent','accepted','declined','archived')),
  quote_provider_target text not null default 'orca_facil'
    check (quote_provider_target = 'orca_facil'),
  acceptance_provider_target text not null default 'confirmapro'
    check (acceptance_provider_target = 'confirmapro'),
  integration_state text not null default 'not_connected'
    check (integration_state in ('not_connected','ready_for_manual_handoff','quote_registered','acceptance_requested','accepted','failed')),
  quote_external_ref text check (quote_external_ref is null or char_length(quote_external_ref) between 3 and 160),
  acceptance_external_ref text check (acceptance_external_ref is null or char_length(acceptance_external_ref) between 3 and 160),
  retention_until date not null default (current_date + 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vc_university_proposal_events (
  event_id bigint generated always as identity primary key,
  proposal_id uuid not null references public.vc_university_proposal_requests(proposal_id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  previous_status text,
  new_status text not null,
  internal_note text check (internal_note is null or char_length(internal_note) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists vc_university_proposals_status_created_idx
  on public.vc_university_proposal_requests(status, created_at desc);
create index if not exists vc_university_proposals_fingerprint_created_idx
  on public.vc_university_proposal_requests(submission_fingerprint, created_at desc);
create index if not exists vc_university_proposals_retention_idx
  on public.vc_university_proposal_requests(retention_until);
create index if not exists vc_university_proposal_events_proposal_created_idx
  on public.vc_university_proposal_events(proposal_id, created_at desc);
create index if not exists vc_university_proposal_events_actor_idx
  on public.vc_university_proposal_events(actor_user_id);

alter table public.vc_university_proposal_requests enable row level security;
alter table public.vc_university_proposal_events enable row level security;

revoke all on public.vc_university_proposal_requests from public, anon, authenticated;
revoke all on public.vc_university_proposal_events from public, anon, authenticated;
grant select, insert, update on public.vc_university_proposal_requests to service_role;
grant select, insert on public.vc_university_proposal_events to service_role;
grant usage, select on sequence public.vc_university_proposal_events_event_id_seq to service_role;

create or replace function public.vc_university_guard_proposal_immutable_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.proposal_id, new.proposal_reference, new.idempotency_key, new.contact_name,
    new.organization_name, new.contact_role, new.email, new.phone, new.team_size,
    new.delivery_mode, new.course_interest, new.goals, new.consent_at,
    new.source_path, new.submission_fingerprint, new.created_at
  ) is distinct from row(
    old.proposal_id, old.proposal_reference, old.idempotency_key, old.contact_name,
    old.organization_name, old.contact_role, old.email, old.phone, old.team_size,
    old.delivery_mode, old.course_interest, old.goals, old.consent_at,
    old.source_path, old.submission_fingerprint, old.created_at
  ) then
    raise exception 'proposal_identity_is_immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists vc_university_guard_proposal_immutable_fields on public.vc_university_proposal_requests;
create trigger vc_university_guard_proposal_immutable_fields
before update on public.vc_university_proposal_requests
for each row execute function public.vc_university_guard_proposal_immutable_fields();

create or replace function public.vc_university_submit_proposal_request(
  p_idempotency_key uuid,
  p_contact_name text,
  p_organization_name text,
  p_contact_role text,
  p_email text,
  p_phone text,
  p_team_size text,
  p_delivery_mode text,
  p_course_interest text,
  p_goals text,
  p_consent_at timestamptz,
  p_source_path text,
  p_submission_fingerprint text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reference text;
  v_proposal_id uuid;
begin
  select proposal_reference into v_reference
  from public.vc_university_proposal_requests
  where idempotency_key = p_idempotency_key;
  if v_reference is not null then
    return v_reference;
  end if;

  if (select count(*) from public.vc_university_proposal_requests
      where submission_fingerprint = p_submission_fingerprint
        and created_at >= now() - interval '1 hour') >= 5 then
    raise exception 'proposal_rate_limited';
  end if;

  insert into public.vc_university_proposal_requests (
    idempotency_key, contact_name, organization_name, contact_role, email, phone,
    team_size, delivery_mode, course_interest, goals, consent_at, source_path,
    submission_fingerprint
  ) values (
    p_idempotency_key, trim(p_contact_name), trim(p_organization_name), nullif(trim(p_contact_role), ''),
    lower(trim(p_email)), trim(p_phone), p_team_size, p_delivery_mode,
    p_course_interest, trim(p_goals), p_consent_at, p_source_path, p_submission_fingerprint
  ) returning proposal_id, proposal_reference into v_proposal_id, v_reference;

  insert into public.vc_university_proposal_events (proposal_id, previous_status, new_status, internal_note)
  values (v_proposal_id, null, 'received', 'Solicitação recebida pelo formulário empresarial.');
  return v_reference;
end;
$$;

create or replace function public.vc_university_transition_proposal(
  p_proposal_id uuid,
  p_new_status text,
  p_actor_user_id uuid,
  p_internal_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.vc_university_proposal_requests%rowtype;
  v_allowed boolean := false;
begin
  if p_actor_user_id is null then raise exception 'proposal_actor_required'; end if;
  select * into v_row from public.vc_university_proposal_requests
    where proposal_id = p_proposal_id for update;
  if not found then raise exception 'proposal_not_found'; end if;

  v_allowed := case v_row.status
    when 'received' then p_new_status in ('reviewing','qualified','declined','archived')
    when 'reviewing' then p_new_status in ('qualified','declined','archived')
    when 'qualified' then p_new_status in ('proposal_prepared','declined','archived')
    when 'proposal_prepared' then p_new_status in ('qualified','sent','archived')
    when 'sent' then p_new_status in ('accepted','declined','archived')
    when 'accepted' then p_new_status = 'archived'
    when 'declined' then p_new_status in ('reviewing','archived')
    else false
  end;
  if not v_allowed then raise exception 'invalid_proposal_transition'; end if;

  update public.vc_university_proposal_requests set
    status = p_new_status,
    integration_state = case
      when p_new_status = 'proposal_prepared' then 'ready_for_manual_handoff'
      when p_new_status = 'accepted' then 'accepted'
      else integration_state
    end
  where proposal_id = p_proposal_id;

  insert into public.vc_university_proposal_events (
    proposal_id, actor_user_id, previous_status, new_status, internal_note
  ) values (
    p_proposal_id, p_actor_user_id, v_row.status, p_new_status, nullif(trim(p_internal_note), '')
  );

  return jsonb_build_object('proposal_id', p_proposal_id, 'status', p_new_status);
end;
$$;

revoke all on function public.vc_university_guard_proposal_immutable_fields() from public, anon, authenticated;
revoke all on function public.vc_university_submit_proposal_request(uuid,text,text,text,text,text,text,text,text,text,timestamptz,text,text) from public, anon, authenticated;
revoke all on function public.vc_university_transition_proposal(uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.vc_university_submit_proposal_request(uuid,text,text,text,text,text,text,text,text,text,timestamptz,text,text) to service_role;
grant execute on function public.vc_university_transition_proposal(uuid,text,uuid,text) to service_role;
