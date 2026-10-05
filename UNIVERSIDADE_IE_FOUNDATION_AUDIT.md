# PR 1 — Fundação acadêmica e arquitetura de dados

## Escopo

Este PR prepara a Universidade V&C para receber **Inteligência Emocional
Aplicada — Da reação automática à decisão consciente** sem publicar conteúdo
pedagógico do novo curso e sem substituir o percurso de Liderança Estratégica
Aplicada.

## Diagnóstico anterior

- Site estático HTML/CSS/JavaScript, publicado pela Vercel; não há Next.js nem
  App Router neste repositório.
- Autenticação via Supabase Auth e registro canônico de produtos/direitos.
- APIs acadêmicas em Supabase Edge Functions, com operações privilegiadas
  exclusivamente no servidor.
- Modelo já multicursos para cursos, módulos, turmas, matrículas, professores,
  progresso, tentativas, certificação e relatórios B2B agregados.
- Matrículas já fixam `course_version`, preservando o conteúdo cursado.
- Conteúdo pedagógico ainda concentrado em JSON por curso/versão.
- Módulos não possuíam catálogo próprio de versões; aulas e blocos estruturados
  não estavam normalizados.
- Questões possuíam quatro opções em JSON e gabarito por índice visual.
- Evidência e parecer estavam armazenados na linha de progresso, sem histórico
  imutável de revisões.
- Eventos existentes eram vinculados à matrícula, insuficientes para auditoria
  editorial e administrativa geral.
- A API do professor validava turmas atribuídas, mas estava fixa no curso de
  Liderança.

## Arquitetura reutilizada

- `vc_university_courses` e `vc_university_modules` continuam canônicos.
- `vc_university_course_content` permanece como fonte compatível do runtime
  v1.1 de Liderança.
- Turmas, matrículas, atribuições de professor, progresso, tentativas finais,
  certificados e eventos existentes foram preservados.
- O registro de produtos, entitlements, Auth, Edge Functions e relatórios B2B
  não foi duplicado.
- A privacidade B2B continua agregada e sem relatos individuais.

## Fundação acrescentada

- versões canônicas de curso e módulo;
- aulas, versões de aula e blocos de conteúdo;
- competências e vínculo por versão de curso;
- opções de questão com `option_id` e `correct_option_id` estáveis;
- definições de evidência versionadas, submissões, revisões e pareceres;
- fontes científicas/editoriais e vínculos a entidades acadêmicas;
- ferramentas de aprendizagem versionadas;
- motor genérico de ciclos aplicados e entradas revisionáveis;
- sessões de preview isoladas de matrícula e progresso;
- log acadêmico append-only;
- API do professor preparada para selecionar curso sem perder o padrão de
  Liderança.

## Migrations versionadas

- `20261005014328_ie_course_academic_foundation.sql`: modelo acadêmico,
  backfill de Liderança, RLS e isolamento de dados pessoais.
- `20261005014650_ie_course_academic_foundation_hardening.sql`: índices de
  chaves estrangeiras e fronteira explícita para tabelas server-only.
- `20261005014806_ie_course_question_fk_indexes.sql`: índices das novas
  relações do banco canônico de questões.

## Limites de privacidade

- Governança de conteúdo não concede acesso automático a relatos pessoais.
- Aluno lê somente sua própria evidência e seus ciclos.
- Professor atribuído lê evidência somente quando o modo é `sampled` ou
  `human_required`.
- Professor não atribuído não lê evidência privada.
- Ciclos aplicados permanecem privados ao aluno; eventual material avaliável
  deve ser submetido pelo fluxo de evidências.
- Empresa/gestor B2B não recebe acesso às tabelas de evidência ou ciclos.
- Preview não possui `enrollment_id` e não pode gerar progresso ou certificado.

## Compatibilidade

A migration mantém `choices` e `correct_index` temporariamente para o runtime
v1.1, ao mesmo tempo em que cria e preenche opções estáveis. A retirada dos
campos legados somente poderá ocorrer depois que todas as APIs consumirem
`correct_option_id`.

## Gaps deliberados para PR 2

- cadastrar o novo produto/curso após receber código comercial, carga horária,
  versão inicial e metadados aprovados;
- importar as 10 aulas aprovadas para lesson versions/content blocks;
- cadastrar competências e referências aprovadas;
- cadastrar definições de evidência e rubricas reais;
- migrar o runtime do aluno/professor para o novo modelo de opções e evidências;
- implementar previews visuais aluno/professor/conteúdo-mestre;
- construir o IE30 e sua interface;
- inserir banco de questões, avaliação final, projeto, certificado e materiais;
- conectar os novos eventos de publicação/revisão ao audit log;
- criar catálogo e sala específicos do novo curso.

Nenhum dado pedagógico de Inteligência Emocional foi inventado neste PR.

## Verificações remotas

- Liderança preservada com 10 módulos e 20 versões históricas de módulo.
- 616 alternativas existentes receberam identificadores estáveis.
- Nenhuma questão ficou sem `correct_option_id`.
- Teste RLS transacional confirmou isolamento entre alunos e entre professor
  não atribuído e evidência privada; os dados temporários foram revertidos.
- Advisor pós-migration não encontrou foreign keys sem índice nem alertas de
  segurança novos introduzidos por este PR.
