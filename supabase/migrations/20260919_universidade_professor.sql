-- Revisão pedagógica e avaliação final auditável; apenas o aluno lê seu parecer.
create table if not exists public.vc_course_reviews (
 user_id uuid not null,
 product_id text not null,
 module_no smallint not null,
 status text not null check(status in ('approved','revise')),
 feedback text not null default '' check(length(feedback)<=2000),
 reviewer_id uuid not null references auth.users(id),
 reviewed_at timestamptz not null default now(),
 primary key(user_id,product_id,module_no),
 foreign key(user_id,product_id,module_no) references public.vc_course_evidence(user_id,product_id,module_no) on delete cascade
);
alter table public.vc_course_reviews enable row level security;
revoke all on public.vc_course_reviews from public,anon,authenticated;
grant select on public.vc_course_reviews to authenticated;
create policy vc_course_reviews_student_read on public.vc_course_reviews
 for select to authenticated using(user_id=(select auth.uid()) and product_id='P-021' and (select public.vc_course_has_access()));

create table if not exists public.vc_course_assessment_attempts (
 attempt_id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 product_id text not null references public.vc_products(product_id),
 answers jsonb not null,
 score smallint not null check(score between 0 and 10),
 submitted_at timestamptz not null default now()
);
create index if not exists vc_course_attempts_user on public.vc_course_assessment_attempts(user_id,product_id,submitted_at desc);
alter table public.vc_course_assessment_attempts enable row level security;
revoke all on public.vc_course_assessment_attempts from public,anon,authenticated;
grant select on public.vc_course_assessment_attempts to authenticated;
create policy vc_course_attempts_student_read on public.vc_course_assessment_attempts
 for select to authenticated using(user_id=(select auth.uid()) and product_id='P-021' and (select public.vc_course_has_access()));
