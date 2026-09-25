# Universidade V&C — ativação controlada

Estado verificado em 25/09/2026. Este documento distingue código na branch, ambiente remoto e validação. O PR da branch `feature/universidade-multicursos` permanece sem merge.

## Implementado na branch

- O mesmo site institucional contém o catálogo público e a sala do aluno; não foi criado outro site.
- O modelo persistente inclui cursos, módulos, turmas, organizações, matrículas, professores, questões, tentativas de checkpoint e avaliação, progresso, eventos e certificados. As tabelas acadêmicas têm RLS e acesso de escrita pelo navegador revogado.
- A API privada `vc-universidade-learner-v2` verifica identidade, direito no V&C Core e matrícula ativa antes de ler conteúdo. Aceita `course=<slug>` e vincula o direito ao `product_id` do curso; o padrão sem parâmetro continua Liderança. A exceção de acesso do proprietário aplica-se somente a Liderança/P-021 e exige identidade, e-mail confirmado, escopo administrativo no Core e matrícula ativa.
- Módulos seguintes dependem da conclusão persistida do anterior; evidência e cinco respostas do checkpoint são corrigidas no servidor. O banco tem um gatilho adicional que exige evidência, tentativa aprovada e sequência para registrar conclusão.
- A sala v2 usa a nova API, com estados de acesso, entrega de evidência e checkpoint. O conteúdo completo e os gabaritos não ficam em arquivos públicos.
- A branch contém o fluxo de avaliação final com 20 questões, bloqueio até concluir os módulos, correção no servidor e registro de tentativas. Ainda não há questões finais ativas no banco; a API responde `final_unavailable` até o banco ser preparado e homologado.

## Conteúdo pedagógico 1.1 — candidato controlado

- Os dez módulos foram aprofundados e estruturados em fonte privada com abertura, objetivos, cinco núcleos de estudo, conceitos, Princípio V&C, exemplo, caso, erros comuns, aplicação, estudo guiado, reflexão, oficina, evidência, preparação para checkpoint, síntese e referências.
- A versão `1.1` foi gravada como linha separada em `vc_university_course_content`; a versão `1.0` permanece preservada e continua ativa no curso.
- A matriz de 20 horas foi registrada como estimativa pedagógica: 7h de conteúdo/estudo, 3h de casos/checkpoints, 6h de oficinas/evidências, 3h de projeto e 1h de avaliação/revisão. Não há timer artificial de página.
- O conteúdo pago não foi incluído no repositório público. O GitHub contém somente renderizador, estilos, testes e este contrato editorial.
- Hash SHA-256 do JSON privado candidato 1.1: `f2a9deba76b42717e6ef285c0e00c35036b2e59ba1f3b165d95b26367c6b3c39`.
- Não promover o curso para `1.1` antes de o commit do renderizador chegar ao preview e a sala autenticada ser validada em desktop e celular.

## Situação remota e bloqueios

- A função `vc-universidade-learner-v2` está publicada na versão **6** e seu código confere com a fonte versionada. O bloqueio temporário anterior de implantação foi superado sem migração para outro projeto Supabase.
- O curso está em `review`; o produto P-021 em `development`; a oferta de R$147 em `draft`, com `commerce_enabled=false`. O valor não foi alterado.
- Os 23 testes locais passam, mas **M1 → evidência → checkpoint → M2 e o conteúdo candidato 1.1 ainda precisam de homologação final no navegador com conta autenticada**. Testes simulados não substituem essa verificação.
- O fluxo legado `vc-universidade-course` ainda existe, inclusive avaliação antiga corrigida no navegador. Planejar desligamento ou redirecionamento seguro após a migração das dependências; não usar o fluxo legado como prova de conclusão oficial.
- Banco da avaliação final, registro e revisão do projeto, regras de conclusão, emissão e validação pública do certificado, painel premium do professor e administração, fluxo empresarial, pagamentos e integração Orça Fácil/ConfirmaPro continuam pendentes ou sem homologação.

## Sequência de retomada

1. Aplicar o commit da Fase 5 na branch e aguardar o preview Vercel aprovado, mantendo o PR em Draft.
2. Homologar em conta autorizada, com captura de respostas/status e registros persistidos: M1 aberto, evidência válida, checkpoint sem gabarito exposto, M2 bloqueado antes e liberado depois. Testar anônimo e usuário sem direito/matrícula.
3. Validar a apresentação do conteúdo 1.1 em desktop e celular; somente depois atualizar a versão ativa do curso de `1.0` para `1.1`, mantendo rollback imediato.
4. Completar e testar percurso M1–M10, banco e avaliação final, projeto, fila docente, emissão e consulta pública de certificado com dados mínimos. Verificar RLS com perfis separados e dispositivos móveis.
5. Homologar as modalidades comercial e empresarial, pagamento sandbox, webhook, conciliação, cancelamento e suporte. Cobrança real, mudança destrutiva e publicação comercial irreversível exigem autorização do proprietário.

## Comunicação enquanto o gate está fechado

A página pública pode ser usada para apresentar a proposta em preparação. Não anunciar inscrições abertas, compra disponível, certificação automática ou data garantida enquanto as etapas acima não estiverem homologadas.
