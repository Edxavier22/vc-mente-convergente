-- Final assessment v1.1: a reviewed pool larger than the 20-question exam,
-- persistent exam sessions and atomic attempt recording. Browser roles never
-- receive the answer key or direct write access to academic records.

create table if not exists public.vc_university_final_sessions (
 session_id uuid primary key default gen_random_uuid(),
 enrollment_id uuid not null,
 course_id text not null,
 course_version text not null,
 question_ids uuid[] not null check (cardinality(question_ids) = 20),
 started_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '2 hours'),
 submitted_at timestamptz,
 foreign key (enrollment_id, course_id)
  references public.vc_university_enrollments(enrollment_id, course_id),
 foreign key (course_id, course_version)
  references public.vc_university_course_content(course_id, course_version),
 check (expires_at > started_at),
 check (submitted_at is null or submitted_at >= started_at)
);

create index if not exists vc_university_final_sessions_open_idx
 on public.vc_university_final_sessions(enrollment_id, course_id, course_version, started_at desc)
 where submitted_at is null;

alter table public.vc_university_final_sessions enable row level security;
revoke all on public.vc_university_final_sessions from public, anon, authenticated;
grant select, insert, update on public.vc_university_final_sessions to service_role;

alter table public.vc_university_final_attempts
 add column if not exists session_id uuid references public.vc_university_final_sessions(session_id),
 add column if not exists course_id text,
 add column if not exists course_version text;

alter table public.vc_university_final_attempts
 drop constraint if exists vc_university_final_attempts_content_version_fkey;
alter table public.vc_university_final_attempts
 add constraint vc_university_final_attempts_content_version_fkey
 foreign key (course_id, course_version)
 references public.vc_university_course_content(course_id, course_version);

create unique index if not exists vc_university_final_attempts_session_idx
 on public.vc_university_final_attempts(session_id) where session_id is not null;

-- This function is SECURITY INVOKER and executable only by service_role.
-- It serializes a submission, enforces the rolling attempt limit and records
-- the attempt plus session completion in one database transaction.
create or replace function public.vc_university_submit_final_attempt(
 p_session_id uuid,
 p_enrollment_id uuid,
 p_course_id text,
 p_course_version text,
 p_score smallint,
 p_review_concepts jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
 assessment public.vc_university_final_sessions%rowtype;
 recent_attempts integer;
 new_attempt_id uuid;
begin
 select * into assessment
 from public.vc_university_final_sessions
 where session_id = p_session_id
 for update;

 if assessment.session_id is null
    or assessment.enrollment_id <> p_enrollment_id
    or assessment.course_id <> p_course_id
    or assessment.course_version <> p_course_version
    or assessment.submitted_at is not null
    or assessment.expires_at <= now() then
  return jsonb_build_object('error', 'assessment_session_invalid');
 end if;

 select count(*) into recent_attempts
 from public.vc_university_final_attempts
 where enrollment_id = p_enrollment_id
  and submitted_at >= now() - interval '24 hours';

 if recent_attempts >= 3 then
  return jsonb_build_object('error', 'attempt_limit');
 end if;

 insert into public.vc_university_final_attempts
  (session_id, enrollment_id, course_id, course_version, score,
   question_count, review_concepts)
 values
  (p_session_id, p_enrollment_id, p_course_id, p_course_version, p_score,
   20, p_review_concepts)
 returning attempt_id into new_attempt_id;

 update public.vc_university_final_sessions
 set submitted_at = now()
 where session_id = p_session_id;

 return jsonb_build_object('attempt_id', new_attempt_id);
end
$$;

revoke all on function public.vc_university_submit_final_attempt(uuid,uuid,text,text,smallint,jsonb)
 from public, anon, authenticated;
grant execute on function public.vc_university_submit_final_attempt(uuid,uuid,text,text,smallint,jsonb)
 to service_role;

-- Preserve the 24 reviewed v1.0 items in the immutable v1.1 bank.
insert into public.vc_university_questions
 (question_id, course_id, course_version, module_no, purpose, kind, prompt,
  choices, correct_index, review_concept, active)
select gen_random_uuid(), q.course_id, '1.1', null, 'final', q.kind, q.prompt,
 q.choices, q.correct_index, q.review_concept, true
from public.vc_university_questions q
where q.course_id = 'lideranca-estrategica-aplicada'
 and q.course_version = '1.0'
 and q.purpose = 'final'
 and not exists (
  select 1 from public.vc_university_questions target
  where target.course_id = q.course_id
   and target.course_version = '1.1'
   and target.purpose = 'final'
   and target.prompt = q.prompt
 );

-- Six additional applied items create a 30-question pool. They use only the
-- course's own concepts and deliberately avoid trivia or implausible options.
insert into public.vc_university_questions
 (course_id, course_version, module_no, purpose, kind, prompt, choices,
  correct_index, review_concept, active)
values
 ('lideranca-estrategica-aplicada','1.1',null,'final','case',
  'Uma operação registra retrabalho apenas quando o cliente reclama. A equipe conclui que a qualidade melhorou porque houve menos reclamações. Qual ação produz uma linha de base mais confiável?',
  '["Manter o indicador, pois a percepção do cliente é a única evidência necessária.","Contar todo retrabalho por fonte e período, verificar o critério de registro e então comparar os resultados.","Perguntar quem cometeu mais erros e usar essa percepção como medida.","Reduzir a meta de qualidade até que os dados atuais se tornem suficientes."]'::jsonb,
  1,'linha de base, fonte e critério de registro',true),
 ('lideranca-estrategica-aplicada','1.1',null,'final','application',
  'Um processo RADAR funciona nos casos rotineiros, mas as exceções ficam paradas esperando a diretoria. Qual ajuste preserva controle e aumenta a fluidez?',
  '["Eliminar os limites para que qualquer pessoa aprove qualquer exceção.","Aumentar a frequência das reuniões sem mudar as alçadas.","Definir tipos de exceção, alçadas, registro da decisão e prazo de escalonamento.","Nomear mais responsáveis pelo mesmo resultado sem distinguir autoridade."]'::jsonb,
  2,'RADAR: autonomia, limites e escalonamento',true),
 ('lideranca-estrategica-aplicada','1.1',null,'final','decision',
  'Uma pessoa recebeu autonomia para negociar prazos dentro de cinco dias. Diante de um pedido de oito dias, qual conduta demonstra delegação responsável?',
  '["Negar automaticamente sem analisar impacto ou alternativas.","Decidir os oito dias sem informar, pois o resultado foi delegado.","Devolver toda negociação definitivamente ao líder.","Preparar opções e evidências, escalar a exceção e registrar a decisão tomada."]'::jsonb,
  3,'delegação: limites, autoridade e exceções',true),
 ('lideranca-estrategica-aplicada','1.1',null,'final','case',
  'A produtividade subiu após uma meta agressiva, mas também aumentaram correções e afastamentos. Qual leitura é mais adequada?',
  '["A meta funcionou porque produtividade é o único indicador relevante.","A equipe precisa apenas de reconhecimento para manter o ritmo.","É preciso ler resultado, qualidade e capacidade em conjunto antes de sustentar a decisão.","As correções devem ser excluídas do painel porque ocorreram depois das entregas."]'::jsonb,
  2,'indicadores balanceados e consequências não intencionais',true),
 ('lideranca-estrategica-aplicada','1.1',null,'final','decision',
  'Durante uma comunicação difícil, a outra pessoa apresenta um fato novo que altera a compreensão do caso. Qual resposta é coerente com escuta e decisão baseada em evidência?',
  '["Manter a conclusão inicial para não demonstrar insegurança.","Reconhecer o dado novo, verificar sua fonte e revisar o acordo se ele mudar o diagnóstico.","Encerrar a conversa e registrar apenas a versão do líder.","Transformar o fato novo em assunto pessoal para evitar mudança de decisão."]'::jsonb,
  1,'escuta, verificação e revisão de acordos',true),
 ('lideranca-estrategica-aplicada','1.1',null,'final','application',
  'No Plano de Liderança de 30 dias, uma ação foi executada, mas não gerou o resultado esperado. O que torna a revisão metodologicamente útil?',
  '["Registrar execução, indicador e contexto; testar uma hipótese de ajuste com responsável e nova data de revisão.","Substituir o indicador por uma impressão positiva da equipe.","Repetir indefinidamente a mesma ação para demonstrar consistência.","Retirar a evidência do plano para que a ação permaneça concluída."]'::jsonb,
  0,'plano de 30 dias: aprendizagem e revisão',true)
on conflict do nothing;

do $$
declare
 active_items integer;
 invalid_items integer;
 invalid_kind_groups integer;
begin
 select count(*) into active_items
 from public.vc_university_questions
 where course_id = 'lideranca-estrategica-aplicada'
  and course_version = '1.1' and purpose = 'final' and active = true;

 select count(*) into invalid_items
 from public.vc_university_questions
 where course_id = 'lideranca-estrategica-aplicada'
  and course_version = '1.1' and purpose = 'final' and active = true
 and (jsonb_array_length(choices) <> 4 or correct_index not between 0 and 3
       or length(trim(review_concept)) < 3);

 select count(*) into invalid_kind_groups
 from (
  select kind
  from public.vc_university_questions
  where course_id = 'lideranca-estrategica-aplicada'
   and course_version = '1.1' and purpose = 'final' and active = true
  group by kind
  having count(*) < 5
 ) insufficient;

 if active_items < 30 or invalid_items <> 0 or invalid_kind_groups <> 0 then
  raise exception 'final_bank_v11_invalid:active=%,invalid=%,kinds=%',
   active_items, invalid_items, invalid_kind_groups;
 end if;
end
$$;
