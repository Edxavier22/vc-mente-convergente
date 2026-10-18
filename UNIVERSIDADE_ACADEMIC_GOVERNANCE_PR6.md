# PR 6 — Governança acadêmica multicursos

Base exata `e013c44b83b12e0deea7af65e15fd25844efba83`, branch `feat/ie-course-academic-governance`, stacked sobre `feat/ie-course-assessment-bank` (PR #15). PRs #11–#15 intactos, Draft, sem merge.

## Auditoria inicial e arquitetura reaproveitada

Não havia branch equivalente ao PR 6. O GitHub PR #6 é uma etapa antiga de certificação de Liderança e não representa esta missão. Foram encontrados painel geral privado, espelho de conteúdo-mestre, painel docente, assignments em `vc_university_teachers`, catálogo de versões, aulas/blocos, requisitos/progresso, banco 50+20, evidências/revisões/pareceres canônicos, IE30/E10, preview por perspectiva e motor legado de certificados.

Os estados legados de conteúdo eram draft/review/published/archived (fontes usam verified). Não existia mecanismo persistente de aprovação editorial que condicionasse publicação. O PR acrescenta apenas o registro de governança editorial referenciado por tipo/ID/fingerprint; não duplica conteúdo, versões, questões, submissões, ciclos ou revisões docentes. O histórico usa `vc_university_academic_audit_log`.

Liderança v1.1, suas aulas, questões e funções de emissão/certificação não foram editadas. O resolvedor novo retorna `legacy_certificate_engine_preserved` para o modelo legado. Nenhum conteúdo das dez aulas IE foi inventado ou importado.

## Painel do professor

O painel existente ganhou seleção de cursos/turmas efetivamente atribuídos, resumo por versão fixada na matrícula, módulos concluídos, estado do ciclo e fila ordenada por revisão especial, ressubmissão, nova submissão e revisão em andamento, com desempate por data/ID.

E10 continua usando a rubrica canônica de sete critérios e feedback estruturado em quatro partes. A consulta histórica busca a revisão explícita, verifica atribuição no servidor e mostra somente o snapshot compartilhado daquela revisão e seus pareceres. Ações docentes continuam nos RPCs existentes de revisão, com recusa de revisão stale. Os quick logs não selecionados e relatos fora do escopo não são consultados.

Módulos concluídos não são rotulados como certificação concluída no novo resumo estruturado. A ação “Consultar requisitos para certificação” usa o resolvedor no servidor. O percurso legado de Liderança continua com seus renderizadores existentes.

## Painel do proprietário e editores

Nova superfície `/governanca-universidade`, vinculada ao painel geral, com inventário multicursos e versões: curso, módulo, aula, bloco, evidência, questão, ciclo, ferramenta, requisito, dependência e fonte. Filtros, consulta do conteúdo exato, parecer, autor, fontes, lacunas, histórico, pré-publicação e edição de campos autorizados em rascunho.

A edição avançada recebe um patch estruturado validado por allowlist no servidor; identidade, versão, status, notas e dados dos alunos não podem ser alterados por esse caminho. Editar rascunho retorna a decisão ao estado draft e incrementa a revisão, exigindo nova avaliação.

Owner pode atribuir/remover professor e delegar explicitamente revisão editorial pelo campo `can_edit_academic` da atribuição existente. A delegação restringe-se ao curso da turma; publicar/arquivar via workflow continua exclusivo do owner. Revogação tem efeito nas novas consultas, sem depender de claims editáveis do usuário.

O inventário e saúde retornam somente conteúdo acadêmico/metadados. Integrações externas são identificadas como não verificadas, sem sugerir um health check inexistente. Relatos de alunos não são incorporados à visão de governança. Ser owner não substitui atribuição docente.

## Workflow editorial

`draft → in_review → approved_for_publication → published → archived`, com retorno a draft antes de publicação para correções. Estados de governança coexistem com os estados acadêmicos legados, sem alterar os filtros dos motores anteriores.

Cada decisão exige ator autorizado, autor confirmado, parecer, revisão esperada e fontes válidas. Aprovação/publicação exigem fontes e nenhuma lacuna declarada; fingerprint divergente invalida o avanço. Controle transacional e lock por material impedem decisões concorrentes silenciosas. Histórico registra autor/decisor, versão da decisão, fontes, gaps, fingerprint, parecer e transição, sem copiar conteúdo de alunos.

Triggers bloqueiam inserção/publicação de material novo sem aprovação e alterações de status para published/verified sem uma decisão válida. Cursos/bancos legados permanecem compatíveis. O endpoint de publicação IE recusa `ie_publication_disabled` nesta etapa.

As 70 questões IE permanecem **draft/inativas**, versão de questão 1, sem alteração no arquivo do banco. As cinco lacunas originais continuam no banco e visíveis no painel:

| Questão | Lacuna preservada |
|---|---|
| IE-M02-Q05 | Composição/instruções oficiais de PENTA |
| IE-M04-Q05 | Composição oficial de 3R |
| IE-M07-Q03 | Passos oficiais de FARO |
| IE-M08-Q04 | Composição oficial de CPTR |
| IE-M10-Q01 | Passos oficiais de CALMA |

Nenhuma definição foi inventada nem substituída por texto genérico.

## Preview operacional

Reaproveita o preview autorizado de aluno simulado, professor e conteúdo-mestre. Owner é verificado por identidade exata, e editor delegado só pode abrir mestre nos cursos autorizados. Professor comum não recebe essa perspectiva. Abrange aulas/blocos existentes, E01–E09, IE30/E10, checkpoints, prova/feedback/retry e estrutura de certificado simulada, sem nome real, código público ou QR.

A perspectiva está rotulada como simulação. O preview não cria matrícula, tentativa, evidência, nota, certificado ou conclusão. A fixture pública de QA contém apenas conteúdo técnico hipotético; não publica gabaritos oficiais.

## Resolvedor autoritativo de elegibilidade

`vc_university_certification_eligibility` é uma consulta estável, sem escrita ou emissão. Resolve a versão da matrícula, escopo e status, módulos publicados/concluídos, checkpoints realmente aprovados, todos os requisitos obrigatórios publicados, suficiência das nove evidências, prova final ligada à sessão e E10 humana na revisão atual.

A prova exige `final_assessment_passed` e tentativa aprovada com contexto histórico correto. E10 exige `final_project_approved` ligado ao ID da revisão de evidência, submissão aprovada e parecer humano correspondente, não apenas M10 concluído ou prova aprovada. O retorno enumera requisitos faltantes, com código, módulo/evidência/ID quando aplicável, e sempre mantém `issuanceEnabled=false`.

Learner consulta apenas sua matrícula resolvida no servidor. Professor consulta apenas turmas atribuídas. Owner pode consultar metadados de elegibilidade sem receber narrativas. Não foi criado emissor IE, QR, código público ou alteração de certificados legados.

## Schema, funções e privacidade

Migration aplicada uma vez em homologação: `20261018184102_universidade_academic_governance.sql` (nome do arquivo alinhado ao ledger remoto; arquivo inicial foi criado pela CLI).

Tabela de metadados nova: `vc_university_editorial_reviews`, com RLS habilitada e sem grants ao browser. Coluna nova em assignments: `can_edit_academic`, default false. As funções novas são SECURITY INVOKER, service-only, com search_path vazio. Endpoints verificam a identidade e repassam o ator resolvido, nunca o revisor arbitrário do payload.

RPCs: governance_owner, editor_can, academic_materials, editorial_publish_guard, editorial_decide, teacher_operations, teacher_revision, certification_eligibility, teacher_assignment, governance_read e material_draft_save, todos com prefixo `vc_university_`.

Edge Functions implantadas: learner **v21**, admin **v10**, professor **v13**, todas ACTIVE. verify_jwt preservado: learner/professor false com autenticação própria, admin true. Novo compartilhado `governance-api.ts`.

Audit logs não recebem structured_data, quick logs ou respostas privadas. Empresas continuam sem acesso a essas superfícies; fluxo B2B não foi ampliado. Advisors mantêm o aviso Auth preexistente de leaked-password protection e INFO de tabelas service-only sem políticas. A tabela editorial também é service-only, sem grants a anon/authenticated: não representa acesso público.

## Testes e evidências

- `npm run check`: **219/219** (189 anteriores + 30 novos), zero skips/falhas.
- Lint/sintaxe, Deno typecheck, secret scan e diff check aprovados.
- Sete suites SQL reversíveis aprovadas: editorial; avaliação + certificação; evidências PR3; ciclo PR4; fundação RLS; progressão RLS; Liderança M1→M2.
- Workflow: estado, fonte/gap, conflito de revisão, edição invalidando aprovação, publicação não revisada, delegação/revogação e negativa de acesso ao mestre.
- Certificação: recusa sem prova, sem E10, com módulo/requisito/evidência pendente; elegibilidade positiva somente após submissão real das nove evidências e aprovação humana de E10; nenhum certificado criado.
- Regressão PR4: M7→M9→30 dias→E10→69→ressubmissão→70, revisão especial e RLS.
- Isolamento aluno A/B, professor não atribuído, owner sem bypass de E10, histórico exato e projeção docente sem narrativas.
- Após rollback: zero usuários de fixtures PR5/PR6, zero sessões, zero certificados IE, zero decisões editoriais persistidas; 70 questões Draft/inativas e cinco gaps preservados.

Os testes de publicação técnica preparam metadados e removem gaps somente dentro de BEGIN/ROLLBACK através de função em pg_temp. Isso permite exercitar os motores anteriores sob o novo guard sem publicar o banco real ou criar bypass de produção. O runner `scripts/universidade-governance-sql.mjs` apenas compõe/emite SQL para o conector autorizado.

## Homologação autenticada e limites

A aba administrativa existente foi inspecionada e ainda exibe “Entre em Meus acessos antes de usar a prévia.” Não havia sessão autorizada utilizável. Não foram fabricadas credenciais nem declarados aprovados os testes autenticados de aluno/professor/admin de IE30/E10. Fixtures de API, SQL e UI são identificadas separadamente.

Revisão browser/390 px e checks finais GitHub/Vercel são registrados na entrega após publicação da branch. Ainda é necessário QA com login real, sobretudo editor delegado, revisão E10, seleção de turmas e conteúdo-mestre autorizado. Não se presume aprovação editorial dos 70 itens.

A CLI criou o arquivo da migration, mas uma tentativa de telemetria foi bloqueada pela revisão automática. Nenhum envio foi contornado; aplicação e verificações remotas foram feitas pelo conector autenticado Supabase.

## Confirmações

Nenhum merge. PRs anteriores intactos. Nenhuma publicação acadêmica das questões, checkout, certificado IE ou QR ativado. Nenhuma implementação do PR 7.
