# Universidade V&C — PR 2: motor de conteúdo e progressão

## Base e escopo

Branch: `feat/ie-course-content-progression`
Base remota: `feat/ie-course-academic-foundation` no commit aprovado `c04886019cdde8efe191cca0282838328fc0155c` (PR #11).

Este é um PR stacked. Depende do PR #11 e não deve ser mergeado antes dele. Não contém merge na `main`.

## Arquitetura anterior auditada

- A sala do aluno carregava `vc_university_course_content.content`, um JSON privado e versionado.
- A versão já era fixada em `vc_university_enrollments.course_version`; o runtime consultava o JSON com essa versão.
- `vc_university_module_progress` reunia abertura, evidência, checkpoint e conclusão.
- O desbloqueio era calculado pela posição anterior da lista; a conclusão era escrita junto com a aprovação do checkpoint.
- O trigger `vc_university_validate_module_completion` protegia sequência, evidência e tentativa aprovada, mas estava preso ao contrato de Liderança.
- Questões ainda eram entregues como `choices` e corrigidas por `correct_index`, embora o PR #11 já tivesse criado opções estáveis e `correct_option_id`.
- Tentativas de checkpoint não preservavam versão das questões, respostas ou snapshot completo.
- O conteúdo, progresso, checkpoints, prova final e certificado passavam pela Edge Function privada `vc-universidade-learner-v2`.
- Professor e proprietário já possuíam APIs separadas; tabelas sensíveis e de catálogo da fundação eram server-only.

## Decisões do PR 2

### Conteúdo versionado

O resolver seleciona `vc_university_course_versions` pela versão fixa da matrícula. Para `legacy_json`, mantém o adaptador de Liderança. Para `structured_blocks`, percorre:

`course_version → module_version → lesson_version → content_blocks`.

Os tipos de bloco aprovados foram incorporados à tabela canônica; nenhuma tabela `v2` foi criada.

### Requisitos e progressão

- `vc_university_module_requirements`: requisitos obrigatórios/opcionais e configuráveis por versão.
- `vc_university_module_dependencies`: grafo explícito de desbloqueio, sem usar `module_no - 1` como autorização.
- `vc_university_lesson_progress`: visualização, início e conclusão de conteúdo.
- `vc_university_requirement_progress`: satisfação autoritativa de requisitos.
- `vc_university_module_progress`: ampliada com versão, estado, início, conteúdo e requisitos concluídos.

Estados acadêmicos: `not_started`, `in_progress`, `requirements_pending`, `completed`.

O frontend apenas apresenta o estado. `vc_university_complete_module_if_ready` e o trigger de conclusão validam versão, requisitos obrigatórios e dependências no banco. Somente `service_role` pode executar a RPC.

### Checkpoints

- Conteúdo novo usa `option_id` e `correct_option_id`.
- A posição visual pode mudar sem alterar a resposta correta.
- O retorno inclui feedback correto ou feedback específico do distrator.
- A tentativa preserva curso/versão, módulo/versão, número, percentual, resultado, respostas por option ID e snapshot das questões/opções.
- Retry permanece permitido, com o limite operacional já existente.
- O adaptador numérico por `correct_index` foi mantido exclusivamente para clientes legados de Liderança.

### Preview

`/admin/universidade/preview` permite que proprietário ou professor atribuído escolha curso, versão e perspectiva autorizada. A API aceita somente GET no modo preview e informa explicitamente que não cria matrícula, progresso, tentativa, certificado ou analytics. Conteúdo-mestre é reservado ao proprietário/admin.

## Compatibilidade com Liderança v1.1

- JSON privado preservado.
- `correct_index` e `choices` não foram removidos.
- Requisitos de evidência e checkpoint foram catalogados a partir do contrato existente.
- Dependências sequenciais foram materializadas como grafo explícito.
- Prova final e certificado mantêm os contratos atuais.
- O trigger possui fallback seguro para versões que ainda não tenham requisitos publicados.

## Inteligência Emocional Aplicada

Foram cadastrados somente metadados aprovados e a estrutura dos dez módulos. A versão `1.0` permanece `draft`, com `content_model=structured_blocks`. Não foram criadas aulas, blocos pedagógicos ou questões. Os requisitos de checkpoint IE permanecem `draft` até a importação do banco acadêmico aprovado.

Os 120 minutos por módulo são a distribuição técnica inicial da carga total aprovada de 20 horas por dez módulos e podem ser refinados na importação acadêmica antes da publicação.

## Segurança e RLS

As quatro novas tabelas têm RLS habilitada, deny policy explícita para `anon`/`authenticated` e grants de escrita somente para `service_role`. Alunos não podem escrever progresso ou requisitos diretamente. A Edge Function valida identidade, direito, matrícula, versão e desbloqueio antes de entregar conteúdo ou aceitar ação. Preview possui autorização separada e somente leitura.

O snapshot de tentativa contém a resposta correta histórica para auditoria e, por isso, `vc_university_checkpoint_attempts` deixou de ter leitura direta pelo navegador; a API devolve apenas resultado e feedback filtrados.

## Migrations

- `20261005141004_universidade_content_progression_engine.sql`
- `20261005141523_universidade_content_progression_hardening.sql`
- `20261005142153_universidade_content_progression_fk_indexes.sql`

## Retirada futura do legado

Somente depois que Liderança for migrada e homologada em `structured_blocks`:

1. publicar a versão estruturada sem alterar matrículas antigas;
2. migrar clientes para respostas por option ID;
3. observar tentativas e erros por uma janela definida;
4. arquivar o JSON apenas para novas matrículas, preservando leitura histórica;
5. remover `correct_index` em migration posterior, após provar que nenhuma versão ativa depende dele.

## Gaps deliberados para PR 3

- Importação do conteúdo acadêmico aprovado das dez aulas/módulos IE.
- E01–E09, IE30 e E10.
- Banco definitivo de 50 questões e prova final de 20 questões.
- Rubrica operacional E10, revisão humana e certificado específico.
- Materiais e Caderno Mestre.
- Publicação comercial/produto e matrícula IE.
- Refinamento acadêmico da distribuição de minutos por módulo.

Não foram implementados IA avaliadora, B2B emocional, score psicológico ou cronômetro de tela.


## Auditoria de recuperação — 6 de outubro de 2026

- PR #11 confirmado Draft, aberto e sem merge, com head `c04886019cdde8efe191cca0282838328fc0155c`.
- Branch local e todos os arquivos de trabalho foram encontrados no ambiente anterior; nenhuma implementação precisou ser reescrita do zero.
- O HEAD local `ff6518a` tinha a mesma árvore Git da base aprovada, porém pais diferentes. A referência da branch PR 2 foi alinhada à base exata antes do commit.
- As três migrations do motor já estavam aplicadas no projeto `ctzgsxxbyvruzmfqibnl`, com SQL idêntico ao local. Os filenames foram alinhados ao histórico real; nenhuma migration foi reaplicada.
- A função `vc-universidade-learner-v2` v15 estava ativa, com os dois arquivos idênticos ao local. Nenhuma implantação repetida foi realizada.
- O erro `Internal Server Error` foi reportado pela conversa interrompida. Sem logs internos do ChatGPT não é possível atribuir sua causa raiz; não foi encontrado rollback, duplicação ou perda do trabalho no Supabase.
- O teste de homologação legado exigia transação externa apenas em comentário. Agora contém `BEGIN/ROLLBACK`, evitando persistência acidental de fixtures.
- A revisão funcional identificou uma ligação incompleta entre blocos estruturados, tela e progresso de aula. A recuperação completou o renderer compartilhado e os registros de início/conclusão das aulas, bloqueou conteúdo estruturado não publicado para alunos e restringiu respostas numéricas ao adaptador legado.
- O preview renderiza os conteúdos autorizados sem gerar progresso de aula, matrícula, tentativa, certificado ou eventos.
- O advisor não apontou tabela sem RLS nem FK sem índice. Permanecem avisos anteriores: proteção de senha vazada desativada, tabelas server-only sem policy (deny por grants) e índices ainda sem uso.

As migrations aplicadas são históricas e não devem ser executadas de novo. Em projeto sincronizado, o runner deve usar as versões deste diretório e o histórico `supabase_migrations.schema_migrations`.


## Verificação da recuperação

- `npm run check`: 94/94 testes aprovados, incluindo os 74 anteriores, opção estável, 70%, retry, preview sem escrita, fluxo M1→M2 e progresso de aulas estruturadas.
- `npm run lint` e `npm run typecheck`: aprovados.
- Testes SQL de foundation RLS, progression RLS, progression flow e homologação: aprovados com `BEGIN/ROLLBACK`; nenhuma fixture persistida.
- Chamada real sem credencial ao learner: HTTP 401 `sign_in_required`.
- Nova versão `vc-universidade-learner-v2`: 16 ativa, criada somente para a correção funcional identificada nesta auditoria; professor v9 e admin v7 preservados.
- SHA-256 do bundle da v16: `4ed88d34b9fb197c394f357752ebba8301c4db80b7de04e3cfb1b664d5fe61b1`.
- Prévia em navegador será registrada no corpo do Draft PR após a publicação da branch.
