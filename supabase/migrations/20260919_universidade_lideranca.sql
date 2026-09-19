-- Universidade V&C: identidade comercial do curso e evidências individuais.
-- Nenhum checkout é ativado nesta migration.
insert into public.vc_products(product_id,canonical_name,status,brand_mode,data_boundary,official_url_global,metadata)
values('P-021','Liderança Estratégica Aplicada','development','vc_native','isolated:universidade-vc',null,
  jsonb_build_object('type','course','hours_planned',20,'version','1.0','source_status','ready_for_homologation'))
on conflict(product_id) do nothing;

insert into public.vc_product_editions(edition_id,product_id,market,default_locale,locales,status,official_url,commercial_status,metadata)
values('P-021-BR-PT','P-021','BR','pt-BR',array['pt-BR'],'planned',null,'planned',jsonb_build_object('audience','first_line_leaders'))
on conflict(edition_id) do nothing;

insert into public.vc_offers(offer_id,product_id,name,status,market,plan_code,release_channel,seat_mode,features,metadata,currency,unit_amount_minor,billing_model,commerce_enabled)
values('P-021-BR-FOUNDERS','P-021','Turma Fundadora · Liderança Estratégica Aplicada','draft','BR','FOUNDERS','stable','single',
  jsonb_build_object('course_version','1.0','modules',10),jsonb_build_object('price_hypothesis','launch_147_brl'),
  'BRL',14700,'one_time',false)
on conflict(offer_id) do nothing;

create table if not exists public.vc_course_evidence (
 user_id uuid not null references auth.users(id) on delete cascade,
 product_id text not null references public.vc_products(product_id),
 module_no smallint not null check(module_no between 1 and 10),
 evidence text not null default '' check(length(evidence)<=12000),
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(user_id,product_id,module_no)
);
create index if not exists vc_course_evidence_product on public.vc_course_evidence(product_id,module_no);
alter table public.vc_course_evidence enable row level security;
revoke all on public.vc_course_evidence from public,anon;
grant select,insert,update(evidence,updated_at,completed_at) on public.vc_course_evidence to authenticated;
create or replace function public.vc_course_has_access()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(
  select 1 from public.vc_entitlements e
  where e.subject_type='person' and e.subject_id=(select auth.uid())::text
   and e.product_id='P-021' and e.status='active' and e.starts_at<=now()
   and (e.ends_at is null or now()<e.ends_at)
 )
$$;
revoke all on function public.vc_course_has_access() from public,anon;
grant execute on function public.vc_course_has_access() to authenticated;

create policy vc_course_evidence_select on public.vc_course_evidence
 for select to authenticated using (
 user_id=(select auth.uid()) and product_id='P-021' and (select public.vc_course_has_access())
 );
create policy vc_course_evidence_insert on public.vc_course_evidence
 for insert to authenticated with check (
 user_id=(select auth.uid()) and product_id='P-021' and (select public.vc_course_has_access())
 );
create policy vc_course_evidence_update on public.vc_course_evidence
 for update to authenticated using (
 user_id=(select auth.uid()) and product_id='P-021' and (select public.vc_course_has_access())) with check (user_id=(select auth.uid()) and product_id='P-021');
