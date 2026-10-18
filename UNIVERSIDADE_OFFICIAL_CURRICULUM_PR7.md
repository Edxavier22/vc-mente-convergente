# PR 7 — Auditoria do currículo oficial IE

**Veredito: BLOQUEADO para importação integral e homologação editorial.**
A auditoria e as regressões foram concluídas. Não foi localizado o texto aprovado das dez aulas.
Este Draft PR registra a evidência reproduzível e os impedimentos; não representa a entrega do curso completo.

## Continuidade

Branch `feat/ie-course-official-curriculum`, criada exclusivamente de
`1bed0825438554c9403f82e05d00f9fb735a9778`, head aprovado do PR #16.
A busca remota não encontrou branch ou PR equivalente antes da criação.
PR #16 confirmado aberto, Draft, sem merge e no SHA informado.
Base do novo PR: `feat/ie-course-academic-governance`.
Nenhum arquivo da implementação dos PRs #11–#16 foi alterado.

## Fontes efetivamente localizadas

Foram pesquisados o Git versionado, os registros acadêmicos canônicos em homologação e os arquivos disponíveis na Library, por título e conteúdo.
Consultas incluíram o nome/subtítulo do curso, Especificação Mestre, Manual do Professor, Caderno do Aluno e PENTA/3R/FARO/CPTR/CALMA.
A ausência nestas buscas significa **não localizado neste acesso**, não prova de inexistência em outros ambientes.

| Material conferido | Uso comprovado | Limite |
|---|---|---|
| `Texto colado.txt`, 747 linhas, comando PR2 | Metadados oficiais, 20h, títulos M1–M10 e estrutura canônica | Seção 23 registra que o conteúdo profundo ainda precisava ser fornecido ao executor |
| `Texto colado(1).txt`, 797 linhas, comando PR3 | Campos e regras E01–E09, privacidade e ferramentas citadas | Não contém aulas completas ou manual IE |
| `Texto colado(3).txt`, 717 linhas, comando PR5 | Temas M1–M10, competências e avaliações 50+20 | Não fornece as definições das cinco ferramentas nem as aulas |
| `Markdown.md colado`, 291 linhas | Arquitetura multicursos e projeto de Liderança | Não é especificação pedagógica IE; RADAR de Liderança não foi transplantado para IE |
| `content/evidence/ie-e01-e09.v1.json` | Nove definições estruturadas existentes | Não é substituto do texto de aula |
| `content/cycles/ie30.v1.json` | IE30 v1.0, formulários e rubrica existentes | Não é Manual do Professor ou Caderno do Aluno |
| `supabase/seed-data/ie-assessment-bank.v1.json` | 70 itens existentes e seus gaps | Questões não foram usadas para gerar aulas retroativamente |
| Relatórios e migrations PR1–PR6 | Histórico, esquema, limites e workflow editorial | São registros técnicos, não originais pedagógicos |

Os quatro registros de comando/arquitetura foram lidos integralmente, sem depender apenas de snippets.
Resultados com títulos de manuais e cadernos de Liderança foram identificados como outro curso.
A apostila FIE de terceiro apareceu na busca, mas não foi adotada como fonte oficial V&C nem como autorização para redefinir ferramentas.

**Não localizados:** Especificação Mestre integral IE com versão/aprovação; texto integral aprovado dos dez módulos; Manual do Professor IE; Caderno do Aluno IE; roteiros/instruções oficiais completos das ferramentas; bibliografia aprovada das aulas; distribuição detalhada de carga horária por aula/atividade.
Nenhuma pesquisa pública foi usada para substituir esses originais proprietários.

## Inventário por módulo

Consulta executada por `scripts/universidade-curriculum-audit.sql`, em transação somente leitura com rollback.
Snapshot de metadados em `audits/ie-official-curriculum-source-audit.v1.json`.
Esse JSON é relatório de auditoria; o runtime não o lê e ele não constitui conteúdo paralelo.

| Módulo oficial | Evidência canônica existente | Checkpoint existente | Aulas / blocos |
|---|---|---|---|
| M1 — Emoções: Entender Antes de Controlar | E01 Mapa da Reação Automática | IE-M01-Q01–Q05 | 0 / 0 |
| M2 — Autoconsciência: Perceber Antes de Mudar | E02 RADAR 72H | IE-M02-Q01–Q05 | 0 / 0 |
| M3 — Gatilhos, Padrões e Contexto | E03 Mapa de Padrões | IE-M03-Q01–Q05 | 0 / 0 |
| M4 — PAUSA: O Espaço Entre Impulso e Resposta | E04 Aplicação PAUSA | IE-M04-Q01–Q05 | 0 / 0 |
| M5 — Regulação Emocional | E05 Repertório de Regulação | IE-M05-Q01–Q05 | 0 / 0 |
| M6 — Fatos, Histórias e Interpretações | E06 Dossiê FIR–REAL | IE-M06-Q01–Q05 | 0 / 0 |
| M7 — Comunicação Emocionalmente Inteligente | E07 Conversa CLARO | IE-M07-Q01–Q05 | 0 / 0 |
| M8 — Inteligência Emocional nos Relacionamentos | E08 Mapa ELOS | IE-M08-Q01–Q05 | 0 / 0 |
| M9 — Decisões sob Emoção | E09 Decisão Estruturada | IE-M09-Q01–Q05 | 0 / 0 |
| M10 — Integração e Desenvolvimento | E10 Projeto Integrador IE30 | IE-M10-Q01–Q05 | 0 / 0 |

Todos os módulos estão Draft na versão 1.0. Cada um tem 120 minutos estimados: distribuição técnica inicial das 20h, ainda sem validação detalhada das atividades.
As dez definições de evidência estão Draft, revisão 1.
IE30 permanece v1.0; E10 mantém sua revisão humana e independência da prova.
As 50 questões de checkpoint e 20 finais permanecem Draft/inativas, versão 1.
Existem 21 requisitos e nove dependências, preservados.

## Completude editorial comprovada

- Metadados dos módulos: **10/10**.
- Módulos oficiais integralmente importados: **0/10**.
- Aulas/blocos IE no catálogo canônico: **0/0**, contagens absolutas; não significa completude.
- Elementos pedagógicos comprovados no conteúdo importado: **0/120** (12 por módulo). Não se exige que cada elemento vire exatamente um bloco.
- Ferramentas com versões canônicas cadastradas: **0**.
- Cinco gaps prioritários resolvidos: **0/5**.
- Fontes canônicas relacionadas: duas Draft, classificadas **D** e **H**. Nenhuma bibliografia empírica/consolidada aprovada das aulas foi localizada.
- Conteúdo pedagógico novo importado nesta PR: **zero**.

Abertura, objetivos, fundamentação, tradução prática, instruções, demonstrações/casos, oficina, aplicação cotidiana, orientação da evidência, checkpoint contextualizado, síntese/reflexão e ponte seguinte precisam ser confrontados com o original de cada módulo.
A existência de formulário e questões não comprova esses elementos da aula.

## Ferramentas e bloqueios

| Questão | Ferramenta | Parecer para continuidade |
|---|---|---|
| IE-M02-Q05 | PENTA | Faltam composição, sequência e instruções oficiais; item atual avalia princípio de autoconsciência |
| IE-M04-Q05 | 3R | Falta composição oficial; não expandir a sigla por inferência |
| IE-M07-Q03 | FARO | Faltam passos oficiais; verificação de compreensão não comprova a ferramenta completa |
| IE-M08-Q04 | CPTR | Falta composição oficial; campos de confiança da E08 não autorizam inferir a sigla |
| IE-M10-Q01 | CALMA | Faltam passos oficiais; escolha contextual não comprova instruções da ferramenta |

Os gaps canônicos das cinco questões permanecem intactos e bloqueiam sua aprovação no workflow existente.
Não foram criados materiais dependentes sem fonte nem decisões de aprovação editorial.
O registro desta auditoria não cria um novo bloqueio técnico para todos os módulos: a importação permanece impedida pela falta dos originais; o endpoint IE de publicação continua desabilitado pelo PR6.

MRA, RADAR, CAMPO, PAUSA, PAINEL 5P V&C, FLEX, FIR, REAL, CLARO, ELOS, 3T e DECIDE aparecem nos contratos de evidência/avaliação.
Esses contratos sustentam seus formulários existentes, mas não autorizam reconstruir as instruções completas da aula.
Nenhuma ferramenta própria foi classificada como instrumento científico validado; não houve bibliografia, citação, diagnóstico ou promessa terapêutica novos.

## Arquitetura e integração preservadas

Curso → versão → módulo → aula → bloco continua sendo o único percurso de conteúdo.
Matrículas fixadas à versão, dependências, requisitos, checkpoints, evidências, histórico e direitos não foram alterados.
O renderer compartilhado e o preview por perspectiva já existem; não há necessidade de criar tabelas, outro motor ou aulas vazias para preparar a importação.
O workflow draft → in_review → approved_for_publication → published → archived continua no PR6, com fingerprint, fonte, parecer, autor, gaps e histórico.
As fontes D/H existentes não foram promovidas a verificadas.
O alinhamento entre **aula** e evidência/checkpoint, progressão didática, duplicações, terminologia, referências, clareza e acessibilidade do texto integral permanece inconclusivo até localizar os originais.

## Testes e regressões executados

- `npm run check`: **221/221** aprovados, incluindo os 189 anteriores e as regressões PR6.
- `npm run lint`, `npm run typecheck`: aprovados.
- `npm run secret-scan`: aprovado, 173 arquivos após os novos artefatos de auditoria.
- `git diff --check`: aprovado.
- Sete suítes SQL: editorial, certification (inclui assessment), evidence, cycle, foundation, progression e leadership; executadas pelo runner existente, todas sem erro e com BEGIN/ROLLBACK.
- Cobertura existente exercitada: workflow, publicação sem revisão, CAS, escopo docente, RLS, isolamento A/B, snapshots, 3/5→4/5, 13/20→14/20, prova independente do IE30, E10 humana, elegibilidade sem emissão e progressão.
- Pós-testes: zero usuários fixtures PR3–PR6, zero turmas rollback PR3–PR6, zero fontes de fixture PR6, zero registros editoriais residuais, zero certificados IE.
- A consulta inicial de limpeza usou incorretamente course_id na tabela de certificados; foi corrigida para a relação por enrollment_id, e a consulta corrigida confirmou zero. Nenhuma escrita decorreu desse erro.

Não foram adicionados testes que pretendam validar conteúdo ausente.

## Navegador, mobile e autenticação

A tela real de governança na implantação do PR6 informa: **“Entre em Meus acessos para usar a governança acadêmica.”**
Nenhuma sessão autorizada estava acessível. Homologação real aluno/professor/owner de IE30/E10 e preview permanece **pendente**; nenhum teste técnico foi declarado autenticação aprovada.

A fixture pública existente mostra explicitamente “Fixtures técnicas hipotéticas” e “sem API acadêmica”.
O contêiner `governance-fixture` mede clientWidth=390 e scrollWidth=390; screenshot inspecionado sem overflow interno.
Isso é regressão da fixture técnica em contêiner de 390 px, não viewport móvel integral, aparelho real ou validação das dez aulas oficiais.
A prévia mobile do currículo IE está **bloqueada por ausência de aulas e de sessão autorizada**.
Preview sem persistência segue coberto pelas regressões existentes; não foi exercitado como fluxo autenticado real nesta etapa.

## Migrations, funções e arquivos

**Nenhuma migration criada/aplicada/reaplicada. Nenhuma Edge Function alterada ou reimplantada.**
Versões remotas ACTIVE confirmadas: learner-v2 v21, admin v10, professor v14.
Liderança v1.1, seus conteúdos e certificados permanecem intactos.

Arquivos acrescentados:
1. `UNIVERSIDADE_OFFICIAL_CURRICULUM_PR7.md`: este relatório.
2. `audits/ie-official-curriculum-source-audit.v1.json`: snapshot editorial/contagens, sem respostas ou narrativas de alunos.
3. `scripts/universidade-curriculum-audit.sql`: consulta somente leitura reproduzível.

## Condições para retomar esta mesma branch

Disponibilizar os originais aprovados com identificação de versão, autoria e aprovação; confrontar as doze etapas por módulo; localizar as instruções das ferramentas; resolver as cinco dependências editoriais; validar bibliografia e carga horária; então importar fielmente em aulas/blocos Draft e fontes/vínculos canônicos.
Depois, revisar o alinhamento com evidências/questões sem alterá-las automaticamente e executar preview autorizado de aluno/professor/editor, inclusive viewport móvel.
Não há autorização implícita de publicação decorrente dessa importação.

O SHA final e o link do Draft PR são informados na entrega e no histórico Git.
**Não houve merge na main ou em qualquer PR anterior.**
Não houve publicação acadêmica, mudança das 70 questões, matrícula comercial, checkout, certificado IE ou QR.

