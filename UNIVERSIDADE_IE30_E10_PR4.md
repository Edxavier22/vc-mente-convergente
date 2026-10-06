# PR 4 — Motor de ciclos aplicados + IE30 + E10

Base obrigatória: `ea4bfac2d4cd886e23b90fa79adf2f63c3d07247`. Branch `feat/ie-course-ie30-e10`. Stack #11 → #12 → #13 → este PR. Nenhum merge.

## Diagnóstico e arquitetura

PR13 confirmado aberto/Draft, SHA aprovado. Cópia local limpa e source remoto learner v18/professor v11 idêntico à base. Todas as migrations PR1–PR3 confirmadas. As quatro tabelas canônicas de application_cycles existiam sem definições/versões/instâncias/entries. Entries e revisões acadêmicas já eram imutáveis; ciclos/entries tinham RLS de leitura própria e nenhum acesso docente/B2B. Evidências E01–E09, requisitos e conclusão PR2 foram preservados. Não havia infraestrutura de notificações acadêmicas.

O motor evolui `application_cycle_definitions`, `application_cycle_versions`, `application_cycles` e `application_cycle_entries`; nenhuma tabela IE30 específica. Definições versionadas configuram duração, janela, elegibilidade, fases, formulários, aplicações, rubrica, prazo de revisão e limites. Configuração publicada/usada não pode ser alterada ou reaberta como draft. Escritas são RPCs service-only que resolvem aluno/matrícula/versão/contexto e validam estado. APIs não aceitam aluno, matrícula, nota, aprovação ou reviewer arbitrários do cliente.

## IE30 e política operacional

Manifesto `content/cycles/ie30.v1.json`, somente estrutura e textos autorizados. Um alvo, até três contextos/sinais/estratégias/planos SE–ENTÃO, um a três indicadores observáveis. Teste da Câmera como heurística educacional. Sem diagnóstico, score emocional, hábito cientificamente garantido ou streak.

Preparação após M7 não define started_at. Confirmação após M9 define started_at. Quatro fases: OBSERVAR 1–7, INTERROMPER 8–14, SUBSTITUIR 15–21, CONSOLIDAR 22–30. Pausa/retomada registram timestamps e motivo opcional categórico; a janela fixa não se estende. Após 30 dias, finalização; até 45 dias, primeira submissão. Após 45 sem entrega, closed_incomplete, preservando histórico. A expiração é normalizada ao acessar o RPC; não há job agendado que apague ou modifique dados em segundo plano.

Entrega feita no prazo permanece na revisão humana, sem expirar durante espera docente. Cada solicitação de revisão abre 14 dias para resposta. Duas revisões incluídas; nova insuficiência leva a `special_review_required`, sem reprovação automática. Professor atribuído pode autorizar mais uma revisão; limite operacional de dez autorizações especiais por ciclo protege abuso e exige futura política de reabertura além disso. O encaminhamento especial mantém o histórico, aguardando decisão humana.

Estados: not_started (ausência de instância), setup, active, paused, resumed, awaiting_weekly_review, final_reflection, submitted, under_review, revision_requested, resubmitted, approved e closed_incomplete; estados genéricos legados permanecem aceitos. Transições são verificadas no servidor.

## Experiência, autosave e histórico

Setup em seções; quick log com data/cenário/contexto/situação/ferramenta/resultado/aprendizado/indicadores; nenhum registro diário obrigatório. Cenários reais seguros, anonimizados, simulados, retrospectivos ou hipotéticos. Indicadores selecionados entre os do objetivo. Correção de log cria nova versão ligada à anterior. Quatro revisões semanais, liberadas nas fronteiras temporais; nenhuma oportunidade relevante admite reflexão opcional. Revisão concluída é imutável; correção durante revisão solicitada cria nova versão.

Setup, revisões e reflexão reutilizam debounce 800ms, single-flight, flush e cache temporário do renderer PR3. Uma seção de edição ativa evita concorrência entre formulários; versão otimista impede sobrescrita entre telas. SessionStorage é temporário, isolado por usuário/ciclo/etapa; não é analytics nem persistência de preview. Quick logs usam envio explícito; não existe request por tecla.

Labels, fieldsets, help/privacy hints, foco de erro, numeric/date inputs, alvos 48px e aria-live controlado. Formulários em cards/etapas, renderização móvel de 390px na prévia. Não há rankings, comparação ou culpa por ausência.

## E10, rubrica e professor

E10 = Projeto Integrador IE30, canonical evidence human_required/on_approval. Snapshot gerado no banco inclui objetivos/versionamento/planos/indicadores, somente logs relevantes selecionados, quatro revisões, aplicações e reflexão/ próximo ciclo. Não há cópia manual nem segundo projeto final. Validação estrutural exige três PAUSA, uma CLARO e uma DECIDE nas versões atuais dos registros selecionados. Snapshot e revisão E10 imutáveis, UUID idempotente, duplo envio não duplica revisão.

Reflexão contém as oito perguntas oficiais e o bloco mudou/não mudou/ainda não sei. Aviso integral de privacidade novamente antes de enviar, com confirmação. Professor recebe revisão exata e visão consolidada; quick logs privados não são fornecidos diretamente.

Rubrica: Padrões15, Ferramentas20, Reflexão15, Coerência15, Aplicabilidade20, Indicadores10, Clareza5 =100. Backend soma valores numeric, sem arredondar; <70 solicita revisão, >=70 aprova. Feedback estruturado: reconhecer evidência, localizar lacuna, retornar ao critério, orientar próxima ação. API genérica de evidência não contorna rubrica obrigatória. Painel docente tem aluno/turma/revisão/status/data/histórico/rubrica/feedback e prioriza entregas que precisam de ação; início de revisão explícito.

## Progressão e limites

Aprovação E10 satisfaz `final_project_approved` por integração canônica de evidência/requisito. Não há lógica paralela de conclusão. Esse requisito de M10 é `required=false` para conclusão do módulo, com `certification_gate=true` e `module_completion_gate=false`: M10 e futuro exame permanecem independentes da espera pelo ciclo. O futuro motor de certificação deverá ler esse gate explicitamente. Primeira submissão/fim de 30 dias não satisfazem o projeto.

Prova final/certificação legadas continuam para Liderança; cursos estruturados recebem bloqueio explícito dessas rotas até PR futuro. Nenhum certificado IE emitido. Não foram adicionadas aulas/checkpoints definitivos, QR/PDF, IA avaliadora, psicometria, diagnóstico, pagamento ou relatórios emocionais B2B.

## Privacidade, RLS e auditoria

Leitura própria de ciclos/entries; professores/owners/B2B não leem registros privados. E10 somente docente atribuído, propósito acadêmico e revisão imutável, sem bypass de proprietário. Aluno não escreve review, rubrica ou status. `contains_sensitive_data` mantido. Conteúdo não integrado a analytics. Audit events mínimos de setup/start/alvo/pause/resume/log/weekly/final/E10 submission/resubmission/revision/approval, IDs/estado e total acadêmico da rubrica, sem relatos completos.

## Migrations e funções

Homologação `ctzgsxxbyvruzmfqibnl`, aplicadas uma vez:

- `20261006164744_universidade_application_cycle_engine.sql`
- `20261006165648_universidade_cycle_policy_hardening.sql`

Learner v19; professor v12. Configurações IE30/E10/novo requisito continuam Draft. Nenhuma migration PR1–PR3 reaplicada.

## Validação

- 159 testes Node: 130 anteriores +29 novos, todos aprovados.
- check, lint, typecheck, secret scan e diff check aprovados.
- SQL completo service_role/authenticated com BEGIN/ROLLBACK: preparação M7; start antes M9 recusado; início M9; pausa sem extensão; objetivo/log versionados; ausência diária; quatro revisões; nenhuma oportunidade; 3/1/1 aplicações; dia30/reflexão; E10 idempotente; 69/revisão; duas revisões incluídas; encaminhamento especial/autorização humana; ressubmissão imutável; 70/aprovação/gate satisfeitos.
- Expiração em pausa no dia46 fecha incompleto e conserva entries.
- RLS alunoA/B, professor atribuído/não atribuído, quick logs privados, owner sem bypass e B2B aprovados.
- M10 concluído antes de E10 no fluxo SQL; progressão sequencial canônica preservada.
- SQL regressão PR3 E01→checkpoint→M2, foundation RLS, PR2 RLS e Liderança M1→M2 aprovados, rollback completo.
- Vercel inicial READY, deployment dpl_BQ6nvrkwoavpWv88AmSCzjPtXikN, SHA 3ff2445123bae65ff874aa60e15bb4f4882d48cb; Actions run37500493114 success.
- Browser: quick log hipotético preenchido, resumo/aviso/simulação e geometria390px sem overflow confirmados. Mensagem de conta indevida em preview identificada e corrigida pelo repasse do flag preview ao renderer PR3; nenhum dado fora de memória foi persistido.
- Timeout interno de navegador recuperado; preview administrativo carregou com sign-in requerido na sessão nova. Fixture técnica em tests/universidade-cycle-preview.html usa exatamente o renderer e manifesto canônicos em memória para validação sem autenticação/escrita. Resultado visual final no head/PR.

## Gaps PR5 e riscos

Conteúdo oficial/checkpoints definitivos, prova final estruturada e certificação ainda pendentes por escopo. Certificação futura deve considerar módulos, E10 approved e futura prova, sem confundir conclusão do módulo com aprovação do projeto. Notificações moderadas: eventos auditáveis preparados, sem worker, push ou email; infraestrutura inexistente, documentada como gap. Reabertura/novo ciclo após closed_incomplete é futura. Mobile validado em largura390 no browser, sem dispositivo físico. Preview técnico canônico usa somente fixtures hipotéticas em memória; preview administrativo autenticado exige login nesta sessão nova e não foi exercitado com credenciais de aluno/professor. Aviso Auth preexistente de proteção de senhas vazadas desativada permanece: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

Não houve merge na main.
