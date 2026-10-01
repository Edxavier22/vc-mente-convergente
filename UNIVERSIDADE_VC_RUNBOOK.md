# Universidade V&C — ativação controlada

Estado verificado em 29/09/2026. Este documento separa código, banco, funções remotas, preview e produção. Os PRs #5 (`feature/universidade-administracao`) e #6 (`feature/universidade-certificacao`) permanecem como **Draft**, sem merge. A produção continua vinculada à `main`.

## Estrutura acadêmica ativa

- O site institucional, catálogo, portal, sala do aluno, professor e administração permanecem no mesmo projeto Vercel.
- O modelo persistente inclui cursos versionados, módulos, organizações, turmas, matrículas, professores, questões, tentativas, progresso, eventos e certificados.
- Conteúdo completo, respostas e gabaritos permanecem fora dos arquivos públicos.
- A progressão exige evidência válida e checkpoint aprovado; a avaliação final exige todos os módulos e registra tentativas no servidor.
- O conteúdo Liderança 1.1, seus 50 itens formativos e banco ampliado da avaliação final estão ativos no ambiente acadêmico.
- O painel do professor usa escopo por turma; o administrador proprietário continua separado e validado no backend.

## Fase 11 — conclusão e certificação verificável

- Migration `20260928201649_universidade_certificacao_verificavel.sql` aplicada com sucesso.
- Emissão exige, no banco e na API: todos os módulos, todas as evidências, todos os checkpoints, avaliação final igual ou superior ao mínimo e aprovação do projeto quando configurada.
- O banco bloqueou uma tentativa privilegiada de emissão para matrícula incompleta; nenhum certificado de teste foi persistido.
- Cada certificado recebe código `VC-<PREFIXO>-<ANO>-<SEQUÊNCIA>`, snapshots acadêmicos imutáveis, programa, resultado, período, emissor e URL de validação.
- A tabela de certificados está com RLS ativa e sem leitura para `anon` ou `authenticated`; a consulta pública passa por função limitada e retorna somente autenticidade, nome, curso, carga, conclusão, emissor e código.
- O certificado autenticado possui frente e segunda página programática, QR Code e impressão/salvamento em PDF pelo navegador.
- Certificados já emitidos permanecem verificáveis mesmo que o curso seja atualizado, pois título, versão, carga e programa são snapshots.
- Funções remotas ativas após as correções incrementais: `vc-universidade-learner-v2` v12, `vc-universidade-admin` v4, `vc-certificado-publico` v1 e `vc-universidade-empresa` v1.
- Código inexistente retorna 404 sem expor dados; rota acadêmica sem sessão retorna 401.

## Verificações concluídas

- 43 testes automatizados aprovados, sem falhas.
- `git diff --check` aprovado.
- CORS validado no domínio oficial e nos previews versionados; origens externas não são refletidas.
- RLS, ausência de grants públicos e prefixo `LEA` conferidos no banco.
- Advisors sem alertas de nível `ERROR` após a migration.
- O advisor mantém um aviso de configuração: proteção contra senhas vazadas ainda precisa ser habilitada manualmente no Supabase Auth.

## Estado real dos dados

- Uma matrícula existente.
- Um módulo concluído no momento da auditoria.
- Nenhuma avaliação final registrada.
- Nenhum projeto final aprovado.
- Nenhum certificado emitido.

Esses dados confirmam que a nova camada não certificou o administrador ou qualquer aluno artificialmente.

## Gates ainda abertos

1. Homologar visualmente as páginas de validação e certificado em desktop e celular no preview da Fase 11. A tentativa local automatizada ficou bloqueada pela indisponibilidade do binário Chrome no executor, não por erro da aplicação.
2. Confirmar o PR #6 como Draft e preservar o PR #5 sem merge até o término da homologação.
3. Repetir no navegador autenticado: aluno, professor e administração após a correção de CORS.
4. Percorrer M1–M10 com conta de homologação, aprovar avaliação e projeto e emitir o primeiro certificado de homologação; conferir QR, impressão e validação pública.
5. Definir razão social/CNPJ ofertante e responsável nominal antes da primeira emissão comercial. Enquanto não definidos, esses dados não são inventados.
6. Habilitar proteção contra senhas vazadas no painel do Supabase Auth.

## Fase 12 — arquitetura B2C/B2B

- A Universidade reutiliza `vc_organizations`, `vc_memberships`, `vc_seat_pools` e `vc_seat_assignments`; não foi criado um cadastro corporativo paralelo.
- Turmas distinguem B2C/B2B, modalidade Individual/Profissional/Empresarial e entrega on-line/presencial/híbrida.
- Matrículas empresariais podem ser vinculadas a uma vaga canônica, e o banco bloqueia sobrelotação de turma mesmo sob concorrência.
- O gestor corporativo precisa ter membership ativa com papel `owner`, `admin` ou `manager`.
- O painel empresarial entrega somente participantes, início, progresso, conclusão, avaliação agregada e certificação consolidada.
- Turmas abaixo do grupo mínimo configurado (padrão 5) têm indicadores acadêmicos suprimidos para evitar identificação indireta.
- Evidências, respostas, reflexões, comentários, conceitos de revisão e histórico individual não fazem parte da resposta corporativa.
- Migration principal e migration de índices aplicadas; testes transacionais foram revertidos e não deixaram dados fictícios.
- `vc_university_corporate_reports` possui RLS, nenhuma leitura para `anon`/`authenticated` e grants explícitos somente para o serviço.
- Advisors sem chaves estrangeiras desindexadas após a correção. Avisos de índices ainda não utilizados são esperados em tabelas novas/vazias.

## Produção e comunicação comercial

Não fazer merge, cobrança real ou abertura comercial antes da homologação autenticada completa. A página pública pode apresentar a formação, mas checkout, certificado comercial e inscrições devem permanecer fechados até os gates acima serem aprovados.

## Fase 13 — formação para empresas e propostas

- Página empresarial própria com escopo, entregas, privacidade e processo de contratação.
- Formulário envia a solicitação para uma Edge Function controlada; não abre aplicativos externos e não cria cobrança ou contrato.
- Cada solicitação recebe protocolo `VC-PROP-ANO-SEQUÊNCIA`, chave de idempotência e trilha de eventos.
- Validação no servidor, honeypot, limite de tamanho e até cinco solicitações por impressão anonimizada a cada hora.
- Dados de contato, contexto e proposta ficam em tabelas com RLS, sem leitura para `anon` ou `authenticated`.
- Campos originais da solicitação são imutáveis; apenas situação comercial e referências de integração podem evoluir.
- Administração proprietária recebe fila de propostas e transições válidas auditadas.
- Orça Fácil e ConfirmaPro estão registrados apenas como destinos planejados. O estado inicial é `not_connected`; nenhum orçamento, aceite ou link externo é criado automaticamente.
- Aviso de privacidade informa finalidade, acesso, retenção inicial e canal para exercício de direitos.
- Migration `universidade_formacao_empresas_propostas` aplicada no projeto de homologação.
- Funções remotas ativas: `vc-universidade-propostas` v1 e `vc-universidade-admin` v5.
- Teste remoto confirmou CORS do preview, bloqueio de origem externa, honeypot, criação com protocolo e bloqueio sem sessão administrativa.
- Dados de homologação removidos após o teste: zero solicitações artificiais e zero eventos órfãos.
- Suíte local ampliada para 50 testes, todos aprovados; TypeScript das duas funções validado pelo Deno.

### Gate da Fase 13

Antes de produção: publicar a branch em preview, conferir a página em desktop/celular e confirmar com sessão proprietária que a fila recebe e movimenta uma solicitação controlada. A inspeção visual automática local ficou indisponível porque o daemon do navegador não iniciou.
