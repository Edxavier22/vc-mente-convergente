# Universidade V&C — auditoria incremental das fases 1 a 7

Data de corte: 25 de setembro de 2026.

Este registro não autoriza merge, venda, cobrança ou publicação em produção.

## Estado por fase

| Fase | Estado verificável | Critério pendente |
| --- | --- | --- |
| 1 — auditoria e segurança | Base, autenticação, RLS, APIs, migrations e funções inventariadas; PR isolado em rascunho | Ativar proteção contra senhas vazadas no painel de Auth, se disponível no plano |
| 2 — arquitetura multicursos | Cursos, produtos, turmas, organizações, matrículas, professores e versões separados por identificadores | Homologar um segundo curso somente quando houver conteúdo real |
| 3 — modelo de dados e progressão | Evidência, checkpoint, ordem dos módulos, tentativas e auditoria persistentes | Executar novamente a jornada autenticada após cada ativação de conteúdo |
| 4 — redesign premium | Catálogo, sala, hierarquia pedagógica, acessibilidade e responsividade implementados | Homologação visual autenticada em desktop e celular |
| 5 — conteúdo aprofundado | Conteúdo privado v1.1 com 10 módulos e referências estruturadas | Revisão editorial humana e ativação controlada da v1.1 |
| 6 — ferramentas visuais | RADAR e FOCO interativos, com exemplo, exercício e envio à evidência | Homologação visual autenticada |
| 7 — Checkpoint V&C | 50 questões v1.1: cinco por módulo, sendo duas conceituais, duas práticas e uma de decisão | Jornada autenticada completa M1 → M10 |

## Correções desta auditoria

- matrícula passou a fixar a versão acadêmica usada pelo aluno;
- conteúdo v1.1 permanece separado da matrícula v1.0 existente;
- carga dos módulos passou a representar 19 horas pedagógicas, reservando uma hora para avaliação e revisão, sem cronômetro de página;
- verificador de direito deixou o schema público exposto e passou ao schema privado;
- índices foram adicionados para os caminhos acadêmicos de matrícula, progressão, revisão e questões;
- painel do professor passou a ler as tabelas multicursos de progresso e avaliação;
- nota da prova deixou de ser exibida como `/10` e respeita o total de 20 questões;
- banco de checkpoints v1.1 foi criado sem ativar a nova versão do curso.

## Barreiras de publicação preservadas

- curso permanece em `review` e versão corrente `1.0`;
- conteúdo integral continua em tabela privada, sem grant ao navegador;
- gabaritos continuam restritos ao servidor;
- PR deve continuar em `Draft` até a homologação autenticada;
- produção comercial e cobrança continuam desativadas;
- certificados ainda não devem ser emitidos.

## Próxima validação obrigatória

Auditar e preparar o banco da avaliação final v1.1 com mais de 20 questões, ativar somente 20 por prova conforme regra controlada e homologar reprovação, revisão, nova tentativa e aprovação mínima de 70%. Depois, concluir os gates de projeto final e certificado.
