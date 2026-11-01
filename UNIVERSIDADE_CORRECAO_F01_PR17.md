# PR #17 — Correção F01 das candidatas — 01/11/2026

**F01 corrigido no pacote candidato, com conservação da numeração funcional e ressalvas documentais explícitas. Importação formal continua não autorizada.** Nenhuma revisão 3 permaneceu no banco; nenhum merge, publicação, ativação de questão, venda ou certificado IE.

## Origem e escopo

Branch existente `feat/ie-course-official-curriculum`, PR #17 Draft. Head inicial local/remoto confirmado: `072d940bba258e0d3be689af25d7f6c0dbcf6446`; workspace inicialmente limpo. Lidos comando F01, parecer Rev3, decisão das 50 aulas por hash e checklist funcional. Os 50 hashes das candidatas recebidas conferem com a decisão. Recebidos 36 aceites condicionais de formatação, cinco didáticos condicionais e nove AJUSTAR; nenhum foi convertido em aprovação para persistência/publicação.

A normalização anterior removeu indevidamente números de passos e quantidades. A correção mantém índices narrativos removidos, mas restaura números que identificam protocolos, formulários, escalas, perguntas ou quantidades. Todas as 50 aulas foram confrontadas com a rev2; **14 candidatas mudaram, 36 permanecem byte a byte iguais às candidatas anteriormente avaliadas**. Os textos persistidos rev1/rev2 não foram editados.

## Alterações mínimas por candidata

| Aula | Correção |
|---|---|
| M02-A02 | “Eliminaremos” substituído por orientação ao estudante. Referência delimitada como revisão de escopo com 98 artigos, sem alegar 98 experimentos de validação. |
| M02-A03 | Preservadas as identificações 3/10, 5/10, 7/10 e 9/10 em subtítulos funcionais. |
| M03-A05 | Restituídos os 11 tópicos numerados existentes em E03, sem criar tópicos ausentes. |
| M04-A03 | Restituídas as quantidades 3 sinais internos, 3 elementos externos e 1 pergunta. |
| M04-A04 | PAUSA Express 1–5, quantidade de 10 segundos e identificadores da escala didática preservados. |
| M05-A04 | Regra 1–2–3 restaurada: observar, ajustar, escalonar. |
| M06-A05 | Campos E06 FIR–REAL 1–14 restaurados. |
| M07-A03 | Espelho de Precisão 1–4 restaurado. |
| M08-A03 | Ciclo de reparação 1–6 restaurado. |
| M09-A03 | Seis perguntas do DECIDE Express restauradas. |
| M10-A01 | Voz de bastidor revista; comparação de exemplos descrita como autorreflexão qualitativa, sem soma de notas, nível psicométrico ou percentual de evolução. |
| M10-A02 | Escala de frequência 1–5 e quantidade de 28 itens restauradas; sem converter autorrelato em instrumento clínico. |
| M10-A03 | Quantidades de dias/padrões/antecedentes/estratégias preservadas; “Nunca mostraremos...” substituído por orientação contextual ao estudante. |
| M10-A04 | Sete perguntas da revisão semanal restauradas. |

Inventário SHA-256 pai rev2 → candidata avaliada → candidata corrigida: `audits/ie-curriculum-f01-audit.json`. Manifesto privado inclui bytes, origem, decisão recebida e novo hash. O diff F01 limita-se às intervenções acima; as melhorias didáticas condicionais e as cinco questões propostas foram preservadas.

### Divergências nas referências do parecer

O checklist chama E03 de sequência 1–13. A rev2 apresenta **11 tópicos**, e o schema protegido contém **12 campos** agrupados em duas seções. Restaurar numeração não autoriza inventar itens 12/13 nem equiparar roteiro didático e formulário. Essa correspondência exige decisão acadêmica específica; o pacote registra a discrepância.

A frase “Nunca mostraremos número sem interpretação” ocorre em **M10-A03**, não em M10-A01. A frase foi corrigida no local real, e M10-A01 recebeu sua revisão própria de voz e limites da autorreflexão.

O [resumo primário de Ozomaro et al.](https://pubmed.ncbi.nlm.nih.gov/40816203/), DOI `10.1016/j.jpsychires.2025.08.008`, identifica 98 artigos revisados por pares. A candidata distingue esse inventário de demonstração causal ou validação de ferramenta V&C. A conferência do resumo não equivale a leitura integral, avaliação crítica ou homologação científica do curso. As 46/66 entradas pendentes continuam pendentes.

## Renderização e acessibilidade

As 50 candidatas passaram pelo renderer existente `assets/js/universidade-content.js`, sem alteração da aplicação, em DOM instrumentado. As **81 identificações numéricas funcionais/quantitativas** conferem com o inventário de origem. Na apresentação local, H1 identifica o documento de QA, H2 a aula, e o renderer desloca os títulos Markdown para H3–H6; passos funcionais ficam subordinados às seções.

As cinco tabelas renderizadas mantêm `th scope=col`, região de rolagem nomeada e foco por teclado. O CSS existente limita a região e permite quebra/rolagem. Isso é verificação de estrutura e código, não prova de layout, leitura por tecnologia assistiva ou ausência de overflow real.

Pacote privado: HTML local de QA sem backend/persistência e duas provas tipográficas inspecionadas, com largura de 390 e 1100 pixels. As imagens são documentos de apoio, **não capturas do site**. A revisão visual autenticada em produção continua **NÃO TESTADA**. Nesta retomada o inventário do navegador não apresentou sessão/aba disponível; o bloqueio de login registrado anteriormente não foi contornado. Nenhum fluxo real aluno/professor/owner foi declarado aprovado.

## Dry-run e integridade

Novo emissor `scripts/universidade-curriculum-candidate-dryrun.mjs/.sql` aceita somente o manifesto privado fixado por SHA, confere origem/bytes/conteúdo/numeração e **não possui modo COMMIT**. Exige os pais Draft rev2 no curso/versão canônicos. Texto entra como JSON, com bloqueio de delimitadores SQL. Não toca questões, notas, tentativas ou decisões editoriais.

Execução autorizada em homologação: 50 aulas/blocos rev3 **temporários**, duas passagens na mesma transação sem duplicação, encerrada em ROLLBACK. Teste negativo de hash de pai adulterado recusado com `candidate_parent_or_payload_changed`. Não reaplicar como importação. Os IDs de simulação não conferem aprovação futura.

Hashes MD5 agregados de linhas, antes = depois da simulação:

| Conjunto | Hash preservado |
|---|---|
| Todas as revisões de aula | `756a1f893bfaa82f96d351226118aada` |
| Todos os blocos | `a29c00fdfba7764aed8f60322b4cab64` |
| Todas as questões, inclusive seis v2 | `572642784cf6b3575b1afe9ea3fe14b1` |
| Todas as alternativas/feedbacks | `21655ebd654c3d67db24e6e6bcc8ea33` |
| Requisitos | `a964a44576f27c1b0a963b3b8772631d` |
| Versão IE30 | `8c6af985c9354b94b3620c83f5170c82` |

Pós-rollback: **zero aula rev3, 100 blocos históricos, 76 versões de questão e zero aprovações editoriais IE**. Nenhum dado de aluno real ou fixture de usuário foi criado pelo dry-run. Os testes reversíveis de saneamento/RLS e progressão legada Liderança também passaram.

## Quality gate e pendências

**266/266 testes**: 259 anteriores e sete novos, cobrindo perda de numeração mesmo com hash recalculado, adulteração de bytes/pai, escopo, duplicidade, rollback obrigatório e delimitadores. Check, lint, typecheck, secret scan e diff check aprovados. Nenhuma migration ou função Edge alterada/implantada; motor 30/45, 70 v1, seis v2, histórico e Liderança preservados.

Plano de carga candidata recalculado apenas pela hipótese de leitura: **1.126 minutos estimados**, sem piloto ou medição humana. Não comprova 20h. Bibliografia/direitos, docente/competência/dificuldade/pré-teste, QA autenticado 390px/desktop e materiais independentes continuam pendentes. As cinco questões rev3 permanecem propostas privadas favoráveis apenas a pré-teste; M02-Q05 v2 continua inativa.

Arquivos Git alterados: emissor `.mjs/.sql`, sete testes em `tests/universidade-curriculum-candidate.test.mjs`, inventário `audits/ie-curriculum-f01-audit.json`, `package.json`, este relatório e aviso de continuidade no relatório Rev3. Nenhum texto-mestre, gabarito ou feedback privado foi publicado no repositório/site.

O pacote de retorno contém os 50 arquivos candidatos, com 14 alterações identificadas, manifesto de três hashes, diff mínimo, inventário funcional, decisão recebida, QA documental e pendências. A gestão pode conferir apenas as diferenças e deliberar sobre futura importação Draft em gate separado. **F01 corrigido tecnicamente; aceite acadêmico e importação ainda pendentes.** O SHA final e os checks desse commit são registrados no PR e na entrega; nenhum merge realizado.
