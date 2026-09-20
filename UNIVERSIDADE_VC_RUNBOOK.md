# Universidade V&C — ativação controlada

Estado verificado em 20/09/2026. Este documento distingue código na branch, ambiente remoto e validação. O PR da branch `feature/universidade-multicursos` permanece sem merge.

## Implementado na branch

- O mesmo site institucional contém o catálogo público e a sala do aluno; não foi criado outro site.
- O modelo persistente inclui cursos, módulos, turmas, organizações, matrículas, professores, questões, tentativas de checkpoint e avaliação, progresso, eventos e certificados. As tabelas acadêmicas têm RLS e acesso de escrita pelo navegador revogado.
- A API privada `vc-universidade-learner-v2` verifica identidade, direito no V&C Core e matrícula ativa antes de ler conteúdo. Aceita `course=<slug>` e vincula o direito ao `product_id` do curso; o padrão sem parâmetro continua Liderança. A exceção de acesso do proprietário aplica-se somente a Liderança/P-021 e exige identidade, e-mail confirmado, escopo administrativo no Core e matrícula ativa.
- Módulos seguintes dependem da conclusão persistida do anterior; evidência e cinco respostas do checkpoint são corrigidas no servidor. O banco tem um gatilho adicional que exige evidência, tentativa aprovada e sequência para registrar conclusão.
- A sala v2 usa a nova API, com estados de acesso, entrega de evidência e checkpoint. O conteúdo completo e os gabaritos não ficam em arquivos públicos.

## Situação remota e bloqueios

- A função publicada ainda é a versão **4**: a correção do acesso proprietário e a seleção multicursos da branch não estão implantadas. A revisão automática rejeitou a implantação por **limite de uso até 24/09/2026 às 19h36**; informou que não avaliou a segurança da ação. Não tentar publicar por outro caminho para contornar a revisão.
- O curso está em `review`; o produto P-021 em `development`; a oferta de R$147 em `draft`, com `commerce_enabled=false`. O valor não foi alterado.
- Os 18 testes locais passam, mas **M1 → evidência → checkpoint → M2 não foi homologado no navegador com conta autenticada**. Testes simulados não substituem essa verificação.
- O fluxo legado `vc-universidade-course` ainda existe, inclusive avaliação antiga corrigida no navegador. Planejar desligamento ou redirecionamento seguro após a migração das dependências; não usar o fluxo legado como prova de conclusão oficial.
- Avaliação final de 20 questões, registro e revisão do projeto, regras de conclusão, emissão e validação pública do certificado, painel premium do professor e administração, fluxo empresarial, pagamentos e integração Orça Fácil/ConfirmaPro continuam pendentes ou sem homologação.

## Sequência de retomada

1. Quando a revisão automática permitir, implantar somente a função revisada e confirmar a versão publicada. Não alterar pagamento, domínio ou curso publicado nesse passo.
2. Homologar em conta autorizada, com captura de respostas/status e registros persistidos: M1 aberto, evidência válida, checkpoint sem gabarito exposto, M2 bloqueado antes e liberado depois. Testar anônimo e usuário sem direito/matrícula.
3. Completar e testar percurso M1–M10, banco e avaliação final, projeto, fila docente, emissão e consulta pública de certificado com dados mínimos. Verificar RLS com perfis separados e dispositivos móveis.
4. Homologar as modalidades comercial e empresarial, pagamento sandbox, webhook, conciliação, cancelamento e suporte. Cobrança real, mudança destrutiva e publicação comercial irreversível exigem autorização do proprietário.

## Comunicação enquanto o gate está fechado

A página pública pode ser usada para apresentar a proposta em preparação. Não anunciar inscrições abertas, compra disponível, certificação automática ou data garantida enquanto as etapas acima não estiverem homologadas.
