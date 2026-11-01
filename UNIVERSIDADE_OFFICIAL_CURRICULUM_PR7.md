# PR #17 — Integração Draft do currículo IE — 31/10/2026

> Registro histórico de 31/10. O saneamento prospectivo e as pendências atuais estão em [UNIVERSIDADE_SANEAMENTO_PR17.md](UNIVERSIDADE_SANEAMENTO_PR17.md).

**Resultado:** 50 aulas e 50 blocos importados fielmente como Draft. Integração técnica concluída em homologação; aprovação acadêmica, publicação e homologação autenticada permanecem pendentes.

Branch preservada: `feat/ie-course-official-curriculum`.
Base histórica PR #16: `1bed0825438554c9403f82e05d00f9fb735a9778`.
Head encontrado na retomada: `cb3c80573ac3044efdb74147b95ffd1a48976391`, PR aberto, Draft, sem merge e sem mudanças recentes.
Não houve reconstrução ou branch/PR duplicado. Este relatório atualiza o diagnóstico de 18/10; o snapshot antigo `audits/ie-official-curriculum-source-audit.v1.json` permanece como registro histórico, não inventário atual.

## Fonte e integridade

O ZIP recuperado da Library e o ZIP anexado pelo usuário são idênticos:
`UNIVERSIDADE_VC_CONSOLIDADO_ACADEMICO_PR17_2026-10-31.zip`.

- SHA-256 ZIP: `5a67583fa4a7fa3102c41e54d99f342b1647bb4aa272990d3b4f32342a176867`.
- SHA-256 aulas.json: `305350cf8c0da29af19272dee1a553f2f3b0ca1feb3e6c18c7fbdaebade58d15`.
- SHA-256 proposta de questões: `7ddcc928046bdfe5241d357c879d5eaa307133042d6603dbc19c8ace080ab34b`.
- 60 arquivos; **50/50 Markdown** com hashes/tamanhos conferidos contra CSV, JSON e staging; UTF-8 válido.
- **37.732 palavras**, cinco aulas por módulo, zero aulas integralmente duplicadas por hash.
- **50/50 títulos** extraídos do próprio Markdown.
- 44 ocorrências bibliográficas, 37 URLs como fornecidas e 36 após normalização.
- O staging foi lido como dados, nunca executado.
- Alertas automáticos vazios não equivalem a aprovação.

O CSV tem cinco module_title vazios no M1; no M2 esse campo contém títulos de aula. O staging também contém códigos e títulos truncados, como IE-M03-A05 terminando em “E”. O importador preserva os módulos canônicos e extrai os títulos completos do Markdown.
Manual do Professor IE, Caderno do Aluno IE e histórico completo de aprovação da Especificação Mestre não vieram como documentos independentes; não foram declarados importados.

## Inventário e integração

Curso versão **1.0**, módulos/aulas/blocos **Draft**, revisão de aula/bloco 1. Um bloco study por aula preserva seu Markdown integral, sem resumo, corte ou texto substituto.
O mapeamento completo de IDs, títulos e hashes está em `audits/ie-curriculum-import-mapping.v1.json`.

| Módulo | Aulas / blocos | Evidência existente | Checkpoint |
|---|---:|---|---|
| M1 — Emoções: Entender Antes de Controlar | 5 / 5 | E01 Mapa da Reação Automática | 5 itens |
| M2 — Autoconsciência: Perceber Antes de Mudar | 5 / 5 | E02 RADAR 72H | 5 itens |
| M3 — Gatilhos, Padrões e Contexto | 5 / 5 | E03 Mapa de Padrões | 5 itens |
| M4 — PAUSA: O Espaço Entre Impulso e Resposta | 5 / 5 | E04 Aplicação PAUSA | 5 itens |
| M5 — Regulação Emocional | 5 / 5 | E05 Repertório de Regulação | 5 itens |
| M6 — Fatos, Histórias e Interpretações | 5 / 5 | E06 Dossiê FIR–REAL | 5 itens |
| M7 — Comunicação Emocionalmente Inteligente | 5 / 5 | E07 Conversa CLARO | 5 itens |
| M8 — Inteligência Emocional nos Relacionamentos | 5 / 5 | E08 Mapa ELOS | 5 itens |
| M9 — Decisões sob Emoção | 5 / 5 | E09 Decisão Estruturada | 5 itens |
| M10 — Integração e Desenvolvimento | 5 / 5 | E10 Projeto Integrador IE30 | 5 itens |

Foram preservados matrícula fixada à versão, dependências, direitos, requisitos, banco e definições/rubricas existentes.
IE30 mantém **30 dias, janela 45 dias, setup após M7, início após M9 e E10 humana**. Prova após M10 não aprova E10.
A autoavaliação de 28 itens/sete domínios permanece no texto de M10-A2, sem score clínico ou psicométrico implementado.

Os 120 minutos por módulo foram distribuídos tecnicamente em 24 minutos por aula: 1.200 minutos globais. A carga real de estudo/prática aguarda homologação.
Os **21 requisitos** existentes foram preservados: dez checkpoints, nove evidências, prova e E10. Não há requisito content_completed catalogado em IE; a equipe acadêmica deve decidir sobre um gate formal de leitura antes de publicar. Não foi inventada política obrigatória nova.

## Importador e persistência

`scripts/universidade-curriculum-import.mjs` valida o manifesto fixado por hash e emite SQL com o texto como JSON, sem conectar ao banco.
O texto completo e as propostas com gabaritos não foram incluídos nos arquivos estáticos/repositório público: ficam no catálogo protegido. Para reproduzir, é necessário o pacote fonte.

Exemplo:

```sh
node scripts/universidade-curriculum-import.mjs --source /caminho/pacote-extraido --mapping /caminho/relatorio.json --sql /caminho/privado/dry-run.sql
```

O SQL termina em **ROLLBACK por padrão**. A opção explícita `--commit` emite o SQL de persistência, executável somente por conexão autorizada.
Hashes divergentes, alertas, caminhos inválidos, títulos ausentes, seções docentes detectadas e delimitadores SQL perigosos interrompem a geração.

A transação exige owner confirmado, curso/módulos Draft e lock; usa IDs estáveis/chaves canônicas, recusa conflito ou revisão posterior e não sobrescreve material publicado.
Insere fonte editorial/source_links e decisões Draft com gaps. O audit log registra IDs, hashes, estados e contagens, sem narrativas/respostas privadas.
A ordem das cinco aulas por módulo é determinística.

Executado: dry-run/rollback; dupla importação na mesma transação, sem duplicação; consulta confirmando zero aulas após rollback; importação efetiva; consulta confirmando **50 aulas/50 blocos** e os 50 hashes novamente no Postgres.
Nenhuma tabela paralela, migration de schema ou nova política de acesso foi criada.

## Ferramentas e questões

| Ferramenta | Fonte recuperada | Definição localizada |
|---|---|---|
| PENTA | IE-M02-A01 | Percepção corporal, Emoção, Narrativa, Tendência, Ação |
| 3R | IE-M04-A03 | Responder, Retardar, Redirecionar |
| FARO | IE-M07-A04 | Fato, Afetação, Requisito, Oportunidade de resposta |
| CPTR | IE-M08-A03 | Coerência, Previsibilidade, Transparência, Reparação |
| CALMA | IE-M10-A01 | Captar, Acolher, Ler, Modular, Agir |

Localizar definições resolve o acesso à fonte, não homologa academicamente os itens.
A proposta originou seis revisões **v2 Draft/inativas**, com question_key/editorial_id preservados e novos question_id/option_id:
IE-M01-Q03, IE-M02-Q05, IE-M04-Q05, IE-M07-Q03, IE-M08-Q04 e IE-M10-Q01.

O banco mantém **70 identidades lógicas (50+20), agora 76 versões físicas**: 70 v1 + seis v2.
As 70 versões originais e alternativas ficaram intactas; os cinco gaps históricos não foram apagados.
Não houve aprovação editorial das candidatas. A proposta não fornece feedback por alternativa: feedback/correct_feedback ficaram nulos, com gaps explícitos para competência, dificuldade, rubrica e feedback. A publicação está bloqueada.
O preview seleciona uma revisão por instrumento; o conteúdo-mestre conserva o histórico completo.
A fixture SQL anterior publica somente question_version=1 dentro de rollback, para continuar testando o contrato histórico dos 70 itens.

## Editorial, fontes e ressalvas

Uma fonte editorial **D/Draft** identifica o pacote e se vincula às aulas/candidatas. D classifica o pacote didático, não valida as alegações científicas ou sua bibliografia.
Aulas, blocos e candidatas possuem revisões Draft com gaps; **zero approved_for_publication/published**.

A verificação das **36 URLs normalizadas** encontrou 24 páginas com metadados acessíveis, nove desafios de acesso, uma falha de recuperação/403 e duas respostas insuficientes. Não se contornaram desafios.
Acessibilidade não comprova sustentação científica. Autoria/obra, atribuição e classificação E/C/D/H/P por alegação ainda exigem revisão acadêmica.
Links originais permanecem no texto; somente o relatório público retira tracking/identificador de sessão e guarda hash da URL original.

Achados documentados em `audits/ie-curriculum-editorial-findings.v1.json`:

- Quatro grupos de parágrafos de pelo menos 18 palavras repetidos em três ou mais aulas, incluindo critério genérico em 35 aulas e atividade/critério genérico em 15.
- IE-M10-A05 orienta avançar ao “próximo módulo”, embora encerre os dez módulos.
- A abertura “AGORA COMEÇA O IE30” de M10-A03 precisa ser confrontada com o início operacional após M9.
- Carga horária, terminologia, exemplos/oficinas, bibliografia e as doze etapas pedagógicas de cada módulo ainda precisam de homologação humana.
- As seis candidatas precisam de feedback e parecer.

Os originais foram preservados. **50/50 aulas importadas não significa 120/120 etapas homologadas**, nem aprovação científica/comercial.

## Interface e privacidade

O renderer compartilhado apresenta Markdown com títulos, ênfase, citações, listas, tabelas, links seguros e navegação por aula. Usa nós DOM de texto, sem interpretar HTML/script; URLs executáveis são bloqueadas. Há foco visível e tratamento de textos/links/tabelas em largura pequena.

Foi corrigido um vazamento na resposta do preview anterior: student recebia correct_option_id/feedback, embora o frontend ocultasse o gabarito.
Agora a API entrega somente enunciados/opções/identificação necessária, remove blocos rubric da perspectiva de aluno e corrige a simulação no servidor após o envio.
A ação isolada preview_assessment exige owner/professor atribuído antes de consultar dados. Recusa versões stale, módulo/item/opção alheios e respostas duplicadas/incompletas. Só faz leituras; não gera matrícula, sessão, tentativa, evidência, nota persistente, evento de conclusão ou certificado.
Professor autorizado e editor mantêm o material necessário ao papel; alunos reais não recebem Draft.

## Testes e ambiente

- **247/247 testes**, incluindo os 221 anteriores e os 189 históricos; 26 testes novos de importação, tamper, Markdown/XSS, navegação, versões, limiares e endpoints de preview com autorização positiva/negativa.
- Check, lint, typecheck, secret scan e diff check aprovados.
- Oito suites SQL com rollback: curriculum_draft_rls; editorial; certification/assessment; evidence; cycle; foundation; progression; leadership.
- Exercitados 3/5→retry 4/5, 13/20→retry 14/20, E01–E09, IE30/E10, snapshots, idempotência, elegibilidade, RLS e bloqueio de publicação não revisada.
- Zero fixtures residuais PR3–PR6, zero matrículas/sessões/certificados IE e zero aprovações editoriais. Os registros Draft reais da importação são intencionais.
- Hashes SQL antes/depois idênticos: questões v1 `f63ea8b2e0faf4159cb528d8ee148fd0`; alternativas v1 `68b6e1548bd4fbe20bb1221639ac9be7`; conteúdo de Liderança `7bdd220da6c79968983230afca18ab23`.

O projeto vc-core-homolog estava INACTIVE e foi reativado no mesmo banco; depois ACTIVE_HEALTHY.
O bundle remoto learner v21 foi comparado arquivo a arquivo com o head anterior, sem drift.
Learner-v2 **v22 ACTIVE** contém a correção de preview; verify_jwt=false/autenticação própria preservados. Admin v10 e professor v14 não foram reimplantados.
**Nenhuma migration criada/aplicada/reaplicada**: a importação é seed DML transacional. Ledger permanece em `20261018185426`.
Liderança, direitos, pagamentos e certificados existentes não foram alterados.

## Browser, autenticação e entrega

**NÃO TESTADO:** a revisão visual de 390 px/desktop no novo deployment e o fluxo autenticado real. A Vercel redirecionou a prévia para login; o navegador não tinha sessão autorizada disponível. Uma tentativa local da fixture encontrou ERR_CONNECTION_REFUSED, pois este navegador não alcançou o servidor local. Não foram desativadas proteções, criadas credenciais ou gerados bypasses. O servidor local de teste foi encerrado.

Os testes automatizados de DOM/Markdown, navegação e CSS não são apresentados como screenshot ou homologação mobile real. O teste visual de 18/10 era de uma fixture anterior e não homologa estas 50 aulas.
A fixture `tests/universidade-curriculum-preview.html` contém somente texto hipotético, sem aulas/questões oficiais ou API acadêmica.
Homologação autenticada real de aluno/professor/owner e mobile integral não pode ser declarada com base em fixtures HTTP/SQL.

Arquivos alterados: renderer/CSS; avaliação/preview frontend; learner/assessment-api; package.json; fixture SQL do banco v1; este relatório.
Arquivos novos: importador/template SQL; mapeamento; achados editoriais; auditoria de acesso bibliográfico; testes unitários/HTTP/SQL e fixture visual.
GitHub Actions run 41237299341 passou e a Vercel ficou READY no commit de implementação 1a0aa1758645fa77279025203c19dc192e989283. O SHA final após este registro documental, os checks e o link do PR são apresentados na entrega e no histórico Git.

Veredito: integração técnica em Draft concluída com ressalvas; publicação/homologação acadêmica e QA autenticado/visual permanecem bloqueados pelos gates documentados.

**Gate seguinte:** homologar academicamente aulas, seis revisões, feedback, referências/classificações, carga horária e ajustes documentados; executar fluxo autenticado e mobile integral. Retomar esta mesma branch.
**Não houve merge, publicação acadêmica, checkout, matrícula comercial, certificado IE ou QR.**
