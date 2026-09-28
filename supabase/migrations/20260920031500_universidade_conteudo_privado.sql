-- Conteúdo pedagógico versionado. Sem políticas de leitura para o navegador.
-- O JSON inicial será importado da função privada existente, sem gabaritos.
create table if not exists public.vc_university_course_content (
 course_id text not null references public.vc_university_courses(course_id),
 course_version text not null,
 content jsonb not null,
 source_function_version integer,
 imported_at timestamptz not null default now(),
 primary key (course_id,course_version),
 check (content->>'id'=course_id),
 check (content->>'version'=course_version),
 check (jsonb_typeof(content->'modules')='array')
);

alter table public.vc_university_course_content enable row level security;
revoke all on public.vc_university_course_content from public, anon, authenticated;
grant select on public.vc_university_course_content to service_role;
