# Universidade V&C — ativação controlada

Estado verificado em 29/09/2026. Este documento separa código, banco, funções remotas, preview e produção. O PR #5 da branch `feature/universidade-administracao` permanece como **Draft**, sem merge. A produção continua vinculada à `main`.

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
- Funções remotas ativas: `vc-universidade-learner-v2` v11, `vc-universidade-admin` v2 e `vc-certificado-publico` v1.
- Código inexistente retorna 404 sem expor dados; rota acadêmica sem sessão retorna 401.

## Verificações concluídas

- 39 testes automatizados aprovados, sem falhas.
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

1. Aplicar o patch da Fase 11 em uma branch baseada em `feature/universidade-administracao`, publicar o preview e manter os PRs sem merge.
2. Homologar visualmente as páginas de validação e certificado em desktop e celular no preview. A tentativa local automatizada ficou bloqueada pela indisponibilidade do binário Chrome no executor, não por erro da aplicação.
3. Repetir no navegador autenticado: aluno, professor e administração após a correção de CORS.
4. Percorrer M1–M10 com conta de homologação, aprovar avaliação e projeto e emitir o primeiro certificado de homologação; conferir QR, impressão e validação pública.
5. Definir razão social/CNPJ ofertante e responsável nominal antes da primeira emissão comercial. Enquanto não definidos, esses dados não são inventados.
6. Habilitar proteção contra senhas vazadas no painel do Supabase Auth.

## Produção e comunicação comercial

Não fazer merge, cobrança real ou abertura comercial antes da homologação autenticada completa. A página pública pode apresentar a formação, mas checkout, certificado comercial e inscrições devem permanecer fechados até os gates acima serem aprovados.
